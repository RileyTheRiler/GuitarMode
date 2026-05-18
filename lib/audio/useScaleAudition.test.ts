import { describe, expect, it } from "vitest";
import {
  AUDITION_BASE_MIDI,
  buildAuditionSequence,
} from "./useScaleAudition";

describe("buildAuditionSequence", () => {
  it("plays C major up an octave and back down", () => {
    // C major intervals: 0,2,4,5,7,9,11
    const root = AUDITION_BASE_MIDI; // C3
    const seq = buildAuditionSequence(root, [0, 2, 4, 5, 7, 9, 11]);
    expect(seq).toEqual([
      48, 50, 52, 53, 55, 57, 59, 60, // ascend including octave
      59, 57, 55, 53, 52, 50, 48,     // descend
    ]);
  });

  it("plays the minor pentatonic without duplicating the octave", () => {
    // A minor pentatonic: 0,3,5,7,10
    const root = AUDITION_BASE_MIDI + 9; // A3 = 57
    const seq = buildAuditionSequence(root, [0, 3, 5, 7, 10]);
    expect(seq).toEqual([
      57, 60, 62, 64, 67, 69, // ascend + octave
      67, 64, 62, 60, 57,      // descend (no duplicate 69)
    ]);
  });

  it("returns at least one note even for degenerate templates", () => {
    expect(buildAuditionSequence(60, [0])).toEqual([60, 72, 60]);
  });
});
