export const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export type PitchClass = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export const DEFAULT_A4_HZ = 440;

export function freqToMidi(freq: number, a4Hz: number = DEFAULT_A4_HZ): number {
  return 69 + 12 * Math.log2(freq / a4Hz);
}

export function midiToFreq(midi: number, a4Hz: number = DEFAULT_A4_HZ): number {
  return a4Hz * Math.pow(2, (midi - 69) / 12);
}

export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const pc = ((rounded % 12) + 12) % 12;
  const octave = Math.floor(rounded / 12) - 1;
  return `${NOTE_NAMES[pc]}${octave}`;
}

export function midiToPitchClass(midi: number): PitchClass {
  const rounded = Math.round(midi);
  return (((rounded % 12) + 12) % 12) as PitchClass;
}

export function pitchClassName(pc: number): string {
  return NOTE_NAMES[((pc % 12) + 12) % 12];
}

// Distinguishable colors per pitch-class (12-hue wheel).
export const PITCH_CLASS_COLORS: string[] = [
  "#ef4444", // C   - red
  "#f97316", // C#  - orange
  "#f59e0b", // D   - amber
  "#eab308", // D#  - yellow
  "#84cc16", // E   - lime
  "#22c55e", // F   - green
  "#14b8a6", // F#  - teal
  "#06b6d4", // G   - cyan
  "#3b82f6", // G#  - blue
  "#8b5cf6", // A   - violet
  "#d946ef", // A#  - fuchsia
  "#ec4899", // B   - pink
];

export function colorForPitchClass(pc: number): string {
  return PITCH_CLASS_COLORS[((pc % 12) + 12) % 12];
}
