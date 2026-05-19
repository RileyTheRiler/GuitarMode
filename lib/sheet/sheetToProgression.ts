import type { ChordEvent } from "../music/progression";
import { parseChord } from "../music/chords";
import type { SheetAnalysis } from "./types";

const DEFAULT_BPM = 100;
const DEFAULT_BEATS_PER_BAR = 4;
const MAX_CHORDS = 64;

function parseBeatsPerBar(ts: string | undefined): number | null {
  if (!ts) return null;
  const m = ts.match(/^(\d+)\s*\/\s*\d+$/);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 0 && n <= 16 ? n : null;
}

function cleanChordToken(raw: string): string {
  // Drop slash bass notes ("G/B" -> "G") and strip parenthetical / repeat markers
  // ("Em (intro)", "Em x2"). Keep just the chord symbol up to the first stop char.
  const trimmed = raw.trim().split("/")[0];
  const m = trimmed.match(/^([A-G][#b]?[A-Za-z0-9#b]*)/);
  return m ? m[1] : trimmed;
}

export function sheetToProgression(analysis: SheetAnalysis): ChordEvent[] {
  const raw = analysis.chordsText?.trim();
  if (!raw) return [];

  const tokens = raw
    .split(/[,|]/g)
    .map((t) => cleanChordToken(t))
    .filter(Boolean);

  const valid: string[] = [];
  for (const t of tokens) {
    if (valid.length >= MAX_CHORDS) break;
    if (parseChord(t)) valid.push(t);
  }
  if (valid.length === 0) return [];

  const bpm = analysis.bpm && analysis.bpm > 0 ? analysis.bpm : DEFAULT_BPM;
  const beatsPerBar = parseBeatsPerBar(analysis.timeSignature) ?? DEFAULT_BEATS_PER_BAR;
  const secondsPerBar = (beatsPerBar * 60) / bpm;

  return valid.map((chord, i) => ({ time: +(i * secondsPerBar).toFixed(3), chord }));
}
