/**
 * In-place radix-2 Cooley–Tukey FFT. Expects `re.length === im.length` and a
 * power of two. Writes the complex DFT back into re/im.
 *
 * Used offline only; live analysis pulls FFT magnitudes straight from an
 * AnalyserNode and never hits this path.
 */
export function radix2FFT(re: Float32Array, im: Float32Array): void {
  const n = re.length;
  if (n !== im.length) throw new Error("re/im length mismatch");
  if (n === 0 || (n & (n - 1)) !== 0) {
    throw new Error("FFT length must be a power of two");
  }

  // Bit-reverse permutation
  let j = 0;
  for (let i = 1; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }

  // Butterfly
  for (let len = 2; len <= n; len <<= 1) {
    const half = len >> 1;
    const theta = (-2 * Math.PI) / len;
    const wRe = Math.cos(theta);
    const wIm = Math.sin(theta);
    for (let i = 0; i < n; i += len) {
      let cRe = 1;
      let cIm = 0;
      for (let k = 0; k < half; k++) {
        const uRe = re[i + k];
        const uIm = im[i + k];
        const vRe = re[i + k + half] * cRe - im[i + k + half] * cIm;
        const vIm = re[i + k + half] * cIm + im[i + k + half] * cRe;
        re[i + k] = uRe + vRe;
        im[i + k] = uIm + vIm;
        re[i + k + half] = uRe - vRe;
        im[i + k + half] = uIm - vIm;
        const nRe = cRe * wRe - cIm * wIm;
        const nIm = cRe * wIm + cIm * wRe;
        cRe = nRe;
        cIm = nIm;
      }
    }
  }
}
