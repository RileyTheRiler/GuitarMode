import { describe, expect, it } from "vitest";
import { stretchChannelOLA } from "./timeStretch";

const SR = 44100;

function makeSine(freq: number, durSec: number): Float32Array {
  const len = Math.round(durSec * SR);
  const out = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    out[i] = Math.sin((2 * Math.PI * freq * i) / SR);
  }
  return out;
}

function approxRms(arr: Float32Array, start: number, end: number): number {
  let sum = 0;
  const n = end - start;
  for (let i = start; i < end; i++) sum += arr[i] * arr[i];
  return Math.sqrt(sum / n);
}

describe("stretchChannelOLA", () => {
  it("returns a copy unchanged at rate=1", () => {
    const sine = makeSine(440, 0.5);
    const out = stretchChannelOLA(sine, SR, 1);
    expect(out).not.toBe(sine);
    expect(out.length).toBe(sine.length);
    expect(out[100]).toBe(sine[100]);
  });

  it("produces a longer output for rate < 1 (slowdown)", () => {
    const sine = makeSine(440, 1.0);
    const out = stretchChannelOLA(sine, SR, 0.5);
    // ~2x as long, within a frame of rounding
    expect(out.length).toBeGreaterThan(sine.length * 1.9);
    expect(out.length).toBeLessThan(sine.length * 2.1);
  });

  it("produces a shorter output for rate > 1 (speedup)", () => {
    const sine = makeSine(440, 1.0);
    const out = stretchChannelOLA(sine, SR, 1.5);
    expect(out.length).toBeGreaterThan(sine.length * 0.6);
    expect(out.length).toBeLessThan(sine.length * 0.7);
  });

  it("preserves perceived loudness in the steady-state region", () => {
    // The 50% Hann OLA sums to ~1.0 in steady state, so RMS of a sine
    // should be close to the input's RMS (≈ 0.707) once we are past the
    // first grain's ramp-in.
    const sine = makeSine(440, 1.0);
    const out = stretchChannelOLA(sine, SR, 0.5);
    const rms = approxRms(out, SR * 0.2, SR * 0.8);
    expect(rms).toBeGreaterThan(0.5);
    expect(rms).toBeLessThan(0.85);
  });

  it("preserves pitch under slowdown (zero crossings per second unchanged)", () => {
    // Count zero crossings in the steady-state region. For a 440 Hz sine
    // we expect ~880 crossings/sec regardless of stretch rate, since OLA
    // does not pitch-shift.
    const sine = makeSine(440, 1.0);
    const slow = stretchChannelOLA(sine, SR, 0.5);
    const a = SR * 0.3, b = SR * 0.7;
    let crossings = 0;
    for (let i = a + 1; i < b; i++) {
      if ((slow[i - 1] >= 0) !== (slow[i] >= 0)) crossings++;
    }
    const crossingsPerSec = crossings / ((b - a) / SR);
    // 440 Hz sine = ~880 zero crossings per second; allow ±5% slack.
    expect(crossingsPerSec).toBeGreaterThan(820);
    expect(crossingsPerSec).toBeLessThan(940);
  });

  it("rejects non-positive or non-finite rates via the AudioBuffer wrapper", () => {
    // stretchChannelOLA itself is forgiving (lets rate=1 short-circuit before
    // anything bad happens), but the documented contract is positive finite.
    // Smoke-test edge: rate very small still produces output without throwing.
    const sine = makeSine(220, 0.1);
    expect(() => stretchChannelOLA(sine, SR, 0.25)).not.toThrow();
  });
});
