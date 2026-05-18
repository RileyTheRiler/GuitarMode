import { describe, expect, it } from "vitest";
import { voicingMidis } from "./useProgressionPlayer";
import { CHORD_TEMPLATES } from "../music/chords";

describe("voicingMidis", () => {
  it("places C major as C3 E3 G3", () => {
    const v = voicingMidis(0, CHORD_TEMPLATES.maj.intervals);
    expect(v).toEqual([48, 52, 55]);
  });

  it("places A minor as A3 C4 E4 (root above C3)", () => {
    const v = voicingMidis(9, CHORD_TEMPLATES.min.intervals);
    expect(v).toEqual([57, 60, 64]);
  });

  it("stacks the dominant seventh", () => {
    // G7 = G B D F
    const v = voicingMidis(7, CHORD_TEMPLATES["7"].intervals);
    expect(v).toEqual([55, 59, 62, 65]);
  });

  it("stacks add9 with the 9 above the root", () => {
    const v = voicingMidis(0, CHORD_TEMPLATES.add9.intervals);
    // intervals are [0, 4, 7, 2] in template order
    expect(v).toEqual([48, 52, 55, 50]);
  });
});
