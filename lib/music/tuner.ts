import { STANDARD_TUNING } from "../guitar/fretboard";
import { freqToMidi, midiToNoteName } from "./notes";

export type TuningReading = {
  targetMidi: number;
  targetName: string;
  cents: number;
  detectedMidi: number;
};

/**
 * Return the MIDI value in `targets` that is closest (in semitones) to
 * `midi`. Ties go to the lower target.
 */
export function nearestTarget(midi: number, targets: number[]): number {
  if (targets.length === 0) {
    throw new Error("nearestTarget: targets must not be empty");
  }
  let bestDist = Infinity;
  let best = targets[0];
  for (const t of targets) {
    const d = Math.abs(midi - t);
    if (d < bestDist) {
      bestDist = d;
      best = t;
    }
  }
  return best;
}

/**
 * Compute a tuner reading for a detected frequency against a set of MIDI
 * tuning targets (defaults to the open-string MIDI values of standard
 * tuning). `cents` is signed: negative = flat, positive = sharp.
 *
 * Returns `null` if `freq` is non-positive / non-finite — the detector
 * can produce those on weak frames.
 */
export function tunerReading(
  freq: number,
  a4Hz: number,
  targets: number[] = STANDARD_TUNING
): TuningReading | null {
  if (!(freq > 0) || !Number.isFinite(freq)) return null;
  const detectedMidi = freqToMidi(freq, a4Hz);
  const targetMidi = nearestTarget(detectedMidi, targets);
  const cents = (detectedMidi - targetMidi) * 100;
  return {
    targetMidi,
    targetName: midiToNoteName(targetMidi),
    cents,
    detectedMidi,
  };
}
