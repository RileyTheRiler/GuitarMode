"use client";

import { parseChord, chordPitchClasses, type ChordQuality } from "./chords";
import { detectScales } from "./detectScale";
import { allPositions, type FretPosition, STANDARD_TUNING } from "../guitar/fretboard";

export interface SoloNote {
  stringIndex: number;
  fret: number;
  midi: number;
  pitchClass: number;
  startBeat: number;
  durationBeats: number;
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

  // 7. Phrase-based generation
  const notes: SoloNote[] = [];
  let beat = 0;
  let posIdx = Math.floor(positions.length * 0.4); // start in lower-mid of the box
  let phraseDir = 1; // +1 ascending, -1 descending

  type Shape = "run" | "lick" | "hold" | "arpeggio";
  const SHAPES: Shape[] =
    style === "jazz"
      ? ["run", "lick", "arpeggio", "hold", "arpeggio"]
      : style === "blues"
      ? ["lick", "lick", "run", "hold", "lick"]
      : ["run", "lick", "run", "hold", "run"];

  while (beat < totalBeats - 0.01) {
    // Snap to chord tone at every chord boundary
    if (isChordChange(beat)) {
      const chord = chordAtBeat(beat);
      posIdx = nearestChordToneIdx(posIdx, chord);
    }

    const phraseBeats = rng.pick([2, 2, 2, 4]);
    const endBeat = Math.min(beat + phraseBeats, totalBeats);
    const shape: Shape = rng.pick(SHAPES);

    if (shape === "hold") {
      // Sustain the current note for 1–2 beats then rest briefly
      const dur = Math.min(rng.pick([0.5, 1, 1.5]), endBeat - beat);
      if (dur > 0) {
        notes.push({ ...positions[posIdx], startBeat: beat, durationBeats: dur });
        beat += dur;
      }
      // Optional rest
      if (rng.next() < 0.6) beat += rng.pick([0.25, 0.5]);

    } else if (shape === "lick") {
      // Short 3–5 note motif, played once or twice
      const lickLen = rng.nextInt(3, 5);
      const pattern: number[] = [posIdx];
      for (let i = 1; i < lickLen; i++) {
        const step = rng.pick([-2, -1, -1, 0, 1, 1, 2]);
        pattern.push(Math.max(0, Math.min(positions.length - 1, pattern[i - 1] + step)));
      }
      const reps = rng.next() < 0.4 ? 2 : 1;
      for (let r = 0; r < reps && beat < endBeat - 0.01; r++) {
        for (const idx of pattern) {
          if (beat >= endBeat - 0.01) break;
          notes.push({ ...positions[idx], startBeat: beat, durationBeats: 0.25 });
          beat += 0.25;
        }
      }
      posIdx = pattern[pattern.length - 1];

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
        // update posIdx to closest match
        const last = chordPositions[(cpIdx - phraseDir + chordPositions.length) % chordPositions.length];
        const closest = positions.findIndex((p) => p.midi >= last.midi);
        if (closest >= 0) posIdx = closest;
      } else {
        beat = endBeat;
      }

    } else {
      // "run" — stepwise motion in phraseDir with rhythmic variety
      let localBeat = beat;
      let reversals = 0;
      while (localBeat < endBeat - 0.01) {
        // Occasional 16th-note burst (2 rapid notes)
        const dur = rng.next() < 0.25 ? 0.25 : 0.5;

        // Leave rests for breathing room
        if (rng.next() < 0.18) {
          localBeat += dur;
          continue;
        }

        notes.push({ ...positions[posIdx], startBeat: localBeat, durationBeats: dur });
        localBeat += dur;

        const step = rng.nextInt(1, 2) * phraseDir;
        posIdx += step;
        // Bounce at the box edges
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

    // Inter-phrase rest
    if (rng.next() < 0.25 && beat < totalBeats - 0.01) {
      beat += rng.pick([0.25, 0.5]);
    }

    phraseDir = -phraseDir;
  }

  return { notes, bpm, totalBeats, scaleRoot, scaleName, scalePitchClasses: scalePCs, centerFret };
}
