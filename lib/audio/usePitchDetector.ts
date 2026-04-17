"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import { DEFAULT_A4_HZ, freqToMidi, midiToNoteName, midiToPitchClass } from "../music/notes";
import { computeChroma } from "./chroma";
import { radix2FFT } from "./fft";

export type DetectedNote = {
  midi: number;
  noteName: string;
  pitchClass: number;
  frequency: number;
  clarity: number;
  at: number; // start time, ms (performance.now() for live, buffer-offset for offline)
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

const FRAME_SIZE = 2048;
const HOP_SIZE = 1024;

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

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const highPassRef = useRef<BiquadFilterNode | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const sinkRef = useRef<GainNode | null>(null);
  const detectorRef = useRef<PitchDetector<Float32Array<ArrayBuffer>> | null>(null);

  // Scratch buffers for the optional FFT / chroma path
  const fftReRef = useRef<Float32Array | null>(null);
  const fftImRef = useRef<Float32Array | null>(null);
  const freqDbRef = useRef<Float32Array | null>(null);

  // Live-mutable config mirror so config changes take effect without a graph rebuild.
  const cfgRef = useRef<PitchDetectorConfig>(config);
  cfgRef.current = config;

  // Active note state machine (for duration tracking).
  const activeMidiRef = useRef<number | null>(null);
  const activeStartRef = useRef<number>(0);
  const activeEndRef = useRef<number>(0);
  const activeFreqRef = useRef<number>(0);
  const activeClarityRef = useRef<number>(0);

  // Candidate-note building (debouncer).
  const candidateMidiRef = useRef<number | null>(null);
  const candidateCountRef = useRef(0);
  const silenceFramesRef = useRef(0);

  // Rolling chroma accumulator (polyphonic contribution).
  const chromaAccumRef = useRef<number[]>(Array(12).fill(0));
  const chromaDirtyRef = useRef(false);
  const chromaFlushAtRef = useRef(0);
  const levelFlushAtRef = useRef(0);

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

  const finalizeActive = useCallback((endTime: number) => {
    const midi = activeMidiRef.current;
    if (midi == null) return;
    const start = activeStartRef.current;
    const end = Math.max(endTime, activeEndRef.current);
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

      let sumSq = 0;
      for (let i = 0; i < frame.length; i++) sumSq += frame[i] * frame[i];
      const rms = Math.sqrt(sumSq / frame.length);

      // Throttle the level state update to ~15 Hz.
      if (now - levelFlushAtRef.current > 66) {
        levelFlushAtRef.current = now;
        setLevel(rms);
      }

      const [freq, clarity] = detector.findPitch(frame, ctx.sampleRate);

      const passes =
        rms >= cfg.minRms &&
        clarity >= cfg.minClarity &&
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

        if (candidateCountRef.current >= cfg.framesToConfirm) {
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
        silenceFramesRef.current += 1;
        if (
          silenceFramesRef.current >= cfg.silenceFramesToRelease &&
          activeMidiRef.current != null
        ) {
          finalizeActive(now);
          candidateMidiRef.current = null;
          candidateCountRef.current = 0;
        }
      }

      if (cfg.polyphonic && rms >= cfg.minRms) {
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
        chromaDirtyRef.current = true;

        if (now - chromaFlushAtRef.current > 100) {
          chromaFlushAtRef.current = now;
          if (chromaDirtyRef.current) {
            setChromaProfile([...accum]);
            chromaDirtyRef.current = false;
          }
        }
      }
    },
    [finalizeActive]
  );

  const start = useCallback(
    async (stream: MediaStream) => {
      if (active) return;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx({ latencyHint: "interactive" });

      // Worklet module load (idempotent per context).
      try {
        await ctx.audioWorklet.addModule("/worklets/frame-producer.js");
      } catch (e) {
        ctx.close().catch(() => {});
        throw new Error(
          `AudioWorklet not available: ${e instanceof Error ? e.message : String(e)}`
        );
      }

      const source = ctx.createMediaStreamSource(stream);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = cfgRef.current.highPass ? cfgRef.current.highPassHz : 20;
      hp.Q.value = 0.707;

      const worklet = new AudioWorkletNode(ctx, "frame-producer", {
        processorOptions: { frameSize: FRAME_SIZE, hopSize: HOP_SIZE },
      });
      // A zero-gain sink keeps the worklet scheduled without routing mic audio
      // back to the speakers.
      const sink = ctx.createGain();
      sink.gain.value = 0;

      source.connect(hp);
      hp.connect(worklet);
      worklet.connect(sink);
      sink.connect(ctx.destination);

      const detector = PitchDetector.forFloat32Array(FRAME_SIZE);
      detectorRef.current = detector;
      fftReRef.current = new Float32Array(FRAME_SIZE);
      fftImRef.current = new Float32Array(FRAME_SIZE);
      freqDbRef.current = new Float32Array(FRAME_SIZE / 2);

      audioContextRef.current = ctx;
      sourceRef.current = source;
      highPassRef.current = hp;
      workletRef.current = worklet;
      sinkRef.current = sink;

      activeMidiRef.current = null;
      candidateMidiRef.current = null;
      candidateCountRef.current = 0;
      silenceFramesRef.current = 0;
      chromaAccumRef.current = Array(12).fill(0);
      chromaDirtyRef.current = false;
      chromaFlushAtRef.current = performance.now();
      levelFlushAtRef.current = 0;

      worklet.port.onmessage = (ev: MessageEvent<{ frame: Float32Array }>) => {
        const raw = ev.data?.frame;
        if (!raw) return;
        // Guarantee a fresh ArrayBuffer-backed view for pitchy's typing.
        processFrame(raw as Float32Array<ArrayBuffer>);
      };

      setActive(true);
    },
    [active, processFrame]
  );

  const stop = useCallback(() => {
    if (activeMidiRef.current != null) finalizeActive(performance.now());

    const worklet = workletRef.current;
    if (worklet) {
      worklet.port.onmessage = null;
      try {
        worklet.disconnect();
      } catch {}
      workletRef.current = null;
    }
    const tearDown = (ref: React.MutableRefObject<AudioNode | null>) => {
      const node = ref.current;
      if (node) {
        try {
          node.disconnect();
        } catch {}
        ref.current = null;
      }
    };
    tearDown(sourceRef as React.MutableRefObject<AudioNode | null>);
    tearDown(highPassRef as React.MutableRefObject<AudioNode | null>);
    tearDown(sinkRef as React.MutableRefObject<AudioNode | null>);
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    detectorRef.current = null;
    fftReRef.current = null;
    fftImRef.current = null;
    freqDbRef.current = null;
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
    chromaAccumRef.current = Array(12).fill(0);
    chromaDirtyRef.current = false;
    candidateMidiRef.current = null;
    candidateCountRef.current = 0;
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

  useEffect(() => {
    return () => {
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, []);

  return {
    active,
    start,
    stop,
    reset,
    addNotes,
    addChroma,
    currentNote,
    level,
    notes,
    config,
    setConfig,
    chromaProfile,
  };
}
