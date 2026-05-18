import { NOTE_NAMES } from "./notes";
import { CHORD_TEMPLATES, chordPitchClasses, type ChordQuality } from "./chords";
import type { PitchClassProfile } from "./detectScale";

export type ChordMatch = {
  root: number;
  rootName: string;
  quality: ChordQuality;
  displayName: string;
  score: number;
  confidence: number;
};

/**
 * Score each (root, quality) combination against the pitch-class profile.
 * Returns the top N matches sorted by score descending.
 */
export function detectChords(profile: PitchClassProfile, topN = 5): ChordMatch[] {
  const totalWeight = profile.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return [];

  const results: ChordMatch[] = [];
  const qualities = Object.keys(CHORD_TEMPLATES) as ChordQuality[];

  for (let root = 0; root < 12; root++) {
    for (const quality of qualities) {
      const pcs = chordPitchClasses(root, quality);
      let score = 0;
      for (let pc = 0; pc < 12; pc++) {
        const w = profile[pc];
        if (w <= 0) continue;
        if (pcs.all.has(pc)) score += w;
        else score -= w * 0.4;
      }
      // Root emphasis
      score += profile[root] * 0.5;

      const rootName = NOTE_NAMES[root];
      const suffix = quality === "maj" ? "" : quality;
      results.push({
        root,
        rootName,
        quality,
        displayName: `${rootName}${suffix}`,
        score,
        confidence: Math.max(0, Math.min(1, score / (totalWeight * 1.5))),
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topN);
}
