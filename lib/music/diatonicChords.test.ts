/// <reference types="vitest/globals" />
import { describe, expect, it } from "vitest";
import { diatonicTriads } from "./diatonicChords";
import { SCALE_TEMPLATES } from "./scales";

const IONIAN = SCALE_TEMPLATES.find((s) => s.name === "Ionian (Major)")!;
const AEOLIAN = SCALE_TEMPLATES.find((s) => s.name === "Aeolian (Natural Minor)")!;
const HARMONIC_MINOR = SCALE_TEMPLATES.find((s) => s.name === "Harmonic Minor")!;
const MINOR_PENTA = SCALE_TEMPLATES.find((s) => s.name === "Minor Pentatonic")!;

describe("diatonicTriads", () => {
  it("returns empty array for scales with fewer than 7 notes", () => {
    expect(diatonicTriads(MINOR_PENTA, 0)).toEqual([]);
  });

  it("returns 7 triads for a 7-note scale", () => {
    expect(diatonicTriads(IONIAN, 0)).toHaveLength(7);
  });

  it("C major triads have correct qualities: I ii iii IV V vi vii°", () => {
    const triads = diatonicTriads(IONIAN, 0); // C = 0
    const qualities = triads.map((t) => t.quality);
    expect(qualities).toEqual(["maj", "min", "min", "maj", "maj", "min", "dim"]);
  });

  it("C major triad labels are correct", () => {
    const triads = diatonicTriads(IONIAN, 0);
    expect(triads.map((t) => t.label)).toEqual(["C", "Dm", "Em", "F", "G", "Am", "B°"]);
  });

  it("C major roman numerals are correct", () => {
    const triads = diatonicTriads(IONIAN, 0);
    expect(triads.map((t) => t.romanNumeral)).toEqual(["I", "ii", "iii", "IV", "V", "vi", "vii°"]);
  });

  it("C major root pitch classes are correct", () => {
    const triads = diatonicTriads(IONIAN, 0);
    // C D E F G A B = 0 2 4 5 7 9 11
    expect(triads.map((t) => t.root)).toEqual([0, 2, 4, 5, 7, 9, 11]);
  });

  it("G major (root=7) triads have correct root names", () => {
    const triads = diatonicTriads(IONIAN, 7);
    // G A B C D E F#
    expect(triads.map((t) => t.rootName)).toEqual(["G", "A", "B", "C", "D", "E", "F#"]);
  });

  it("G major labels include F#° for the vii degree", () => {
    const triads = diatonicTriads(IONIAN, 7);
    expect(triads[6].label).toBe("F#°");
    expect(triads[6].romanNumeral).toBe("vii°");
  });

  it("A natural minor (root=9) qualities are: i ii° III iv v VI VII", () => {
    const triads = diatonicTriads(AEOLIAN, 9);
    const qualities = triads.map((t) => t.quality);
    expect(qualities).toEqual(["min", "dim", "maj", "min", "min", "maj", "maj"]);
  });

  it("A natural minor root names are A B C D E F G", () => {
    const triads = diatonicTriads(AEOLIAN, 9);
    expect(triads.map((t) => t.rootName)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
  });

  it("harmonic minor (A root=9) vii degree is diminished", () => {
    // A harmonic minor: A B C D E F G# — vii = G#dim
    const triads = diatonicTriads(HARMONIC_MINOR, 9);
    expect(triads).toHaveLength(7);
    // G# is pitch class 8
    expect(triads[6].root).toBe(8);
    expect(triads[6].quality).toBe("dim");
  });

  it("degree field equals the index in the returned array", () => {
    const triads = diatonicTriads(IONIAN, 0);
    triads.forEach((t, i) => expect(t.degree).toBe(i));
  });

  it("rootName matches NOTE_NAMES for the computed pitch class", () => {
    const NOTE_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
    const triads = diatonicTriads(IONIAN, 5); // F major
    for (const t of triads) {
      expect(t.rootName).toBe(NOTE_NAMES[t.root]);
    }
  });
});
