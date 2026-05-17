import { describe, it, expect } from "vitest";
import { detectScales, emptyProfile } from "./detectScale";

describe("detectScales", () => {
  it("returns empty for an empty profile", () => {
    expect(detectScales(emptyProfile())).toEqual([]);
  });

  it("identifies C major from all 7 pitch classes equally weighted", () => {
    const profile = emptyProfile();
    for (const pc of [0, 2, 4, 5, 7, 9, 11]) profile[pc] = 1000;
    const results = detectScales(profile, 5);
    expect(results.length).toBeGreaterThan(0);
    const top = results[0];
    expect(new Set(top.scale)).toEqual(new Set([0, 2, 4, 5, 7, 9, 11]));
  });

  it("ranks A minor above C major when A is heavily emphasized", () => {
    const profile = emptyProfile();
    for (const pc of [0, 2, 4, 5, 7, 9, 11]) profile[pc] = 100;
    profile[9] = 1000;
    const results = detectScales(profile, 5);
    const topRootName = results[0].rootName;
    expect(topRootName).toBe("A");
  });

  it("penalizes notes outside the scale", () => {
    const profile = emptyProfile();
    for (let pc = 0; pc < 12; pc++) profile[pc] = 100;
    const results = detectScales(profile, 5);
    if (results.length > 0) {
      expect(results[0].confidence).toBeLessThan(0.6);
    }
  });

  it("returns at most topN de-duplicated results", () => {
    const profile = emptyProfile();
    profile[0] = 500;
    profile[4] = 300;
    profile[7] = 400;
    const results = detectScales(profile, 3);
    expect(results.length).toBeLessThanOrEqual(3);
    const keys = results.map((r) => r.scale.join(","));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives a positive score for a clean pentatonic input", () => {
    const profile = emptyProfile();
    for (const pc of [9, 0, 2, 4, 7]) profile[pc] = 500;
    const results = detectScales(profile, 5);
    expect(results[0].score).toBeGreaterThan(0);
  });
});
