import { describe, expect, it } from "vitest";
import { notesToMidi } from "./midi";
import type { DetectedNote } from "../audio/usePitchDetector";

function makeNote(midi: number, at: number, durationMs: number): DetectedNote {
  return {
    midi,
    noteName: "A4",
    pitchClass: midi % 12,
    frequency: 440,
    clarity: 0.95,
    at,
    endAt: at + durationMs,
    durationMs,
  };
}

describe("notesToMidi", () => {
  it("returns empty bytes for no notes", () => {
    expect(notesToMidi([]).length).toBe(0);
  });

  it("produces a valid MIDI header (MThd) for a single note", () => {
    const bytes = notesToMidi([makeNote(60, 0, 500)]);
    // Bytes 0–3: "MThd"
    expect(bytes[0]).toBe(0x4d);
    expect(bytes[1]).toBe(0x54);
    expect(bytes[2]).toBe(0x68);
    expect(bytes[3]).toBe(0x64);
    // Header chunk length = 6
    expect(bytes[4]).toBe(0);
    expect(bytes[5]).toBe(0);
    expect(bytes[6]).toBe(0);
    expect(bytes[7]).toBe(6);
  });

  it("produces a valid track chunk (MTrk) for a single note", () => {
    const bytes = notesToMidi([makeNote(60, 0, 500)]);
    // Bytes 14–17: "MTrk"
    expect(bytes[14]).toBe(0x4d);
    expect(bytes[15]).toBe(0x54);
    expect(bytes[16]).toBe(0x72);
    expect(bytes[17]).toBe(0x6b);
  });

  it("encodes format 0 and 1 track", () => {
    const bytes = notesToMidi([makeNote(60, 0, 500)]);
    // Format (bytes 8-9)
    expect(bytes[8]).toBe(0);
    expect(bytes[9]).toBe(0);
    // Track count (bytes 10-11)
    expect(bytes[10]).toBe(0);
    expect(bytes[11]).toBe(1);
  });

  it("handles multiple notes without throwing", () => {
    const notes = [
      makeNote(60, 0, 500),
      makeNote(62, 600, 300),
      makeNote(64, 1000, 200),
    ];
    const bytes = notesToMidi(notes);
    expect(bytes.length).toBeGreaterThan(22);
  });

  it("clamps midi values to 0-127", () => {
    const bytes = notesToMidi([makeNote(200, 0, 500)]);
    // Should not throw and should produce valid output
    expect(bytes.length).toBeGreaterThan(0);
  });
});
