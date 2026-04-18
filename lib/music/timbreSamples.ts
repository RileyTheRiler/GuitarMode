export type TimbreSample = {
  id: string;
  name: string;
  description: string;
  // Normalized harmonic amplitudes h1..h8 (h1 = fundamental).
  harmonics: number[];
};

// Hand-crafted reference profiles. The numbers are relative harmonic energies
// after normalization (h1 = 1). They are rough-but-musically-meaningful
// starting points — users can replace them with recordings of their own.
export const TIMBRE_SAMPLES: TimbreSample[] = [
  {
    id: "neck-warm",
    name: "Neck pickup (warm)",
    description: "Dominant fundamental with a steep roll-off. Classic clean neck-pickup voicing.",
    harmonics: [1, 0.75, 0.4, 0.2, 0.1, 0.06, 0.04, 0.02],
  },
  {
    id: "bridge-bright",
    name: "Bridge pickup (bright)",
    description: "Strong upper harmonics. Cuts through a mix — think single-coil bridge.",
    harmonics: [1, 0.9, 0.7, 0.55, 0.45, 0.35, 0.25, 0.18],
  },
  {
    id: "acoustic-balanced",
    name: "Acoustic (balanced)",
    description: "Even taper. Balanced partials with a slow roll-off.",
    harmonics: [1, 0.6, 0.45, 0.3, 0.22, 0.15, 0.1, 0.06],
  },
];
