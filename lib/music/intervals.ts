export const INTERVAL_NAMES = [
  "P1", "m2", "M2", "m3", "M3", "P4", "TT", "P5", "m6", "M6", "m7", "M7",
] as const;

export type IntervalName = (typeof INTERVAL_NAMES)[number];

export function intervalName(semitones: number): IntervalName {
  return INTERVAL_NAMES[((semitones % 12) + 12) % 12];
}

export function intervalDirection(from: number, to: number): "up" | "down" | "unison" {
  if (from === to) return "unison";
  return to > from ? "up" : "down";
}
