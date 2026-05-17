"use client";

import { colorForPitchClass, pitchClassName } from "@/lib/music/notes";
import type { ScaleMatch } from "@/lib/music/detectScale";

type Props = {
  matches: ScaleMatch[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  detectedCount: number;
};

function confidenceGradient(pct: number): string {
  if (pct >= 70) return "linear-gradient(to right, #10b981, #34d399)";
  if (pct >= 40) return "linear-gradient(to right, #f59e0b, #fbbf24)";
  return "linear-gradient(to right, #ef4444, #f87171)";
}

export function ScaleSuggestions({ matches, selectedIndex, onSelect, detectedCount }: Props) {
  if (matches.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true" className="text-zinc-700">
          <path d="M14 28V10l16-4v18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="10" cy="28" r="4" stroke="currentColor" strokeWidth="2"/>
          <circle cx="26" cy="24" r="4" stroke="currentColor" strokeWidth="2"/>
        </svg>
        <div>
          <p className="text-sm font-medium text-zinc-400">Play some notes</p>
          <p className="mt-1 text-xs text-zinc-600">Scale suggestions appear once you play 2+ notes.</p>
        </div>
      </div>
    );
  }

  const lowConfidence = detectedCount < 3;

  return (
    <div className="space-y-3">
      {lowConfidence && (
        <p className="text-xs text-amber-400">
          Low confidence &mdash; play a few more notes for a stronger match.
        </p>
      )}
      <ul className="space-y-2">
        {matches.map((m, i) => {
          const selected = i === selectedIndex;
          const pct = Math.round(m.confidence * 100);
          return (
            <li key={`${m.root}-${m.templateName}`}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                  selected
                    ? "border-emerald-500 border-l-[3px] border-l-emerald-400 bg-emerald-500/10 pl-[calc(0.75rem-1px)]"
                    : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-100">
                    {m.rootName} {m.templateName}
                  </span>
                  <span className="text-xs text-zinc-400">{pct}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{ width: `${pct}%`, background: confidenceGradient(pct) }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.scale.map((pc) => (
                    <span
                      key={pc}
                      className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200"
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: colorForPitchClass(pc) }}
                      />
                      {pitchClassName(pc)}
                    </span>
                  ))}
                </div>
                {m.missing.length > 0 && (
                  <p className="mt-2 text-xs text-zinc-400">
                    Try next:{" "}
                    {m.missing.map((pc) => pitchClassName(pc)).join(", ")}
                  </p>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
