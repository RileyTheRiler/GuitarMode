import { describe, expect, it } from "vitest";
import {
  STANDARD_TUNING,
  allPositions,
  getNoteAt,
  positionsForPitchClass,
  stringLabelsFor,
} from "./fretboard";
import { TUNINGS, getTuning } from "./tunings";

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

  it("12th fret on every string equals open + 12 semitones", () => {
    for (let s = 0; s < STANDARD_TUNING.length; s++) {
      const open = getNoteAt(s, 0);
      const twelfth = getNoteAt(s, 12);
      expect(twelfth.midi).toBe(open.midi + 12);
      expect(twelfth.pitchClass).toBe(open.pitchClass);
    }
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

  it("returns the expected open-string notes", () => {
    expect(getNoteAt(0, 0).noteName).toBe("E2");
    expect(getNoteAt(1, 0).noteName).toBe("A2");
    expect(getNoteAt(2, 0).noteName).toBe("D3");
    expect(getNoteAt(3, 0).noteName).toBe("G3");
    expect(getNoteAt(4, 0).noteName).toBe("B3");
    expect(getNoteAt(5, 0).noteName).toBe("E4");
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

  it("includes the C at string 1 fret 3 (MIDI 48) and string 0 fret 8", () => {
    const cs = positionsForPitchClass(0, 12);
    const onA = cs.find((p) => p.stringIndex === 1 && p.fret === 3);
    const onLowE = cs.find((p) => p.stringIndex === 0 && p.fret === 8);
    expect(onA?.midi).toBe(48);
    expect(onLowE?.midi).toBe(48);
  });

  it("pitch class out of 0-11 range returns empty (no fret produces it)", () => {
    // midiToPitchClass always returns 0..11, so pitchClass===12 never matches
    expect(positionsForPitchClass(12, 22)).toHaveLength(0);
  });
});

describe("alternate tunings", () => {
  it("Drop D lowers the low string to D2 (MIDI 38)", () => {
    const dropD = getTuning("drop-d");
    const open = getNoteAt(0, 0, dropD.midi);
    expect(open.midi).toBe(38);
    expect(open.noteName).toBe("D2");
  });

  it("DADGAD's 12th fret on every string equals open + 12", () => {
    const dadgad = getTuning("dadgad");
    for (let s = 0; s < dadgad.midi.length; s++) {
      expect(getNoteAt(s, 12, dadgad.midi).midi).toBe(dadgad.midi[s] + 12);
    }
  });

  it("positionsForPitchClass honors the active tuning", () => {
    const dropD = getTuning("drop-d");
    const ds = positionsForPitchClass(2, 12, dropD.midi); // D
    const openLow = ds.find((p) => p.stringIndex === 0 && p.fret === 0);
    expect(openLow).toBeDefined();
    expect(openLow?.midi).toBe(38);
  });
});

describe("stringLabelsFor", () => {
  it("preserves the conventional E A D G B e for standard tuning", () => {
    expect(stringLabelsFor(STANDARD_TUNING)).toEqual([
      "E",
      "A",
      "D",
      "G",
      "B",
      "e",
    ]);
  });

  it("derives labels from pitch class for non-standard tunings", () => {
    expect(stringLabelsFor(getTuning("drop-d").midi)).toEqual([
      "D",
      "A",
      "D",
      "G",
      "B",
      "E",
    ]);
    expect(stringLabelsFor(getTuning("dadgad").midi)).toEqual([
      "D",
      "A",
      "D",
      "G",
      "A",
      "D",
    ]);
  });

  it("returns 6 labels for every built-in tuning", () => {
    for (const t of TUNINGS) {
      expect(stringLabelsFor(t.midi).length).toBe(6);
    }
  });
});
