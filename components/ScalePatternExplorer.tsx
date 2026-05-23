"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Fretboard } from "@/components/Fretboard";
import { SCALE_TEMPLATES, scalePitchClasses } from "@/lib/music/scales";
import { computeScalePatterns } from "@/lib/music/scalePatterns";
import { NOTE_NAMES } from "@/lib/music/notes";
import { getToneContext, schedulePluck } from "@/lib/audio/tonePlayer";
import type { ScheduledNote } from "@/lib/audio/tonePlayer";
import { STANDARD_TUNING } from "@/lib/guitar/fretboard";

const DEGREE_LABELS = ["1","♭2","2","♭3","3","4","♯4","5","♭6","6","♭7","7"];

const CURATED_SCALE_INDICES = [
  SCALE_TEMPLATES.findIndex((s) => s.name === "Minor Pentatonic"),
  SCALE_TEMPLATES.findIndex((s) => s.name === "Blues"),
  SCALE_TEMPLATES.findIndex((s) => s.name === "Major Pentatonic"),
  SCALE_TEMPLATES.findIndex((s) => s.name === "Ionian (Major)"),
  SCALE_TEMPLATES.findIndex((s) => s.name === "Aeolian (Natural Minor)"),
  SCALE_TEMPLATES.findIndex((s) => s.name === "Dorian"),
  SCALE_TEMPLATES.findIndex((s) => s.name === "Mixolydian"),
  SCALE_TEMPLATES.findIndex((s) => s.name === "Harmonic Minor"),
].filter((i) => i !== -1);

const FINGER_COLORS = ["#f97316","#22c55e","#ef4444","#3b82f6"] as const; // orange, green, red, blue
const FINGER_NAMES = ["Index","Middle","Ring","Pinky"];

const EMPTY_SET = new Set<number>();

function HandDiagram() {
  return (
    <svg viewBox="0 0 140 100" width={140} height={100} aria-label="Finger color guide">
      {/* Palm */}
      <rect x="18" y="52" width="104" height="40" rx="10" fill="#44403c" />
      {/* Fingers */}
      {FINGER_COLORS.map((color, i) => (
        <g key={i}>
          <rect
            x={18 + i * 26}
            y={i === 1 ? 8 : i === 2 ? 12 : i === 0 ? 16 : 22}
            width={20}
            height={i === 1 ? 46 : i === 2 ? 42 : i === 0 ? 38 : 32}
            rx={10}
            fill={color}
          />
          <text
            x={28 + i * 26}
            y={95}
            textAnchor="middle"
            fontSize={8}
            fill={color}
            fontWeight="600"
          >
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function ScalePatternExplorer() {
  const [rootPc, setRootPc] = useState(9); // A
  const [scaleTemplateIdx, setScaleTemplateIdx] = useState(
    CURATED_SCALE_INDICES[0] ?? SCALE_TEMPLATES.findIndex((s) => s.name === "Minor Pentatonic")
  );
  const [patternIdx, setPatternIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playHandlesRef = useRef<ScheduledNote[]>([]);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scale = SCALE_TEMPLATES[scaleTemplateIdx];

  const patterns = useMemo(
    () => computeScalePatterns(scale, rootPc, STANDARD_TUNING, 22),
    [scale, rootPc]
  );

  const currentPattern = patterns[Math.min(patternIdx, patterns.length - 1)];

  const scaleSet = useMemo(
    () => scalePitchClasses(scale, rootPc),
    [scale, rootPc]
  );

  const degreeMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const interval of scale.intervals) {
      const pc = (rootPc + interval) % 12;
      map.set(pc, DEGREE_LABELS[interval] ?? String(interval));
    }
    return map;
  }, [scale, rootPc]);

  const handlePatternChange = (idx: number) => {
    setPatternIdx(Math.max(0, Math.min(patterns.length - 1, idx)));
  };

  const handleRootChange = (pc: number) => {
    setRootPc(pc);
    setPatternIdx(0);
  };

  const handleScaleChange = (idx: number) => {
    setScaleTemplateIdx(idx);
    setPatternIdx(0);
  };

  const stopPlayback = useCallback(() => {
    for (const h of playHandlesRef.current) try { h.cancel(); } catch {}
    playHandlesRef.current = [];
    if (playTimerRef.current) { clearTimeout(playTimerRef.current); playTimerRef.current = null; }
    setIsPlaying(false);
  }, []);

  const handlePlayPattern = useCallback(() => {
    if (isPlaying) { stopPlayback(); return; }
    if (!currentPattern) return;

    const midiNotes = [...new Set(
      currentPattern.positions.map((p) => STANDARD_TUNING[p.stringIndex] + p.fret)
    )].sort((a, b) => a - b);

    const ctx = getToneContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const startAt = ctx.currentTime + 0.05;
    const handles: ScheduledNote[] = [];
    midiNotes.forEach((midi, i) => {
      handles.push(schedulePluck(midi, startAt + i * 0.22, 0.6));
    });
    playHandlesRef.current = handles;
    setIsPlaying(true);

    const totalMs = midiNotes.length * 220 + 800;
    playTimerRef.current = setTimeout(() => {
      playHandlesRef.current = [];
      playTimerRef.current = null;
      setIsPlaying(false);
    }, totalMs);
  }, [isPlaying, currentPattern, stopPlayback]);

  const handleFretClick = useCallback((_s: number, _f: number, midi: number) => {
    schedulePluck(midi, getToneContext().currentTime + 0.01, 0.9);
  }, []);

  const rootName = NOTE_NAMES[rootPc];
  const patternCount = patterns.length;

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
      <div className="mb-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2 before:content-[''] before:block before:h-[3px] before:w-1 before:rounded-full before:bg-emerald-500/70 before:shrink-0">
          Scale Pattern Explorer
        </h2>

        {/* Root selector */}
        <div className="mb-3">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Root</p>
          <div className="flex flex-wrap gap-1">
            {NOTE_NAMES.map((name, pc) => (
              <button
                key={pc}
                type="button"
                onClick={() => handleRootChange(pc)}
                className={`rounded px-2 py-0.5 text-xs font-medium transition ${
                  pc === rootPc
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>

        {/* Scale selector */}
        <div className="mb-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Scale</p>
          <div className="flex flex-wrap gap-1.5">
            {CURATED_SCALE_INDICES.map((idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleScaleChange(idx)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                  idx === scaleTemplateIdx
                    ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500"
                }`}
              >
                {SCALE_TEMPLATES[idx].name}
              </button>
            ))}
          </div>
        </div>

        {/* Pattern header + navigation */}
        {currentPattern && (
          <div className="mb-2 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-zinc-200">
                {rootName} {scale.name} — {currentPattern.label}
              </p>
              <p className="text-xs text-zinc-500">
                Frets {currentPattern.startFret}–{currentPattern.endFret}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handlePatternChange(patternIdx - 1)}
                disabled={patternIdx === 0}
                className="rounded bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <div className="flex gap-1">
                {patterns.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handlePatternChange(i)}
                    className={`h-2 w-2 rounded-full transition ${
                      i === patternIdx ? "bg-emerald-400" : "bg-zinc-600 hover:bg-zinc-500"
                    }`}
                    aria-label={`Pattern ${i + 1}`}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => handlePatternChange(patternIdx + 1)}
                disabled={patternIdx >= patternCount - 1}
                className="rounded bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Fretboard */}
        <div className="overflow-x-auto">
          <Fretboard
            numFrets={22}
            tuning={STANDARD_TUNING}
            playedPitchClasses={scaleSet}
            scalePitchClasses={scaleSet}
            rootPitchClass={rootPc}
            showDegrees
            degreeMap={degreeMap}
            boxCenterFret={currentPattern?.centerFret ?? null}
            boxWindow={2}
            onFretClick={handleFretClick}
          />
        </div>

        {/* Footer: hand diagram + play button */}
        <div className="mt-3 flex flex-wrap items-start gap-4">
          {/* Finger legend */}
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Finger Guide</p>
            <HandDiagram />
            <div className="mt-1 flex gap-3">
              {FINGER_NAMES.map((name, i) => (
                <span key={i} className="text-[10px] font-medium" style={{ color: FINGER_COLORS[i] }}>
                  {name}
                </span>
              ))}
            </div>
          </div>

          {/* Play button */}
          <div className="flex flex-col gap-2 mt-2">
            <button
              type="button"
              onClick={handlePlayPattern}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                isPlaying
                  ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-zinc-800 text-zinc-200 border border-zinc-700 hover:border-zinc-500"
              }`}
            >
              {isPlaying ? "■ Stop" : "▶ Play Pattern"}
            </button>
            <p className="text-[10px] text-zinc-600">
              Click any dot to hear individual notes.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
