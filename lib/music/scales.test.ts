import { describe, expect, it } from "vitest";
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

  it("transposes correctly to a non-zero root", () => {
    const major = SCALE_TEMPLATES.find((t) => t.name.startsWith("Ionian"))!;
    // G major: G A B C D E F# -> 7, 9, 11, 0, 2, 4, 6
    const set = scalePitchClasses(major, 7);
    expect(set).toEqual(new Set([7, 9, 11, 0, 2, 4, 6]));
  });
});

describe("SCALE_TEMPLATES", () => {
  it("has at least the diatonic modes and pentatonics", () => {
    // Defensive lower bound rather than a brittle exact count.
    expect(SCALE_TEMPLATES.length).toBeGreaterThanOrEqual(12);
  });

  it("every template has a non-empty name and intervals array", () => {
    for (const t of SCALE_TEMPLATES) {
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.intervals.length).toBeGreaterThan(0);
    }
  });

  it("starts every template at the root (interval 0)", () => {
    for (const t of SCALE_TEMPLATES) {
      expect(t.intervals[0]).toBe(0);
    }
  });

  it("keeps every interval in [0, 11]", () => {
    for (const t of SCALE_TEMPLATES) {
      for (const i of t.intervals) {
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThanOrEqual(11);
      }
    }
  });

  it("every template has no duplicate intervals", () => {
    for (const t of SCALE_TEMPLATES) {
      expect(new Set(t.intervals).size).toBe(t.intervals.length);
    }
  });

  it("has no two templates with identical pitch-class sets at C", () => {
    const seen = new Map<string, string>();
    for (const t of SCALE_TEMPLATES) {
      const key = Array.from(scalePitchClasses(t, 0))
        .sort((a, b) => a - b)
        .join(",");
      const prior = seen.get(key);
      expect(
        prior,
        `template "${t.name}" duplicates pitch-class set of "${prior}"`
      ).toBeUndefined();
      seen.set(key, t.name);
    }
  });

  it("has unique template names", () => {
    const names = SCALE_TEMPLATES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});
