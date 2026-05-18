/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { getSoloGuide, soloScalePitchClasses } from "./soloGuide";
import { SCALE_TEMPLATES } from "./scales";
import { chordPitchClasses } from "./chords";

const AEOLIAN = SCALE_TEMPLATES.find((s) => s.name === "Aeolian (Natural Minor)")!;
const IONIAN  = SCALE_TEMPLATES.find((s) => s.name === "Ionian (Major)")!;

describe("soloScalePitchClasses", () => {
  it("returns the correct set for A minor (root=9)", () => {
    const pcs = soloScalePitchClasses(9, AEOLIAN);
    // A B C D E F G = 9 11 0 2 4 5 7
    expect([...pcs].sort((a, b) => a - b)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it("returns 7 pitch classes for a 7-note scale", () => {
    expect(soloScalePitchClasses(0, IONIAN).size).toBe(7);
  });
});

describe("getSoloGuide", () => {
  it("returns one guide entry per scale note", () => {
    const guides = getSoloGuide(9, AEOLIAN, null);
    // A natural minor has 7 notes
    expect(guides).toHaveLength(7);
  });

  it("all roles are 'color' when chord is null", () => {
    const guides = getSoloGuide(9, AEOLIAN, null);
    expect(guides.every((g) => g.role === "color")).toBe(true);
  });

  it("guide is sorted by ascending interval from the root", () => {
    const guides = getSoloGuide(9, AEOLIAN, null);
    const offsets = guides.map((g) => (g.pitchClass - 9 + 12) % 12);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
  });

  it("root note gets 'chord-root' role when chord matches", () => {
    const amChord = chordPitchClasses(9, "min"); // A minor: root=A(9), third=C(0), fifth=E(4)
    const guides = getSoloGuide(9, AEOLIAN, amChord);
    const aGuide = guides.find((g) => g.pitchClass === 9);
    expect(aGuide?.role).toBe("chord-root");
  });

  it("third note gets 'chord-third' role", () => {
    const amChord = chordPitchClasses(9, "min");
    const guides = getSoloGuide(9, AEOLIAN, amChord);
    // C (pc=0) is the minor third of Am
    const cGuide = guides.find((g) => g.pitchClass === 0);
    expect(cGuide?.role).toBe("chord-third");
  });

  it("fifth note gets 'chord-fifth' role", () => {
    const amChord = chordPitchClasses(9, "min");
    const guides = getSoloGuide(9, AEOLIAN, amChord);
    // E (pc=4) is the fifth of Am
    const eGuide = guides.find((g) => g.pitchClass === 4);
    expect(eGuide?.role).toBe("chord-fifth");
  });

  it("non-chord scale tones get 'color' role", () => {
    const amChord = chordPitchClasses(9, "min");
    const guides = getSoloGuide(9, AEOLIAN, amChord);
    // B(11), D(2), F(5), G(7) are in A minor scale but not Am triad
    const colorPcs = [11, 2, 5, 7];
    for (const pc of colorPcs) {
      const g = guides.find((g) => g.pitchClass === pc);
      expect(g?.role).toBe("color");
    }
  });

  it("returns 'chord-ext' for extended chord tones not in root/third/fifth", () => {
    // Am7 chord: root=A(9), third=C(0), fifth=E(4), b7=G(7)
    const am7Chord = chordPitchClasses(9, "min7");
    const guides = getSoloGuide(9, AEOLIAN, am7Chord);
    // G(7) is the b7 extension
    const gGuide = guides.find((g) => g.pitchClass === 7);
    expect(gGuide?.role).toBe("chord-ext");
  });

  it("name field matches the pitch class note name", () => {
    const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    const guides = getSoloGuide(0, IONIAN, null);
    for (const g of guides) {
      expect(g.name).toBe(NOTE_NAMES[g.pitchClass]);
    }
  });

  it("works for C major scale over C major chord", () => {
    const cChord = chordPitchClasses(0, "maj"); // C E G
    const guides = getSoloGuide(0, IONIAN, cChord);
    expect(guides.find((g) => g.pitchClass === 0)?.role).toBe("chord-root");  // C
    expect(guides.find((g) => g.pitchClass === 4)?.role).toBe("chord-third"); // E
    expect(guides.find((g) => g.pitchClass === 7)?.role).toBe("chord-fifth"); // G
    // D(2), F(5), A(9), B(11) are color
    for (const pc of [2, 5, 9, 11]) {
      expect(guides.find((g) => g.pitchClass === pc)?.role).toBe("color");
    }
  });
});
