import { describe, it, expect } from "vitest";
import { TIMBRE_SAMPLES } from "./timbreSamples";

describe("TIMBRE_SAMPLES", () => {
  it("has exactly 3 samples", () => {
    expect(TIMBRE_SAMPLES).toHaveLength(3);
  });

  it("each sample has a unique id", () => {
    const ids = TIMBRE_SAMPLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(3);
  });

  it.each(TIMBRE_SAMPLES)("$id has exactly 8 harmonics", ({ harmonics }) => {
    expect(harmonics).toHaveLength(8);
  });

  it.each(TIMBRE_SAMPLES)("$id fundamental (h1) is 1.0", ({ harmonics }) => {
    expect(harmonics[0]).toBe(1);
  });

  it.each(TIMBRE_SAMPLES)("$id harmonics are all in [0, 1]", ({ harmonics }) => {
    for (const h of harmonics) {
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(1);
    }
  });

  it.each(TIMBRE_SAMPLES)("$id has non-empty name and description", ({ name, description }) => {
    expect(name.length).toBeGreaterThan(0);
    expect(description.length).toBeGreaterThan(0);
  });

  it("samples have distinct harmonic profiles", () => {
    const profiles = TIMBRE_SAMPLES.map((s) => s.harmonics.join(","));
    expect(new Set(profiles).size).toBe(3);
  });
});
