"use client";

import { colorForPitchClass } from "@/lib/music/notes";
import type { ChordMatch } from "@/lib/music/detectChord";

type Props = {
  matches: ChordMatch[];
};

export function ChordSuggestions({ matches }: Props) {
  if (matches.length === 0) return null;

  const top = matches.slice(0, 4);
  const best = top[0];

  return (
    <div className="mt-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Chord detection
      </h3>
      <div className="flex flex-wrap gap-2">
        {top.map((m) => {
          const pct = Math.round(m.confidence * 100);
          const isBest = m === best;
          return (
            <div
              key={`${m.root}-${m.quality}`}
              className={`rounded-lg border px-3 py-1.5 text-sm ${
                isBest
                  ? "border-sky-500 bg-sky-500/10 text-zinc-100"
                  : "border-zinc-700 bg-zinc-900 text-zinc-300"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: colorForPitchClass(m.root) }}
                />
                <span className="font-medium">{m.displayName}</span>
                <span className="text-xs text-zinc-500">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
