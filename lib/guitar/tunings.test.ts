import { describe, expect, it } from "vitest";
import { DEFAULT_TUNING_ID, TUNINGS, getTuning } from "./tunings";

describe("TUNINGS table", () => {
  it("has a unique id per tuning", () => {
    const ids = TUNINGS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every tuning has 6 strings of valid MIDI values", () => {
    for (const t of TUNINGS) {
      expect(t.midi.length).toBe(6);
      for (const m of t.midi) {
        expect(Number.isInteger(m)).toBe(true);
        expect(m).toBeGreaterThan(0);
        expect(m).toBeLessThan(128);
      }
    }
  });

  it("strings are monotonically non-decreasing low-to-high", () => {
    for (const t of TUNINGS) {
      for (let i = 1; i < t.midi.length; i++) {
        expect(
          t.midi[i],
          `${t.name}: string ${i} below string ${i - 1}`
        ).toBeGreaterThanOrEqual(t.midi[i - 1]);
      }
    }
  });

  it("default tuning resolves to standard", () => {
    const std = getTuning(DEFAULT_TUNING_ID);
    expect(std.midi).toEqual([40, 45, 50, 55, 59, 64]);
  });

  it("falls back to standard on unknown id", () => {
    expect(getTuning("nonsense").id).toBe("standard");
    expect(getTuning(null).id).toBe("standard");
    expect(getTuning(undefined).id).toBe("standard");
  });
});
