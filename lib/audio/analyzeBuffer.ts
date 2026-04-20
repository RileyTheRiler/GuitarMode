"use client";

import { PitchDetector } from "pitchy";
import { DEFAULT_A4_HZ, freqToMidi, midiToNoteName, midiToPitchClass } from "../music/notes";
import type { DetectedNote } from "./usePitchDetector";
import { octaveCorrect } from "./octaveCorrect";

export type AnalyzeOptions = {
  minFreq?: number;
  maxFreq?: number;
  minClarity?: number;
  minRms?: number;
  framesToConfirm?: number;
  silenceFramesToRelease?: number;
  frameSize?: number;
  hopSize?: number;
  a4Hz?: number;
  polyphonic?: boolean;
  highPass?: boolean;
  highPassHz?: number;
};

const DEFAULTS: Required<AnalyzeOptions> = {
  minFreq: 70,
  maxFreq: 1400,
  minClarity: 0.9,
  minRms: 0.01,
  framesToConfirm: 3,
  silenceFramesToRelease: 10,
  frameSize: 2048,
  hopSize: 1024,
  a4Hz: DEFAULT_A4_HZ,
  polyphonic: false,
  highPass: true,
  highPassHz: 80,
};

export type AnalyzeResult = {
  notes: DetectedNote[];
  chroma: number[];
  durationMs: number;
};

function mixToMono(buffer: AudioBuffer): Float32Array {
  if (buffer.numberOfChannels === 1) {
    return buffer.getChannelData(0);
  }
  const out = new Float32Array(buffer.length);
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) out[i] += data[i];
  }
  const inv = 1 / buffer.numberOfChannels;
  for (let i = 0; i < out.length; i++) out[i] *= inv;
  return out;
}

function highPassInPlace(data: Float32Array, sampleRate: number, cutoffHz: number) {
  const rc = 1 / (2 * Math.PI * cutoffHz);
  const dt = 1 / sampleRate;
  const alpha = rc / (rc + dt);
  let prevIn = 0;
  let prevOut = 0;
  for (let i = 0; i < data.length; i++) {
    const x = data[i];
    const y = alpha * (prevOut + x - prevIn);
    prevIn = x;
    prevOut = y;
    data[i] = y;
  }
}

/** Bandwise RMS flux across 4 sub-bands (same formula as the live path). */
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

const CALIB_FRAMES = 43;
const CALIB_MULTIPLIER = 3;
const HYSTERESIS_RATIO = 0.5;
const CLARITY_HYSTERESIS_RATIO = 0.85;
const ONSET_FLUX_THRESHOLD = 0.015;

/**
 * Offline analysis of an AudioBuffer. Mirrors the live detector's state
 * machine: adaptive noise gate, octave correction, spectral-flux onset
 * detection, confirmation + duration tracking on release, optional chroma.
 */
export async function analyzeAudioBuffer(
  buffer: AudioBuffer,
  opts: AnalyzeOptions = {},
  signal?: AbortSignal
): Promise<AnalyzeResult> {
  const cfg = { ...DEFAULTS, ...opts };
  const sampleRate = buffer.sampleRate;
  const mono = mixToMono(buffer).slice();
  if (cfg.highPass) {
    highPassInPlace(mono, sampleRate, cfg.highPassHz);
  }

  const detector = PitchDetector.forFloat32Array(cfg.frameSize);
  const frame = new Float32Array(
    new ArrayBuffer(cfg.frameSize * Float32Array.BYTES_PER_ELEMENT)
  );
  let prevFrame: Float32Array | null = null;

  let chromaLib: typeof import("./chroma") | null = null;
  let fftHelpers: { fft: (re: Float32Array, im: Float32Array) => void } | null = null;
  let fftRe: Float32Array | null = null;
  let fftIm: Float32Array | null = null;
  let freqDb: Float32Array | null = null;
  if (cfg.polyphonic) {
    chromaLib = await import("./chroma");
    const mod = await import("./fft");
    fftHelpers = { fft: mod.radix2FFT };
    fftRe = new Float32Array(cfg.frameSize);
    fftIm = new Float32Array(cfg.frameSize);
    freqDb = new Float32Array(cfg.frameSize / 2);
  }
  const chromaAccum: number[] = Array(12).fill(0);

  // Adaptive gate calibration state (25th-percentile baseline of early RMS)
  const calibSamples: number[] = [];
  let adaptiveMinRms: number | null = null;

  let activeMidi: number | null = null;
  let activeStart = 0;
  let activeEnd = 0;
  let activeFreq = 0;
  let activeClarity = 0;
  let candidateMidi: number | null = null;
  let candidateCount = 0;
  let silenceFrames = 0;

  const notes: DetectedNote[] = [];

  const finalize = (endMs: number) => {
    if (activeMidi == null) return;
    // Prefer the last frame where audio was present; endMs is the release
    // point (after ~silenceFramesToRelease of silence) and overstates
    // duration by roughly silenceFramesToRelease * hop/sr seconds.
    const end = activeEnd > 0 ? activeEnd : endMs;
    notes.push({
      midi: activeMidi,
      noteName: midiToNoteName(activeMidi),
      pitchClass: midiToPitchClass(activeMidi),
      frequency: activeFreq,
      clarity: activeClarity,
      at: activeStart,
      endAt: end,
      durationMs: Math.max(0, end - activeStart),
    });
    activeMidi = null;
  };

  const totalFrames = Math.max(0, Math.floor((mono.length - cfg.frameSize) / cfg.hopSize) + 1);

  for (let f = 0; f < totalFrames; f++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const startSample = f * cfg.hopSize;
    frame.set(mono.subarray(startSample, startSample + cfg.frameSize));
    const frameAtMs = (startSample / sampleRate) * 1000;

    let sumSq = 0;
    for (let i = 0; i < frame.length; i++) sumSq += frame[i] * frame[i];
    const rms = Math.sqrt(sumSq / frame.length);

    // Adaptive noise gate calibration — 25th percentile is robust to the
    // user playing a note during the calibration window.
    if (calibSamples.length < CALIB_FRAMES) {
      calibSamples.push(rms);
      if (calibSamples.length === CALIB_FRAMES) {
        const sorted = calibSamples.slice().sort((a, b) => a - b);
        const baseline = sorted[Math.floor(sorted.length * 0.25)];
        adaptiveMinRms = Math.max(cfg.minRms, baseline * CALIB_MULTIPLIER);
      }
    }
    const effectiveMinRms = adaptiveMinRms ?? cfg.minRms;
    const releaseThreshold = activeMidi != null ? effectiveMinRms * HYSTERESIS_RATIO : effectiveMinRms;

    // Spectral flux onset detection
    let onsetDetected = false;
    if (prevFrame) {
      onsetDetected = computeFlux(frame, prevFrame) > ONSET_FLUX_THRESHOLD;
    }
    if (!prevFrame) prevFrame = new Float32Array(cfg.frameSize);
    prevFrame.set(frame);

    const [rawFreq, clarity] = detector.findPitch(frame, sampleRate);
    const freq = octaveCorrect(frame, rawFreq, sampleRate, cfg.minFreq);

    const confirmThreshold = onsetDetected ? 1 : cfg.framesToConfirm;

    const onsetMinRms = activeMidi != null ? releaseThreshold : effectiveMinRms;
    const clarityThreshold =
      activeMidi != null ? cfg.minClarity * CLARITY_HYSTERESIS_RATIO : cfg.minClarity;
    const passes =
      rms >= onsetMinRms &&
      clarity >= clarityThreshold &&
      freq >= cfg.minFreq &&
      freq <= cfg.maxFreq;

    if (passes) {
      const midi = Math.round(freqToMidi(freq, cfg.a4Hz));
      silenceFrames = 0;
      if (midi === candidateMidi) {
        candidateCount += 1;
      } else {
        candidateMidi = midi;
        candidateCount = 1;
      }
      if (candidateCount >= confirmThreshold) {
        if (activeMidi === midi) {
          activeEnd = frameAtMs;
          activeFreq = freq;
          activeClarity = Math.max(activeClarity, clarity);
        } else {
          finalize(frameAtMs);
          activeMidi = midi;
          activeStart = frameAtMs;
          activeEnd = frameAtMs;
          activeFreq = freq;
          activeClarity = clarity;
        }
      }
    } else {
      if (rms < releaseThreshold || !passes) silenceFrames += 1;
      if (silenceFrames >= cfg.silenceFramesToRelease && activeMidi != null) {
        finalize(frameAtMs);
        candidateMidi = null;
        candidateCount = 0;
      }
    }

    if (cfg.polyphonic && rms >= effectiveMinRms && chromaLib && fftHelpers && fftRe && fftIm && freqDb) {
      for (let i = 0; i < cfg.frameSize; i++) {
        const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (cfg.frameSize - 1));
        fftRe[i] = frame[i] * w;
        fftIm[i] = 0;
      }
      fftHelpers.fft(fftRe, fftIm);
      for (let k = 0; k < cfg.frameSize / 2; k++) {
        const mag = Math.sqrt(fftRe[k] * fftRe[k] + fftIm[k] * fftIm[k]) + 1e-12;
        freqDb[k] = 20 * Math.log10(mag);
      }
      const c = chromaLib.computeChroma(freqDb, sampleRate, cfg.a4Hz, cfg.minFreq, cfg.maxFreq);
      for (let i = 0; i < 12; i++) chromaAccum[i] += c[i];
    }
  }

  finalize((mono.length / sampleRate) * 1000);

  return {
    notes,
    chroma: chromaAccum,
    durationMs: (mono.length / sampleRate) * 1000,
  };
}

/** Decode an ArrayBuffer (from a File or Blob) into an AudioBuffer. */
export async function decodeArrayBuffer(arr: ArrayBuffer): Promise<AudioBuffer> {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    return await ctx.decodeAudioData(arr.slice(0));
  } finally {
    ctx.close().catch(() => {});
  }
}
