import { describe, expect, it } from "vitest";
import { octaveCorrect } from "./octaveCorrect";

const SR = 44100;
const FRAME_LEN = 2048;

function makeSineFrame(freq: number, lengthIn = FRAME_LEN): Float32Array {
  const f = new Float32Array(lengthIn);
  for (let i = 0; i < lengthIn; i++) f[i] = Math.sin((2 * Math.PI * freq * i) / SR);
  return f;
}

describe("octaveCorrect", () => {
  it("returns input freq when the half-frequency falls below minFreq", () => {
    // Detected 80 Hz; half (40 Hz) is below minFreq=70, so no correction
    // even if autocorrelation at 2T looks strong on the input frame.
    const frame = makeSineFrame(80);
    const out = octaveCorrect(frame, 80, SR, 70);
    expect(out).toBe(80);
  });

  it("returns input freq for non-positive or non-finite input", () => {
    const frame = makeSineFrame(220);
    expect(octaveCorrect(frame, 0, SR, 70)).toBe(0);
    expect(octaveCorrect(frame, -10, SR, 70)).toBe(-10);
    expect(octaveCorrect(frame, NaN, SR, 70)).toBeNaN();
    expect(octaveCorrect(frame, Infinity, SR, 70)).toBe(Infinity);
  });

  it("drops to the lower octave when the input frame is actually that octave", () => {
    // YIN reported 880 Hz (octave too high) but the signal is really 440 Hz.
    const frame = makeSineFrame(440);
    const out = octaveCorrect(frame, 880, SR, 70);
    expect(out).toBeCloseTo(440, 6);
  });

  it("does not throw when the half-period exceeds the frame length", () => {
    // Very low freq at small frame; halfPeriod >= frame.length should bail.
    const shortFrame = makeSineFrame(220, 64);
    expect(() => octaveCorrect(shortFrame, 200, SR, 70)).not.toThrow();
    expect(octaveCorrect(shortFrame, 200, SR, 70)).toBe(200);
  });
});
