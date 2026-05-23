export interface TabNote {
  stringIndex: number; // 0 = low E, 5 = high e
  fret: number;
}

export interface TabEvent {
  notes: TabNote[];
  columnPos: number;
}

export interface ParsedTab {
  events: TabEvent[];
  durationColumns: number;
}

function isTabLine(raw: string): boolean {
  const s = raw.trim();
  // Must contain dashes or digits, and either a pipe or a known string label prefix
  return /[\d-]/.test(s) && (s.includes("|") || /^[eEbBgGdDaA]/i.test(s));
}

function stripLabel(line: string): string {
  // Remove prefix like "e|", "B|", "G|", "1|", "e :", etc.
  return line.trim().replace(/^[a-zA-Z1-6]?\s*[|:]/, "");
}

// Detect the guitar string from a line's label + position in the system.
// Returns 0 (low E) through 5 (high e).
function detectStringIndex(line: string, lineIdx: number, systemSize: number): number {
  const match = line.trim().match(/^([eEbBgGdDaA])\s*[|:]/);
  if (match) {
    const lbl = match[1];
    if (lbl === "e") return 5;                          // explicit lowercase = high e
    if (lbl === "B" || lbl === "b") return 4;
    if (lbl === "G" || lbl === "g") return 3;
    if (lbl === "D" || lbl === "d") return 2;
    if (lbl === "A" || lbl === "a") return 1;
    if (lbl === "E") {
      // Ambiguous: could be high e (top) or low E (bottom)
      // Use position: top line in the system = high e
      return lineIdx === 0 ? 5 : 0;
    }
  }
  // Positional fallback: top = high e (5), bottom = low E (0)
  return Math.max(0, systemSize - 1 - lineIdx);
}

function parseSystem(lines: string[]): TabEvent[] {
  const contents = lines.map(stripLabel);
  const events = new Map<number, TabNote[]>();

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const stringIndex = detectStringIndex(lines[lineIdx], lineIdx, lines.length);
    const content = contents[lineIdx];

    let col = 0;
    while (col < content.length) {
      if (/\d/.test(content[col])) {
        let num = content[col];
        const start = col++;
        while (col < content.length && /\d/.test(content[col])) {
          num += content[col++];
        }
        const fret = parseInt(num, 10);
        if (fret >= 0 && fret <= 24) {
          const bucket = events.get(start) ?? [];
          bucket.push({ stringIndex, fret });
          events.set(start, bucket);
        }
      } else {
        col++;
      }
    }
  }

  return [...events.entries()]
    .sort(([a], [b]) => a - b)
    .map(([columnPos, notes]) => ({ columnPos, notes }));
}

/**
 * Parse ASCII guitar tablature into a sequence of time-stamped fret events.
 * Handles multi-system tabs (multiple groups of 6 lines), labeled and unlabeled,
 * standard 6-string format. Technique notations (h, p, b, /, ~) are ignored.
 */
export function parseTab(tabText: string): ParsedTab {
  const rawLines = tabText.split("\n");
  const tabLines = rawLines.filter((l) => isTabLine(l));

  if (tabLines.length < 3) return { events: [], durationColumns: 0 };

  // Group into systems: prefer groups of 6, allow 3–6
  const systems: string[][] = [];
  const size = tabLines.length >= 6 ? 6 : tabLines.length >= 3 ? tabLines.length : 6;
  for (let i = 0; i < tabLines.length; i += size) {
    const sys = tabLines.slice(i, i + size);
    if (sys.length >= 3) systems.push(sys);
  }

  if (systems.length === 0) return { events: [], durationColumns: 0 };

  const allEvents: TabEvent[] = [];
  let colOffset = 0;

  for (const sys of systems) {
    const sysEvents = parseSystem(sys);
    if (sysEvents.length === 0) continue;
    for (const ev of sysEvents) {
      allEvents.push({ ...ev, columnPos: ev.columnPos + colOffset });
    }
    const maxCol = sysEvents[sysEvents.length - 1].columnPos;
    colOffset += maxCol + 8; // gap between systems
  }

  const durationColumns =
    allEvents.length > 0 ? allEvents[allEvents.length - 1].columnPos : 0;

  return { events: allEvents, durationColumns };
}

/**
 * Convert column positions to audio times in seconds.
 * columnsPerBeat defaults to 4 (each column = 1/16 note at given BPM).
 */
export function columnsToTimes(
  events: TabEvent[],
  bpm: number,
  columnsPerBeat = 4
): number[] {
  const secPerColumn = 60 / bpm / columnsPerBeat;
  return events.map((e) => e.columnPos * secPerColumn);
}

/** Auto-detect a sensible columnsPerBeat from the tab's average note spacing. */
export function detectColumnsPerBeat(events: TabEvent[]): number {
  if (events.length < 2) return 4;
  const gaps = events
    .slice(1)
    .map((e, i) => e.columnPos - events[i].columnPos)
    .filter((g) => g > 0);
  if (gaps.length === 0) return 4;
  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  // Snap to 1, 2, 4, or 8
  const candidates = [1, 2, 4, 8];
  return candidates.reduce((best, c) =>
    Math.abs(c - avg) < Math.abs(best - avg) ? c : best
  );
}
