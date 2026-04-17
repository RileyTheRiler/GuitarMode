import { midiToPitchClass, midiToNoteName } from "../music/notes";

// Standard tuning, low-to-high, as MIDI note numbers.
// E2=40, A2=45, D3=50, G3=55, B3=59, E4=64
export const STANDARD_TUNING: number[] = [40, 45, 50, 55, 59, 64];

export const STRING_LABELS = ["E", "A", "D", "G", "B", "e"] as const;

export type FretPosition = {
  stringIndex: number; // 0 = low E
  fret: number; // 0 = open
  midi: number;
  pitchClass: number;
  noteName: string;
};

export function getNoteAt(stringIndex: number, fret: number): FretPosition {
  const midi = STANDARD_TUNING[stringIndex] + fret;
  return {
    stringIndex,
    fret,
    midi,
    pitchClass: midiToPitchClass(midi),
    noteName: midiToNoteName(midi),
  };
}

export function allPositions(maxFret: number): FretPosition[] {
  const positions: FretPosition[] = [];
  for (let s = 0; s < STANDARD_TUNING.length; s++) {
    for (let f = 0; f <= maxFret; f++) {
      positions.push(getNoteAt(s, f));
    }
  }
  return positions;
}

export function positionsForPitchClass(pc: number, maxFret: number): FretPosition[] {
  return allPositions(maxFret).filter((p) => p.pitchClass === pc);
}
