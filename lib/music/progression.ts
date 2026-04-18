export type ChordEvent = { time: number; chord: string };

export function activeChordAt(
  progression: ChordEvent[],
  seconds: number
): ChordEvent | null {
  if (progression.length === 0) return null;
  if (seconds < progression[0].time) return null;
  let current: ChordEvent | null = null;
  for (const ev of progression) {
    if (ev.time <= seconds) current = ev;
    else break;
  }
  return current;
}

export function sortProgression(p: ChordEvent[]): ChordEvent[] {
  return p.slice().sort((a, b) => a.time - b.time);
}

// I–V–vi–IV in G, two seconds per chord.
export const DEMO_PROGRESSION: ChordEvent[] = [
  { time: 0, chord: "G" },
  { time: 2, chord: "D" },
  { time: 4, chord: "Em" },
  { time: 6, chord: "C" },
  { time: 8, chord: "G" },
  { time: 10, chord: "D" },
  { time: 12, chord: "Em" },
  { time: 14, chord: "C" },
];
