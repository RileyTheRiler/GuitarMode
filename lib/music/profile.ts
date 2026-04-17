import type { PitchClassProfile } from "./detectScale";
import { emptyProfile } from "./detectScale";
import type { DetectedNote } from "../audio/usePitchDetector";

/**
 * Build a weighted pitch-class profile from monophonic detected notes and an
 * optional chromagram accumulator (pitch-class energy summed over frames).
 *
 * `chromaWeight` scales chroma contribution relative to note durations. The
 * chroma accumulator is expected to already be in arbitrary-but-consistent
 * units (e.g. summed magnitude squared per frame).
 */
export function buildProfile(
  notes: DetectedNote[],
  chroma: PitchClassProfile | null = null,
  chromaWeight = 1
): PitchClassProfile {
  const profile = emptyProfile();

  for (const n of notes) {
    // At minimum, credit a note for the debouncer's confirmation window.
    const dur = Math.max(80, n.durationMs);
    profile[n.pitchClass] += dur;
  }

  if (chroma) {
    const noteTotal = profile.reduce((a, b) => a + b, 0);
    const chromaTotal = chroma.reduce((a, b) => a + b, 0);
    // Normalize chroma so it contributes on roughly the same scale as notes.
    if (chromaTotal > 0) {
      const target = Math.max(noteTotal, 500) * chromaWeight;
      const scale = target / chromaTotal;
      for (let i = 0; i < 12; i++) profile[i] += chroma[i] * scale;
    }
  }

  return profile;
}

export function profilePitchClassSet(profile: PitchClassProfile): Set<number> {
  const s = new Set<number>();
  for (let i = 0; i < 12; i++) if (profile[i] > 0) s.add(i);
  return s;
}
