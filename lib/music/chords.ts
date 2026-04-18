import { NOTE_NAMES } from "./notes";

export type ChordQuality =
  | "maj"
  | "min"
  | "7"
  | "maj7"
  | "min7"
  | "dim"
  | "sus2"
  | "sus4";

export type ChordTemplate = {
  intervals: number[];
  thirdIdx: number | null;
  fifthIdx: number | null;
};

export const CHORD_TEMPLATES: Record<ChordQuality, ChordTemplate> = {
  maj: { intervals: [0, 4, 7], thirdIdx: 1, fifthIdx: 2 },
  min: { intervals: [0, 3, 7], thirdIdx: 1, fifthIdx: 2 },
  "7": { intervals: [0, 4, 7, 10], thirdIdx: 1, fifthIdx: 2 },
  maj7: { intervals: [0, 4, 7, 11], thirdIdx: 1, fifthIdx: 2 },
  min7: { intervals: [0, 3, 7, 10], thirdIdx: 1, fifthIdx: 2 },
  dim: { intervals: [0, 3, 6], thirdIdx: 1, fifthIdx: 2 },
  sus2: { intervals: [0, 2, 7], thirdIdx: null, fifthIdx: 2 },
  sus4: { intervals: [0, 5, 7], thirdIdx: null, fifthIdx: 2 },
};

const ROOT_PITCH_CLASS: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

const CHORD_REGEX = /^([A-G])(#|b)?(maj7|min7|m7|maj|min|m|7|dim|sus2|sus4)?$/;

export function parseChord(
  input: string
): { root: number; quality: ChordQuality } | null {
  if (!input) return null;
  const match = input.trim().match(CHORD_REGEX);
  if (!match) return null;
  const [, letter, accidental, suffix] = match;
  const base = ROOT_PITCH_CLASS[letter];
  if (base == null) return null;
  const shift = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  const root = ((base + shift) % 12 + 12) % 12;

  let quality: ChordQuality;
  if (!suffix) quality = "maj";
  else if (suffix === "m" || suffix === "min") quality = "min";
  else if (suffix === "m7") quality = "min7";
  else quality = suffix as ChordQuality;

  return { root, quality };
}

export type ChordPitchClasses = {
  root: number;
  third: number | null;
  fifth: number | null;
  all: Set<number>;
};

export function chordPitchClasses(
  root: number,
  quality: ChordQuality
): ChordPitchClasses {
  const tmpl = CHORD_TEMPLATES[quality];
  const all = new Set<number>();
  for (const i of tmpl.intervals) all.add((root + i) % 12);
  const pcAt = (idx: number | null) =>
    idx == null ? null : (root + tmpl.intervals[idx]) % 12;
  return {
    root: root % 12,
    third: pcAt(tmpl.thirdIdx),
    fifth: pcAt(tmpl.fifthIdx),
    all,
  };
}

export function chordDisplayName(root: number, quality: ChordQuality): string {
  return `${NOTE_NAMES[((root % 12) + 12) % 12]}${quality === "maj" ? "" : quality}`;
}
