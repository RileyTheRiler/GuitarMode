import { describe, expect, it } from "vitest";
import {
  extractHarmonics,
  normalizeHarmonics,
  rmsError,
  similarity,
} from "./timbre";

// Synthesize a dB magnitude buffer with peaks at k*f0 and given linear ratios.
function synthDb(
  bins: number,
  sampleRate: number,
  f0: number,
  ratios: number[]
): Float32Array {
  const buf = new Float32Array(bins).fill(-120);
  const fftSize = bins * 2;
  ratios.forEach((r, k0) => {
    const k = k0 + 1;
    const bin = Math.round((k * f0 * fftSize) / sampleRate);
    if (bin >= 0 && bin < bins) {
      buf[bin] = 20 * Math.log10(r);
    }
  });
  return buf;
}

describe("extractHarmonics", () => {
  it("recovers injected harmonic ratios", () => {
    const ratios = [1, 0.5, 0.25, 0.125];
    const buf = synthDb(1024, 44100, 220, ratios);
    const h = extractHarmonics(buf, 44100, 220, 4);
    for (let i = 0; i < ratios.length; i++) {
      expect(h[i]).toBeCloseTo(ratios[i], 2);
    }
  });

  it("returns zeros when f0 is invalid", () => {
    const buf = new Float32Array(1024).fill(-120);
    expect(extractHarmonics(buf, 44100, 0, 8)).toEqual(Array(8).fill(0));
    expect(extractHarmonics(buf, 44100, NaN, 8)).toEqual(Array(8).fill(0));
  });

  it("stops past Nyquist", () => {
    const buf = new Float32Array(1024).fill(-120);
    // f0 close to Nyquist — only first harmonic fits
    const h = extractHarmonics(buf, 44100, 20000, 8);
    expect(h.slice(1).every((v) => v === 0)).toBe(true);
  });
});

describe("normalizeHarmonics", () => {
  it("divides by max", () => {
    expect(normalizeHarmonics([0.5, 1, 0.25])).toEqual([0.5, 1, 0.25]);
    expect(normalizeHarmonics([2, 1, 0.5])).toEqual([1, 0.5, 0.25]);
  });

  it("safe on all-zero input", () => {
    expect(normalizeHarmonics([0, 0, 0])).toEqual([0, 0, 0]);
  });
});

describe("rmsError and similarity", () => {
  it("is zero for identical vectors", () => {
    expect(rmsError([1, 0.5, 0.25], [1, 0.5, 0.25])).toBe(0);
    expect(similarity([1, 0.5], [1, 0.5])).toBe(1);
  });

  it("is sqrt(1) for orthogonal unit vectors", () => {
    expect(rmsError([1, 0], [0, 1])).toBeCloseTo(1, 10);
  });

  it("clamps similarity to [0,1]", () => {
    expect(similarity([0, 0], [1, 1])).toBeGreaterThanOrEqual(0);
    expect(similarity([0, 0], [1, 1])).toBeLessThanOrEqual(1);
  });
});
