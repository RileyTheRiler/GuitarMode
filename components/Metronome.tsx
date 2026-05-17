"use client";

import { useMetronome } from "@/lib/audio/useMetronome";

const TIME_SIGNATURES = [2, 3, 4, 5, 6, 7, 8] as const;

export function Metronome() {
  const m = useMetronome();

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2 before:content-[''] before:block before:h-[3px] before:w-1 before:rounded-full before:bg-emerald-500/70 before:shrink-0">
          Metronome
        </h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {Array.from({ length: m.beatsPerBar }, (_, i) => {
            const beat = i + 1;
            const isAccent = beat === 1;
            const isActive = m.playing && beat === m.currentBeat;
            return (
              <span
                key={beat}
                aria-label={`Beat ${beat}${isAccent ? " (accent)" : ""}`}
                className={`h-4 w-4 rounded-full transition-all duration-75 ${
                  isActive
                    ? isAccent
                      ? "bg-amber-400 scale-125"
                      : "bg-emerald-400 scale-110"
                    : isAccent
                    ? "bg-amber-400/30"
                    : "bg-zinc-700"
                }`}
                style={
                  isActive && isAccent
                    ? { boxShadow: "0 0 8px rgba(251, 191, 36, 0.6)" }
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        <button
          type="button"
          onClick={m.toggle}
          aria-pressed={m.playing}
          className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${
            m.playing
              ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
              : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
          }`}
        >
          {m.playing ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
              <rect x="1" y="1" width="8" height="8" rx="1"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <path d="M3 2l7 4-7 4V2Z"/>
            </svg>
          )}
          {m.playing ? "Stop" : "Start"}
        </button>

        <label className="flex items-center gap-2 text-xs text-zinc-400">
          BPM
          <input
            type="number"
            min={30}
            max={240}
            step={1}
            value={m.bpm}
            onChange={(e) => m.setBpm(Number(e.target.value))}
            className="w-16 rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
          />
        </label>

        <input
          type="range"
          min={30}
          max={240}
          step={1}
          value={m.bpm}
          onChange={(e) => m.setBpm(Number(e.target.value))}
          aria-label="Tempo"
          className="min-w-[120px] flex-1"
        />

        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Beats/bar
          <select
            value={m.beatsPerBar}
            onChange={(e) => m.setBeatsPerBar(Number(e.target.value))}
            className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
          >
            {TIME_SIGNATURES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
