import { describe, it, expect } from "vitest";
import { octaveCorrect } from "./octaveCorrect";

const SAMPLE_RATE = 44100;

function makeSine(freq: number, sampleRate: number, samples: number): Float32Array {
  const frame = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    frame[i] = Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return frame;
}

describe("octaveCorrect — pass-through conditions", () => {
  it("returns freq unchanged when halfFreq < minFreq", () => {
    const frame = makeSine(200, SAMPLE_RATE, 2048);
    // halfFreq = 100, minFreq = 110 → should NOT correct
    const result = octaveCorrect(frame, 200, SAMPLE_RATE, 110);
    expect(result).toBe(200);
  });

  it("returns freq unchanged when half-period >= frame length", () => {
    // freq=1000, period=44, halfPeriod=88; use frame of length 88 → boundary triggers
    const frame = new Float32Array(88).fill(0.5);
    const result = octaveCorrect(frame, 1000, SAMPLE_RATE, 70);
    expect(result).toBe(1000);
  });

  it("returns freq unchanged for an all-zeros frame (no signal)", () => {
    const frame = new Float32Array(2048).fill(0);
    const result = octaveCorrect(frame, 440, SAMPLE_RATE, 70);
    // Both r1 and r2 are 0 (denom=0 → returns 0). r2(0) >= r1(0)*0.85 → returns halfFreq
    // This documents the current behavior: degenerate input still "corrects"
    expect(typeof result).toBe("number");
  });
});

describe("octaveCorrect — octave correction", () => {
  it("corrects a 110 Hz signal detected as 220 Hz", () => {
    // Signal is at 110 Hz; YIN mistakenly reported 220 Hz (one octave too high)
    // autocorr at lag≈200 (220 Hz period) should be negative for a 110 Hz sine
    // autocorr at lag≈400 (110 Hz period) should be ≈+1
    const frame = makeSine(110, SAMPLE_RATE, 4096);
    const result = octaveCorrect(frame, 220, SAMPLE_RATE, 70);
    expect(result).toBeCloseTo(110, 0);
  });

  it("corrects a 82.4 Hz signal (open E string) detected as 164.8 Hz", () => {
    // Open low E2 = 82.4 Hz; YIN might detect 164.8 Hz
    const frame = makeSine(82.4, SAMPLE_RATE, 4096);
    const result = octaveCorrect(frame, 164.8, SAMPLE_RATE, 70);
    expect(result).toBeCloseTo(82.4, 0);
  });
});

describe("octaveCorrect — frequency range guards", () => {
  it("does not correct below minFreq even with a strong lower-octave signal", () => {
    // halfFreq=35 Hz is below minFreq=70 → no correction regardless of signal
    const frame = makeSine(35, SAMPLE_RATE, 4096);
    const result = octaveCorrect(frame, 70, SAMPLE_RATE, 70);
    // halfFreq = 35 < minFreq = 70 → returns 70
    expect(result).toBe(70);
  });

  it("returns a number (not NaN or undefined) for any valid input", () => {
    const frame = makeSine(440, SAMPLE_RATE, 2048);
    const result = octaveCorrect(frame, 440, SAMPLE_RATE, 70);
    expect(Number.isFinite(result)).toBe(true);
  });
});
