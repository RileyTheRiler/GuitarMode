import { describe, it, expect } from "vitest";
import { getNoteAt, allPositions, positionsForPitchClass, STANDARD_TUNING } from "./fretboard";

describe("getNoteAt", () => {
  it("open low E string (string 0, fret 0) is E2 at MIDI 40", () => {
    const pos = getNoteAt(0, 0);
    expect(pos.stringIndex).toBe(0);
    expect(pos.fret).toBe(0);
    expect(pos.midi).toBe(40);
    expect(pos.pitchClass).toBe(4); // E
    expect(pos.noteName).toBe("E2");
  });

  it("open A string (string 1, fret 0) is A2 at MIDI 45", () => {
    const pos = getNoteAt(1, 0);
    expect(pos.midi).toBe(45);
    expect(pos.pitchClass).toBe(9); // A
    expect(pos.noteName).toBe("A2");
  });

  it("open high e string (string 5, fret 0) is E4 at MIDI 64", () => {
    const pos = getNoteAt(5, 0);
    expect(pos.midi).toBe(64);
    expect(pos.pitchClass).toBe(4); // E
    expect(pos.noteName).toBe("E4");
  });

  it("string 0 fret 12 is one octave above open (MIDI 52, E3)", () => {
    const pos = getNoteAt(0, 12);
    expect(pos.midi).toBe(52);
    expect(pos.pitchClass).toBe(4); // E
    expect(pos.noteName).toBe("E3");
  });

  it("each open string midi equals STANDARD_TUNING value", () => {
    for (let s = 0; s < STANDARD_TUNING.length; s++) {
      expect(getNoteAt(s, 0).midi).toBe(STANDARD_TUNING[s]);
    }
  });

  it("midi increases by 1 with each fret", () => {
    for (let f = 1; f <= 5; f++) {
      expect(getNoteAt(2, f).midi).toBe(getNoteAt(2, 0).midi + f);
    }
  });
});

describe("allPositions", () => {
  it("maxFret=0 returns 6 positions (one open per string)", () => {
    expect(allPositions(0)).toHaveLength(6);
  });

  it("maxFret=12 returns 6 * 13 = 78 positions", () => {
    expect(allPositions(12)).toHaveLength(78);
  });

  it("maxFret=22 returns 6 * 23 = 138 positions", () => {
    expect(allPositions(22)).toHaveLength(138);
  });

  it("all positions have midi equal to STANDARD_TUNING[string] + fret", () => {
    for (const pos of allPositions(5)) {
      expect(pos.midi).toBe(STANDARD_TUNING[pos.stringIndex] + pos.fret);
    }
  });

  it("no duplicate (stringIndex, fret) pairs", () => {
    const seen = new Set<string>();
    for (const pos of allPositions(12)) {
      const key = `${pos.stringIndex}-${pos.fret}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });
});

describe("positionsForPitchClass", () => {
  it("returns only positions with the requested pitch class", () => {
    const results = positionsForPitchClass(4, 22); // E (pitch class 4)
    expect(results.length).toBeGreaterThan(0);
    for (const pos of results) {
      expect(pos.pitchClass).toBe(4);
    }
  });

  it("E (pitch class 4) appears on at least strings 0 and 5 as open notes", () => {
    const results = positionsForPitchClass(4, 22);
    const openEs = results.filter((p) => p.fret === 0);
    const strings = openEs.map((p) => p.stringIndex);
    expect(strings).toContain(0); // low E
    expect(strings).toContain(5); // high e
  });

  it("C (pitch class 0) has at least one position in standard maxFret=12", () => {
    expect(positionsForPitchClass(0, 12).length).toBeGreaterThan(0);
  });

  it("pitch class out of 0-11 range returns empty (no fret produces it)", () => {
    // midiToPitchClass always returns 0..11, so pitchClass===12 never matches
    expect(positionsForPitchClass(12, 22)).toHaveLength(0);
  });
});
