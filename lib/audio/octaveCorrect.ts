/**
 * Normalized autocorrelation at a given lag.
 * Returns a value in [-1, 1]; higher means more periodic at that lag.
 */
function autocorrNormalized(frame: Float32Array, lag: number): number {
  const n = frame.length - lag;
  if (n <= 0) return 0;
  let num = 0, d0 = 0, dLag = 0;
  for (let i = 0; i < n; i++) {
    num += frame[i] * frame[i + lag];
    d0 += frame[i] * frame[i];
    dLag += frame[i + lag] * frame[i + lag];
  }
  const denom = Math.sqrt(d0 * dLag);
  return denom > 1e-12 ? num / denom : 0;
}

/**
 * YIN sometimes detects the 2nd harmonic instead of the fundamental on low
 * strings (open E2, A2, etc.). Cross-check by comparing the autocorrelation
 * strength at period T (detected) vs 2T (one octave lower). Prefer the lower
 * octave when its autocorr is at least 85% as strong.
 */
export function octaveCorrect(
  frame: Float32Array,
  freq: number,
  sampleRate: number,
  minFreq: number
): number {
  // YIN can return 0 / NaN on weak input; bail before the divisions.
  if (!(freq > 0) || !Number.isFinite(freq)) return freq;
  const halfFreq = freq / 2;
  if (halfFreq < minFreq) return freq;

  const period = Math.round(sampleRate / freq);
  const halfPeriod = period * 2;
  if (period < 1 || halfPeriod >= frame.length) return freq;

  const r1 = autocorrNormalized(frame, period);
  const r2 = autocorrNormalized(frame, halfPeriod);

  return r2 >= r1 * 0.85 ? halfFreq : freq;
}
