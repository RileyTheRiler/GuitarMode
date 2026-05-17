import { describe, it, expect } from "vitest";
import {
  freqToMidi,
  midiToFreq,
  midiToNoteName,
  midiToPitchClass,
  pitchClassName,
  colorForPitchClass,
  PITCH_CLASS_COLORS,
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

  it("custom a4Hz shifts the result", () => {
    const result432 = freqToMidi(432, 432);
    expect(result432).toBeCloseTo(69, 6);
  });
});

describe("midiToFreq", () => {
  it("MIDI 69 is 440 Hz", () => {
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
  });

  it("MIDI 57 is 220 Hz (A3)", () => {
    expect(midiToFreq(57)).toBeCloseTo(220, 6);
  });

  it("MIDI 81 is 880 Hz (A5)", () => {
    expect(midiToFreq(81)).toBeCloseTo(880, 6);
  });

  it("round-trips with freqToMidi within floating-point tolerance", () => {
    for (const freq of [110, 220, 440, 880, 261.63, 329.63]) {
      expect(midiToFreq(freqToMidi(freq))).toBeCloseTo(freq, 3);
    }
  });
});

describe("midiToNoteName", () => {
  it("MIDI 60 is C4", () => expect(midiToNoteName(60)).toBe("C4"));
  it("MIDI 69 is A4", () => expect(midiToNoteName(69)).toBe("A4"));
  it("MIDI 21 is A0 (lowest piano key)", () => expect(midiToNoteName(21)).toBe("A0"));
  it("MIDI 108 is C8", () => expect(midiToNoteName(108)).toBe("C8"));
  it("rounds non-integer input", () => expect(midiToNoteName(60.4)).toBe("C4"));
  it("MIDI 0 is C-1", () => expect(midiToNoteName(0)).toBe("C-1"));
});

describe("midiToPitchClass", () => {
  it("MIDI 60 (C) is pitch class 0", () => expect(midiToPitchClass(60)).toBe(0));
  it("MIDI 61 (C#) is pitch class 1", () => expect(midiToPitchClass(61)).toBe(1));
  it("MIDI 69 (A) is pitch class 9", () => expect(midiToPitchClass(69)).toBe(9));
  it("MIDI 71 (B) is pitch class 11", () => expect(midiToPitchClass(71)).toBe(11));
  it("MIDI 72 (C) wraps back to pitch class 0", () => expect(midiToPitchClass(72)).toBe(0));
});

describe("pitchClassName", () => {
  it("pc 0 is C", () => expect(pitchClassName(0)).toBe("C"));
  it("pc 9 is A", () => expect(pitchClassName(9)).toBe("A"));
  it("pc 11 is B", () => expect(pitchClassName(11)).toBe("B"));
  it("pc 12 wraps to C", () => expect(pitchClassName(12)).toBe("C"));
  it("pc -1 wraps to B", () => expect(pitchClassName(-1)).toBe("B"));
});

describe("colorForPitchClass", () => {
  it("returns a hex color string starting with #", () => {
    for (let pc = 0; pc < 12; pc++) {
      expect(colorForPitchClass(pc)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("pc 0 matches the PITCH_CLASS_COLORS constant for C", () => {
    expect(colorForPitchClass(0)).toBe(PITCH_CLASS_COLORS[0]);
  });

  it("pc 12 wraps to same color as pc 0", () => {
    expect(colorForPitchClass(12)).toBe(colorForPitchClass(0));
  });

  it("all 12 pitch classes have distinct colors", () => {
    const colors = Array.from({ length: 12 }, (_, i) => colorForPitchClass(i));
    expect(new Set(colors).size).toBe(12);
  });
});
