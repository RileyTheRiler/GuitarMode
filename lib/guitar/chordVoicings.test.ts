import { describe, expect, it } from "vitest";
import { findVoicings } from "./chordVoicings";
import { STANDARD_TUNING } from "./fretboard";

describe("findVoicings", () => {
  it("returns at least one voicing for Cmaj in standard tuning", () => {
    // C major: root=0 (C), intervals [0,4,7]
    const voicings = findVoicings(0, "maj", STANDARD_TUNING);
    expect(voicings.length).toBeGreaterThan(0);
  });

  it("returns at least one voicing for Amin in standard tuning", () => {
    const voicings = findVoicings(9, "min", STANDARD_TUNING);
    expect(voicings.length).toBeGreaterThan(0);
  });

  it("each voicing contains only valid fret numbers (0-19)", () => {
    for (let root = 0; root < 12; root++) {
      const voicings = findVoicings(root, "maj", STANDARD_TUNING);
      for (const v of voicings) {
        for (const n of v) {
          expect(n.fret).toBeGreaterThanOrEqual(0);
          expect(n.fret).toBeLessThanOrEqual(19);
        }
      }
    }
  });

  it("each voicing has at least 3 notes", () => {
    const voicings = findVoicings(5, "maj", STANDARD_TUNING); // Fmaj
    for (const v of voicings) {
      expect(v.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("voicings are sorted ascending by lowest fret (open positions first)", () => {
    const voicings = findVoicings(4, "min", STANDARD_TUNING); // Emin
    if (voicings.length >= 2) {
      const lowestFret = (v: typeof voicings[0]) => Math.min(...v.map((n) => n.fret));
      expect(lowestFret(voicings[0])).toBeLessThanOrEqual(lowestFret(voicings[1]));
    }
  });

  it("returns no more than 3 voicings", () => {
    const voicings = findVoicings(7, "maj", STANDARD_TUNING); // Gmaj
    expect(voicings.length).toBeLessThanOrEqual(3);
  });

  it("handles dim quality without throwing", () => {
    expect(() => findVoicings(2, "dim", STANDARD_TUNING)).not.toThrow();
  });

  it("handles aug quality without throwing", () => {
    expect(() => findVoicings(3, "aug", STANDARD_TUNING)).not.toThrow();
  });
});
