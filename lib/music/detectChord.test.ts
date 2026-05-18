import { describe, expect, it } from "vitest";
import { detectChords } from "./detectChord";

describe("detectChords", () => {
  it("returns empty for a zero profile", () => {
    const profile = Array(12).fill(0);
    expect(detectChords(profile)).toHaveLength(0);
  });

  it("detects C root from profile with C, E, G", () => {
    const profile = Array(12).fill(0);
    profile[0] = 500; // C
    profile[4] = 400; // E
    profile[7] = 350; // G
    const matches = detectChords(profile, 5);
    expect(matches.length).toBeGreaterThan(0);
    // Top match should have C as root; quality may be maj or a superset (maj7, 7)
    // since all share the same C, E, G pitches and tie on score.
    expect(matches[0].root).toBe(0);
    // One of the top-5 must be Cmaj
    expect(matches.some((m) => m.root === 0 && m.quality === "maj")).toBe(true);
  });

  it("detects A minor from profile with A, C, E", () => {
    const profile = Array(12).fill(0);
    profile[9] = 500; // A
    profile[0] = 400; // C
    profile[4] = 350; // E
    const matches = detectChords(profile, 5);
    expect(matches.length).toBeGreaterThan(0);
    const top = matches[0];
    expect(top.root).toBe(9); // A
    expect(top.quality).toBe("min");
  });

  it("returns up to topN matches", () => {
    const profile = Array(12).fill(100);
    const matches = detectChords(profile, 3);
    expect(matches).toHaveLength(3);
  });

  it("returns confidence in 0..1", () => {
    const profile = Array(12).fill(0);
    profile[0] = 500;
    profile[4] = 400;
    profile[7] = 350;
    const matches = detectChords(profile, 5);
    for (const m of matches) {
      expect(m.confidence).toBeGreaterThanOrEqual(0);
      expect(m.confidence).toBeLessThanOrEqual(1);
    }
  });

  it("displayName is formatted correctly for maj", () => {
    const profile = Array(12).fill(0);
    profile[0] = 500;
    profile[4] = 400;
    profile[7] = 350;
    const matches = detectChords(profile, 5);
    const cmaj = matches.find((m) => m.root === 0 && m.quality === "maj");
    expect(cmaj).toBeTruthy();
    expect(cmaj!.displayName).toBe("C"); // maj suffix omitted for major
  });
});
