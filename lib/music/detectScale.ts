import { pitchClassName } from "./notes";
import { SCALE_TEMPLATES, ScaleTemplate, scalePitchClasses } from "./scales";

export type ScaleMatch = {
  root: number;
  rootName: string;
  templateName: string;
  template: ScaleTemplate;
  scale: number[]; // sorted pitch classes in the scale
  missing: number[]; // scale pitch classes not yet played
  score: number;
  confidence: number; // 0..1 normalized confidence vs best possible score
};

/**
 * Score every (root × template) pair against the detected pitch-class set.
 *
 * +2 for each detected PC that is in the scale
 * -1 for each detected PC that is NOT in the scale (out-of-scale penalty)
 * +0.5 bonus when the root is in the detected set
 * +0.25 bonus when the fifth (root+7) is in the detected set
 * -specificity (from the template) to damp exotic-scale false-positives
 */
export function detectScales(
  detected: Set<number>,
  topN = 5
): ScaleMatch[] {
  if (detected.size === 0) return [];

  const detectedArr = Array.from(detected);
  const results: ScaleMatch[] = [];

  for (let root = 0; root < 12; root++) {
    for (const template of SCALE_TEMPLATES) {
      const scaleSet = scalePitchClasses(template, root);
      let score = 0;
      for (const pc of detectedArr) {
        if (scaleSet.has(pc)) score += 2;
        else score -= 1;
      }
      if (detected.has(root)) score += 0.5;
      if (detected.has((root + 7) % 12)) score += 0.25;
      score -= template.specificity;

      const scaleArr = Array.from(scaleSet).sort((a, b) => a - b);
      const missing = scaleArr.filter((pc) => !detected.has(pc));

      const bestPossible = detectedArr.length * 2 + 0.75;
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

  // De-duplicate equivalent scale sets (e.g., C Ionian vs A Aeolian have the
  // same pitch-class set; keep only the highest-scoring one of each set).
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
