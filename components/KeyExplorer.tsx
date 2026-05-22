"use client";

import { useCallback, useMemo, useState } from "react";
import { Fretboard } from "@/components/Fretboard";
import { SCALE_TEMPLATES, scalePitchClasses } from "@/lib/music/scales";
import { diatonicTriads, type DiatonicTriad } from "@/lib/music/diatonicChords";
import { chordPitchClasses } from "@/lib/music/chords";
import { findVoicings, type Voicing } from "@/lib/guitar/chordVoicings";
import { NOTE_NAMES } from "@/lib/music/notes";
import { STANDARD_TUNING } from "@/lib/guitar/fretboard";
import { getToneContext, schedulePluck } from "@/lib/audio/tonePlayer";

const DEGREE_LABELS = ["1","♭2","2","♭3","3","4","♯4","5","♭6","6","♭7","7"];
const EMPTY_SET = new Set<number>();

const MAJOR_TEMPLATE = SCALE_TEMPLATES.find((s) => s.name === "Ionian (Major)")!;
const MINOR_TEMPLATE = SCALE_TEMPLATES.find((s) => s.name === "Aeolian (Natural Minor)")!;

// fretLIVE-inspired color per diatonic degree
const DEGREE_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: "bg-emerald-800/60", border: "border-emerald-600/60", text: "text-emerald-200" },
  1: { bg: "bg-sky-900/60",     border: "border-sky-700/60",     text: "text-sky-200" },
  2: { bg: "bg-sky-900/60",     border: "border-sky-700/60",     text: "text-sky-200" },
  3: { bg: "bg-amber-800/60",   border: "border-amber-600/60",   text: "text-amber-200" },
  4: { bg: "bg-orange-800/60",  border: "border-orange-600/60",  text: "text-orange-200" },
  5: { bg: "bg-sky-900/60",     border: "border-sky-700/60",     text: "text-sky-200" },
  6: { bg: "bg-rose-900/60",    border: "border-rose-700/60",    text: "text-rose-200" },
};

function playChordVoicing(voicing: Voicing, tuning: number[]) {
  const ctx = getToneContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const startAt = ctx.currentTime + 0.05;
  voicing.forEach((note, i) => {
    const midi = tuning[note.stringIndex] + note.fret;
    schedulePluck(midi, startAt + i * 0.08, 1.2);
  });
}

export function KeyExplorer() {
  const [rootPc, setRootPc] = useState(0); // C
  const [mode, setMode] = useState<"major" | "minor">("major");
  const [selectedDegree, setSelectedDegree] = useState<number | null>(null);
  const [activeVoicing, setActiveVoicing] = useState<Voicing | null>(null);

  const template = mode === "major" ? MAJOR_TEMPLATE : MINOR_TEMPLATE;

  const triads = useMemo(() => diatonicTriads(template, rootPc), [template, rootPc]);

  const scaleSet = useMemo(() => scalePitchClasses(template, rootPc), [template, rootPc]);

  const degreeMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const interval of template.intervals) {
      const pc = (rootPc + interval) % 12;
      map.set(pc, DEGREE_LABELS[interval] ?? String(interval));
    }
    return map;
  }, [template, rootPc]);

  const chordInfo = useMemo(() => {
    if (selectedDegree == null) return null;
    const triad = triads[selectedDegree];
    if (!triad) return null;
    const q = triad.quality === "other" ? "maj" : triad.quality;
    return chordPitchClasses(triad.root, q);
  }, [selectedDegree, triads]);

  const handleDegreeSelect = useCallback((degree: number, triad: DiatonicTriad) => {
    if (selectedDegree === degree) {
      setSelectedDegree(null);
      setActiveVoicing(null);
      return;
    }
    setSelectedDegree(degree);
    const q = triad.quality === "other" ? "maj" : triad.quality;
    const voicings = findVoicings(triad.root, q, STANDARD_TUNING);
    const voicing = voicings[0] ?? null;
    setActiveVoicing(voicing);
    if (voicing) playChordVoicing(voicing, STANDARD_TUNING);
  }, [selectedDegree]);

  const handleRootChange = (pc: number) => {
    setRootPc(pc);
    setSelectedDegree(null);
    setActiveVoicing(null);
  };

  const handleFretClick = useCallback((_s: number, _f: number, midi: number) => {
    schedulePluck(midi, getToneContext().currentTime + 0.01, 0.9);
  }, []);

  const rootName = NOTE_NAMES[rootPc];
  const scaleName = mode === "major" ? "Major" : "Natural Minor";

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2 before:content-[''] before:block before:h-[3px] before:w-1 before:rounded-full before:bg-emerald-500/70 before:shrink-0">
        Key Explorer
      </h2>

      {/* Root + mode selectors */}
      <div className="mb-4 flex flex-wrap gap-4">
        <div>
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

        <div>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Mode</p>
          <div className="flex rounded-lg border border-zinc-700 bg-zinc-950 p-0.5 gap-0.5">
            {(["major", "minor"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setSelectedDegree(null); setActiveVoicing(null); }}
                className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition ${
                  mode === m
                    ? "bg-zinc-700 text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* fretLIVE-style diatonic chord progression bar */}
      <div className="mb-4">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
          All chords in {rootName} {scaleName} — click to hear
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {triads.map((triad, i) => {
            const colors = DEGREE_COLORS[i] ?? DEGREE_COLORS[0];
            const isSelected = selectedDegree === i;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleDegreeSelect(i, triad)}
                className={`flex flex-col items-center rounded-lg border px-3 py-2 min-w-[52px] transition ${
                  isSelected
                    ? "ring-2 ring-emerald-400 ring-offset-1 ring-offset-zinc-900"
                    : ""
                } ${colors.bg} ${colors.border} hover:brightness-125`}
              >
                <span className={`text-xs font-bold ${colors.text}`}>{triad.romanNumeral}</span>
                <span className="text-[10px] text-zinc-300 mt-0.5">{triad.label}</span>
              </button>
            );
          })}
        </div>
        {selectedDegree != null && triads[selectedDegree] && (
          <p className="mt-2 text-xs text-zinc-400">
            <span className="font-semibold text-zinc-200">{triads[selectedDegree].label}</span>
            {" "}— {triads[selectedDegree].romanNumeral} chord in {rootName} {scaleName}.
            {activeVoicing && " Voicing shown on fretboard below."}
          </p>
        )}
      </div>

      {/* Full-neck scale + chord voicing fretboard */}
      <div className="overflow-x-auto">
        <Fretboard
          numFrets={22}
          tuning={STANDARD_TUNING}
          playedPitchClasses={EMPTY_SET}
          scalePitchClasses={scaleSet}
          rootPitchClass={rootPc}
          showDegrees
          degreeMap={degreeMap}
          voicingPositions={activeVoicing ?? undefined}
          chordPitchClasses={chordInfo?.all}
          chordRootPitchClass={chordInfo?.root ?? null}
          chordThirdPitchClass={chordInfo?.third ?? null}
          onFretClick={handleFretClick}
        />
      </div>

      <p className="mt-2 text-xs text-zinc-600">
        Outlined circles = {rootName} {scaleName} scale tones. Chord voicing shown when a chord is selected.
      </p>
    </section>
  );
}
