import { describe, expect, it } from "vitest";
import { chordPitchClasses, parseChord } from "./chords";

describe("parseChord", () => {
  it("parses bare letters as major", () => {
    expect(parseChord("C")).toEqual({ root: 0, quality: "maj" });
    expect(parseChord("G")).toEqual({ root: 7, quality: "maj" });
  });

  it("parses minor with m alias", () => {
    expect(parseChord("Bm")).toEqual({ root: 11, quality: "min" });
    expect(parseChord("Am")).toEqual({ root: 9, quality: "min" });
    expect(parseChord("Emin")).toEqual({ root: 4, quality: "min" });
  });

  it("parses sharps and flats", () => {
    expect(parseChord("F#7")).toEqual({ root: 6, quality: "7" });
    expect(parseChord("Bbmaj7")).toEqual({ root: 10, quality: "maj7" });
    expect(parseChord("Db")).toEqual({ root: 1, quality: "maj" });
  });

  it("parses suspended and diminished", () => {
    expect(parseChord("Dsus4")).toEqual({ root: 2, quality: "sus4" });
    expect(parseChord("Gsus2")).toEqual({ root: 7, quality: "sus2" });
    expect(parseChord("Gdim")).toEqual({ root: 7, quality: "dim" });
  });

  it("parses m7 as min7", () => {
    expect(parseChord("Am7")).toEqual({ root: 9, quality: "min7" });
  });

  it("returns null for garbage", () => {
    expect(parseChord("Xy")).toBeNull();
    expect(parseChord("")).toBeNull();
    expect(parseChord("Cfoo")).toBeNull();
  });

  it("parses extended jazz qualities", () => {
    expect(parseChord("Bdim7")).toEqual({ root: 11, quality: "dim7" });
    expect(parseChord("Bm7b5")).toEqual({ root: 11, quality: "m7b5" });
    expect(parseChord("Caug")).toEqual({ root: 0, quality: "aug" });
    expect(parseChord("G6")).toEqual({ root: 7, quality: "6" });
    expect(parseChord("Am6")).toEqual({ root: 9, quality: "m6" });
    expect(parseChord("Cadd9")).toEqual({ root: 0, quality: "add9" });
  });

  it("longer suffixes win over shorter prefixes", () => {
    expect(parseChord("Bm7b5")?.quality).toBe("m7b5");
    expect(parseChord("Bm7")?.quality).toBe("min7");
    expect(parseChord("Bdim7")?.quality).toBe("dim7");
    expect(parseChord("Bdim")?.quality).toBe("dim");
    expect(parseChord("Am6")?.quality).toBe("m6");
    expect(parseChord("Am")?.quality).toBe("min");
  });
});

describe("chordPitchClasses", () => {
  it("returns triad for C major", () => {
    const r = chordPitchClasses(0, "maj");
    expect(r.all).toEqual(new Set([0, 4, 7]));
    expect(r.third).toBe(4);
    expect(r.fifth).toBe(7);
    expect(r.root).toBe(0);
  });

  it("returns triad for A minor", () => {
    const r = chordPitchClasses(9, "min");
    expect(r.all).toEqual(new Set([9, 0, 4]));
    expect(r.third).toBe(0);
    expect(r.fifth).toBe(4);
  });

  it("null third for sus chords", () => {
    const r = chordPitchClasses(2, "sus2");
    expect(r.third).toBeNull();
    expect(r.all).toEqual(new Set([2, 4, 9]));
  });

  it("includes 7th for dominant seven", () => {
    const r = chordPitchClasses(7, "7");
    expect(r.all).toEqual(new Set([7, 11, 2, 5]));
  });

  it("returns the diminished-seventh stack of minor thirds", () => {
    const r = chordPitchClasses(11, "dim7");
    expect(r.all).toEqual(new Set([11, 2, 5, 8]));
    expect(r.third).toBe(2);
    expect(r.fifth).toBe(5);
  });

  it("returns the half-diminished collection", () => {
    const r = chordPitchClasses(11, "m7b5");
    expect(r.all).toEqual(new Set([11, 2, 5, 9]));
  });

  it("returns the augmented triad", () => {
    const r = chordPitchClasses(0, "aug");
    expect(r.all).toEqual(new Set([0, 4, 8]));
    expect(r.third).toBe(4);
    expect(r.fifth).toBe(8);
  });

  it("returns the add9 four-note set", () => {
    const r = chordPitchClasses(0, "add9");
    expect(r.all).toEqual(new Set([0, 2, 4, 7]));
    expect(r.third).toBe(4);
    expect(r.fifth).toBe(7);
  });
});
