// Timbre = spectral envelope. Given a dB magnitude spectrum and the fundamental
// frequency f0, we sample the amplitude at k*f0 for k=1..N to build a harmonic
// vector, then compare two such vectors via RMSE to score tonal similarity.

export function extractHarmonics(
  magDb: Float32Array | number[],
  sampleRate: number,
  f0Hz: number,
  numHarmonics = 8,
  searchBins = 2
): number[] {
  const out = new Array<number>(numHarmonics).fill(0);
  if (!(f0Hz > 0) || !isFinite(f0Hz)) return out;
  const bins = magDb.length;
  const fftSize = bins * 2;
  const nyquist = sampleRate / 2;

  for (let k = 1; k <= numHarmonics; k++) {
    const freq = k * f0Hz;
    if (freq >= nyquist) break;
    const center = Math.round((freq * fftSize) / sampleRate);
    const lo = Math.max(0, center - searchBins);
    const hi = Math.min(bins - 1, center + searchBins);
    let peakDb = -Infinity;
    for (let i = lo; i <= hi; i++) {
      const v = magDb[i];
      if (v > peakDb) peakDb = v;
    }
    if (!isFinite(peakDb)) continue;
    // dB → linear amplitude.
    out[k - 1] = Math.pow(10, peakDb / 20);
  }
  return out;
}

export function normalizeHarmonics(h: number[]): number[] {
  let max = 0;
  for (const v of h) if (v > max) max = v;
  if (max <= 1e-12) return h.map(() => 0);
  return h.map((v) => v / max);
}

export function rmsError(user: number[], ref: number[]): number {
  const n = Math.min(user.length, ref.length);
  if (n === 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const d = user[i] - ref[i];
    sum += d * d;
  }
  return Math.sqrt(sum / n);
}

export function similarity(user: number[], ref: number[]): number {
  const e = rmsError(user, ref);
  return Math.max(0, 1 - Math.min(1, e));
}
