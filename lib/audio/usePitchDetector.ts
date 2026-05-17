"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import { DEFAULT_A4_HZ, freqToMidi, midiToNoteName, midiToPitchClass } from "../music/notes";
import { computeChroma } from "./chroma";
import { radix2FFT } from "./fft";
import { octaveCorrect } from "./octaveCorrect";
import { extractHarmonics, normalizeHarmonics } from "./timbre";

const NUM_HARMONICS = 8;

export type DetectedNote = {
  midi: number;
  noteName: string;
  pitchClass: number;
  frequency: number;
  clarity: number;
  at: number;
  durationMs: number;
  endAt: number;
};

export type PitchDetectorConfig = {
  minFreq: number;
  maxFreq: number;
  minClarity: number;
  minRms: number;
  framesToConfirm: number;
  a4Hz: number;
  highPass: boolean;
  highPassHz: number;
  polyphonic: boolean;
  silenceFramesToRelease: number;
};

export const DEFAULT_CONFIG: PitchDetectorConfig = {
  minFreq: 70,
  maxFreq: 1400,
  minClarity: 0.9,
  minRms: 0.01,
  framesToConfirm: 3,
  a4Hz: DEFAULT_A4_HZ,
  highPass: true,
  highPassHz: 80,
  polyphonic: false,
  silenceFramesToRelease: 10,
};

const STORAGE_KEY = "guitarmode:detector-config:v1";

const FRAME_SIZE = 2048;
const HOP_SIZE = 1024;

// Frames needed to calibrate the adaptive noise gate (~1 s at 44.1 kHz / 1024 hop)
const CALIB_FRAMES = 43;
// Multiplier over baseline RMS to use as the onset gate
const CALIB_MULTIPLIER = 3;
// When a note is active, require RMS to fall below this fraction of minRms before releasing
const HYSTERESIS_RATIO = 0.5;
// While a note is active, accept lower clarity to avoid truncating sustained
// notes whose YIN clarity momentarily dips (vibrato, string noise, bow noise).
const CLARITY_HYSTERESIS_RATIO = 0.85;
// Spectral-flux onset: accept a note after 1 frame when band-flux exceeds this
const ONSET_FLUX_THRESHOLD = 0.015;

/** Bandwise RMS flux: compares 4 equal sub-bands between current and previous frame. */
function computeFlux(frame: Float32Array, prev: Float32Array): number {
  const band = frame.length >> 2;
  let flux = 0;
  for (let b = 0; b < 4; b++) {
    const off = b * band;
    let e = 0, ep = 0;
    for (let i = 0; i < band; i++) {
      e += frame[off + i] * frame[off + i];
      ep += prev[off + i] * prev[off + i];
    }
    const diff = Math.sqrt(e / band) - Math.sqrt(ep / band);
    if (diff > 0) flux += diff;
  }
  return flux;
}

export function usePitchDetector(initial: Partial<PitchDetectorConfig> = {}) {
  const [config, setConfigState] = useState<PitchDetectorConfig>({
    ...DEFAULT_CONFIG,
    ...initial,
  });
  const [active, setActive] = useState(false);
  const [currentNote, setCurrentNote] = useState<DetectedNote | null>(null);
  const [level, setLevel] = useState(0);
  const [notes, setNotes] = useState<DetectedNote[]>([]);
  const [chromaProfile, setChromaProfile] = useState<number[]>(() => Array(12).fill(0));
  const [harmonics, setHarmonics] = useState<number[]>(() => Array(NUM_HARMONICS).fill(0));

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  // Fallback path when AudioWorklet is unavailable
  const analyserFallbackRef = useRef<AnalyserNode | null>(null);
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sinkRef = useRef<GainNode | null>(null);
  const detectorRef = useRef<PitchDetector<Float32Array<ArrayBuffer>> | null>(null);

  const fftReRef = useRef<Float32Array | null>(null);
  const fftImRef = useRef<Float32Array | null>(null);
  const freqDbRef = useRef<Float32Array | null>(null);

  const cfgRef = useRef<PitchDetectorConfig>(config);
  cfgRef.current = config;

  const activeMidiRef = useRef<number | null>(null);
  const activeStartRef = useRef<number>(0);
  const activeEndRef = useRef<number>(0);
  const activeFreqRef = useRef<number>(0);
  const activeClarityRef = useRef<number>(0);

  const candidateMidiRef = useRef<number | null>(null);
  const candidateCountRef = useRef(0);
  const silenceFramesRef = useRef(0);

  // Spectral-flux onset detection
  const prevFrameRef = useRef<Float32Array | null>(null);

  // Adaptive noise gate calibration. We collect per-frame RMS and take the
  // 25th percentile as the baseline — resilient to a user playing during
  // calibration, which would otherwise inflate the gate and mask quiet notes.
  const calibSamplesRef = useRef<number[]>([]);
  const adaptiveMinRmsRef = useRef<number | null>(null); // null = not yet calibrated

  const chromaAccumRef = useRef<number[]>(Array(12).fill(0));
  const chromaFrameCountRef = useRef(0);
  const chromaDirtyRef = useRef(false);
  const chromaFlushAtRef = useRef(0);
  const levelFlushAtRef = useRef(0);
  const harmonicVectorRef = useRef<number[]>(Array(NUM_HARMONICS).fill(0));
  const harmonicsDirtyRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setConfig = useCallback((patch: Partial<PitchDetectorConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...patch };
      const hp = highPassRef.current;
      if (hp) {
        hp.frequency.value = next.highPass ? next.highPassHz : 20;
      }
      return next;
    });
  }, []);

  // Hydrate persisted config on mount, then write-through on future changes.
  // Gated on a ref so the first write doesn't clobber storage before the read.
  const configHydratedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") {
      configHydratedRef.current = true;
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PitchDetectorConfig>;
        setConfigState((prev) => ({ ...prev, ...parsed }));
      }
    } catch (err) {
      console.warn("usePitchDetector: failed to read persisted config", err);
    }
    configHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!configHydratedRef.current || typeof window === "undefined") return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      } catch (err) {
        console.warn("usePitchDetector: failed to persist config", err);
      }
    }, 500);
  }, [config]);

  const finalizeActive = useCallback((endTime: number) => {
    const midi = activeMidiRef.current;
    if (midi == null) return;
    const start = activeStartRef.current;
    // Use the last frame where audio was present, not the release time — the
    // release is delayed by silenceFramesToRelease (~230ms) of post-decay silence
    // and would otherwise inflate every note's duration.
    const end = activeEndRef.current > 0 ? activeEndRef.current : endTime;
    const note: DetectedNote = {
      midi,
      noteName: midiToNoteName(midi),
      pitchClass: midiToPitchClass(midi),
      frequency: activeFreqRef.current,
      clarity: activeClarityRef.current,
      at: start,
      endAt: end,
      durationMs: Math.max(0, end - start),
    };
    setNotes((prev) => [...prev, note]);
    setCurrentNote(null);
    activeMidiRef.current = null;
  }, []);

  const processFrame = useCallback(
    (frame: Float32Array<ArrayBuffer>) => {
      const cfg = cfgRef.current;
      const ctx = audioContextRef.current;
      const detector = detectorRef.current;
      if (!ctx || !detector) return;
      const now = performance.now();

      // RMS
      let sumSq = 0;
      for (let i = 0; i < frame.length; i++) sumSq += frame[i] * frame[i];
      const rms = Math.sqrt(sumSq / frame.length);

      // Adaptive noise gate calibration (first CALIB_FRAMES frames)
      if (calibSamplesRef.current.length < CALIB_FRAMES) {
        calibSamplesRef.current.push(rms);
        if (calibSamplesRef.current.length === CALIB_FRAMES) {
          const sorted = calibSamplesRef.current.slice().sort((a, b) => a - b);
          const pIdx = Math.floor(sorted.length * 0.25);
          const baseline = sorted[pIdx];
          adaptiveMinRmsRef.current = Math.max(cfg.minRms, baseline * CALIB_MULTIPLIER);
        }
      }
      const effectiveMinRms = adaptiveMinRmsRef.current ?? cfg.minRms;

      // Release hysteresis: lower threshold while a note is active
      const releaseThreshold = activeMidiRef.current != null
        ? effectiveMinRms * HYSTERESIS_RATIO
        : effectiveMinRms;

      if (now - levelFlushAtRef.current > 66) {
        levelFlushAtRef.current = now;
        setLevel(rms);
      }

      // Spectral flux onset detection
      let onsetDetected = false;
      if (prevFrameRef.current) {
        onsetDetected = computeFlux(frame, prevFrameRef.current) > ONSET_FLUX_THRESHOLD;
      }
      if (!prevFrameRef.current || prevFrameRef.current.length !== frame.length) {
        prevFrameRef.current = new Float32Array(frame.length);
      }
      prevFrameRef.current.set(frame);

      const [rawFreq, clarity] = detector.findPitch(frame, ctx.sampleRate);

      // Octave-error correction on low notes
      const freq = octaveCorrect(frame, rawFreq, ctx.sampleRate, cfg.minFreq);

      // Onset bypasses multi-frame confirmation (1-frame accept)
      const confirmThreshold = onsetDetected ? 1 : cfg.framesToConfirm;

      const clarityThreshold =
        activeMidiRef.current != null ? cfg.minClarity * CLARITY_HYSTERESIS_RATIO : cfg.minClarity;
      const passes =
        rms >= (activeMidiRef.current != null ? releaseThreshold : effectiveMinRms) &&
        clarity >= clarityThreshold &&
        freq >= cfg.minFreq &&
        freq <= cfg.maxFreq;

      if (passes) {
        const midi = Math.round(freqToMidi(freq, cfg.a4Hz));
        silenceFramesRef.current = 0;

        if (midi === candidateMidiRef.current) {
          candidateCountRef.current += 1;
        } else {
          candidateMidiRef.current = midi;
          candidateCountRef.current = 1;
        }

        if (candidateCountRef.current >= confirmThreshold) {
          if (activeMidiRef.current === midi) {
            activeEndRef.current = now;
            activeFreqRef.current = freq;
            if (clarity > activeClarityRef.current) activeClarityRef.current = clarity;
          } else {
            if (activeMidiRef.current != null) finalizeActive(now);
            activeMidiRef.current = midi;
            activeStartRef.current = now;
            activeEndRef.current = now;
            activeFreqRef.current = freq;
            activeClarityRef.current = clarity;
            setCurrentNote({
              midi,
              noteName: midiToNoteName(midi),
              pitchClass: midiToPitchClass(midi),
              frequency: freq,
              clarity,
              at: now,
              endAt: now,
              durationMs: 0,
            });
          }
        }
      } else {
        // Only count silence frames when RMS drops below release threshold
        if (rms < releaseThreshold) {
          silenceFramesRef.current += 1;
        }
        if (
          silenceFramesRef.current >= cfg.silenceFramesToRelease &&
          activeMidiRef.current != null
        ) {
          finalizeActive(now);
          candidateMidiRef.current = null;
          candidateCountRef.current = 0;
        }
      }

      if (cfg.polyphonic && rms >= effectiveMinRms) {
        const fre = fftReRef.current!;
        const fim = fftImRef.current!;
        const fdb = freqDbRef.current!;
        for (let i = 0; i < frame.length; i++) {
          const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (frame.length - 1));
          fre[i] = frame[i] * w;
          fim[i] = 0;
        }
        radix2FFT(fre, fim);
        for (let k = 0; k < fdb.length; k++) {
          const mag = Math.sqrt(fre[k] * fre[k] + fim[k] * fim[k]) + 1e-12;
          fdb[k] = 20 * Math.log10(mag);
        }
        const c = computeChroma(fdb, ctx.sampleRate, cfg.a4Hz, cfg.minFreq, cfg.maxFreq);
        const accum = chromaAccumRef.current;
        for (let i = 0; i < 12; i++) accum[i] += c[i];
        chromaFrameCountRef.current += 1;
        chromaDirtyRef.current = true;

        // Harmonic envelope for the currently-active note — reuse freqDb
        // so we don't run a second FFT.
        if (activeMidiRef.current != null && activeFreqRef.current > 0) {
          const raw = extractHarmonics(fdb, ctx.sampleRate, activeFreqRef.current, NUM_HARMONICS);
          harmonicVectorRef.current = normalizeHarmonics(raw);
          harmonicsDirtyRef.current = true;
        }

        if (now - chromaFlushAtRef.current > 100) {
          chromaFlushAtRef.current = now;
          if (chromaDirtyRef.current) {
            const count = chromaFrameCountRef.current || 1;
            setChromaProfile(accum.map((v) => v / count));
            chromaDirtyRef.current = false;
          }
          if (harmonicsDirtyRef.current) {
            setHarmonics([...harmonicVectorRef.current]);
            harmonicsDirtyRef.current = false;
          }
        }
      }
    },
    [finalizeActive]
  );

  const initSharedNodes = (ctx: AudioContext, stream: MediaStream) => {
    const source = ctx.createMediaStreamSource(stream);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = cfgRef.current.highPass ? cfgRef.current.highPassHz : 20;
    hp.Q.value = 0.707;
    const sink = ctx.createGain();
    sink.gain.value = 0;

    audioContextRef.current = ctx;
    sourceRef.current = source;
    highPassRef.current = hp;
    sinkRef.current = sink;

    detectorRef.current = PitchDetector.forFloat32Array(FRAME_SIZE);
    fftReRef.current = new Float32Array(FRAME_SIZE);
    fftImRef.current = new Float32Array(FRAME_SIZE);
    freqDbRef.current = new Float32Array(FRAME_SIZE / 2);

    return { source, hp, sink };
  };

  const resetLiveState = () => {
    activeMidiRef.current = null;
    candidateMidiRef.current = null;
    candidateCountRef.current = 0;
    silenceFramesRef.current = 0;
    prevFrameRef.current = null;
    calibSamplesRef.current = [];
    adaptiveMinRmsRef.current = null;
    chromaAccumRef.current = Array(12).fill(0);
    chromaFrameCountRef.current = 0;
    chromaDirtyRef.current = false;
    chromaFlushAtRef.current = performance.now();
    levelFlushAtRef.current = 0;
  };

  const start = useCallback(
    async (stream: MediaStream) => {
      if (active) return;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx({ latencyHint: "interactive" });

      let useWorklet = true;
      try {
        await ctx.audioWorklet.addModule("/worklets/frame-producer.js");
      } catch {
        useWorklet = false;
      }

      const { source, hp, sink } = initSharedNodes(ctx, stream);
      resetLiveState();

      if (useWorklet) {
        const worklet = new AudioWorkletNode(ctx, "frame-producer", {
          processorOptions: { frameSize: FRAME_SIZE, hopSize: HOP_SIZE },
        });
        source.connect(hp);
        hp.connect(worklet);
        worklet.connect(sink);
        sink.connect(ctx.destination);
        workletRef.current = worklet;

        worklet.port.onmessage = (ev: MessageEvent<{ frame: Float32Array }>) => {
          const raw = ev.data?.frame;
          if (!raw) return;
          processFrame(raw as Float32Array<ArrayBuffer>);
        };
      } else {
        // Fallback: AnalyserNode polled via setInterval
        const analyser = ctx.createAnalyser();
        analyser.fftSize = FRAME_SIZE;
        analyser.smoothingTimeConstant = 0;
        source.connect(hp);
        hp.connect(analyser);
        hp.connect(sink);
        sink.connect(ctx.destination);
        analyserFallbackRef.current = analyser;

        const fallbackFrame = new Float32Array(FRAME_SIZE);
        fallbackIntervalRef.current = setInterval(() => {
          analyser.getFloatTimeDomainData(fallbackFrame);
          processFrame(fallbackFrame as Float32Array<ArrayBuffer>);
        }, 20);
      }

      setActive(true);
    },
    [active, processFrame]
  );

  const stop = useCallback(() => {
    if (activeMidiRef.current != null) finalizeActive(performance.now());

    if (fallbackIntervalRef.current != null) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }

    const worklet = workletRef.current;
    if (worklet) {
      worklet.port.onmessage = null;
      try { worklet.disconnect(); } catch {}
      workletRef.current = null;
    }

    const tearDown = (ref: React.MutableRefObject<AudioNode | null>) => {
      const node = ref.current;
      if (node) {
        try { node.disconnect(); } catch {}
        ref.current = null;
      }
    };
    tearDown(analyserFallbackRef as React.MutableRefObject<AudioNode | null>);
    tearDown(sourceRef as React.MutableRefObject<AudioNode | null>);
    tearDown(highPassRef as React.MutableRefObject<AudioNode | null>);
    tearDown(sinkRef as React.MutableRefObject<AudioNode | null>);

    if (audioContextRef.current) {
      audioContextRef.current.close().catch((err) => {
        console.warn("usePitchDetector: AudioContext close failed", err);
      });
      audioContextRef.current = null;
    }
    detectorRef.current = null;
    fftReRef.current = null;
    fftImRef.current = null;
    freqDbRef.current = null;
    prevFrameRef.current = null;
    adaptiveMinRmsRef.current = null;
    candidateMidiRef.current = null;
    candidateCountRef.current = 0;
    silenceFramesRef.current = 0;
    setLevel(0);
    setCurrentNote(null);
    setActive(false);
  }, [finalizeActive]);

  const reset = useCallback(() => {
    activeMidiRef.current = null;
    setNotes([]);
    setCurrentNote(null);
    setChromaProfile(Array(12).fill(0));
    setHarmonics(Array(NUM_HARMONICS).fill(0));
    chromaAccumRef.current = Array(12).fill(0);
    chromaFrameCountRef.current = 0;
    chromaDirtyRef.current = false;
    harmonicVectorRef.current = Array(NUM_HARMONICS).fill(0);
    harmonicsDirtyRef.current = false;
    candidateMidiRef.current = null;
    candidateCountRef.current = 0;
    // Reset adaptive gate so it re-calibrates on next session
    calibSamplesRef.current = [];
    adaptiveMinRmsRef.current = null;
    prevFrameRef.current = null;
  }, []);

  const addNotes = useCallback((more: DetectedNote[]) => {
    setNotes((prev) => [...prev, ...more]);
  }, []);

  const addChroma = useCallback((more: number[]) => {
    setChromaProfile((prev) => {
      const next = prev.slice();
      for (let i = 0; i < 12; i++) next[i] += more[i] ?? 0;
      return next;
    });
  }, []);

  const deleteNote = useCallback((index: number) => {
    setNotes((prev) => prev.filter((_, i) => i !== index));
  }, []);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) audioContextRef.current.close().catch((err) => {
        console.warn("usePitchDetector: AudioContext close failed", err);
      });
      if (fallbackIntervalRef.current != null) clearInterval(fallbackIntervalRef.current);
    };
  }, []);

  return {
    active,
    start,
    stop,
    reset,
    addNotes,
    addChroma,
    deleteNote,
    currentNote,
    level,
    notes,
    config,
    setConfig,
    chromaProfile,
    harmonics,
  };
}
