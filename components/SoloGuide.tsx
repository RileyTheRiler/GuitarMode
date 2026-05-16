"use client";

import { useMemo } from "react";
import { NOTE_NAMES } from "@/lib/music/notes";
import { SCALE_TEMPLATES } from "@/lib/music/scales";
import { getSoloGuide, type NoteRole } from "@/lib/music/soloGuide";
import type { ChordPitchClasses } from "@/lib/music/chords";

type Props = {
  root: number;
  scaleIdx: number;
  chordInfo: ChordPitchClasses | null;
  currentChord: string | null;
  onRootChange: (root: number) => void;
  onScaleIdxChange: (idx: number) => void;
};

const ROLE_LABEL: Record<NoteRole, string> = {
  "chord-root": "R",
  "chord-third": "3rd",
  "chord-fifth": "5th",
  "chord-ext": "Ext",
  color: "—",
};

const ROLE_STYLE: Record<NoteRole, string> = {
  "chord-root": "bg-white text-zinc-900 font-bold ring-2 ring-white",
  "chord-third": "bg-amber-400 text-zinc-900 font-bold ring-2 ring-amber-400",
  "chord-fifth": "bg-sky-400 text-zinc-900 font-semibold ring-2 ring-sky-400",
  "chord-ext": "bg-violet-400 text-zinc-900 font-semibold ring-2 ring-violet-400",
  color: "bg-zinc-800 text-zinc-300 ring-1 ring-zinc-600",
};

const ROLE_DESC: Record<NoteRole, string> = {
  "chord-root": "Root — strongest landing point",
  "chord-third": "3rd — defines major/minor color",
  "chord-fifth": "5th — open and stable",
  "chord-ext": "Ext — extended chord tone",
  color: "Passing — tension and movement",
};

export function SoloGuide({
  root,
  scaleIdx,
  chordInfo,
  currentChord,
  onRootChange,
  onScaleIdxChange,
}: Props) {
  const template = SCALE_TEMPLATES[scaleIdx];
  const guides = useMemo(
    () => getSoloGuide(root, template, chordInfo),
    [root, template, chordInfo]
  );

  const chordActive = chordInfo != null && currentChord != null;

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2 before:content-[''] before:block before:h-[3px] before:w-1 before:rounded-full before:bg-emerald-500/70 before:shrink-0">
        Solo Guide
      </h2>

      {/* Key + scale selectors */}
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Key / Root</label>
          <select
            value={root}
            onChange={(e) => onRootChange(Number(e.target.value))}
            className="rounded bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {NOTE_NAMES.map((name, i) => (
              <option key={i} value={i}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-40">
          <label className="text-xs text-zinc-500">Scale / Mode</label>
          <select
            value={scaleIdx}
            onChange={(e) => onScaleIdxChange(Number(e.target.value))}
            className="rounded bg-zinc-800 px-2 py-1.5 text-sm text-zinc-200 border border-zinc-700 focus:outline-none focus:ring-1 focus:ring-amber-500 w-full"
          >
            {SCALE_TEMPLATES.map((t, i) => (
              <option key={i} value={i}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Note role guide */}
      <div>
        <p className="mb-2 text-xs text-zinc-500">
          {chordActive
            ? `Notes in ${NOTE_NAMES[root]} ${template.name} over ${currentChord}:`
            : `Notes in ${NOTE_NAMES[root]} ${template.name} — add a chord progression to see targets:`}
        </p>
        <div className="flex flex-wrap gap-2">
          {guides.map(({ pitchClass, name, role }) => (
            <div
              key={pitchClass}
              title={ROLE_DESC[role]}
              className={`flex flex-col items-center rounded-lg px-2.5 py-1.5 text-center ring-offset-zinc-900 ${ROLE_STYLE[role]}`}
            >
              <span className="text-sm font-mono leading-tight">{name}</span>
              <span className="text-[10px] leading-tight mt-0.5 opacity-75">
                {chordActive ? ROLE_LABEL[role] : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Legend — only shown when a chord is active */}
      {chordActive && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
          {(Object.keys(ROLE_DESC) as NoteRole[]).map((role) => (
            <span key={role} className="flex items-center gap-1">
              <span
                className={`inline-block h-2 w-2 rounded-full ${ROLE_STYLE[role].split(" ")[0]}`}
              />
              {ROLE_DESC[role]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
