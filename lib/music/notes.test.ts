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

describe("freqToMidi", () => {
  it("440 Hz is MIDI 69 (A4)", () => {
    expect(freqToMidi(440)).toBeCloseTo(69, 6);
  });

  it("880 Hz is MIDI 81 (A5, one octave up)", () => {
    expect(freqToMidi(880)).toBeCloseTo(81, 6);
  });

  it("220 Hz is MIDI 57 (A3)", () => {
    expect(freqToMidi(220)).toBeCloseTo(57, 6);
  });

  it("261.63 Hz rounds to MIDI 60 (C4)", () => {
    expect(Math.round(freqToMidi(261.63))).toBe(60);
  });

  it("honors custom concert pitch", () => {
    expect(freqToMidi(432, 432)).toBeCloseTo(69, 6);
  });
});

describe("midiToFreq", () => {
  it("MIDI 69 is 440 Hz", () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
  });

  it("doubles per octave", () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 6); // A5
    expect(midiToFreq(57)).toBeCloseTo(220, 6); // A3
  });

  it("honors a non-standard concert pitch", () => {
    expect(midiToFreq(69, 432)).toBeCloseTo(432, 9);
  });

  it("round-trips with freqToMidi within floating-point tolerance", () => {
    for (const freq of [110, 220, 440, 880, 261.63, 329.63]) {
      expect(midiToFreq(freqToMidi(freq))).toBeCloseTo(freq, 3);
    }
  });
});

describe("midiToNoteName", () => {
  it("names A4 correctly", () => {
    expect(midiToNoteName(69)).toBe("A4");
  });

  it("MIDI 60 is C4", () => expect(midiToNoteName(60)).toBe("C4"));
  it("MIDI 21 is A0 (lowest piano key)", () => expect(midiToNoteName(21)).toBe("A0"));
  it("MIDI 108 is C8", () => expect(midiToNoteName(108)).toBe("C8"));
  it("MIDI 0 is C-1", () => expect(midiToNoteName(0)).toBe("C-1"));

  it("names low and high open strings", () => {
    expect(midiToNoteName(40)).toBe("E2"); // low E
    expect(midiToNoteName(64)).toBe("E4"); // high E
  });

  it("rounds non-integer MIDI input", () => {
    expect(midiToNoteName(60.4)).toBe("C4");
    expect(midiToNoteName(68.6)).toBe("A4");
    expect(midiToNoteName(69.4)).toBe("A4");
  });
});

describe("midiToPitchClass", () => {
  it("wraps positive MIDI values", () => {
    expect(midiToPitchClass(60)).toBe(0); // C4
    expect(midiToPitchClass(61)).toBe(1); // C#
    expect(midiToPitchClass(69)).toBe(9); // A4
    expect(midiToPitchClass(71)).toBe(11); // B
    expect(midiToPitchClass(72)).toBe(0); // C5
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

  it("returns a hex color string starting with #", () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(colorForPitchClass(pc)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("wraps out-of-range input", () => {
    expect(colorForPitchClass(12)).toBe(PITCH_CLASS_COLORS[0]);
    expect(colorForPitchClass(-1)).toBe(PITCH_CLASS_COLORS[11]);
  });

  it("pc 12 wraps to same color as pc 0", () => {
    expect(colorForPitchClass(12)).toBe(colorForPitchClass(0));
  });

  it("all 12 pitch classes have distinct colors", () => {
    const colors = Array.from({ length: 12 }, (_, i) => colorForPitchClass(i));
    expect(new Set(colors).size).toBe(12);
  });
});
