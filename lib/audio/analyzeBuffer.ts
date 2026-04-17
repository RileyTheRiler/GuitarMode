"use client";

import { PitchDetector } from "pitchy";
import { freqToMidi, midiToNoteName, midiToPitchClass } from "../music/notes";
import type { DetectedNote } from "./usePitchDetector";

export type AnalyzeOptions = {
  minFreq?: number;
  maxFreq?: number;
  minClarity?: number;
  minRms?: number;
  framesToConfirm?: number;
  frameSize?: number;
  hopSize?: number;
};

const DEFAULTS: Required<AnalyzeOptions> = {
  minFreq: 70,
  maxFreq: 1400,
  minClarity: 0.9,
  minRms: 0.01,
  framesToConfirm: 3,
  frameSize: 2048,
  hopSize: 1024,
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

/** Offline analysis of an AudioBuffer, mirrors the live detector's debouncer. */
export async function analyzeAudioBuffer(
  buffer: AudioBuffer,
  opts: AnalyzeOptions = {}
): Promise<DetectedNote[]> {
  const cfg = { ...DEFAULTS, ...opts };
  const sampleRate = buffer.sampleRate;
  const mono = mixToMono(buffer);

  const detector = PitchDetector.forFloat32Array(cfg.frameSize);
  const frame = new Float32Array(
    new ArrayBuffer(cfg.frameSize * Float32Array.BYTES_PER_ELEMENT)
  );

  let lastEmittedMidi: number | null = null;
  let candidateMidi: number | null = null;
  let candidateCount = 0;
  let silenceFrames = 0;

  const notes: DetectedNote[] = [];
  const totalFrames = Math.max(0, Math.floor((mono.length - cfg.frameSize) / cfg.hopSize) + 1);

  for (let f = 0; f < totalFrames; f++) {
    const start = f * cfg.hopSize;
    frame.set(mono.subarray(start, start + cfg.frameSize));

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
      const midi = Math.round(freqToMidi(freq));
      silenceFrames = 0;
      if (midi === candidateMidi) {
        candidateCount += 1;
      } else {
        candidateMidi = midi;
        candidateCount = 1;
      }
      if (candidateCount >= cfg.framesToConfirm && midi !== lastEmittedMidi) {
        lastEmittedMidi = midi;
        notes.push({
          midi,
          noteName: midiToNoteName(midi),
          pitchClass: midiToPitchClass(midi),
          frequency: freq,
          clarity,
          at: (start / sampleRate) * 1000,
        });
      }
    } else {
      silenceFrames += 1;
      if (silenceFrames > 12) {
        lastEmittedMidi = null;
        candidateMidi = null;
        candidateCount = 0;
      }
    }
  }

  return notes;
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
