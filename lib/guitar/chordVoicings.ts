import { midiToPitchClass } from "../music/notes";
import type { DiatonicTriad } from "../music/diatonicChords";

export type VoicingNote = { stringIndex: number; fret: number };
export type Voicing = VoicingNote[];

// Fret offsets relative to the root fret, per string (index = string).
// null = muted string.
type Shape = (number | null)[];

const E_SHAPE: Record<string, Shape> = {
  maj: [0, 2, 2, 1, 0, 0],
  min: [0, 2, 2, 0, 0, 0],
  dim: [0, 1, 2, 0, null, null],
  aug: [0, 2, 2, 1, 1, null],
  other: [0, 2, 2, 1, 0, 0],
};

const A_SHAPE: Record<string, Shape> = {
  maj: [null, 0, 2, 2, 2, 0],
  min: [null, 0, 2, 2, 1, 0],
  dim: [null, 0, 1, 2, 1, null],
  aug: [null, 0, 2, 2, 2, 1],
  other: [null, 0, 2, 2, 2, 0],
};

function rootFretOnString(rootPc: number, stringIndex: number, tuning: number[]): number {
  const openPc = midiToPitchClass(tuning[stringIndex]);
  return ((rootPc - openPc) + 12) % 12;
}

function applyShape(
  rootFret: number,
  shape: Shape,
  maxFret = 19
): Voicing | null {
  const notes: VoicingNote[] = [];
  for (let s = 0; s < shape.length; s++) {
    const offset = shape[s];
    if (offset === null) continue;
    const fret = rootFret + offset;
    if (fret < 0 || fret > maxFret) return null;
    notes.push({ stringIndex: s, fret });
  }
  return notes.length >= 3 ? notes : null;
}

export function findVoicings(
  root: number,
  quality: DiatonicTriad["quality"],
  tuning: number[]
): Voicing[] {
  const q = quality === "other" ? "maj" : quality;
  const eShape = E_SHAPE[q];
  const aShape = A_SHAPE[q];

  const results: Voicing[] = [];

  // E-shape: root on string 0 (low E)
  const eLo = rootFretOnString(root, 0, tuning);
  const eVoicingLo = applyShape(eLo, eShape);
  if (eVoicingLo) results.push(eVoicingLo);
  // Also the octave position if the low fret is very low (< 2)
  if (eLo < 2) {
    const eVoicingHi = applyShape(eLo + 12, eShape);
    if (eVoicingHi) results.push(eVoicingHi);
  }

  // A-shape: root on string 1 (A)
  const aLo = rootFretOnString(root, 1, tuning);
  const aVoicingLo = applyShape(aLo, aShape);
  if (aVoicingLo) results.push(aVoicingLo);
  if (aLo < 2) {
    const aVoicingHi = applyShape(aLo + 12, aShape);
    if (aVoicingHi) results.push(aVoicingHi);
  }

  // Deduplicate and sort by lowest fret (open positions first)
  const seen = new Set<string>();
  return results
    .filter((v) => {
      const key = v.map((n) => `${n.stringIndex}:${n.fret}`).join(",");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Math.min(...a.map((n) => n.fret)) - Math.min(...b.map((n) => n.fret)))
    .slice(0, 3);
}
