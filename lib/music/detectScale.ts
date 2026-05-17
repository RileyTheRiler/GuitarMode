import { pitchClassName } from "./notes";
import { SCALE_TEMPLATES, ScaleTemplate, scalePitchClasses } from "./scales";

export type ScaleMatch = {
  root: number;
  rootName: string;
  templateName: string;
  template: ScaleTemplate;
  scale: number[]; // sorted pitch classes in the scale
  missing: number[]; // scale pitch classes with zero weight in the profile
  score: number;
  confidence: number; // 0..1 normalized vs best-possible score
};

/**
 * A pitch-class profile is a 12-element array of non-negative weights — one
 * per pitch class — typically accumulated by dwell time (ms) or chroma energy.
 * Any positive value counts that pitch-class as "played".
 */
export type PitchClassProfile = number[];

export function emptyProfile(): PitchClassProfile {
  return Array(12).fill(0);
}

/**
 * Weighted scale/mode matcher. A pitch-class that was held longer exerts more
 * influence than one played briefly — so e.g. sitting on A over the A-minor
 * pitch collection correctly ranks A Aeolian above C Ionian.
 *
 * Scoring per (root, template):
 *   +profile[pc]              for each pc in the scale
 *   -profile[pc] * 0.5        for each pc NOT in the scale
 *   +profile[root] * 0.75     root emphasis bonus
 *   +profile[root+7] * 0.25   fifth emphasis bonus
 *   -specificity * totalWeight  damp exotic/rare scales on thin evidence
 * confidence = score / (2 * totalWeight)   clamped to [0, 1]
 */
export function detectScales(profile: PitchClassProfile, topN = 5): ScaleMatch[] {
  const totalWeight = profile.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) return [];

  const results: ScaleMatch[] = [];

  for (let root = 0; root < 12; root++) {
    for (const template of SCALE_TEMPLATES) {
      const scaleSet = scalePitchClasses(template, root);
      let score = 0;
      for (let pc = 0; pc < 12; pc++) {
        const w = profile[pc];
        if (w <= 0) continue;
        if (scaleSet.has(pc)) score += w;
        else score -= w * 0.5;
      }
      score += profile[root] * 0.75;
      score += profile[(root + 7) % 12] * 0.25;
      score -= template.specificity * totalWeight;
      score += template.popularity * totalWeight;

      const scaleArr = Array.from(scaleSet).sort((a, b) => a - b);
      const missing = scaleArr.filter((pc) => profile[pc] <= 0);

      const bestPossible = totalWeight * 2;
      const confidence = Math.max(0, Math.min(1, score / bestPossible));

      results.push({
        root,
        rootName: pitchClassName(root),
        templateName: template.name,
        template,
        scale: scaleArr,
        missing,
        score,
        confidence,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  // De-duplicate equivalent pitch-class collections (e.g. C Ionian and A
  // Aeolian share a set; keep whichever scored higher).
  const seen = new Set<string>();
  const deduped: ScaleMatch[] = [];
  for (const m of results) {
    const key = m.scale.join(",");
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(m);
    if (deduped.length >= topN) break;
  }

  return deduped;
}
