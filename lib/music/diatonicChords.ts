import { NOTE_NAMES } from "./notes";
import type { ScaleTemplate } from "./scales";

export type DiatonicTriad = {
  degree: number;
  root: number;
  rootName: string;
  quality: "maj" | "min" | "dim" | "aug" | "other";
  romanNumeral: string;
  label: string;
};

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

function triadQuality(
  third: number,
  fifth: number
): "maj" | "min" | "dim" | "aug" | "other" {
  if (third === 4 && fifth === 7) return "maj";
  if (third === 3 && fifth === 7) return "min";
  if (third === 3 && fifth === 6) return "dim";
  if (third === 4 && fifth === 8) return "aug";
  return "other";
}

function romanFor(idx: number, quality: string): string {
  const r = ROMAN[idx] ?? String(idx + 1);
  const lower = quality === "min" || quality === "dim";
  return lower ? r.toLowerCase() : r;
}

function qualitySuffix(quality: string): string {
  if (quality === "dim") return "°";
  if (quality === "aug") return "+";
  return "";
}

export function diatonicTriads(
  template: ScaleTemplate,
  root: number
): DiatonicTriad[] {
  const { intervals } = template;
  const n = intervals.length;
  if (n < 7) return [];

  return intervals.map((interval, i) => {
    const chordRoot = (root + interval) % 12;
    const thirdInterval = intervals[(i + 2) % n];
    const fifthInterval = intervals[(i + 4) % n];
    const third = ((thirdInterval - interval) % 12 + 12) % 12;
    const fifth = ((fifthInterval - interval) % 12 + 12) % 12;
    const quality = triadQuality(third, fifth);
    const roman = romanFor(i, quality) + qualitySuffix(quality);
    const rootName = NOTE_NAMES[chordRoot];
    const label = rootName + (quality === "min" ? "m" : quality === "dim" ? "°" : quality === "aug" ? "+" : "");

    return { degree: i, root: chordRoot, rootName, quality, romanNumeral: roman, label };
  });
}
