import { describe, expect, it } from "vitest";
import { nearestTarget, tunerReading } from "./tuner";
import { STANDARD_TUNING } from "../guitar/fretboard";

describe("nearestTarget", () => {
  it("picks the closest semitone target", () => {
    // Standard tuning: 40 (E2), 45 (A2), 50 (D3), 55 (G3), 59 (B3), 64 (E4)
    expect(nearestTarget(40, STANDARD_TUNING)).toBe(40);
    expect(nearestTarget(40.4, STANDARD_TUNING)).toBe(40);
    expect(nearestTarget(44.6, STANDARD_TUNING)).toBe(45);
    expect(nearestTarget(64, STANDARD_TUNING)).toBe(64);
  });

  it("handles values outside the target range", () => {
    expect(nearestTarget(20, STANDARD_TUNING)).toBe(40); // far below
    expect(nearestTarget(100, STANDARD_TUNING)).toBe(64); // far above
  });

  it("throws on an empty target list", () => {
    expect(() => nearestTarget(60, [])).toThrow();
  });
});

describe("tunerReading", () => {
  it("reads exactly 0 cents at the target frequency", () => {
    // Low E2 at 440 Hz concert: midiToFreq(40, 440) ≈ 82.407 Hz
    const e2 = 440 * Math.pow(2, (40 - 69) / 12);
    const r = tunerReading(e2, 440);
    expect(r).not.toBeNull();
    expect(r!.targetMidi).toBe(40);
    expect(r!.targetName).toBe("E2");
    expect(r!.cents).toBeCloseTo(0, 6);
  });

  it("reports negative cents when flat", () => {
    // 10 cents flat of A2 (MIDI 45): freq * 2^(-10/1200)
    const a2 = 440 * Math.pow(2, (45 - 69) / 12);
    const flat = a2 * Math.pow(2, -10 / 1200);
    const r = tunerReading(flat, 440);
    expect(r!.targetMidi).toBe(45);
    expect(r!.cents).toBeCloseTo(-10, 4);
  });

  it("reports positive cents when sharp", () => {
    const a2 = 440 * Math.pow(2, (45 - 69) / 12);
    const sharp = a2 * Math.pow(2, 25 / 1200);
    const r = tunerReading(sharp, 440);
    expect(r!.targetMidi).toBe(45);
    expect(r!.cents).toBeCloseTo(25, 4);
  });

  it("returns null for non-positive or non-finite input", () => {
    expect(tunerReading(0, 440)).toBeNull();
    expect(tunerReading(-100, 440)).toBeNull();
    expect(tunerReading(NaN, 440)).toBeNull();
    expect(tunerReading(Infinity, 440)).toBeNull();
  });

  it("honors a non-standard concert pitch", () => {
    // At A=432, freq of MIDI 69 is 432 itself.
    const r = tunerReading(432, 432);
    expect(r!.targetMidi).toBe(64); // nearest in standard tuning is E4=64
    // 432 Hz against A=432 reads as MIDI 69 detected, target 64, so 500 cents sharp of E4.
    expect(r!.cents).toBeCloseTo(500, 4);
  });
});
