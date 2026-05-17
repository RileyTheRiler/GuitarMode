import { describe, it, expect } from "vitest";
import { SCALE_TEMPLATES, scalePitchClasses } from "./scales";

describe("scalePitchClasses", () => {
  it("C Ionian (Major) returns {0,2,4,5,7,9,11}", () => {
    const ionian = SCALE_TEMPLATES.find((t) => t.name === "Ionian (Major)")!;
    const set = scalePitchClasses(ionian, 0);
    expect(set).toEqual(new Set([0, 2, 4, 5, 7, 9, 11]));
  });

  it("A Aeolian (Natural Minor) returns the same pitch classes as C Major", () => {
    const aeolian = SCALE_TEMPLATES.find((t) => t.name === "Aeolian (Natural Minor)")!;
    const set = scalePitchClasses(aeolian, 9); // A = root 9
    expect(set).toEqual(new Set([0, 2, 4, 5, 7, 9, 11]));
  });

  it("A Harmonic Minor has the raised 7th (G#)", () => {
    const harmonic = SCALE_TEMPLATES.find((t) => t.name === "Harmonic Minor")!;
    const set = scalePitchClasses(harmonic, 9); // A = root 9
    expect(set.has(8)).toBe(true); // G# = pitch class 8
    expect(set.has(10)).toBe(false); // G natural not present
  });

  it("Major Pentatonic has exactly 5 pitch classes", () => {
    const penta = SCALE_TEMPLATES.find((t) => t.name === "Major Pentatonic")!;
    expect(scalePitchClasses(penta, 0).size).toBe(5);
  });

  it("Blues scale has exactly 6 pitch classes", () => {
    const blues = SCALE_TEMPLATES.find((t) => t.name === "Blues")!;
    expect(scalePitchClasses(blues, 0).size).toBe(6);
  });

  it("root offset wraps correctly at 12: B Ionian", () => {
    const ionian = SCALE_TEMPLATES.find((t) => t.name === "Ionian (Major)")!;
    const set = scalePitchClasses(ionian, 11); // B = root 11
    // B major: B C# D# E F# G# A# = {11, 1, 3, 4, 6, 8, 10}
    expect(set).toEqual(new Set([11, 1, 3, 4, 6, 8, 10]));
  });

  it("every template at every root produces exactly intervals.length pitch classes", () => {
    for (const template of SCALE_TEMPLATES) {
      for (let root = 0; root < 12; root++) {
        const set = scalePitchClasses(template, root);
        expect(set.size).toBe(template.intervals.length);
      }
    }
  });

  it("all pitch classes returned are in the range [0, 11]", () => {
    for (const template of SCALE_TEMPLATES) {
      const set = scalePitchClasses(template, 3);
      for (const pc of set) {
        expect(pc).toBeGreaterThanOrEqual(0);
        expect(pc).toBeLessThanOrEqual(11);
      }
    }
  });
});

describe("SCALE_TEMPLATES", () => {
  it("has 18 templates", () => {
    expect(SCALE_TEMPLATES).toHaveLength(18);
  });

  it("every template has a non-empty name and intervals array", () => {
    for (const t of SCALE_TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.intervals.length).toBeGreaterThan(0);
    }
  });

  it("every template includes 0 as the first interval (starts on root)", () => {
    for (const t of SCALE_TEMPLATES) {
      expect(t.intervals[0]).toBe(0);
    }
  });

  it("every template has no duplicate intervals", () => {
    for (const t of SCALE_TEMPLATES) {
      expect(new Set(t.intervals).size).toBe(t.intervals.length);
    }
  });
});
