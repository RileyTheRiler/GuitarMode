"use client";

import { useMetronome } from "@/lib/audio/useMetronome";

const TIME_SIGNATURES = [2, 3, 4, 5, 6, 7, 8] as const;

export function Metronome() {
  const m = useMetronome();

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
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
                className={`h-3 w-3 rounded-full transition-colors ${
                  isActive
                    ? isAccent
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                    : isAccent
                    ? "bg-amber-400/25"
                    : "bg-zinc-700"
                }`}
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
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            m.playing
              ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
              : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
          }`}
        >
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

        <label className="flex items-center gap-2 text-xs text-zinc-400">
          Click
          <select
            value={m.clickStyle}
            onChange={(e) => m.setClickStyle(e.target.value as "electronic" | "wood")}
            className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
          >
            <option value="electronic">Electronic</option>
            <option value="wood">Woodblock</option>
          </select>
        </label>
      </div>
    </div>
  );
}
