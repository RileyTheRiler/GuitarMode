"use client";

import type { DetectedNote } from "./usePitchDetector";
import { midiToFreq, midiToNoteName, midiToPitchClass } from "../music/notes";

export type BasicPitchOptions = {
  a4Hz?: number;
  onsetThreshold?: number;
  frameThreshold?: number;
  minNoteLengthFrames?: number;
  modelUrl?: string;
  onProgress?: (pct: number) => void;
  signal?: AbortSignal;
};

const DEFAULT_MODEL_URL = "/models/basic-pitch/model.json";

/**
 * Run Spotify's Basic Pitch over a decoded AudioBuffer and return notes in the
 * app's standard `DetectedNote` shape.
 *
 * The @spotify/basic-pitch package and its TensorFlow.js dep are imported
 * dynamically so the main bundle is unaffected for users who never enable
 * polyphonic + Basic Pitch. The first call downloads the model (~900 KB) and
 * the TF.js chunks; subsequent calls reuse the loaded module.
 */
export async function analyzeWithBasicPitch(
  buffer: AudioBuffer,
  opts: BasicPitchOptions = {}
): Promise<DetectedNote[]> {
  const a4 = opts.a4Hz ?? 440;
  const modelUrl = opts.modelUrl ?? DEFAULT_MODEL_URL;

  if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  // Lazy-load the package; pulls TF.js with it.
  const { BasicPitch, noteFramesToTime, outputToNotesPoly, addPitchBendsToNoteEvents } =
    await import("@spotify/basic-pitch");

  if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const basicPitch = new BasicPitch(modelUrl);

  const frames: number[][] = [];
  const onsets: number[][] = [];
  const contours: number[][] = [];

  await basicPitch.evaluateModel(
    buffer,
    (f, o, c) => {
      frames.push(...f);
      onsets.push(...o);
      contours.push(...c);
    },
    (pct) => {
      opts.onProgress?.(pct);
    }
  );

  if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

  const polyNotes = outputToNotesPoly(
    frames,
    onsets,
    opts.onsetThreshold ?? 0.25,
    opts.frameThreshold ?? 0.25,
    opts.minNoteLengthFrames ?? 5
  );
  const notes = noteFramesToTime(addPitchBendsToNoteEvents(contours, polyNotes));

  return notes.map((n): DetectedNote => {
    const midi = Math.round(n.pitchMidi);
    const startMs = n.startTimeSeconds * 1000;
    const endMs = (n.startTimeSeconds + n.durationSeconds) * 1000;
    return {
      midi,
      noteName: midiToNoteName(midi),
      pitchClass: midiToPitchClass(midi),
      frequency: midiToFreq(midi, a4),
      clarity: Math.min(1, Math.max(0, n.amplitude)),
      at: startMs,
      endAt: endMs,
      durationMs: Math.max(0, endMs - startMs),
    };
  });
}
