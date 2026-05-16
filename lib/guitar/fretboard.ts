import { midiToPitchClass, midiToNoteName, pitchClassName } from "../music/notes";
import { TUNINGS } from "./tunings";

// Standard tuning, low-to-high, as MIDI note numbers.
// E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
export const STANDARD_TUNING: number[] = TUNINGS[0].midi;

// Open-string display labels for standard tuning. Other tunings derive
// their labels from MIDI pitch classes via `stringLabelsFor`.
export const STRING_LABELS = ["E", "A", "D", "G", "B", "e"] as const;

export type FretPosition = {
  stringIndex: number; // 0 = low E
  fret: number; // 0 = open
  midi: number;
  pitchClass: number;
  noteName: string;
};

export function getNoteAt(
  stringIndex: number,
  fret: number,
  tuning: number[] = STANDARD_TUNING
): FretPosition {
  const midi = tuning[stringIndex] + fret;
  return {
    stringIndex,
    fret,
    midi,
    pitchClass: midiToPitchClass(midi),
    noteName: midiToNoteName(midi),
  };
}

export function allPositions(
  maxFret: number,
  tuning: number[] = STANDARD_TUNING
): FretPosition[] {
  const positions: FretPosition[] = [];
  for (let s = 0; s < tuning.length; s++) {
    for (let f = 0; f <= maxFret; f++) {
      positions.push(getNoteAt(s, f, tuning));
    }
  }
  return positions;
}

export function positionsForPitchClass(
  pc: number,
  maxFret: number,
  tuning: number[] = STANDARD_TUNING
): FretPosition[] {
  return allPositions(maxFret, tuning).filter((p) => p.pitchClass === pc);
}

/**
 * Open-string labels for an arbitrary tuning, derived from each string's
 * MIDI pitch class. Standard tuning keeps its conventional "E A D G B e"
 * lower-case e for the high string; other tunings just use the note name.
 */
export function stringLabelsFor(tuning: number[]): string[] {
  if (
    tuning.length === STANDARD_TUNING.length &&
    tuning.every((m, i) => m === STANDARD_TUNING[i])
  ) {
    return [...STRING_LABELS];
  }
  return tuning.map((m) => pitchClassName(midiToPitchClass(m)));
}
