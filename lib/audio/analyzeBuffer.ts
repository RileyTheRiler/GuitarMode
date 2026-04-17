"use client";

import { PitchDetector } from "pitchy";
import { DEFAULT_A4_HZ, freqToMidi, midiToNoteName, midiToPitchClass } from "../music/notes";
import type { DetectedNote } from "./usePitchDetector";

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
};

export type AnalyzeResult = {
  notes: DetectedNote[];
  chroma: number[]; // accumulated 12-bin pitch-class energy from chroma mode
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

// Simple 2nd-order high-pass (matching BiquadFilterNode's default Q=0.707)
// to mirror the live-input chain during offline analysis.
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

/**
 * Offline analysis of an AudioBuffer. Mirrors the live detector's state
 * machine (3-frame confirmation + duration tracking on release) and
 * optionally accumulates a chromagram for polyphonic input.
 */
export async function analyzeAudioBuffer(
  buffer: AudioBuffer,
  opts: AnalyzeOptions = {},
  signal?: AbortSignal
): Promise<AnalyzeResult> {
  const cfg = { ...DEFAULTS, ...opts };
  const sampleRate = buffer.sampleRate;
  const mono = mixToMono(buffer).slice();
  highPassInPlace(mono, sampleRate, 80);

  const detector = PitchDetector.forFloat32Array(cfg.frameSize);
  const frame = new Float32Array(
    new ArrayBuffer(cfg.frameSize * Float32Array.BYTES_PER_ELEMENT)
  );

  // Only used when polyphonic=true (lazy to keep bundle size for mono users).
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
    notes.push({
      midi: activeMidi,
      noteName: midiToNoteName(activeMidi),
      pitchClass: midiToPitchClass(activeMidi),
      frequency: activeFreq,
      clarity: activeClarity,
      at: activeStart,
      endAt: Math.max(endMs, activeEnd),
      durationMs: Math.max(0, Math.max(endMs, activeEnd) - activeStart),
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

    const [freq, clarity] = detector.findPitch(frame, sampleRate);
    const passes =
      rms >= cfg.minRms &&
      clarity >= cfg.minClarity &&
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
      if (candidateCount >= cfg.framesToConfirm) {
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
      silenceFrames += 1;
      if (silenceFrames >= cfg.silenceFramesToRelease && activeMidi != null) {
        finalize(frameAtMs);
        candidateMidi = null;
        candidateCount = 0;
      }
    }

    if (cfg.polyphonic && rms >= cfg.minRms && chromaLib && fftHelpers && fftRe && fftIm && freqDb) {
      // Windowed FFT → dB spectrum → chroma
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
