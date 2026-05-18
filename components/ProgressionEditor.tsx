"use client";

import { useEffect, useRef, useState } from "react";
import { DEMO_PROGRESSION, type ChordEvent } from "@/lib/music/progression";
import { parseChord } from "@/lib/music/chords";
import { useProgressionPlayer } from "@/lib/audio/useProgressionPlayer";

type Props = {
  progression: ChordEvent[];
  onChange: (next: ChordEvent[]) => void;
  currentChord?: string | null;
  a4Hz?: number;
  onPlaybackChordChange?: (chord: ChordEvent | null) => void;
};

const MAX_EVENTS = 500;

const PRESET_PROGRESSIONS: Record<string, ChordEvent[]> = {
  "I–IV–V–I (G major)": [
    { time: 0, chord: "G" }, { time: 2, chord: "C" },
    { time: 4, chord: "D" }, { time: 6, chord: "G" },
  ],
  "I–V–vi–IV (G major, pop)": [
    { time: 0, chord: "G" }, { time: 2, chord: "D" },
    { time: 4, chord: "Em" }, { time: 6, chord: "C" },
    { time: 8, chord: "G" }, { time: 10, chord: "D" },
    { time: 12, chord: "Em" }, { time: 14, chord: "C" },
  ],
  "ii–V–I (A minor jazz)": [
    { time: 0, chord: "Bm7" }, { time: 2, chord: "E7" },
    { time: 4, chord: "Amaj7" }, { time: 6, chord: "Amaj7" },
  ],
  "12-bar blues (A)": [
    { time: 0, chord: "A7" }, { time: 4, chord: "A7" },
    { time: 8, chord: "A7" }, { time: 12, chord: "A7" },
    { time: 16, chord: "D7" }, { time: 20, chord: "D7" },
    { time: 24, chord: "A7" }, { time: 28, chord: "A7" },
    { time: 32, chord: "E7" }, { time: 36, chord: "D7" },
    { time: 40, chord: "A7" }, { time: 44, chord: "E7" },
  ],
  "Andalusian cadence (Am)": [
    { time: 0, chord: "Am" }, { time: 2, chord: "G" },
    { time: 4, chord: "F" }, { time: 6, chord: "E" },
  ],
  "I–vi–IV–V (C major, 50s)": [
    { time: 0, chord: "C" }, { time: 2, chord: "Am" },
    { time: 4, chord: "F" }, { time: 6, chord: "G" },
  ],
};

function stringify(p: ChordEvent[]): string {
  if (p.length === 0) return "";
  return JSON.stringify(p, null, 2);
}

function validate(parsed: unknown): { ok: true; value: ChordEvent[] } | { ok: false; error: string } {
  if (!Array.isArray(parsed)) return { ok: false, error: "Expected an array of { time, chord } objects" };
  if (parsed.length > MAX_EVENTS) {
    return { ok: false, error: `Too many events (max ${MAX_EVENTS})` };
  }
  const result: ChordEvent[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const ev = parsed[i] as { time?: unknown; chord?: unknown };
    if (typeof ev?.time !== "number" || !Number.isFinite(ev.time)) {
      return { ok: false, error: `Item ${i}: "time" must be a number` };
    }
    if (typeof ev?.chord !== "string" || ev.chord.length === 0) {
      return { ok: false, error: `Item ${i}: "chord" must be a non-empty string` };
    }
    if (!parseChord(ev.chord)) {
      return { ok: false, error: `Item ${i}: "${ev.chord}" is not a recognized chord` };
    }
    result.push({ time: ev.time, chord: ev.chord });
  }
  return { ok: true, value: result };
}

export function ProgressionEditor({
  progression,
  onChange,
  currentChord,
  a4Hz = 440,
  onPlaybackChordChange,
}: Props) {
  const [text, setText] = useState<string>(() => stringify(progression));
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const player = useProgressionPlayer();

  // Stop playback if the user edits or clears the chord list mid-play.
  useEffect(() => {
    if (player.playing) player.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progression]);

  // Surface the playback's currently-sounding chord so the fretboard can
  // highlight chord tones in sync.
  useEffect(() => {
    onPlaybackChordChange?.(player.currentChord);
  }, [player.currentChord, onPlaybackChordChange]);

  const handleTogglePlay = () => {
    if (player.playing) player.stop();
    else player.play(progression, a4Hz);
  };

  const apply = (raw: string) => {
    setText(raw);
    if (raw.trim().length === 0) {
      setError(null);
      onChange([]);
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invalid JSON");
      return;
    }
    const res = validate(parsed);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setError(null);
    onChange(res.value);
  };

  const loadPreset = (events: ChordEvent[]) => {
    const raw = stringify(events);
    setText(raw);
    setError(null);
    onChange(events);
    setOpen(true);
  };

  const loadDemo = () => loadPreset(DEMO_PROGRESSION);

  const clear = () => {
    setText("");
    setError(null);
    onChange([]);
  };

  const handleExport = () => {
    if (progression.length === 0) return;
    const blob = new Blob([JSON.stringify(progression, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "chord-progression.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    file.text().then((raw) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setError("Import failed: invalid JSON file");
        return;
      }
      const res = validate(parsed);
      if (!res.ok) {
        setError(`Import failed: ${res.error}`);
        return;
      }
      const raw2 = stringify(res.value);
      setText(raw2);
      setError(null);
      onChange(res.value);
      setOpen(true);
    });
  };

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-zinc-500 hover:text-zinc-200 transition-colors"
        >
          Chord progression
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={`transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`} aria-hidden="true">
            <path d="M4 6l4 4 4-4"/>
          </svg>
        </button>
        <div className="flex flex-wrap items-center gap-2 text-xs sm:gap-3">
          {currentChord && (
            <span className="rounded bg-amber-500/15 px-2 py-1 font-medium text-amber-300">
              Now: {currentChord}
            </span>
          )}
          <span className="text-zinc-500">{progression.length} chord{progression.length === 1 ? "" : "s"}</span>

          <select
            className="rounded px-2 py-1 bg-zinc-800 text-zinc-200 text-xs"
            value=""
            onChange={(e) => {
              const preset = PRESET_PROGRESSIONS[e.target.value];
              if (preset) loadPreset(preset);
            }}
            aria-label="Load a preset progression"
          >
            <option value="" disabled>Presets…</option>
            {Object.keys(PRESET_PROGRESSIONS).map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={progression.length === 0}
            aria-pressed={player.playing}
            className={`rounded px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${
              player.playing
                ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
            }`}
          >
            {player.playing ? "Stop" : "Play"}
          </button>
          <button
            type="button"
            onClick={loadDemo}
            className="rounded px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          >
            Demo
          </button>
          {progression.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              title="Download as JSON"
              className="rounded px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            >
              Export
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Import from JSON file"
            className="rounded px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
          >
            Import
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
          <button
            type="button"
            onClick={clear}
            className="rounded px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
          >
            Clear
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-zinc-500">
            JSON array of <code className="text-zinc-300">{`{ "time": seconds, "chord": "Bm" }`}</code>. Chord tones
            will glow on the fretboard while the backing track plays; the 3rd gets a gold ring.
          </p>
          <textarea
            value={text}
            onChange={(e) => apply(e.target.value)}
            rows={8}
            spellCheck={false}
            className={`w-full rounded bg-zinc-950 p-3 font-mono text-xs text-zinc-200 border ${
              error ? "border-red-500" : "border-zinc-800"
            }`}
            placeholder='[{ "time": 0, "chord": "G" }, { "time": 2, "chord": "D" }]'
          />
          {error ? (
            <p className="mt-1 text-xs text-red-400">{error}</p>
          ) : progression.length > 0 ? (
            <p className="mt-1 text-xs text-emerald-400">
              ✓ Loaded {progression.length} chord{progression.length === 1 ? "" : "s"}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
