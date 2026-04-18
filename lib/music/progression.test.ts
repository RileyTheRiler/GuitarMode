import { describe, expect, it } from "vitest";
import { activeChordAt, sortProgression, type ChordEvent } from "./progression";

const sample: ChordEvent[] = [
  { time: 0, chord: "G" },
  { time: 2, chord: "D" },
  { time: 4, chord: "Em" },
];

describe("activeChordAt", () => {
  it("returns null on empty list", () => {
    expect(activeChordAt([], 3)).toBeNull();
  });

  it("returns null when before first event", () => {
    expect(activeChordAt(sample, -0.5)).toBeNull();
  });

  it("returns first event at boundary", () => {
    expect(activeChordAt(sample, 0)?.chord).toBe("G");
  });

  it("returns latest event <= seconds", () => {
    expect(activeChordAt(sample, 1.9)?.chord).toBe("G");
    expect(activeChordAt(sample, 2)?.chord).toBe("D");
    expect(activeChordAt(sample, 3.5)?.chord).toBe("D");
    expect(activeChordAt(sample, 4)?.chord).toBe("Em");
  });

  it("returns final event past the end", () => {
    expect(activeChordAt(sample, 1000)?.chord).toBe("Em");
  });
});

describe("sortProgression", () => {
  it("sorts ascending by time without mutating input", () => {
    const input: ChordEvent[] = [
      { time: 4, chord: "Em" },
      { time: 0, chord: "G" },
      { time: 2, chord: "D" },
    ];
    const sorted = sortProgression(input);
    expect(sorted.map((e) => e.chord)).toEqual(["G", "D", "Em"]);
    expect(input[0].chord).toBe("Em");
  });
});
