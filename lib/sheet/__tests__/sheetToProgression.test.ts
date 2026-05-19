import { describe, expect, it } from "vitest";
import { sheetToProgression } from "../sheetToProgression";
import type { SheetAnalysis } from "../types";

const base: SheetAnalysis = {
  title: "",
  artist: "",
  key: "",
  chordsText: "",
  notes: [],
};

describe("sheetToProgression", () => {
  it("returns an empty array when chordsText is blank", () => {
    expect(sheetToProgression(base)).toEqual([]);
  });

  it("parses a comma-separated progression at 120 BPM in 4/4", () => {
    const result = sheetToProgression({
      ...base,
      chordsText: "Em, C, G, D",
      bpm: 120,
      timeSignature: "4/4",
    });
    // 120 BPM, 4 beats/bar => 2 seconds per chord
    expect(result).toEqual([
      { time: 0, chord: "Em" },
      { time: 2, chord: "C" },
      { time: 4, chord: "G" },
      { time: 6, chord: "D" },
    ]);
  });

  it("supports pipe-separated chord charts", () => {
    const result = sheetToProgression({
      ...base,
      chordsText: "Am | F | C | G",
      bpm: 60,
    });
    expect(result.map((c) => c.chord)).toEqual(["Am", "F", "C", "G"]);
    // 60 BPM, 4/4 default => 4 seconds per chord
    expect(result[1].time).toBe(4);
  });

  it("drops chord symbols the editor does not recognize", () => {
    const result = sheetToProgression({
      ...base,
      chordsText: "Em, C9, G, ???",
      bpm: 100,
    });
    expect(result.map((c) => c.chord)).toEqual(["Em", "G"]);
  });

  it("strips parenthetical/extension noise from chord tokens", () => {
    const result = sheetToProgression({
      ...base,
      chordsText: "Em (intro), Cmaj7 x2, G/B",
      bpm: 100,
    });
    expect(result.map((c) => c.chord)).toEqual(["Em", "Cmaj7", "G"]);
  });

  it("honors a 3/4 time signature", () => {
    const result = sheetToProgression({
      ...base,
      chordsText: "C, G",
      bpm: 120,
      timeSignature: "3/4",
    });
    // 120 BPM, 3 beats/bar => 1.5 seconds per chord
    expect(result[1].time).toBe(1.5);
  });

  it("returns empty when no token parses", () => {
    expect(
      sheetToProgression({ ...base, chordsText: "Cmaj9, Bbmin11" })
    ).toEqual([]);
  });
});
