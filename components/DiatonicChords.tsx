"use client";

import { colorForPitchClass } from "@/lib/music/notes";
import type { DiatonicTriad } from "@/lib/music/diatonicChords";

type Props = {
  triads: DiatonicTriad[];
  scaleName: string;
};

const QUALITY_COLOR: Record<string, string> = {
  maj: "text-emerald-300",
  min: "text-sky-300",
  dim: "text-rose-400",
  aug: "text-amber-300",
  other: "text-zinc-400",
};

export function DiatonicChords({ triads, scaleName }: Props) {
  if (triads.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        Diatonic chords are shown for 7-note scales.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs text-zinc-500">{scaleName}</p>
      <div className="grid grid-cols-7 gap-1">
        {triads.map((t) => (
          <div
            key={t.degree}
            className="flex flex-col items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 px-1 py-2"
          >
            <span className="text-xs font-bold text-zinc-300">
              {t.romanNumeral}
            </span>
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: colorForPitchClass(t.root) }}
            />
            <span className={`text-xs font-medium leading-tight ${QUALITY_COLOR[t.quality]}`}>
              {t.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
