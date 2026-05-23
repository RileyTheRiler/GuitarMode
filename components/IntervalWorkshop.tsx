"use client";

import { useCallback, useMemo, useState } from "react";
import { Fretboard } from "@/components/Fretboard";
import { SCALE_TEMPLATES, scalePitchClasses } from "@/lib/music/scales";
import { CHORD_TEMPLATES, chordDisplayName, type ChordQuality } from "@/lib/music/chords";
import { NOTE_NAMES } from "@/lib/music/notes";
import { STANDARD_TUNING } from "@/lib/guitar/fretboard";
import { getToneContext, schedulePluck } from "@/lib/audio/tonePlayer";

const DEGREE_LABELS = ["1","♭2","2","♭3","3","4","♯4","5","♭6","6","♭7","7"];

const INTERVAL_ROWS: { semitone: number; label: string }[][] = [
  [
    { semitone: 1, label: "♭2" }, { semitone: 2, label: "2" },
    { semitone: 3, label: "♭3" }, { semitone: 4, label: "3" },
    { semitone: 5, label: "4" },  { semitone: 6, label: "♭5" },
  ],
  [
    { semitone: 7, label: "5" },  { semitone: 8, label: "♭6" },
    { semitone: 9, label: "6" },  { semitone: 10, label: "♭7" },
    { semitone: 11, label: "7" }, { semitone: 12, label: "8va" },
  ],
];

const PRESETS: { label: string; intervals: number[] }[] = [
  { label: "Major Triad",  intervals: [4, 7] },
  { label: "Minor Triad",  intervals: [3, 7] },
  { label: "Dom 7",        intervals: [4, 7, 10] },
  { label: "Min 7",        intervals: [3, 7, 10] },
  { label: "Minor Pent",   intervals: [3, 5, 7, 10] },
  { label: "Blues Scale",  intervals: [3, 5, 6, 7, 10] },
];

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// Normalize intervals to pitch classes from root 0
function intervalsToNormalPcSet(root: number, intervals: Set<number>): Set<number> {
  const s = new Set<number>([(root) % 12]);
  for (const i of intervals) s.add((root + (i % 12)) % 12);
  return s;
}

const EMPTY_SET = new Set<number>();

export function IntervalWorkshop() {
  const [rootPc, setRootPc] = useState(0); // C
  const [activeIntervals, setActiveIntervals] = useState<Set<number>>(new Set());

  const toggleInterval = (semitone: number) => {
    setActiveIntervals((prev) => {
      const next = new Set(prev);
      if (next.has(semitone)) next.delete(semitone);
      else next.add(semitone);
      return next;
    });
  };

  const applyPreset = (intervals: number[]) => {
    setActiveIntervals(new Set(intervals));
  };

  // Build pitch class set for fretboard display
  const selectedPcSet = useMemo(() => {
    const s = new Set<number>([rootPc]);
    for (const i of activeIntervals) s.add((rootPc + (i % 12)) % 12);
    return s;
  }, [rootPc, activeIntervals]);

  const degreeMap = useMemo(() => {
    const map = new Map<number, string>();
    map.set(rootPc % 12, "1");
    for (const interval of activeIntervals) {
      const pc = (rootPc + interval) % 12;
      map.set(pc, DEGREE_LABELS[interval % 12] ?? String(interval));
    }
    return map;
  }, [rootPc, activeIntervals]);

  // Match against known chords (exact pitch class match)
  const matchingChords = useMemo(() => {
    if (activeIntervals.size === 0) return [];
    const normalizedSelected = new Set<number>();
    normalizedSelected.add(0);
    for (const i of activeIntervals) normalizedSelected.add(i % 12);

    const matches: string[] = [];
    for (const [quality, template] of Object.entries(CHORD_TEMPLATES) as [ChordQuality, typeof CHORD_TEMPLATES[ChordQuality]][]) {
      const chordIntervalSet = new Set(template.intervals);
      if (setsEqual(normalizedSelected, chordIntervalSet)) {
        matches.push(chordDisplayName(rootPc, quality));
      }
    }
    return matches;
  }, [rootPc, activeIntervals]);

  // Match against known scales (exact pitch class match)
  const matchingScales = useMemo(() => {
    if (activeIntervals.size < 2) return [];
    const selectedPcs = intervalsToNormalPcSet(rootPc, activeIntervals);
    const matches: string[] = [];
    for (const template of SCALE_TEMPLATES) {
      const scalePcs = scalePitchClasses(template, rootPc);
      if (setsEqual(selectedPcs, scalePcs)) {
        matches.push(template.name);
      }
    }
    return matches;
  }, [rootPc, activeIntervals]);

  const handlePlayIntervals = useCallback(() => {
    const ctx = getToneContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const rootMidi = 48 + rootPc; // C3 range
    const startAt = ctx.currentTime + 0.05;
    // Play root first, then each interval
    schedulePluck(rootMidi, startAt, 0.8);
    const sortedIntervals = [...activeIntervals].sort((a, b) => a - b);
    sortedIntervals.forEach((interval, i) => {
      schedulePluck(rootMidi + interval, startAt + (i + 1) * 0.3, 0.8);
    });
  }, [rootPc, activeIntervals]);

  const handleFretClick = useCallback((_s: number, _f: number, midi: number) => {
    schedulePluck(midi, getToneContext().currentTime + 0.01, 0.9);
  }, []);

  const hasMatches = matchingChords.length > 0 || matchingScales.length > 0;

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2 before:content-[''] before:block before:h-[3px] before:w-1 before:rounded-full before:bg-emerald-500/70 before:shrink-0">
        Interval Workshop
      </h2>
      <p className="text-xs text-zinc-500 mb-4">
        Build chords and scales from intervals. Select a root and toggle intervals to hear and see what you create.
      </p>

      {/* Root selector */}
      <div className="mb-4">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Root</p>
        <div className="flex flex-wrap gap-1">
          {NOTE_NAMES.map((name, pc) => (
            <button
              key={pc}
              type="button"
              onClick={() => setRootPc(pc)}
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

      {/* Interval toggle grid */}
      <div className="mb-4">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Intervals</p>
        {/* Root button (always on) */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center justify-center rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white min-w-[2.5rem] text-center">
            R<br/><span className="text-[9px] font-normal opacity-75">0</span>
          </span>
          {INTERVAL_ROWS.flat().map(({ semitone, label }) => (
            <button
              key={semitone}
              type="button"
              onClick={() => toggleInterval(semitone)}
              className={`rounded px-2.5 py-1.5 text-xs font-medium transition min-w-[2.5rem] text-center ${
                activeIntervals.has(semitone)
                  ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200"
              }`}
            >
              {label}<br/><span className="text-[9px] opacity-60">{semitone}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div className="mb-4">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Presets</p>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => {
            const isActive = setsEqual(new Set(preset.intervals), activeIntervals);
            return (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset.intervals)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  isActive
                    ? "bg-teal-600/20 text-teal-300 border border-teal-500/40"
                    : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500"
                }`}
              >
                {preset.label}
              </button>
            );
          })}
          {activeIntervals.size > 0 && (
            <button
              type="button"
              onClick={() => setActiveIntervals(new Set())}
              className="rounded-md px-2.5 py-1 text-xs font-medium bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300 hover:border-zinc-500 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Match results */}
      {activeIntervals.size > 0 && (
        <div className={`mb-4 rounded-lg border p-3 ${
          hasMatches
            ? "border-emerald-700/40 bg-emerald-950/30"
            : "border-zinc-700/40 bg-zinc-900/30"
        }`}>
          {hasMatches ? (
            <div className="flex flex-wrap gap-4">
              {matchingChords.length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Chord</p>
                  <div className="flex flex-wrap gap-1">
                    {matchingChords.map((name) => (
                      <span key={name} className="rounded bg-amber-700/30 border border-amber-600/40 px-2 py-0.5 text-xs font-medium text-amber-300">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {matchingScales.length > 0 && (
                <div>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Scale</p>
                  <div className="flex flex-wrap gap-1">
                    {matchingScales.map((name) => (
                      <span key={name} className="rounded bg-emerald-700/30 border border-emerald-600/40 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        {NOTE_NAMES[rootPc]} {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-zinc-500">
              {activeIntervals.size === 1
                ? "Add more intervals to identify a chord or scale."
                : "No exact match — keep exploring!"}
            </p>
          )}
        </div>
      )}

      {/* Hear It button */}
      <div className="mb-4">
        <button
          type="button"
          onClick={handlePlayIntervals}
          disabled={activeIntervals.size === 0}
          className="rounded-md px-4 py-2 text-sm font-medium bg-zinc-800 text-zinc-200 border border-zinc-700 hover:border-zinc-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          ▶ Hear It
        </button>
      </div>

      {/* Fretboard */}
      <div className="overflow-x-auto">
        <Fretboard
          numFrets={22}
          tuning={STANDARD_TUNING}
          playedPitchClasses={selectedPcSet}
          scalePitchClasses={selectedPcSet}
          rootPitchClass={rootPc}
          showDegrees={activeIntervals.size > 0}
          degreeMap={degreeMap}
          onFretClick={handleFretClick}
        />
      </div>
      <p className="mt-2 text-xs text-zinc-600">
        Filled circles = selected notes. Degree labels show interval names from root.
      </p>
    </section>
  );
}
