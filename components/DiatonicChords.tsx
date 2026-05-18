"use client";

import { colorForPitchClass } from "@/lib/music/notes";
import type { DiatonicTriad } from "@/lib/music/diatonicChords";

type Props = {
  triads: DiatonicTriad[];
  scaleName: string;
  selectedDegree?: number | null;
  onSelect?: (degree: number) => void;
};

const QUALITY_COLOR: Record<string, string> = {
  maj: "text-emerald-300",
  min: "text-sky-300",
  dim: "text-rose-400",
  aug: "text-amber-300",
  other: "text-zinc-400",
};

export function DiatonicChords({ triads, scaleName, selectedDegree, onSelect }: Props) {
  if (triads.length === 0) {
    return (
      <p className="text-xs text-zinc-500">
        Diatonic chords are shown for 7-note scales.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs text-zinc-500">
        {scaleName}
        {onSelect && (
          <span className="ml-2 text-zinc-600">— click a chord to see voicing</span>
        )}
      </p>
      <div className="grid grid-cols-7 gap-1">
        {triads.map((t) => {
          const isSelected = selectedDegree === t.degree;
          return (
            <button
              key={t.degree}
              type="button"
              onClick={() => onSelect?.(t.degree)}
              className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 transition ${
                isSelected
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-zinc-700 bg-zinc-900 hover:border-zinc-500"
              }`}
              aria-pressed={isSelected}
              title={`${t.label} (${t.romanNumeral})`}
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
