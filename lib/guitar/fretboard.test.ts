import { describe, expect, it } from "vitest";
import {
  STANDARD_TUNING,
  allPositions,
  getNoteAt,
  positionsForPitchClass,
} from "./fretboard";

describe("getNoteAt", () => {
  it("returns open low E (string 0, fret 0)", () => {
    const pos = getNoteAt(0, 0);
    expect(pos.midi).toBe(40);
    expect(pos.pitchClass).toBe(4); // E
    expect(pos.noteName).toBe("E2");
  });

  it("returns open high E (string 5, fret 0)", () => {
    const pos = getNoteAt(5, 0);
    expect(pos.midi).toBe(64);
    expect(pos.pitchClass).toBe(4); // E
    expect(pos.noteName).toBe("E4");
  });

  it("12th fret on every string equals open + 12 semitones", () => {
    for (let s = 0; s < STANDARD_TUNING.length; s++) {
      const open = getNoteAt(s, 0);
      const twelfth = getNoteAt(s, 12);
      expect(twelfth.midi).toBe(open.midi + 12);
      expect(twelfth.pitchClass).toBe(open.pitchClass);
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
  it("produces 6 * (maxFret + 1) positions", () => {
    const positions = allPositions(12);
    expect(positions.length).toBe(STANDARD_TUNING.length * 13);
  });
});

describe("positionsForPitchClass", () => {
  it("finds every C on the first 12 frets", () => {
    const cs = positionsForPitchClass(0, 12);
    expect(cs.length).toBeGreaterThan(0);
    for (const p of cs) {
      expect(p.pitchClass).toBe(0);
    }
  });

  it("includes the C at string 1 fret 3 (MIDI 48) and string 0 fret 8", () => {
    const cs = positionsForPitchClass(0, 12);
    const onA = cs.find((p) => p.stringIndex === 1 && p.fret === 3);
    const onLowE = cs.find((p) => p.stringIndex === 0 && p.fret === 8);
    expect(onA?.midi).toBe(48);
    expect(onLowE?.midi).toBe(48);
  });
});
