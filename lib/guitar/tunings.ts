// Built-in guitar tunings. Each tuning is stored as 6 MIDI values (low to
// high). Open-string labels are derived from the MIDI pitch class so a new
// tuning doesn't need to specify them.

export type Tuning = {
  id: string;
  name: string;
  midi: number[];
};

export const TUNINGS: Tuning[] = [
  { id: "standard", name: "Standard (EADGBE)", midi: [40, 45, 50, 55, 59, 64] },
  { id: "drop-d", name: "Drop D (DADGBE)", midi: [38, 45, 50, 55, 59, 64] },
  { id: "half-down", name: "Half-step down (E♭A♭D♭G♭B♭E♭)", midi: [39, 44, 49, 54, 58, 63] },
  { id: "full-down", name: "Full-step down (DGCFAD)", midi: [38, 43, 48, 53, 57, 62] },
  { id: "open-g", name: "Open G (DGDGBD)", midi: [38, 43, 50, 55, 59, 62] },
  { id: "dadgad", name: "DADGAD", midi: [38, 45, 50, 55, 57, 62] },
];

export const DEFAULT_TUNING_ID = "standard";

export function getTuning(id: string | null | undefined): Tuning {
  if (!id) return TUNINGS[0];
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0];
}
