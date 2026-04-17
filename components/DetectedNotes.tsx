"use client";

import { colorForPitchClass } from "@/lib/music/notes";
import type { DetectedNote } from "@/lib/audio/usePitchDetector";

export function DetectedNotes({ notes }: { notes: DetectedNote[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        No notes yet. Play something, upload a file, or record a sample.
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {notes.map((n, i) => (
        <span
          key={`${n.at}-${i}`}
          className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-100"
          title={`${n.durationMs.toFixed(0)} ms`}
        >
          <span
            className="h-3 w-3 rounded-full"
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
        </span>
      ))}
    </div>
  );
}
