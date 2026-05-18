// Scale templates are semitone offsets from the root, 0 included.
// `specificity` penalizes unusual scales on thin evidence (higher = rarer).
// `popularity` gives a small bonus to common scales so they rank ahead of
// equivalent-scoring exotics when evidence is ambiguous (higher = more common).

export type ScaleTemplate = {
  name: string;
  intervals: number[];
  specificity: number;
  popularity: number;
};

export const SCALE_TEMPLATES: ScaleTemplate[] = [
  // Diatonic modes
  { name: "Ionian (Major)", intervals: [0, 2, 4, 5, 7, 9, 11], specificity: 0, popularity: 0.15 },
  { name: "Dorian", intervals: [0, 2, 3, 5, 7, 9, 10], specificity: 0.2, popularity: 0.1 },
  { name: "Phrygian", intervals: [0, 1, 3, 5, 7, 8, 10], specificity: 0.3, popularity: 0.05 },
  { name: "Lydian", intervals: [0, 2, 4, 6, 7, 9, 11], specificity: 0.3, popularity: 0.05 },
  { name: "Mixolydian", intervals: [0, 2, 4, 5, 7, 9, 10], specificity: 0.2, popularity: 0.1 },
  { name: "Aeolian (Natural Minor)", intervals: [0, 2, 3, 5, 7, 8, 10], specificity: 0, popularity: 0.15 },
  { name: "Locrian", intervals: [0, 1, 3, 5, 6, 8, 10], specificity: 0.6, popularity: 0 },

  // Pentatonic + blues
  { name: "Major Pentatonic", intervals: [0, 2, 4, 7, 9], specificity: 0.1, popularity: 0.12 },
  { name: "Minor Pentatonic", intervals: [0, 3, 5, 7, 10], specificity: 0.1, popularity: 0.12 },
  { name: "Blues", intervals: [0, 3, 5, 6, 7, 10], specificity: 0.2, popularity: 0.08 },

  // Minor variants
  { name: "Harmonic Minor", intervals: [0, 2, 3, 5, 7, 8, 11], specificity: 0.4, popularity: 0.05 },
  { name: "Melodic Minor", intervals: [0, 2, 3, 5, 7, 9, 11], specificity: 0.5, popularity: 0.03 },

  // Exotic
  { name: "Phrygian Dominant", intervals: [0, 1, 4, 5, 7, 8, 10], specificity: 0.6, popularity: 0.02 },
  { name: "Lydian Dominant", intervals: [0, 2, 4, 6, 7, 9, 10], specificity: 0.6, popularity: 0.02 },
  { name: "Altered (Super Locrian)", intervals: [0, 1, 3, 4, 6, 8, 10], specificity: 0.8, popularity: 0 },
  { name: "Hungarian Minor", intervals: [0, 2, 3, 6, 7, 8, 11], specificity: 0.8, popularity: 0 },
  { name: "Double Harmonic", intervals: [0, 1, 4, 5, 7, 8, 11], specificity: 0.9, popularity: 0 },
];

export function scalePitchClasses(template: ScaleTemplate, root: number): Set<number> {
  const set = new Set<number>();
  for (const i of template.intervals) {
    set.add((root + i) % 12);
  }
  return set;
}
