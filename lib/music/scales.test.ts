import { describe, expect, it } from "vitest";
import { SCALE_TEMPLATES, scalePitchClasses } from "./scales";

describe("SCALE_TEMPLATES", () => {
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

  it("has no two templates with identical pitch-class sets at C", () => {
    const seen = new Map<string, string>();
    for (const t of SCALE_TEMPLATES) {
      const key = Array.from(scalePitchClasses(t, 0)).sort((a, b) => a - b).join(",");
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

describe("scalePitchClasses", () => {
  it("returns the C major collection", () => {
    const major = SCALE_TEMPLATES.find((t) => t.name.startsWith("Ionian"))!;
    const set = scalePitchClasses(major, 0);
    expect(set).toEqual(new Set([0, 2, 4, 5, 7, 9, 11]));
  });

  it("transposes correctly to a non-zero root", () => {
    const major = SCALE_TEMPLATES.find((t) => t.name.startsWith("Ionian"))!;
    // G major: G A B C D E F#  -> 7, 9, 11, 0, 2, 4, 6
    const set = scalePitchClasses(major, 7);
    expect(set).toEqual(new Set([7, 9, 11, 0, 2, 4, 6]));
  });
});
