"use client";

import type { SheetAnalysis } from "@/lib/sheet/types";

type Props = {
  analysis: SheetAnalysis;
  noteCount: number;
  onClear: () => void;
};

export function SheetAnalysisCard({ analysis, noteCount, onClear }: Props) {
  const title = analysis.title?.trim() || "Untitled";
  const artist = analysis.artist?.trim() || "";
  const hasSections = analysis.sections && analysis.sections.length > 0;

  return (
    <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/20 p-3 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 1.5h7L13 4.5v10H3z" />
              <path d="M10 1.5V4.5H13" />
              <path d="M6 8h4M6 11h4" />
            </svg>
            Sheet music
          </div>
          <h3 className="mt-0.5 truncate text-base font-semibold text-zinc-50">{title}</h3>
          {artist && <p className="truncate text-xs text-zinc-400">{artist}</p>}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 rounded-md border border-zinc-700 bg-transparent px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          title="Clear sheet music context"
        >
          Clear
        </button>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <Field label="Key" value={analysis.key || "—"} />
        <Field label="Tempo" value={analysis.bpm ? `${analysis.bpm} BPM` : "—"} />
        <Field label="Time" value={analysis.timeSignature || "—"} />
        <Field label="Notes loaded" value={String(noteCount)} />
      </dl>

      {analysis.chordsText && (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Chords</div>
          <div className="mt-1 text-sm text-zinc-200 break-words">{analysis.chordsText}</div>
        </div>
      )}

      {hasSections && (
        <div className="mt-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Sections</div>
          <ul className="mt-1 space-y-1 text-xs text-zinc-300">
            {analysis.sections!.map((s, i) => (
              <li key={`${s.name}-${i}`} className="flex gap-2">
                <span className="shrink-0 font-medium text-zinc-100">{s.name}:</span>
                <span className="text-zinc-400">{s.chords}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {analysis.notesSummary && (
        <p className="mt-3 text-xs italic text-zinc-400">{analysis.notesSummary}</p>
      )}

      <p className="mt-3 text-[11px] text-zinc-500">
        Fretboard and Scale Suggestions reflect these notes. The AI Riff Generator below is pre-filled with this context — edit any field there before generating a solo.
      </p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-zinc-100">{value}</dd>
    </div>
  );
}
