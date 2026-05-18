import { type ScaleTemplate, scalePitchClasses } from "./scales";
import { type ChordPitchClasses } from "./chords";
import { NOTE_NAMES } from "./notes";

// How a scale note relates to the currently active chord.
export type NoteRole =
  | "chord-root"   // the chord's root — strongest landing point
  | "chord-third"  // defines major/minor color
  | "chord-fifth"  // stable, open
  | "chord-ext"    // other chord tones (e.g. b7 in min7)
  | "color";       // in scale but not a chord tone — passing / tension

export type NoteGuide = {
  pitchClass: number;
  name: string;
  role: NoteRole;
};

export function getSoloGuide(
  root: number,
  template: ScaleTemplate,
  chord: ChordPitchClasses | null
): NoteGuide[] {
  const pcs = scalePitchClasses(template, root);
  const guides: NoteGuide[] = [];

  for (const pc of pcs) {
    let role: NoteRole = "color";
    if (chord) {
      if (pc === chord.root) role = "chord-root";
      else if (chord.third != null && pc === chord.third) role = "chord-third";
      else if (chord.fifth != null && pc === chord.fifth) role = "chord-fifth";
      else if (chord.all.has(pc)) role = "chord-ext";
    }
    guides.push({ pitchClass: pc, name: NOTE_NAMES[pc], role });
  }

  // Return notes in ascending interval order from the root.
  guides.sort((a, b) => (a.pitchClass - root + 12) % 12 - (b.pitchClass - root + 12) % 12);
  return guides;
}

export function soloScalePitchClasses(root: number, template: ScaleTemplate): Set<number> {
  return scalePitchClasses(template, root);
}
