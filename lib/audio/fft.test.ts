import { describe, it, expect } from "vitest";
import { radix2FFT } from "./fft";

function cosineAtBin(N: number, k: number): Float32Array {
  const re = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    re[n] = Math.cos((2 * Math.PI * k * n) / N);
  }
  return re;
}

function magnitude(re: Float32Array, im: Float32Array, bin: number): number {
  return Math.sqrt(re[bin] * re[bin] + im[bin] * im[bin]);
}

describe("radix2FFT — error conditions", () => {
  it("throws when re and im have different lengths", () => {
    const re = new Float32Array(4);
    const im = new Float32Array(8);
    expect(() => radix2FFT(re, im)).toThrow("re/im length mismatch");
  });

  it("throws for non-power-of-two length", () => {
    const re = new Float32Array(3);
    const im = new Float32Array(3);
    expect(() => radix2FFT(re, im)).toThrow("FFT length must be a power of two");
  });

  it("throws for zero length", () => {
    const re = new Float32Array(0);
    const im = new Float32Array(0);
    expect(() => radix2FFT(re, im)).toThrow();
  });
});

describe("radix2FFT — DC signal", () => {
  it("all-ones input: all energy in bin 0", () => {
    const N = 8;
    const re = new Float32Array(N).fill(1.0);
    const im = new Float32Array(N).fill(0);

    radix2FFT(re, im);

    expect(re[0]).toBeCloseTo(N, 10);
    expect(im[0]).toBeCloseTo(0, 10);
    for (let k = 1; k < N; k++) {
      expect(magnitude(re, im, k)).toBeCloseTo(0, 5);
    }
  });

  it("n=1 edge case: single-element FFT returns input unchanged", () => {
    const re = new Float32Array([3.14]);
    const im = new Float32Array([0]);
    radix2FFT(re, im);
    expect(re[0]).toBeCloseTo(3.14, 5); // float32 precision limit
    expect(im[0]).toBeCloseTo(0, 5);
  });
});

describe("radix2FFT — single-frequency sinusoid", () => {
  it("cosine at bin k has energy only at bins k and N-k", () => {
    const N = 16;
    const k = 3;
    const re = cosineAtBin(N, k);
    const im = new Float32Array(N);

    radix2FFT(re, im);

    expect(magnitude(re, im, k)).toBeCloseTo(N / 2, 5);
    expect(magnitude(re, im, N - k)).toBeCloseTo(N / 2, 5);

    for (let b = 0; b < N; b++) {
      if (b !== k && b !== N - k) {
        expect(magnitude(re, im, b)).toBeCloseTo(0, 4);
      }
    }
  });

  it("bin 0 (DC) has zero magnitude for a pure cosine with k>0", () => {
    const N = 8;
    const re = cosineAtBin(N, 2);
    const im = new Float32Array(N);
    radix2FFT(re, im);
    expect(magnitude(re, im, 0)).toBeCloseTo(0, 5);
  });
});

describe("radix2FFT — round-trip (IFFT)", () => {
  it("IFFT(FFT(x)) recovers the original signal", () => {
    const original = [1, -1, 2, -2, 0.5, -0.5, 1.5, -1.5, 0, 1, 0, -1, 2, 0, -1, 1];
    const N = original.length;
    const re = new Float32Array(original);
    const im = new Float32Array(N);

    radix2FFT(re, im);

    // Inverse FFT: conj(FFT(conj(X))) / N
    for (let i = 0; i < N; i++) im[i] = -im[i];
    radix2FFT(re, im);
    for (let i = 0; i < N; i++) {
      re[i] /= N;
      im[i] = -im[i] / N;
    }

    for (let i = 0; i < N; i++) {
      expect(re[i]).toBeCloseTo(original[i], 5);
      expect(im[i]).toBeCloseTo(0, 5);
    }
  });
});

describe("radix2FFT — Parseval's theorem", () => {
  it("time-domain energy equals frequency-domain energy / N", () => {
    const N = 32;
    const original = Array.from({ length: N }, (_, i) => Math.sin(i * 0.7) + 0.3);
    const re = new Float32Array(original);
    const im = new Float32Array(N);

    const timePower = original.reduce((sum, x) => sum + x * x, 0);

    radix2FFT(re, im);

    const freqPower = Array.from({ length: N }, (_, k) => re[k] * re[k] + im[k] * im[k]).reduce(
      (s, v) => s + v,
      0
    );

    expect(freqPower / N).toBeCloseTo(timePower, 3);
  });
});
