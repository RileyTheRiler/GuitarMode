import { freqToMidi } from "../music/notes";

/**
 * Compute a 12-bin chromagram from FFT frequency-domain data (in dB, as
 * returned by AnalyserNode.getFloatFrequencyData). Applies:
 *   1. dB → linear magnitude conversion (with noise-floor clamp).
 *   2. Folding every in-range bin into its pitch class, weighted by energy.
 *   3. Harmonic suppression: for each pitch-class that has energy, subtract
 *      a fraction of it from the pitch-classes that would be its 2nd, 3rd,
 *      4th and 5th harmonics, so that e.g. a low E doesn't also light up B.
 *   4. Local-max gating so only pitch-classes that stand out above their
 *      neighbors contribute; eliminates wide-band energy leak.
 */
export function computeChroma(
  freqDataDb: Float32Array,
  sampleRate: number,
  a4Hz: number,
  minFreq: number,
  maxFreq: number
): number[] {
  const n = freqDataDb.length; // = fftSize / 2
  const binHz = sampleRate / (2 * n);

  const chroma: number[] = Array(12).fill(0);

  for (let k = 1; k < n; k++) {
    const f = k * binHz;
    if (f < minFreq || f > maxFreq) continue;
    const db = freqDataDb[k];
    if (db < -80) continue; // below noise floor
    const magSq = Math.pow(10, db / 10); // linear power

    const midi = freqToMidi(f, a4Hz);
    const pc = ((Math.round(midi) % 12) + 12) % 12;
    chroma[pc] += magSq;
  }

  // Harmonic suppression — subtract a fraction of each PC's energy from the
  // PCs its harmonics would land in. Ratios: octave=1 (same pc, skip),
  // 2nd=fifth (pc+7), 3rd=octave+fifth (pc+7 again, skip), 4th=2 octaves
  // (skip), 5th=major third (pc+4).
  const suppressed = [...chroma];
  const suppressFifth = 0.5;
  const suppressThird = 0.3;
  for (let pc = 0; pc < 12; pc++) {
    const src = chroma[pc];
    suppressed[(pc + 7) % 12] -= src * suppressFifth;
    suppressed[(pc + 4) % 12] -= src * suppressThird;
  }

  // Clamp negatives.
  for (let i = 0; i < 12; i++) {
    if (suppressed[i] < 0) suppressed[i] = 0;
  }

  // Local-max gating: only keep a pitch class if it's ≥ 0.6× the average of
  // its two chromatic neighbors. Suppresses broad spectral energy (noise).
  const gated: number[] = Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    const left = suppressed[(i + 11) % 12];
    const right = suppressed[(i + 1) % 12];
    const neighborAvg = (left + right) / 2;
    if (suppressed[i] >= 0.6 * Math.max(neighborAvg, 1e-12)) {
      gated[i] = suppressed[i];
    }
  }

  return gated;
}
