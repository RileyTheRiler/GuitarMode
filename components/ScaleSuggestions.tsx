"use client";

import { colorForPitchClass, pitchClassName } from "@/lib/music/notes";
import type { ScaleMatch } from "@/lib/music/detectScale";
import { useScaleAudition } from "@/lib/audio/useScaleAudition";

type Props = {
  matches: ScaleMatch[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  detectedCount: number;
  a4Hz?: number;
};

export function ScaleSuggestions({
  matches,
  selectedIndex,
  onSelect,
  detectedCount,
  a4Hz = 440,
}: Props) {
  const audition = useScaleAudition();

  if (matches.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Scale suggestions will appear once you&rsquo;ve played some notes.
      </p>
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
          const key = `${m.root}-${m.templateName}`;
          const isAuditioning = audition.playingKey === key;
          return (
            <li key={key} className="relative">
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-pressed={selected}
                className={`w-full rounded-lg border px-3 py-2 pr-12 text-left transition ${
                  selected
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-zinc-100">
                    {m.rootName} {m.templateName}
                  </span>
                  <span className="text-xs text-zinc-400">{pct}%</span>
                </div>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${pct}%` }}
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
              <button
                type="button"
                onClick={() => {
                  if (isAuditioning) audition.stop();
                  else audition.play(key, m.root, m.template.intervals, a4Hz);
                }}
                aria-label={
                  isAuditioning
                    ? `Stop auditioning ${m.rootName} ${m.templateName}`
                    : `Play ${m.rootName} ${m.templateName}`
                }
                className={`absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm transition ${
                  isAuditioning
                    ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                    : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                }`}
              >
                {isAuditioning ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                    <rect x="2" y="2" width="6" height="6" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M2 1 L9 5 L2 9 Z" fill="currentColor" />
                  </svg>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
