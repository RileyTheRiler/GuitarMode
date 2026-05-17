"use client";

import { colorForPitchClass } from "@/lib/music/notes";
import type { DetectedNote } from "@/lib/audio/usePitchDetector";

type Props = {
  notes: DetectedNote[];
  onDelete?: (index: number) => void;
};

export function DetectedNotes({ notes, onDelete }: Props) {
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true" className="text-zinc-700">
          <rect x="4"  y="20" width="4" height="12" rx="2" fill="currentColor"/>
          <rect x="11" y="14" width="4" height="18" rx="2" fill="currentColor"/>
          <rect x="18" y="8"  width="4" height="24" rx="2" fill="currentColor" opacity="0.6"/>
          <rect x="25" y="14" width="4" height="18" rx="2" fill="currentColor"/>
          <rect x="32" y="20" width="4" height="12" rx="2" fill="currentColor"/>
        </svg>
        <div>
          <p className="text-sm font-medium text-zinc-400">No notes yet</p>
          <p className="mt-1 text-xs text-zinc-600">Turn on the mic, upload a file, or record a sample.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {notes.map((n, i) => (
        <span
          key={n.at}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-100"
          title={`${n.durationMs.toFixed(0)} ms`}
        >
          <span
            className="h-3 w-3 rounded-full shrink-0"
            style={{ backgroundColor: colorForPitchClass(n.pitchClass) }}
          />
          {n.noteName}
          {n.durationMs > 0 && (
            <span className="text-[10px] text-zinc-400">
              {n.durationMs >= 1000
                ? `${(n.durationMs / 1000).toFixed(1)}s`
                : `${n.durationMs.toFixed(0)}ms`}
            </span>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(i)}
              className="ml-0.5 -mr-1 rounded-full p-0.5 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-700 transition-colors"
              aria-label={`Remove ${n.noteName}`}
              title="Remove this note"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                <path d="M1.4 1.4 L8.6 8.6 M8.6 1.4 L1.4 8.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </span>
      ))}
    </div>
  );
}
