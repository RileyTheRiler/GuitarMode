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
        >
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: colorForPitchClass(n.pitchClass) }}
          />
          {n.noteName}
        </span>
      ))}
    </div>
  );
}
