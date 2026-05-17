import { describe, it, expect } from "vitest";
import { buildProfile, profilePitchClassSet } from "./profile";
import type { DetectedNote } from "../audio/usePitchDetector";

function makeNote(pitchClass: number, durationMs: number): DetectedNote {
  return {
    midi: 60 + pitchClass,
    noteName: "X",
    pitchClass,
    frequency: 440,
    clarity: 0.95,
    at: 0,
    endAt: durationMs,
    durationMs,
  };
}

describe("buildProfile", () => {
  it("returns a 12-element zero array for no input", () => {
    const p = buildProfile([]);
    expect(p).toHaveLength(12);
    expect(p.every((v) => v === 0)).toBe(true);
  });

  it("credits each note by durationMs", () => {
    const notes = [makeNote(0, 500), makeNote(0, 300)];
    const p = buildProfile(notes);
    expect(p[0]).toBe(800);
  });

  it("applies a minimum duration of 80 ms per note", () => {
    const notes = [makeNote(4, 0)];
    const p = buildProfile(notes);
    expect(p[4]).toBe(80);
  });

  it("blends chroma contribution proportionally", () => {
    const notes = [makeNote(0, 1000)];
    const chroma = Array(12).fill(0);
    chroma[7] = 100;
    const p = buildProfile(notes, chroma, 1);
    expect(p[0]).toBeGreaterThan(0);
    expect(p[7]).toBeGreaterThan(0);
  });

  it("ignores chroma when all values are zero", () => {
    const notes = [makeNote(2, 200)];
    const zeroChroma = Array(12).fill(0);
    const p = buildProfile(notes, zeroChroma, 1);
    expect(p[2]).toBe(200);
    expect(p.filter((_, i) => i !== 2).every((v) => v === 0)).toBe(true);
  });
});

describe("profilePitchClassSet", () => {
  it("returns only pitch classes with positive weight", () => {
    const profile = Array(12).fill(0);
    profile[0] = 100;
    profile[7] = 50;
    const set = profilePitchClassSet(profile);
    expect(set).toEqual(new Set([0, 7]));
  });

  it("returns empty set for zero profile", () => {
    expect(profilePitchClassSet(Array(12).fill(0))).toEqual(new Set());
  });
});
