"use client";

import { useState } from "react";
import { colorForPitchClass } from "@/lib/music/notes";
import type { ChordMatch } from "@/lib/music/detectChord";

type Props = {
  matches: ChordMatch[];
  onSnap?: () => void;
  snapped?: boolean;
};

export function ChordSuggestions({ matches, onSnap, snapped }: Props) {
  if (matches.length === 0) return null;

  const top = matches.slice(0, 4);
  const best = top[0];

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Chord detection
        </h3>
        {onSnap && (
          <button
            type="button"
            onClick={onSnap}
            title="Snap: freeze the current chord reading"
            className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
              snapped
                ? "bg-sky-500/20 text-sky-300 border border-sky-500/40"
                : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
            }`}
          >
            {snapped ? "Snapped" : "Snap"}
          </button>
        )}
      </div>
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
      {snapped && (
        <p className="mt-1.5 text-[10px] text-zinc-500">
          Frozen at this moment — keep playing to update live detection above.
        </p>
      )}
    </div>
  );
}
