"use client";

import { STANDARD_TUNING } from "../guitar/fretboard";
import type { GeneratedSolo, NoteTechnique, SoloNote } from "./soloGenerator";

export type LickStyle = "blues" | "rock" | "jazz";
export type LickDifficulty = "beginner" | "intermediate" | "advanced";

export interface RelativeLickNote {
  stringIndex: number;
  fretOffset: number;
  durationBeats: number;
  startBeatOffset: number;
  technique?: NoteTechnique;
  bendSemitones?: number;
}

export interface GuitarLick {
  id: string;
  name: string;
  style: LickStyle;
  difficulty: LickDifficulty;
  description: string;
  notes: RelativeLickNote[];
  totalBeats: number;
  recommendedScale: string;
  scaleIntervals: number[];
}

// Mirror of soloGenerator.ts rootFretOnString (not exported from that module).
function rootFretOnString(rootPC: number, stringIndex: number, minFret = 3): number {
  const openPC = STANDARD_TUNING[stringIndex] % 12;
  let fret = ((rootPC - openPC) + 12) % 12;
  if (fret < minFret) fret += 12;
  return fret;
}

export function transposeLick(lick: GuitarLick, scaleRoot: number): GeneratedSolo {
  const centerFret = rootFretOnString(scaleRoot, 0, 3);
  const scalePitchClasses = new Set(lick.scaleIntervals.map((i) => (scaleRoot + i) % 12));

  const notes: SoloNote[] = lick.notes.map((n) => {
    const fret = Math.min(22, Math.max(0, centerFret + n.fretOffset));
    const midi = STANDARD_TUNING[n.stringIndex] + fret;
    const pitchClass = midi % 12;
    return {
      stringIndex: n.stringIndex,
      fret,
      midi,
      pitchClass,
      startBeat: n.startBeatOffset,
      durationBeats: n.durationBeats,
      technique: n.technique,
      bendSemitones: n.bendSemitones,
    };
  });

  return {
    notes,
    bpm: 80,
    totalBeats: lick.totalBeats,
    scaleRoot,
    scaleName: lick.recommendedScale,
    scalePitchClasses,
    centerFret,
  };
}

export function filterLicks(
  style: LickStyle | "all",
  difficulty: LickDifficulty | "all"
): GuitarLick[] {
  return GUITAR_LICKS.filter(
    (l) =>
      (style === "all" || l.style === style) &&
      (difficulty === "all" || l.difficulty === difficulty)
  );
}

// ─── Lick library ────────────────────────────────────────────────────────────
// All fretOffsets are relative to centerFret (root on low-E string, minFret=3).
// String indices: 0=low E, 1=A, 2=D, 3=G, 4=B, 5=high e
// Minor Pentatonic intervals: [0,3,5,7,10]
// Blues scale intervals:      [0,3,5,6,7,10]
// Dorian intervals:            [0,2,3,5,7,9,10]
// Mixolydian intervals:        [0,2,4,5,7,9,10]

export const GUITAR_LICKS: GuitarLick[] = [
  // ── Blues ──────────────────────────────────────────────────────────────────

  {
    id: "blues-classic-bend",
    name: "Classic Blues Bend",
    style: "blues",
    difficulty: "beginner",
    description: "The signature move: bend the 5th up to the root, then resolve down.",
    recommendedScale: "Minor Pentatonic",
    scaleIntervals: [0, 3, 5, 7, 10],
    totalBeats: 3,
    notes: [
      // Approach: hit 5th on B-string, bend 2 semitones up to root
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0,   durationBeats: 0.5 },
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0.5, durationBeats: 1,   technique: "bend", bendSemitones: 2 },
      // Resolve: minor 3rd then root on high-e
      { stringIndex: 5, fretOffset: 3, startBeatOffset: 1.5, durationBeats: 0.5 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 2,   durationBeats: 1 },
    ],
  },

  {
    id: "blues-bb-king-box",
    name: "BB King Box Phrase",
    style: "blues",
    difficulty: "intermediate",
    description: "Ascend through the pentatonic box with a snap bend at the top.",
    recommendedScale: "Minor Pentatonic",
    scaleIntervals: [0, 3, 5, 7, 10],
    totalBeats: 3,
    notes: [
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 0,    durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 0, startBeatOffset: 0.25, durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0.5,  durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 0.75, durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 1,    durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 3, startBeatOffset: 1.25, durationBeats: 0.5, technique: "bend", bendSemitones: 2 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 2,    durationBeats: 1 },
    ],
  },

  {
    id: "blues-turnaround",
    name: "Turnaround Lick",
    style: "blues",
    difficulty: "advanced",
    description: "Descending run with the blues b5 note for chromatic tension.",
    recommendedScale: "Blues",
    scaleIntervals: [0, 3, 5, 6, 7, 10],
    totalBeats: 4,
    notes: [
      { stringIndex: 5, fretOffset: 3, startBeatOffset: 0,    durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 0.25, durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 0.5,  durationBeats: 0.25 },
      // b5 passing tone (fretOffset 6 = blues note)
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0.75, durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 1, startBeatOffset: 1,    durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 0, startBeatOffset: 1.25, durationBeats: 0.25, technique: "slide_down" },
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 1.5,  durationBeats: 0.5 },
      { stringIndex: 3, fretOffset: 0, startBeatOffset: 2,    durationBeats: 2 },
    ],
  },

  {
    id: "blues-call-response",
    name: "Call & Response",
    style: "blues",
    difficulty: "beginner",
    description: "Two-note call on the high string answered by a lower resolution.",
    recommendedScale: "Minor Pentatonic",
    scaleIntervals: [0, 3, 5, 7, 10],
    totalBeats: 4,
    notes: [
      // Call
      { stringIndex: 5, fretOffset: 3, startBeatOffset: 0,   durationBeats: 0.5 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 0.5, durationBeats: 0.5 },
      // Rest beat 1
      // Response
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 2,   durationBeats: 0.5 },
      { stringIndex: 4, fretOffset: 0, startBeatOffset: 2.5, durationBeats: 1.5 },
    ],
  },

  {
    id: "blues-double-stop",
    name: "Double Stop Squeeze",
    style: "blues",
    difficulty: "intermediate",
    description: "Gritty double-stop bend on G and B strings — classic Chicago blues.",
    recommendedScale: "Minor Pentatonic",
    scaleIntervals: [0, 3, 5, 7, 10],
    totalBeats: 2,
    notes: [
      // G + B together, then bend B
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 0,   durationBeats: 0.5 },
      { stringIndex: 4, fretOffset: 0, startBeatOffset: 0,   durationBeats: 0.5 },
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0.5, durationBeats: 0.75, technique: "bend", bendSemitones: 1 },
      { stringIndex: 3, fretOffset: 0, startBeatOffset: 0.5, durationBeats: 0.75 },
      { stringIndex: 4, fretOffset: 0, startBeatOffset: 1.5, durationBeats: 0.5 },
    ],
  },

  {
    id: "blues-vibrato-run",
    name: "Vibrato Run",
    style: "blues",
    difficulty: "intermediate",
    description: "Ascending pentatonic run ending on a long vibrato bend.",
    recommendedScale: "Minor Pentatonic",
    scaleIntervals: [0, 3, 5, 7, 10],
    totalBeats: 4,
    notes: [
      { stringIndex: 3, fretOffset: 0, startBeatOffset: 0,    durationBeats: 0.25 },
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 0.25, durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 0, startBeatOffset: 0.5,  durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0.75, durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 1,    durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 1.25, durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 3, startBeatOffset: 1.5,  durationBeats: 2.5, technique: "bend", bendSemitones: 2 },
    ],
  },

  {
    id: "blues-box-descent",
    name: "Box Descent",
    style: "blues",
    difficulty: "advanced",
    description: "Fast descending run from the top of the box with slides.",
    recommendedScale: "Blues",
    scaleIntervals: [0, 3, 5, 6, 7, 10],
    totalBeats: 4,
    notes: [
      { stringIndex: 5, fretOffset: 3, startBeatOffset: 0,    durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 0.25, durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 0.5,  durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0.75, durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 0, startBeatOffset: 1,    durationBeats: 0.25, technique: "slide_down" },
      { stringIndex: 3, fretOffset: 5, startBeatOffset: 1.25, durationBeats: 0.25 },
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 1.5,  durationBeats: 0.25 },
      { stringIndex: 3, fretOffset: 0, startBeatOffset: 1.75, durationBeats: 0.25 },
      { stringIndex: 2, fretOffset: 5, startBeatOffset: 2,    durationBeats: 0.25 },
      { stringIndex: 2, fretOffset: 3, startBeatOffset: 2.25, durationBeats: 0.25 },
      { stringIndex: 2, fretOffset: 0, startBeatOffset: 2.5,  durationBeats: 1.5 },
    ],
  },

  // ── Rock ───────────────────────────────────────────────────────────────────

  {
    id: "rock-pentatonic-burst",
    name: "Pentatonic Burst",
    style: "rock",
    difficulty: "beginner",
    description: "Quick ascending 16th-note burst — the bread and butter of rock lead.",
    recommendedScale: "Minor Pentatonic",
    scaleIntervals: [0, 3, 5, 7, 10],
    totalBeats: 2,
    notes: [
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 0,    durationBeats: 0.25 },
      { stringIndex: 3, fretOffset: 5, startBeatOffset: 0.25, durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 0.5,  durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 0.75, durationBeats: 1.25 },
    ],
  },

  {
    id: "rock-hammer-cascade",
    name: "Hammer Cascade",
    style: "rock",
    difficulty: "intermediate",
    description: "Staircase of hammer-ons across G/B/e strings for a fluid sound.",
    recommendedScale: "Minor Pentatonic",
    scaleIntervals: [0, 3, 5, 7, 10],
    totalBeats: 2,
    notes: [
      { stringIndex: 3, fretOffset: 0, startBeatOffset: 0,    durationBeats: 0.25 },
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 0.25, durationBeats: 0.25, technique: "hammer" },
      { stringIndex: 4, fretOffset: 0, startBeatOffset: 0.5,  durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0.75, durationBeats: 0.25, technique: "hammer" },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 1,    durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 3, startBeatOffset: 1.25, durationBeats: 0.75, technique: "hammer" },
    ],
  },

  {
    id: "rock-two-string-blaze",
    name: "Two-String Blaze",
    style: "rock",
    difficulty: "advanced",
    description: "Rapid interleaved B/e string pattern with pull-offs.",
    recommendedScale: "Minor Pentatonic",
    scaleIntervals: [0, 3, 5, 7, 10],
    totalBeats: 2,
    notes: [
      { stringIndex: 5, fretOffset: 3, startBeatOffset: 0,    durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 0.25, durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 0.5,  durationBeats: 0.25, technique: "pull" },
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0.75, durationBeats: 0.25, technique: "pull" },
      { stringIndex: 5, fretOffset: 3, startBeatOffset: 1,    durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 0, startBeatOffset: 1.25, durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 1.5,  durationBeats: 0.5 },
    ],
  },

  {
    id: "rock-power-phrase",
    name: "Power Phrase",
    style: "rock",
    difficulty: "beginner",
    description: "Root-5th-octave root — the power chord melody every rock player needs.",
    recommendedScale: "Minor Pentatonic",
    scaleIntervals: [0, 3, 5, 7, 10],
    totalBeats: 2,
    notes: [
      { stringIndex: 2, fretOffset: 0, startBeatOffset: 0,   durationBeats: 0.5 },
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 0.5, durationBeats: 0.5 },
      { stringIndex: 4, fretOffset: 0, startBeatOffset: 1,   durationBeats: 1 },
    ],
  },

  {
    id: "rock-slide-climb",
    name: "Slide Climb",
    style: "rock",
    difficulty: "intermediate",
    description: "Ascending with slides for an expressive, legato feel.",
    recommendedScale: "Minor Pentatonic",
    scaleIntervals: [0, 3, 5, 7, 10],
    totalBeats: 3,
    notes: [
      { stringIndex: 3, fretOffset: 0, startBeatOffset: 0,   durationBeats: 0.5 },
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 0.5, durationBeats: 0.5, technique: "slide_up" },
      { stringIndex: 3, fretOffset: 5, startBeatOffset: 1,   durationBeats: 0.5, technique: "slide_up" },
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 1.5, durationBeats: 0.5, technique: "slide_up" },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 2,   durationBeats: 1 },
    ],
  },

  {
    id: "rock-pull-off-descent",
    name: "Pull-off Descent",
    style: "rock",
    difficulty: "intermediate",
    description: "Descending pull-off pairs across three strings for speed and fluidity.",
    recommendedScale: "Minor Pentatonic",
    scaleIntervals: [0, 3, 5, 7, 10],
    totalBeats: 2,
    notes: [
      { stringIndex: 5, fretOffset: 3, startBeatOffset: 0,    durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 0.25, durationBeats: 0.25, technique: "pull" },
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 0.5,  durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0.75, durationBeats: 0.25, technique: "pull" },
      { stringIndex: 3, fretOffset: 5, startBeatOffset: 1,    durationBeats: 0.25 },
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 1.25, durationBeats: 0.75, technique: "pull" },
    ],
  },

  {
    id: "rock-full-box-run",
    name: "Full Box Run",
    style: "rock",
    difficulty: "advanced",
    description: "Full pentatonic box top-to-bottom with hammers, pulls, and a final bend.",
    recommendedScale: "Minor Pentatonic",
    scaleIntervals: [0, 3, 5, 7, 10],
    totalBeats: 4,
    notes: [
      { stringIndex: 5, fretOffset: 3, startBeatOffset: 0,    durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 0.25, durationBeats: 0.25, technique: "pull" },
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 0.5,  durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0.75, durationBeats: 0.25, technique: "pull" },
      { stringIndex: 4, fretOffset: 0, startBeatOffset: 1,    durationBeats: 0.25, technique: "pull" },
      { stringIndex: 3, fretOffset: 5, startBeatOffset: 1.25, durationBeats: 0.25 },
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 1.5,  durationBeats: 0.25, technique: "pull" },
      { stringIndex: 3, fretOffset: 0, startBeatOffset: 1.75, durationBeats: 0.25 },
      { stringIndex: 2, fretOffset: 5, startBeatOffset: 2,    durationBeats: 0.25 },
      { stringIndex: 2, fretOffset: 3, startBeatOffset: 2.25, durationBeats: 0.25 },
      { stringIndex: 2, fretOffset: 0, startBeatOffset: 2.5,  durationBeats: 0.25 },
      { stringIndex: 2, fretOffset: 2, startBeatOffset: 2.75, durationBeats: 1.25, technique: "bend", bendSemitones: 1 },
    ],
  },

  // ── Jazz ───────────────────────────────────────────────────────────────────

  {
    id: "jazz-chord-walk",
    name: "Chord Tone Walk",
    style: "jazz",
    difficulty: "beginner",
    description: "Arpeggiate root–3rd–5th–7th up the strings for a clean jazz line.",
    recommendedScale: "Dorian",
    scaleIntervals: [0, 2, 3, 5, 7, 9, 10],
    totalBeats: 4,
    notes: [
      { stringIndex: 2, fretOffset: 0, startBeatOffset: 0,   durationBeats: 1 },
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 1,   durationBeats: 1 },
      { stringIndex: 4, fretOffset: 0, startBeatOffset: 2,   durationBeats: 1 },
      { stringIndex: 5, fretOffset: 2, startBeatOffset: 3,   durationBeats: 1 },
    ],
  },

  {
    id: "jazz-chromatic-approach",
    name: "Chromatic Approach",
    style: "jazz",
    difficulty: "intermediate",
    description: "Two chromatic passing tones below the root create bebop-style tension.",
    recommendedScale: "Dorian",
    scaleIntervals: [0, 2, 3, 5, 7, 9, 10],
    totalBeats: 2,
    notes: [
      // b7 → chromatic → root (approach from below, fretOffset -2 and -1 relative)
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 0,    durationBeats: 0.25 },
      // Half-step below root on same string (fretOffset -1 from root = centerFret-1, but we clamp; use high-e instead)
      { stringIndex: 5, fretOffset: 5, startBeatOffset: 0.25, durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 6, startBeatOffset: 0.5,  durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 7, startBeatOffset: 0.75, durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 1,    durationBeats: 1 },
    ],
  },

  {
    id: "jazz-bebop-fragment",
    name: "Bebop Fragment",
    style: "jazz",
    difficulty: "advanced",
    description: "Syncopated 8th-note phrase with the b7 tone — pure bebop vocabulary.",
    recommendedScale: "Mixolydian",
    scaleIntervals: [0, 2, 4, 5, 7, 9, 10],
    totalBeats: 2,
    notes: [
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 0,    durationBeats: 0.25 },
      { stringIndex: 3, fretOffset: 4, startBeatOffset: 0.25, durationBeats: 0.25 },
      { stringIndex: 3, fretOffset: 5, startBeatOffset: 0.5,  durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0.75, durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 5, startBeatOffset: 1,    durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 7, startBeatOffset: 1.25, durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 5, startBeatOffset: 1.5,  durationBeats: 0.5 },
    ],
  },

  {
    id: "jazz-ii-v-phrase",
    name: "ii–V Phrase",
    style: "jazz",
    difficulty: "intermediate",
    description: "Classic ii–V resolution line — the cornerstone of jazz improvisation.",
    recommendedScale: "Dorian",
    scaleIntervals: [0, 2, 3, 5, 7, 9, 10],
    totalBeats: 4,
    notes: [
      { stringIndex: 2, fretOffset: 2, startBeatOffset: 0,   durationBeats: 0.5 },
      { stringIndex: 3, fretOffset: 0, startBeatOffset: 0.5, durationBeats: 0.5 },
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 1,   durationBeats: 0.5 },
      { stringIndex: 3, fretOffset: 5, startBeatOffset: 1.5, durationBeats: 0.5 },
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 2,   durationBeats: 0.5 },
      { stringIndex: 4, fretOffset: 5, startBeatOffset: 2.5, durationBeats: 0.5 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 3,   durationBeats: 1 },
    ],
  },

  {
    id: "jazz-enclosure",
    name: "Enclosure Motif",
    style: "jazz",
    difficulty: "intermediate",
    description: "Encircle the target note from above and below — an essential jazz trick.",
    recommendedScale: "Dorian",
    scaleIntervals: [0, 2, 3, 5, 7, 9, 10],
    totalBeats: 2,
    notes: [
      // Approach target (root) from above (fretOffset 2 = major 2nd), then below (fretOffset -1 → use b7 on adjacent string), then land
      { stringIndex: 4, fretOffset: 2, startBeatOffset: 0,    durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 0.25, durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 5, startBeatOffset: 0.5,  durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 7, startBeatOffset: 0.75, durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 0, startBeatOffset: 1,    durationBeats: 1 },
    ],
  },

  {
    id: "jazz-altered-phrase",
    name: "Altered Phrase",
    style: "jazz",
    difficulty: "advanced",
    description: "Tense, chromatic line from the altered scale — resolves with impact.",
    recommendedScale: "Dorian",
    scaleIntervals: [0, 2, 3, 5, 7, 9, 10],
    totalBeats: 3,
    notes: [
      { stringIndex: 3, fretOffset: 1, startBeatOffset: 0,    durationBeats: 0.25 },
      { stringIndex: 3, fretOffset: 2, startBeatOffset: 0.25, durationBeats: 0.25 },
      { stringIndex: 3, fretOffset: 4, startBeatOffset: 0.5,  durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 1, startBeatOffset: 0.75, durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 3, startBeatOffset: 1,    durationBeats: 0.25 },
      { stringIndex: 4, fretOffset: 5, startBeatOffset: 1.25, durationBeats: 0.25 },
      { stringIndex: 5, fretOffset: 2, startBeatOffset: 1.5,  durationBeats: 1.5 },
    ],
  },
];
