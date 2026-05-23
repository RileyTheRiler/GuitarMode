import type { ScaleTemplate } from "./scales";

export interface PatternPosition {
  stringIndex: number;
  fret: number;
  degreeIndex: number;
  degreeLabel: string;
  fingerIndex: number; // 0=index(orange), 1=middle(green), 2=ring(red), 3=pinky(blue)
}

export interface ScalePattern {
  index: number;
  label: string;
  startFret: number;
  endFret: number;
  centerFret: number;
  positions: PatternPosition[];
}

const DEGREE_LABELS = ["1","♭2","2","♭3","3","4","♯4","5","♭6","6","♭7","7"];
const SPAN = 4;

/**
 * Compute up to `count` CAGED-style positional patterns for a scale by finding
 * where the root note falls on each string and using those frets as box anchors.
 */
export function computeScalePatterns(
  scale: ScaleTemplate,
  rootPitchClass: number,
  tuning: number[],
  numFrets = 22,
  count = 5
): ScalePattern[] {
  const { intervals } = scale;
  const numStrings = tuning.length;

  // Map pitchClass → degree info
  const pcToDegree = new Map<number, { idx: number; label: string }>();
  for (let i = 0; i < intervals.length; i++) {
    const pc = (rootPitchClass + intervals[i]) % 12;
    pcToDegree.set(pc, { idx: i, label: DEGREE_LABELS[intervals[i]] ?? String(intervals[i]) });
  }

  // For each string, find the first root fret >= 1 that fits within the fretboard
  const anchorFrets = new Set<number>();
  for (let s = 0; s < numStrings; s++) {
    const openPc = tuning[s] % 12;
    const offset = ((rootPitchClass - openPc) % 12 + 12) % 12;
    // If offset=0 the open string is the root; use fret 12 (octave) instead
    const firstFret = offset === 0 ? 12 : offset;
    if (firstFret >= 1 && firstFret <= numFrets - SPAN) {
      anchorFrets.add(firstFret);
    }
  }

  let starts = [...anchorFrets].sort((a, b) => a - b);

  // If fewer than count, pad with octave-shifted copies of the lowest positions
  if (starts.length < count && starts.length > 0) {
    const base = [...starts];
    for (const f of base) {
      if (starts.length >= count) break;
      const next = f + 12;
      if (next <= numFrets - SPAN && !anchorFrets.has(next)) starts.push(next);
    }
    starts.sort((a, b) => a - b);
  }

  // If more than count, pick most evenly spread positions
  if (starts.length > count) {
    const selected: number[] = [starts[0]];
    for (const f of starts.slice(1)) {
      if (selected.length >= count) break;
      if (f - selected[selected.length - 1] >= 3) selected.push(f);
    }
    // Fill remaining slots if we still need more
    for (const f of starts) {
      if (selected.length >= count) break;
      if (!selected.includes(f)) selected.push(f);
    }
    starts = selected.sort((a, b) => a - b).slice(0, count);
  }

  // Enumerate all scale note positions on the fretboard
  type RawPos = { s: number; f: number; degreeIdx: number; degreeLabel: string };
  const allPos: RawPos[] = [];
  for (let s = 0; s < numStrings; s++) {
    for (let f = 1; f <= numFrets; f++) {
      const pc = (tuning[s] + f) % 12;
      const deg = pcToDegree.get(pc);
      if (deg !== undefined) allPos.push({ s, f, degreeIdx: deg.idx, degreeLabel: deg.label });
    }
  }

  return starts.map((startFret, idx) => {
    const endFret = startFret + SPAN;
    const centerFret = startFret + 2;
    const positions: PatternPosition[] = allPos
      .filter((p) => p.f >= startFret && p.f <= endFret)
      .map((p) => ({
        stringIndex: p.s,
        fret: p.f,
        degreeIndex: p.degreeIdx,
        degreeLabel: p.degreeLabel,
        fingerIndex: Math.min(p.f - startFret, 3),
      }));
    return { index: idx, label: `Pattern ${idx + 1}`, startFret, endFret, centerFret, positions };
  });
}
