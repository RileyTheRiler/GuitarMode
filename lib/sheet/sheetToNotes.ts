import {
  DEFAULT_A4_HZ,
  midiToFreq,
  midiToNoteName,
  midiToPitchClass,
  NOTE_NAMES,
} from "../music/notes";
import type { DetectedNote } from "../audio/usePitchDetector";
import type { SheetAnalysis, SheetNote } from "./types";

const DEFAULT_BPM = 100;
const DEFAULT_BEATS_PER_NOTE = 1;
const NOTE_GAP_MS = 30;

export function noteNameToMidi(name: string): number | null {
  const m = name.trim().match(/^([A-G][#b]?)(-?\d+)$/);
  if (!m) return null;
  let pcName = m[1];
  if (pcName.endsWith("b")) {
    const flats: Record<string, string> = {
      Db: "C#",
      Eb: "D#",
      Gb: "F#",
      Ab: "G#",
      Bb: "A#",
      Cb: "B",
      Fb: "E",
    };
    pcName = flats[pcName] ?? pcName;
  }
  const pc = NOTE_NAMES.indexOf(pcName as (typeof NOTE_NAMES)[number]);
  if (pc < 0) return null;
  const octave = parseInt(m[2], 10);
  return (octave + 1) * 12 + pc;
}

function resolveMidi(note: SheetNote): number | null {
  if (Number.isFinite(note.midi) && note.midi >= 0 && note.midi <= 127) {
    return Math.round(note.midi);
  }
  return noteNameToMidi(note.noteName);
}

export type SheetToNotesOptions = {
  a4Hz?: number;
  startAt?: number;
  defaultBpm?: number;
};

export function sheetToDetectedNotes(
  analysis: SheetAnalysis,
  options: SheetToNotesOptions = {}
): DetectedNote[] {
  const a4Hz = options.a4Hz ?? DEFAULT_A4_HZ;
  const bpm = analysis.bpm && analysis.bpm > 0 ? analysis.bpm : options.defaultBpm ?? DEFAULT_BPM;
  const msPerBeat = 60000 / bpm;
  let cursor = options.startAt ?? 0;

  const out: DetectedNote[] = [];
  for (const note of analysis.notes) {
    const midi = resolveMidi(note);
    if (midi == null) continue;
    const beats = note.beats && note.beats > 0 ? note.beats : DEFAULT_BEATS_PER_NOTE;
    const durationMs = Math.max(80, Math.round(beats * msPerBeat));
    const at = cursor;
    const endAt = at + durationMs;
    out.push({
      midi,
      noteName: midiToNoteName(midi),
      pitchClass: midiToPitchClass(midi),
      frequency: midiToFreq(midi, a4Hz),
      clarity: 1,
      at,
      durationMs,
      endAt,
    });
    cursor = endAt + NOTE_GAP_MS;
  }
  return out;
}
