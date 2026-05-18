import { describe, expect, it } from "vitest";
import { noteNameToMidi, sheetToDetectedNotes } from "../sheetToNotes";
import type { SheetAnalysis } from "../types";

describe("noteNameToMidi", () => {
  it("parses naturals and sharps", () => {
    expect(noteNameToMidi("A4")).toBe(69);
    expect(noteNameToMidi("C4")).toBe(60);
    expect(noteNameToMidi("F#3")).toBe(54);
  });

  it("parses flats by converting to sharps", () => {
    expect(noteNameToMidi("Bb3")).toBe(58);
    expect(noteNameToMidi("Eb4")).toBe(63);
  });

  it("returns null for garbage input", () => {
    expect(noteNameToMidi("nope")).toBeNull();
    expect(noteNameToMidi("H4")).toBeNull();
    expect(noteNameToMidi("")).toBeNull();
  });
});

describe("sheetToDetectedNotes", () => {
  const baseAnalysis: SheetAnalysis = {
    title: "Test",
    artist: "Test",
    key: "A minor",
    bpm: 120,
    chordsText: "Am, F, C, G",
    notes: [
      { noteName: "A4", midi: 69, beats: 1 },
      { noteName: "C5", midi: 72, beats: 0.5 },
      { noteName: "E5", midi: 76, beats: 2 },
    ],
  };

  it("produces DetectedNotes with correct midi, frequency, and pitch class", () => {
    const result = sheetToDetectedNotes(baseAnalysis);
    expect(result).toHaveLength(3);
    expect(result[0].midi).toBe(69);
    expect(result[0].noteName).toBe("A4");
    expect(result[0].pitchClass).toBe(9);
    expect(result[0].frequency).toBeCloseTo(440, 0);
    expect(result[0].clarity).toBe(1);
  });

  it("scales duration with beats and BPM", () => {
    const result = sheetToDetectedNotes(baseAnalysis);
    // 120 BPM => 500 ms per beat
    expect(result[0].durationMs).toBe(500);
    expect(result[1].durationMs).toBe(250);
    expect(result[2].durationMs).toBe(1000);
  });

  it("makes notes consecutive with a small gap", () => {
    const result = sheetToDetectedNotes(baseAnalysis);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].at).toBeGreaterThan(result[i - 1].endAt);
    }
  });

  it("skips notes that have no parseable midi or noteName", () => {
    const bad: SheetAnalysis = {
      ...baseAnalysis,
      notes: [
        { noteName: "garbage", midi: -1, beats: 1 },
        { noteName: "G4", midi: 67, beats: 1 },
      ],
    };
    const result = sheetToDetectedNotes(bad);
    expect(result).toHaveLength(1);
    expect(result[0].midi).toBe(67);
  });

  it("falls back to noteName when midi is missing/invalid", () => {
    const analysis: SheetAnalysis = {
      ...baseAnalysis,
      notes: [{ noteName: "D4", midi: 0 as unknown as number, beats: 1 }],
    };
    const result = sheetToDetectedNotes({
      ...analysis,
      notes: [{ noteName: "D4", midi: NaN as unknown as number }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].midi).toBe(62);
  });
});
