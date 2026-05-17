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
      <p className="text-sm text-zinc-500">
        No notes yet. Play something, upload a file, or record a sample.
      </p>
    );
  }
  return (
    <div>
      {/* Announce the most-recent note to screen readers */}
      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {notes.length > 0 ? `Detected: ${notes[notes.length - 1].noteName}` : ""}
      </span>
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
    </div>
  );
}
