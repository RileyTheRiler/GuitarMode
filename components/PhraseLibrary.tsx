"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fretboard } from "./Fretboard";
import {
  filterLicks,
  transposeLick,
  type GuitarLick,
  type LickDifficulty,
  type LickStyle,
} from "@/lib/music/phraseLibrary";
import { createSoloPlayer, type SoloPlayer } from "@/lib/audio/soloPlayer";
import { NOTE_NAMES, colorForPitchClass } from "@/lib/music/notes";
import type { GeneratedSolo, NoteTechnique, SoloNote } from "@/lib/music/soloGenerator";

// ─── Mini tab builder (simplified, single-system) ────────────────────────────

const TAB_LABELS = ["e", "B", "G", "D", "A", "E"] as const;
const CELL_W = 3;
const RESOLUTION = 0.5;
const TECHNIQUE_CHAR: Record<NoteTechnique, string> = {
  bend: "b",
  hammer: "h",
  pull: "p",
  slide_up: "/",
  slide_down: "\\",
};

function buildMiniTab(solo: GeneratedSolo): string {
  const totalCells = Math.max(1, Math.ceil(solo.totalBeats / RESOLUTION));
  const grid: ({ fret: number; technique?: NoteTechnique } | null)[][] = Array(6)
    .fill(null)
    .map(() => new Array(totalCells).fill(null));

  for (const note of solo.notes) {
    const cell = Math.min(Math.round(note.startBeat / RESOLUTION), totalCells - 1);
    const ds = 5 - note.stringIndex;
    if (cell >= 0 && ds >= 0 && ds < 6 && grid[ds][cell] === null) {
      grid[ds][cell] = { fret: note.fret, technique: note.technique };
    }
  }

  return TAB_LABELS.map((label, si) => {
    let line = label + "|";
    for (let c = 0; c < totalCells; c++) {
      const cell = grid[si][c];
      if (cell) {
        const f = String(cell.fret);
        const t = cell.technique ? TECHNIQUE_CHAR[cell.technique] : "-";
        line += f.length >= 2 ? (f + t).slice(0, CELL_W) : f + t + "-";
      } else {
        line += "-".repeat(CELL_W);
      }
    }
    return line + "|";
  }).join("\n");
}

// ─── Badge components ─────────────────────────────────────────────────────────

const STYLE_COLORS: Record<LickStyle, string> = {
  blues: "bg-blue-900/50 text-blue-400 border border-blue-800",
  rock: "bg-orange-900/50 text-orange-400 border border-orange-800",
  jazz: "bg-violet-900/50 text-violet-400 border border-violet-800",
};

const DIFF_COLORS: Record<LickDifficulty, string> = {
  beginner: "bg-emerald-900/50 text-emerald-400 border border-emerald-800",
  intermediate: "bg-amber-900/50 text-amber-400 border border-amber-800",
  advanced: "bg-red-900/50 text-red-400 border border-red-800",
};

function Badge({ label, className }: { label: string; className: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium capitalize ${className}`}>
      {label}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PhraseLibraryProps {
  onLickLoad: (solo: GeneratedSolo, lick: GuitarLick) => void;
  defaultScaleRoot?: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PhraseLibrary({ onLickLoad, defaultScaleRoot = 9 }: PhraseLibraryProps) {
  const [styleFilter, setStyleFilter] = useState<LickStyle | "all">("all");
  const [diffFilter, setDiffFilter] = useState<LickDifficulty | "all">("all");
  const [scaleRoot, setScaleRoot] = useState<number>(defaultScaleRoot);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [currentNote, setCurrentNote] = useState<SoloNote | null>(null);
  const playerRef = useRef<SoloPlayer | null>(null);

  useEffect(() => {
    return () => { playerRef.current?.stop(); };
  }, []);

  const handlePlay = useCallback((lick: GuitarLick) => {
    if (playingId === lick.id) {
      playerRef.current?.stop();
      setPlayingId(null);
      setCurrentNote(null);
      return;
    }
    playerRef.current?.stop();
    const solo = transposeLick(lick, scaleRoot);
    const player = createSoloPlayer(solo, {
      onNoteStart: (note) => setCurrentNote(note),
      onNoteEnd: () => setCurrentNote(null),
      onComplete: () => { setPlayingId(null); setCurrentNote(null); },
    });
    playerRef.current = player;
    setPlayingId(lick.id);
    player.start();
  }, [playingId, scaleRoot]);

  const handleLoad = useCallback((lick: GuitarLick) => {
    playerRef.current?.stop();
    setPlayingId(null);
    setCurrentNote(null);
    onLickLoad(transposeLick(lick, scaleRoot), lick);
  }, [scaleRoot, onLickLoad]);

  const visibleLicks = filterLicks(styleFilter, diffFilter);

  const STYLE_FILTERS: { label: string; value: LickStyle | "all" }[] = [
    { label: "All", value: "all" },
    { label: "Blues", value: "blues" },
    { label: "Rock", value: "rock" },
    { label: "Jazz", value: "jazz" },
  ];

  const DIFF_FILTERS: { label: string; value: LickDifficulty | "all" }[] = [
    { label: "All", value: "all" },
    { label: "Beginner", value: "beginner" },
    { label: "Intermediate", value: "intermediate" },
    { label: "Advanced", value: "advanced" },
  ];

  return (
    <div className="rounded-xl border border-zinc-700 bg-zinc-900/80 p-3">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        Lick Library
      </h3>

      {/* Key selector */}
      <div className="mb-3">
        <p className="mb-1.5 text-xs text-zinc-500">Preview key</p>
        <div className="flex flex-wrap gap-1">
          {NOTE_NAMES.map((name, pc) => (
            <button
              key={pc}
              onClick={() => setScaleRoot(pc)}
              className={`min-w-[2rem] rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                scaleRoot === pc
                  ? "text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
              style={scaleRoot === pc ? { background: colorForPitchClass(pc) } : undefined}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Style filter */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-600">Style:</span>
        {STYLE_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStyleFilter(f.value)}
            className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
              styleFilter === f.value
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Difficulty filter */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-600">Level:</span>
        {DIFF_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setDiffFilter(f.value)}
            className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
              diffFilter === f.value
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Lick grid */}
      {visibleLicks.length === 0 ? (
        <p className="text-xs text-zinc-600">No licks match the current filters.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleLicks.map((lick) => {
            const isPlaying = playingId === lick.id;
            const transposed = transposeLick(lick, scaleRoot);

            return (
              <div
                key={lick.id}
                className={`rounded-xl border p-3 transition-colors ${
                  isPlaying
                    ? "border-teal-700 bg-teal-950/30"
                    : "border-zinc-800 bg-zinc-900/60"
                }`}
              >
                {/* Badges + name */}
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge label={lick.style} className={STYLE_COLORS[lick.style]} />
                  <Badge label={lick.difficulty} className={DIFF_COLORS[lick.difficulty]} />
                </div>
                <p className="mb-0.5 text-sm font-semibold text-zinc-200">{lick.name}</p>
                <p className="mb-2 text-xs text-zinc-500">{lick.description}</p>

                {/* Scale label */}
                <p className="mb-2 text-[10px] text-zinc-600">
                  Scale: <span className="text-zinc-400">{lick.recommendedScale}</span>
                  {" · "}
                  {lick.notes.length} notes · {lick.totalBeats} beats
                </p>

                {/* Mini tab */}
                <div className="mb-2 overflow-x-auto rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5">
                  <pre className="font-mono text-[10px] leading-tight text-zinc-400">
                    {buildMiniTab(transposed)}
                  </pre>
                </div>

                {/* Live fretboard (only when playing) */}
                {isPlaying && (
                  <div className="mb-2">
                    <Fretboard
                      numFrets={15}
                      playedPitchClasses={new Set<number>()}
                      scalePitchClasses={transposed.scalePitchClasses}
                      rootPitchClass={transposed.scaleRoot}
                      highlightFretPosition={
                        currentNote
                          ? { stringIndex: currentNote.stringIndex, fret: currentNote.fret }
                          : null
                      }
                      boxCenterFret={transposed.centerFret + 3}
                      boxWindow={4}
                    />
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePlay(lick)}
                    className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      isPlaying
                        ? "border-red-700 bg-red-900/60 text-red-300 hover:bg-red-900"
                        : "border-teal-700 bg-teal-900/40 text-teal-300 hover:bg-teal-900"
                    }`}
                  >
                    {isPlaying ? "Stop" : "Play"}
                  </button>
                  <button
                    onClick={() => handleLoad(lick)}
                    className="flex-1 rounded-lg border border-violet-700 bg-violet-900/40 px-3 py-1.5 text-xs font-medium text-violet-300 transition-colors hover:bg-violet-900"
                  >
                    Load
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
