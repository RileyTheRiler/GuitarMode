export type TuningPreset = {
  id: string;
  label: string;
  midi: number[];
  stringLabels: string[];
};

export const TUNING_PRESETS: TuningPreset[] = [
  {
    id: "standard",
    label: "Standard (EADGBe)",
    midi: [40, 45, 50, 55, 59, 64],
    stringLabels: ["E", "A", "D", "G", "B", "e"],
  },
  {
    id: "dropD",
    label: "Drop D (DADGBe)",
    midi: [38, 45, 50, 55, 59, 64],
    stringLabels: ["D", "A", "D", "G", "B", "e"],
  },
  {
    id: "halfDown",
    label: "Half step down (Eb)",
    midi: [39, 44, 49, 54, 58, 63],
    stringLabels: ["Eb", "Ab", "Db", "Gb", "Bb", "eb"],
  },
  {
    id: "fullDown",
    label: "Full step down (D)",
    midi: [38, 43, 48, 53, 57, 62],
    stringLabels: ["D", "G", "C", "F", "A", "d"],
  },
  {
    id: "openG",
    label: "Open G (DGDGBd)",
    midi: [38, 43, 50, 55, 59, 62],
    stringLabels: ["D", "G", "D", "G", "B", "d"],
  },
  {
    id: "openD",
    label: "Open D (DADf#ad)",
    midi: [38, 45, 50, 54, 57, 62],
    stringLabels: ["D", "A", "D", "F#", "A", "d"],
  },
  {
    id: "dadgad",
    label: "DADGAD",
    midi: [38, 45, 50, 55, 57, 62],
    stringLabels: ["D", "A", "D", "G", "A", "d"],
  },
];

export const STANDARD_TUNING_PRESET = TUNING_PRESETS[0];
