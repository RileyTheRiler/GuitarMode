import { describe, it, expect } from "vitest";
import { computeChroma } from "./chroma";

const SAMPLE_RATE = 44100;
const A4_HZ = 440;
const FFT_SIZE = 2048;
const BIN_HZ = SAMPLE_RATE / FFT_SIZE;

function makeSpectrumWithPeak(peakFreq: number): Float32Array {
  const n = FFT_SIZE / 2;
  const data = new Float32Array(n).fill(-120);
  const bin = Math.round(peakFreq / BIN_HZ);
  if (bin > 0 && bin < n) data[bin] = 0;
  return data;
}

describe("computeChroma", () => {
  it("returns a 12-element array", () => {
    const spectrum = new Float32Array(FFT_SIZE / 2).fill(-90);
    const chroma = computeChroma(spectrum, SAMPLE_RATE, A4_HZ, 70, 1400);
    expect(chroma).toHaveLength(12);
  });

  it("all zeros for a below-floor spectrum", () => {
    const spectrum = new Float32Array(FFT_SIZE / 2).fill(-120);
    const chroma = computeChroma(spectrum, SAMPLE_RATE, A4_HZ, 70, 1400);
    expect(chroma.every((v) => v === 0)).toBe(true);
  });

  it("lights up pitch class 9 (A) for a 440 Hz peak", () => {
    const spectrum = makeSpectrumWithPeak(440);
    const chroma = computeChroma(spectrum, SAMPLE_RATE, A4_HZ, 70, 1400);
    const maxPc = chroma.indexOf(Math.max(...chroma));
    expect(maxPc).toBe(9);
  });

  it("lights up pitch class 0 (C) for a ~261 Hz peak", () => {
    const spectrum = makeSpectrumWithPeak(261.63);
    const chroma = computeChroma(spectrum, SAMPLE_RATE, A4_HZ, 70, 1400);
    const maxPc = chroma.indexOf(Math.max(...chroma));
    expect(maxPc).toBe(0);
  });

  it("ignores bins outside [minFreq, maxFreq]", () => {
    const spectrum = new Float32Array(FFT_SIZE / 2).fill(-120);
    spectrum[Math.round(5000 / BIN_HZ)] = 0;
    const chroma = computeChroma(spectrum, SAMPLE_RATE, A4_HZ, 70, 1400);
    expect(chroma.every((v) => v === 0)).toBe(true);
  });

  it("returns non-negative values", () => {
    const spectrum = makeSpectrumWithPeak(220);
    const chroma = computeChroma(spectrum, SAMPLE_RATE, A4_HZ, 70, 1400);
    expect(chroma.every((v) => v >= 0)).toBe(true);
  });
});
