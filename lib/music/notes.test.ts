import { describe, expect, it } from "vitest";
import {
  NOTE_NAMES,
  PITCH_CLASS_COLORS,
  colorForPitchClass,
  freqToMidi,
  midiToFreq,
  midiToNoteName,
  midiToPitchClass,
  pitchClassName,
} from "./notes";

describe("freqToMidi / midiToFreq", () => {
  it("round-trips A4 at 440 Hz to MIDI 69", () => {
    expect(freqToMidi(440)).toBeCloseTo(69, 9);
    expect(midiToFreq(69)).toBeCloseTo(440, 9);
  });

  it("doubles frequency per octave", () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 6); // A5
    expect(midiToFreq(57)).toBeCloseTo(220, 6); // A3
  });

  it("honors non-standard concert pitch", () => {
    expect(midiToFreq(69, 432)).toBeCloseTo(432, 9);
    expect(freqToMidi(432, 432)).toBeCloseTo(69, 9);
  });
});

describe("midiToNoteName", () => {
  it("names A4 correctly", () => {
    expect(midiToNoteName(69)).toBe("A4");
  });

  it("names low and high open strings", () => {
    expect(midiToNoteName(40)).toBe("E2"); // low E
    expect(midiToNoteName(64)).toBe("E4"); // high E
  });

  it("rounds non-integer MIDI input", () => {
    expect(midiToNoteName(68.6)).toBe("A4");
    expect(midiToNoteName(69.4)).toBe("A4");
  });
});

describe("midiToPitchClass", () => {
  it("wraps positive MIDI values", () => {
    expect(midiToPitchClass(60)).toBe(0); // C4
    expect(midiToPitchClass(69)).toBe(9); // A4
    expect(midiToPitchClass(83)).toBe(11); // B5
  });

  it("wraps negative MIDI values without going negative", () => {
    expect(midiToPitchClass(-1)).toBe(11);
    expect(midiToPitchClass(-12)).toBe(0);
  });
});

describe("pitchClassName", () => {
  it("matches the NOTE_NAMES table", () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(pitchClassName(pc)).toBe(NOTE_NAMES[pc]);
    }
  });

  it("wraps out-of-range pitch classes", () => {
    expect(pitchClassName(12)).toBe("C");
    expect(pitchClassName(-1)).toBe("B");
  });
});

describe("colorForPitchClass", () => {
  it("returns a defined color for every pitch class", () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(colorForPitchClass(pc)).toBe(PITCH_CLASS_COLORS[pc]);
    }
  });

  it("wraps out-of-range input", () => {
    expect(colorForPitchClass(12)).toBe(PITCH_CLASS_COLORS[0]);
    expect(colorForPitchClass(-1)).toBe(PITCH_CLASS_COLORS[11]);
  });
});
