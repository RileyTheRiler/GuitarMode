"use client";

import { parseChord, chordPitchClasses, type ChordQuality } from "./chords";
import { detectScales } from "./detectScale";
import { allPositions, type FretPosition, STANDARD_TUNING } from "../guitar/fretboard";

export type NoteTechnique = "bend" | "hammer" | "pull" | "slide_up" | "slide_down";

export interface SoloNote {
  stringIndex: number;
  fret: number;
  midi: number;
  pitchClass: number;
  startBeat: number;
  durationBeats: number;
  technique?: NoteTechnique;
  /** For bends: how many semitones to glide up (typically 1 or 2). */
  bendSemitones?: number;
}

export interface GeneratedSolo {
  notes: SoloNote[];
  bpm: number;
  totalBeats: number;
  scaleRoot: number;
  scaleName: string;
  scalePitchClasses: Set<number>;
  centerFret: number;
}

export interface SoloParams {
  chords: string[];
  beatsPerChord?: number;
  bpm?: number;
  bars?: number;
  seed?: number;
  style?: "blues" | "rock" | "jazz";
}

// Mulberry32 seeded PRNG — fast, good distribution, no deps.
function createRng(seed: number) {
  let s = seed >>> 0;
  return {
    next(): number {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    nextInt(min: number, max: number): number {
      return min + Math.floor(this.next() * (max - min + 1));
    },
    pick<T>(arr: T[]): T {
      return arr[this.nextInt(0, arr.length - 1)];
    },
  };
}

// Find what fret the given pitch class is on the given string (preferring fret >= minFret).
function rootFretOnString(rootPC: number, stringIndex: number, minFret = 3): number {
  const openPC = STANDARD_TUNING[stringIndex] % 12;
  let fret = ((rootPC - openPC) + 12) % 12;
  if (fret < minFret) fret += 12;
  return fret;
}

// Style-specific lick pattern banks. Each pattern is an array of position-index deltas
// applied cumulatively from the starting posIdx.
type LickPattern = number[];
const LICK_PATTERNS: Record<"rock" | "blues" | "jazz", LickPattern[]> = {
  blues: [
    [0, 2, -1, 1],           // root → b3 → approach → resolve
    [0, 1, 0, 2, 0],         // hammer-pull b3 trill then resolve up
    [0, 2, 4, 2, 0, -1],     // box-top turnaround
    [0, -1, 1, 3, 2, 0],     // blues crying figure
    [0, 0, 1, 0, -1, 0],     // trill motif
    [0, 3, 2, 1, 0, 2],      // high-to-low resolve
  ],
  rock: [
    [0, 2, 4, 3, 2, 0],      // pentatonic up-and-back
    [0, 1, 3, 1, 0, -1],     // rock nail lick
    [0, 2, -1, 2, 0],        // pentatonic skip
    [0, 3, 2, 0, -1, 1, 0],  // Hendrix box lick
    [0, 1, 2, 3, 2, 1, 0],   // linear ascending-descending
    [0, 2, 0, 2, 0, 3],      // double-time pop figure
  ],
  jazz: [
    [0, 1, 2, 3, 2, 1, 0, -1], // bebop 8th-note descending
    [0, -1, 1, -1, 0, 2],      // chromatic encirclement
    [0, 2, 1, 3, 2, 4],        // arpeggio outline with approach
    [0, 1, 3, 5, 4, 2],        // guide-tone leap line
    [0, 3, 2, 4, 3, 5, 4, 2],  // bebop scale run
    [0, -1, -2, 1, 0, 2, 1],   // altered tension figure
  ],
};

// Intensity curve across the solo: sparse intro → builds → peaks at 75% → releases.
function soloIntensity(beat: number, totalBeats: number): number {
  const t = beat / totalBeats;
  if (t < 0.25) return 0.3 + t * 1.2;
  if (t < 0.75) return 0.6 + (t - 0.25);
  return Math.max(0.3, 1.1 - (t - 0.75) * 3.2);
}

export function generateSolo(params: SoloParams): GeneratedSolo {
  const {
    chords,
    beatsPerChord = 4,
    bpm = 100,
    seed = Date.now(),
    style = "rock",
  } = params;
  const rng = createRng(seed);

  // 1. Parse chords
  const parsedChords = chords
    .map((c) => parseChord(c.trim()))
    .filter((c): c is { root: number; quality: ChordQuality } => c !== null);
  if (parsedChords.length === 0) parsedChords.push({ root: 9, quality: "min" });

  // 2. Build pitch-class profile from chord tones (weighted by root prominence)
  const profile = new Array(12).fill(0);
  for (const chord of parsedChords) {
    const pcs = chordPitchClasses(chord.root, chord.quality);
    pcs.all.forEach((pc) => { profile[pc] += 2; });
    profile[chord.root] += 3;
  }

  // 3. Detect scale — prefer pentatonic/blues for rock/blues, any for jazz
  const scales = detectScales(profile, 8);
  let scaleRoot = parsedChords[0].root;
  let scaleName = "Minor Pentatonic";
  let scaleIntervals = [0, 3, 5, 7, 10];

  if (scales.length > 0) {
    const preferred =
      style === "jazz"
        ? scales[0]
        : (scales.find(
            (s) =>
              s.templateName.includes("Pentatonic") ||
              s.templateName.includes("Blues") ||
              s.templateName.includes("Minor") ||
              s.templateName.includes("Major")
          ) ?? scales[0]);
    scaleRoot = preferred.root;
    scaleName = preferred.templateName;
    scaleIntervals = preferred.template.intervals;
  }

  const scalePCs = new Set(scaleIntervals.map((i) => (scaleRoot + i) % 12));

  // 4. Pick a fret position. Use the root on the low-E string as the box anchor.
  //    minFret=3 so open-position roots jump to 12th-fret equivalent.
  const centerFret = rootFretOnString(scaleRoot, 0, 3);
  const fretMin = centerFret;
  const fretMax = Math.min(22, centerFret + 7);

  // 5. Gather unique scale positions in [fretMin, fretMax], deduplicated by MIDI.
  //    For solos, prefer higher strings (index 3-5: G, B, e) when there's a clash.
  const allPos = allPositions(fretMax).filter(
    (p) => p.fret >= fretMin && scalePCs.has(p.pitchClass)
  );
  allPos.sort((a, b) => a.midi - b.midi || b.stringIndex - a.stringIndex);

  const byMidi = new Map<number, FretPosition>();
  for (const pos of allPos) {
    if (!byMidi.has(pos.midi)) {
      byMidi.set(pos.midi, pos);
    } else {
      // Prefer string 3-5 (G/B/e) for lead-guitar feel
      const existing = byMidi.get(pos.midi)!;
      if (pos.stringIndex >= 3 && existing.stringIndex < 3) {
        byMidi.set(pos.midi, pos);
      }
    }
  }
  const positions = Array.from(byMidi.values()).sort((a, b) => a.midi - b.midi);

  if (positions.length < 2) {
    return { notes: [], bpm, totalBeats: 0, scaleRoot, scaleName, scalePitchClasses: scalePCs, centerFret };
  }

  // 6. Build chord timeline
  interface ChordSlot { chord: { root: number; quality: ChordQuality }; startBeat: number }
  const timeline: ChordSlot[] = parsedChords.map((chord, i) => ({
    chord,
    startBeat: i * beatsPerChord,
  }));
  const totalBeats = parsedChords.length * beatsPerChord;

  function chordAtBeat(beat: number) {
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (beat >= timeline[i].startBeat) return timeline[i].chord;
    }
    return timeline[0].chord;
  }

  function isChordChange(beat: number) {
    return timeline.some((t) => Math.abs(t.startBeat - beat) < 0.01);
  }

  // Find closest chord-tone position index from a starting index, searching outward.
  function nearestChordToneIdx(from: number, chord: { root: number; quality: ChordQuality }) {
    const cPCs = chordPitchClasses(chord.root, chord.quality).all;
    for (let radius = 0; radius < positions.length; radius++) {
      for (const candidate of [from + radius, from - radius]) {
        if (candidate >= 0 && candidate < positions.length && cPCs.has(positions[candidate].pitchClass)) {
          return candidate;
        }
      }
    }
    return from;
  }

  // 7. Build seed motif for repetition. Captured once so it stays consistent per solo.
  const motifIntervals = rng.pick(LICK_PATTERNS[style]).slice(0, rng.nextInt(3, 4));
  const MOTIF_RHYTHM: Record<"rock" | "blues" | "jazz", number[]> = {
    blues: [0.5, 0.5, 0.5, 0.5],
    rock:  [0.25, 0.25, 0.5, 0.25],
    jazz:  [0.25, 0.5, 0.25, 0.5],
  };
  const motifRhythm = MOTIF_RHYTHM[style];

  // Style-specific duration palettes and base rest probabilities for the "run" shape.
  const DURATIONS: Record<"rock" | "blues" | "jazz", number[]> = {
    blues: [0.5, 0.5, 0.5, 0.25],
    rock:  [0.25, 0.25, 0.5],
    jazz:  [0.25, 0.5, 0.25, 0.25, 0.5],
  };
  const BASE_REST_CHANCE: Record<"rock" | "blues" | "jazz", number> = {
    blues: 0.35,
    rock:  0.20,
    jazz:  0.25,
  };
  const durations = DURATIONS[style];
  const baseRestChance = BASE_REST_CHANCE[style];

  // 8. Phrase-based generation
  const notes: SoloNote[] = [];
  let beat = 0;
  let posIdx = Math.floor(positions.length * 0.4); // start in lower-mid of the box
  let phraseDir = 1; // +1 ascending, -1 descending

  // Helper: apply a lick pattern (cumulative position deltas) from the current posIdx/beat.
  function playLick(pattern: LickPattern, noteDur: number, endBeat: number) {
    for (const delta of pattern) {
      if (beat >= endBeat - 0.01) break;
      posIdx = Math.max(0, Math.min(positions.length - 1, posIdx + delta));
      notes.push({ ...positions[posIdx], startBeat: beat, durationBeats: noteDur });
      beat += noteDur;
    }
  }

  type Shape = "run" | "lick" | "hold" | "arpeggio" | "motif" | "call_response";

  // Full shape pools per style — used at medium intensity.
  const SHAPES: Shape[] =
    style === "jazz"
      ? ["run", "lick", "arpeggio", "hold", "arpeggio", "motif", "call_response"]
      : style === "blues"
      ? ["lick", "lick", "run", "hold", "lick", "motif", "call_response"]
      : ["run", "lick", "run", "hold", "run", "motif", "call_response"];

  while (beat < totalBeats - 0.01) {
    // Snap to chord tone at every chord boundary
    if (isChordChange(beat)) {
      const chord = chordAtBeat(beat);
      posIdx = nearestChordToneIdx(posIdx, chord);
    }

    const curIntensity = soloIntensity(beat, totalBeats);
    const phraseBeats = rng.pick([2, 2, 2, 4]);
    const endBeat = Math.min(beat + phraseBeats, totalBeats);

    // Shift shape pool based on intensity arc: sparse at intro/outro, dense at peak.
    let shapePool: Shape[];
    if (curIntensity < 0.5) {
      shapePool = style === "jazz"
        ? ["hold", "call_response", "arpeggio", "motif"]
        : ["hold", "call_response", "lick", "motif"];
    } else if (curIntensity > 0.85) {
      shapePool = style === "jazz"
        ? ["run", "lick", "run", "arpeggio"]
        : style === "blues"
        ? ["lick", "lick", "run", "lick"]
        : ["run", "run", "lick", "run"];
    } else {
      shapePool = SHAPES;
    }

    const shape: Shape = rng.pick(shapePool);

    if (shape === "hold") {
      const dur = Math.min(rng.pick([0.5, 1, 1.5]), endBeat - beat);
      if (dur > 0) {
        notes.push({ ...positions[posIdx], startBeat: beat, durationBeats: dur });
        beat += dur;
      }
      if (rng.next() < 0.6) beat += rng.pick([0.25, 0.5]);

    } else if (shape === "lick") {
      // Style-specific lick pattern with appropriate note duration.
      const pattern = rng.pick(LICK_PATTERNS[style]);
      const noteDur = style === "blues" ? 0.5 : style === "jazz" ? rng.pick([0.25, 0.5]) : 0.25;
      const reps = rng.next() < 0.35 ? 2 : 1;
      const startIdx = posIdx;
      for (let r = 0; r < reps && beat < endBeat - 0.01; r++) {
        posIdx = startIdx;
        playLick(pattern, noteDur, endBeat);
      }

    } else if (shape === "motif") {
      // Replay the seed motif with a variation: exact, transposed, or double-time burst.
      const variation = rng.pick(["exact", "exact", "transposed", "double_time"] as const);
      if (variation === "transposed") {
        posIdx = Math.max(0, Math.min(
          positions.length - 1,
          posIdx + rng.pick([-4, -3, -2, 2, 3, 4])
        ));
      }
      const rhythmMult = variation === "double_time" ? 0.5 : 1;
      const startIdx = posIdx;
      for (let i = 0; i < motifIntervals.length; i++) {
        if (beat >= endBeat - 0.01) break;
        posIdx = Math.max(0, Math.min(positions.length - 1, startIdx + motifIntervals[i]));
        const dur = (motifRhythm[i] ?? 0.25) * rhythmMult;
        notes.push({ ...positions[posIdx], startBeat: beat, durationBeats: dur });
        beat += dur;
      }

    } else if (shape === "call_response" && endBeat - beat >= 3.5) {
      // Call: short ascending phrase ending on a non-root scale tone.
      const callEnd = Math.min(beat + 1.5, endBeat - 1.0);
      while (beat < callEnd - 0.01) {
        const dur = rng.pick(durations);
        notes.push({ ...positions[posIdx], startBeat: beat, durationBeats: dur });
        beat += dur;
        posIdx = Math.min(positions.length - 1, posIdx + 1);
      }

      // Breath: silence between call and response.
      beat += rng.pick([0.5, 0.5, 0.75, 1.0]);

      // Response: resolve to nearest chord tone with a descending lick.
      if (beat < endBeat - 0.01) {
        const chord = chordAtBeat(beat);
        posIdx = nearestChordToneIdx(posIdx, chord);
        const pattern = rng.pick(LICK_PATTERNS[style]);
        const noteDur = style === "blues" ? 0.5 : 0.25;
        playLick(pattern, noteDur, endBeat);
      }

    } else if (shape === "arpeggio") {
      // Walk chord tones only
      const chord = chordAtBeat(beat);
      const cPCs = chordPitchClasses(chord.root, chord.quality).all;
      const chordPositions = positions.filter((p) => cPCs.has(p.pitchClass));
      if (chordPositions.length > 0) {
        let cpIdx = Math.max(0, chordPositions.findIndex((p) => p.midi >= positions[posIdx].midi));
        while (beat < endBeat - 0.01) {
          const noteDur = rng.pick([0.25, 0.5]);
          notes.push({ ...chordPositions[cpIdx], startBeat: beat, durationBeats: noteDur });
          beat += noteDur;
          cpIdx = (cpIdx + phraseDir + chordPositions.length) % chordPositions.length;
        }
        const last = chordPositions[(cpIdx - phraseDir + chordPositions.length) % chordPositions.length];
        const closest = positions.findIndex((p) => p.midi >= last.midi);
        if (closest >= 0) posIdx = closest;
      } else {
        beat = endBeat;
      }

    } else {
      // "run" — stepwise motion with style-specific durations and intensity-driven rests.
      // At high intensity, nudge position toward upper register for a climactic feel.
      if (curIntensity > 0.7 && posIdx < Math.floor(positions.length * 0.5)) {
        posIdx = Math.min(positions.length - 1, posIdx + rng.nextInt(1, 2));
      }
      const restChance = baseRestChance * Math.max(0.4, 1.15 - curIntensity * 0.3);
      let localBeat = beat;
      let reversals = 0;
      while (localBeat < endBeat - 0.01) {
        const dur = rng.pick(durations);
        if (rng.next() < restChance) {
          localBeat += dur;
          continue;
        }
        notes.push({ ...positions[posIdx], startBeat: localBeat, durationBeats: dur });
        localBeat += dur;
        const step = rng.nextInt(1, 2) * phraseDir;
        posIdx += step;
        if (posIdx >= positions.length) {
          posIdx = positions.length - 1;
          if (reversals === 0) { phraseDir = -1; reversals++; }
        } else if (posIdx < 0) {
          posIdx = 0;
          if (reversals === 0) { phraseDir = 1; reversals++; }
        }
      }
      beat = endBeat;
    }

    // Inter-phrase rest — less frequent at intensity peak, more at intro/outro.
    const interRestChance = 0.25 * Math.max(0.5, 1.1 - curIntensity * 0.25);
    if (rng.next() < interRestChance && beat < totalBeats - 0.01) {
      beat += rng.pick([0.25, 0.5]);
    }

    phraseDir = -phraseDir;
  }

  // ── Technique assignment ─────────────────────────────────────────────────

  // Pass 1: hammer-ons, pull-offs, slides between adjacent same-string notes.
  for (let i = 0; i < notes.length - 1; i++) {
    const curr = notes[i];
    const next = notes[i + 1];
    if (curr.stringIndex !== next.stringIndex) continue;
    const gap = next.startBeat - (curr.startBeat + curr.durationBeats);
    if (gap > 0.06) continue;
    const diff = next.fret - curr.fret;
    if (diff >= 1 && diff <= 2) {
      curr.technique = "hammer";
    } else if (diff <= -1 && diff >= -2) {
      curr.technique = "pull";
    } else if (diff >= 3) {
      curr.technique = "slide_up";
    } else if (diff <= -3) {
      curr.technique = "slide_down";
    }
  }

  // Pass 2: bends on high strings (G / B / e).
  // Jazz: only bend sustained notes (≥ 0.5 beats) at a very low rate.
  const bendChance = style === "blues" ? 0.28 : style === "rock" ? 0.14 : 0.03;
  for (const note of notes) {
    if (note.technique) continue;
    if (note.stringIndex < 3) continue;
    if (style === "jazz" && note.durationBeats < 0.5) continue;
    if (rng.next() < bendChance) {
      let semUp: number | undefined;
      for (let delta = 1; delta <= 2; delta++) {
        if (scalePCs.has((note.pitchClass + delta) % 12)) {
          semUp = delta;
          break;
        }
      }
      if (semUp !== undefined) {
        note.technique = "bend";
        note.bendSemitones = semUp;
        note.durationBeats = Math.max(note.durationBeats, 0.5);
      }
    }
  }

  return { notes, bpm, totalBeats, scaleRoot, scaleName, scalePitchClasses: scalePCs, centerFret };
}
