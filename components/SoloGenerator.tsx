"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fretboard } from "./Fretboard";
import { PhraseLibrary } from "./PhraseLibrary";
import { generateSolo, type GeneratedSolo, type SoloNote } from "@/lib/music/soloGenerator";
import { createSoloPlayer, type SoloPlayer } from "@/lib/audio/soloPlayer";
import { NOTE_NAMES, colorForPitchClass } from "@/lib/music/notes";
import { parseChord } from "@/lib/music/chords";
import type { NoteTechnique } from "@/lib/music/soloGenerator";
import type { GuitarLick } from "@/lib/music/phraseLibrary";

// ─── Constants ────────────────────────────────────────────────────────────────

const STYLE_OPTIONS = [
  { value: "rock" as const, label: "Rock" },
  { value: "blues" as const, label: "Blues" },
  { value: "jazz" as const, label: "Jazz" },
];

const PRESET_PROGRESSIONS = [
  { label: "Am blues", value: "Am G F E" },
  { label: "I–V–vi–IV", value: "C G Am F" },
  { label: "12-bar blues", value: "A7 A7 A7 A7 D7 D7 A7 A7 E7 D7 A7 E7" },
  { label: "Dorian jam", value: "Dm G Dm G" },
  { label: "Minor pentatonic", value: "Em Am Em B7" },
];

const BEATS_PER_CHORD_OPTIONS = [2, 4, 8];

// ─── Tab builder ──────────────────────────────────────────────────────────────

const TAB_STRING_LABELS = ["e", "B", "G", "D", "A", "E"] as const;
// 3-char cells: single-digit "5b-", double-digit "12b"
const CELL_W = 3;
const RESOLUTION = 0.5; // 8th-note grid

const TECHNIQUE_CHAR: Record<NoteTechnique, string> = {
  bend: "b",
  hammer: "h",
  pull: "p",
  slide_up: "/",
  slide_down: "\\",
};

interface GridCell { fret: number; technique?: NoteTechnique }

function cellStr(cell: GridCell): string {
  const f = String(cell.fret);
  const t = cell.technique ? TECHNIQUE_CHAR[cell.technique] : "-";
  if (f.length >= 2) return (f + t).slice(0, CELL_W);   // "12b" or "12-"
  return f + t + "-";                                     // "5b-" or "5--"
}

function buildTabSystems(
  solo: GeneratedSolo,
  chords: string[],
  beatsPerChord: number
): string[] {
  const cellsPerBar = Math.round(beatsPerChord / RESOLUTION);
  const totalCells = Math.max(1, Math.ceil(solo.totalBeats / RESOLUTION));

  // grid[displayStringIdx 0=e…5=E][cell]
  const grid: (GridCell | null)[][] = Array(6)
    .fill(null)
    .map(() => new Array(totalCells).fill(null));

  for (const note of solo.notes) {
    const cell = Math.min(
      Math.round(note.startBeat / RESOLUTION),
      totalCells - 1
    );
    const ds = 5 - note.stringIndex;
    if (cell >= 0 && ds >= 0 && ds < 6 && grid[ds][cell] === null) {
      grid[ds][cell] = { fret: note.fret, technique: note.technique };
    }
  }

  const BARS_PER_SYSTEM = 4;
  const systems: string[] = [];

  for (
    let sysStart = 0;
    sysStart < totalCells;
    sysStart += cellsPerBar * BARS_PER_SYSTEM
  ) {
    const sysEnd = Math.min(sysStart + cellsPerBar * BARS_PER_SYSTEM, totalCells);
    const barOffset = Math.floor(sysStart / cellsPerBar);
    const numBarsInSys = Math.ceil((sysEnd - sysStart) / cellsPerBar);

    let chordLine = "   ";
    for (let b = 0; b < numBarsInSys; b++) {
      const ci = (barOffset + b) % Math.max(chords.length, 1);
      chordLine += (chords[ci] ?? "").padEnd(cellsPerBar * CELL_W, " ");
    }

    const stringLines = TAB_STRING_LABELS.map((label, si) => {
      let line = label + "|";
      for (let c = sysStart; c < sysEnd; c++) {
        if (c !== sysStart && (c - sysStart) % cellsPerBar === 0) line += "|";
        const cell = grid[si][c];
        line += cell ? cellStr(cell) : "-".repeat(CELL_W);
      }
      return line + "|";
    });

    systems.push([chordLine, ...stringLines].join("\n"));
  }

  return systems;
}

// ─── Piano roll ──────────────────────────────────────────────────────────────

function PianoRoll({
  solo,
  playheadBeat,
  chords,
}: {
  solo: GeneratedSolo;
  playheadBeat: number | null;
  chords: string[];
}) {
  const { notes, totalBeats } = solo;
  if (notes.length === 0) return null;

  const midiVals = notes.map((n) => n.midi);
  const minMidi = Math.min(...midiVals) - 1;
  const maxMidi = Math.max(...midiVals) + 2;
  const midiRange = maxMidi - minMidi;

  const VX = (beat: number) => beat * 12;
  const VY = (midi: number) => ((maxMidi - midi) / midiRange) * 60;
  const VH = 60;
  const VW = totalBeats * 12;
  const beatsPerChord = totalBeats / Math.max(chords.length, 1);

  return (
    <div className="mb-3 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${VW} ${VH + 12}`}
          preserveAspectRatio="none"
          style={{
            width: "100%",
            minWidth: Math.max(VW * 4, 300),
            height: 90,
            display: "block",
          }}
        >
          <rect x={0} y={0} width={VW} height={VH} fill="#18181b" />

          {chords.map((chord, i) => {
            const x = VX(i * beatsPerChord);
            return (
              <g key={i}>
                <line
                  x1={x} x2={x} y1={0} y2={VH}
                  stroke="#3f3f46" strokeWidth={0.6}
                />
                <text
                  x={x + 1.2} y={VH + 9}
                  fontSize={7} fill="#71717a" fontFamily="monospace"
                >
                  {chord}
                </text>
              </g>
            );
          })}

          {notes.map((note, i) => (
            <rect
              key={i}
              x={VX(note.startBeat)}
              y={VY(note.midi)}
              width={Math.max(VX(note.durationBeats) - 0.8, 1.5)}
              height={Math.max((60 / midiRange) - 0.4, 1.5)}
              fill={colorForPitchClass(note.pitchClass)}
              opacity={0.75}
              rx={0.5}
            />
          ))}

          {playheadBeat != null &&
            playheadBeat >= 0 &&
            playheadBeat <= totalBeats && (
              <line
                x1={VX(playheadBeat)} x2={VX(playheadBeat)}
                y1={0} y2={VH}
                stroke="white" strokeWidth={1.2} opacity={0.8}
              />
            )}
        </svg>
      </div>
      <p className="px-2 py-0.5 text-right text-[10px] text-zinc-600">
        Piano roll · each column = 1 chord
      </p>
    </div>
  );
}

// ─── Tab display ─────────────────────────────────────────────────────────────

function TabDisplay({
  solo,
  chords,
  beatsPerChord,
}: {
  solo: GeneratedSolo;
  chords: string[];
  beatsPerChord: number;
}) {
  const [copied, setCopied] = useState(false);
  const systems = buildTabSystems(solo, chords, beatsPerChord);

  function handleCopy() {
    const text = systems.join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  }

  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Guitar Tab
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-600">
            b=bend · h=hammer · p=pull · /=slide
          </span>
          <button
            onClick={handleCopy}
            className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-md border border-zinc-700 bg-zinc-950 p-3">
        <div className="flex flex-col gap-4">
          {systems.map((sys, i) => (
            <pre
              key={i}
              className="font-mono text-xs leading-tight text-zinc-300 selection:bg-violet-800"
            >
              {sys}
            </pre>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SoloGenerator() {
  const [chordsInput, setChordsInput] = useState("Am G F E");
  const [bpm, setBpm] = useState(100);
  const [beatsPerChord, setBeatsPerChord] = useState(4);
  const [style, setStyle] = useState<"rock" | "blues" | "jazz">("rock");
  const [loop, setLoop] = useState(false);
  const [showTab, setShowTab] = useState(true);

  const [solo, setSolo] = useState<GeneratedSolo | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentNote, setCurrentNote] = useState<SoloNote | null>(null);
  const [playheadBeat, setPlayheadBeat] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLickLibrary, setShowLickLibrary] = useState(false);
  const [activeLick, setActiveLick] = useState<GuitarLick | null>(null);

  const playerRef = useRef<SoloPlayer | null>(null);
  const loopRef = useRef(false);
  const soloRef = useRef<GeneratedSolo | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { soloRef.current = solo; }, [solo]);

  function parseChordList(input: string) {
    return input.split(/[\s,]+/).filter(Boolean);
  }

  // ── Playhead rAF ──

  function startPlayheadRaf(thisSolo: GeneratedSolo) {
    const LOOKAHEAD_MS = 120;
    const startWall = performance.now() + LOOKAHEAD_MS;

    function tick() {
      const beat = ((performance.now() - startWall) / 1000) * (thisSolo.bpm / 60);
      if (beat <= thisSolo.totalBeats + 0.1) {
        setPlayheadBeat(Math.min(beat, thisSolo.totalBeats));
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPlayheadBeat(null);
      }
    }

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopPlayheadRaf() {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setPlayheadBeat(null);
  }

  // ── Player ──

  // Kept in a ref so the onComplete closure always calls the latest version.
  const startPlayerRef = useRef<(s: GeneratedSolo) => void>(() => {});

  function startPlayerImpl(targetSolo: GeneratedSolo) {
    playerRef.current?.stop();

    const player = createSoloPlayer(targetSolo, {
      onNoteStart: (note) => setCurrentNote(note),
      onNoteEnd: () => setCurrentNote(null),
      onComplete: () => {
        if (loopRef.current && soloRef.current) {
          startPlayerRef.current(soloRef.current);
        } else {
          setPlaying(false);
          setCurrentNote(null);
          stopPlayheadRaf();
        }
      },
    });

    playerRef.current = player;
    player.start();
    startPlayheadRaf(targetSolo);
  }

  // Keep ref pointing at latest closure
  startPlayerRef.current = startPlayerImpl;

  // ── Generate ──

  const handleLickLoad = useCallback((s: GeneratedSolo, lick: GuitarLick) => {
    playerRef.current?.stop();
    stopPlayheadRaf();
    setPlaying(false);
    setCurrentNote(null);
    setSolo(s);
    setActiveLick(lick);
    setShowLickLibrary(false);
  }, []);

  const handleGenerate = useCallback(() => {
    const chords = parseChordList(chordsInput);
    if (chords.length === 0) {
      setError("Enter at least one chord (e.g. Am G F E)");
      return;
    }
    if (!chords.some((c) => parseChord(c.trim()))) {
      setError("No valid chords found. Try: Am G F E");
      return;
    }
    setError(null);
    setActiveLick(null);

    playerRef.current?.stop();
    stopPlayheadRaf();
    setPlaying(false);
    setCurrentNote(null);

    const generated = generateSolo({
      chords,
      beatsPerChord,
      bpm,
      seed: Date.now(),
      style,
    });

    if (generated.notes.length === 0) {
      setError("Could not build a solo — check chord names and try again.");
      return;
    }

    setSolo(generated);
  }, [chordsInput, bpm, beatsPerChord, style]);

  // ── Play / Stop ──

  const handlePlayStop = useCallback(() => {
    if (!solo) return;
    if (playing) {
      playerRef.current?.stop();
      stopPlayheadRaf();
      setPlaying(false);
      setCurrentNote(null);
      return;
    }
    setPlaying(true);
    startPlayerRef.current(solo);
  }, [solo, playing]);

  // Generate default solo on first mount
  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      playerRef.current?.stop();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const rootName = solo ? NOTE_NAMES[solo.scaleRoot] : null;
  const chordList = parseChordList(chordsInput);
  const boxCenter = solo ? solo.centerFret + 3 : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
      {/* ── Header ── */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Solo Generator
          </h2>
          {solo && (
            <p className="mt-0.5 text-xs text-zinc-500">
              Scale:{" "}
              <span className="text-zinc-300">
                {rootName} {solo.scaleName}
              </span>
              {" · "}
              {solo.notes.length} notes · frets {solo.centerFret}–
              {solo.centerFret + 7}
            </p>
          )}
          {activeLick && (
            <p className="mt-0.5 text-xs text-teal-500">
              Lick:{" "}
              <span className="text-teal-300">{activeLick.name}</span>
              {" — "}
              {activeLick.description}
            </p>
          )}
        </div>

        {playing && (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            {loop ? "Looping" : "Playing"}
          </span>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="mb-4 flex flex-wrap gap-3">
        {/* Chord input */}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label className="text-xs text-zinc-500">Chord progression</label>
          <input
            type="text"
            value={chordsInput}
            onChange={(e) => setChordsInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            placeholder="e.g. Am G F E"
            className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500"
          />
        </div>

        {/* BPM */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">BPM: {bpm}</label>
          <input
            type="range"
            min={60} max={200} step={5}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-28 accent-violet-500"
          />
        </div>

        {/* Beats per chord */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Beats / chord</label>
          <div className="flex gap-1">
            {BEATS_PER_CHORD_OPTIONS.map((b) => (
              <button
                key={b}
                onClick={() => setBeatsPerChord(b)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  beatsPerChord === b
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        {/* Style */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500">Style</label>
          <div className="flex gap-1">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setStyle(opt.value)}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  style === opt.value
                    ? "bg-violet-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Presets ── */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-600">Presets:</span>
        {PRESET_PROGRESSIONS.map((p) => (
          <button
            key={p.label}
            onClick={() => setChordsInput(p.value)}
            className="rounded border border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Action buttons ── */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={handleGenerate}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700 active:bg-zinc-600"
        >
          Generate new solo
        </button>
        <button
          onClick={handlePlayStop}
          disabled={!solo}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            playing
              ? "border border-red-700 bg-red-900/60 text-red-300 hover:bg-red-900"
              : "border border-violet-700 bg-violet-900/60 text-violet-300 hover:bg-violet-900"
          }`}
        >
          {playing ? "Stop" : "Play solo"}
        </button>
        <button
          onClick={() => setLoop((l) => !l)}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            loop
              ? "border-amber-600 bg-amber-900/60 text-amber-300 hover:bg-amber-900"
              : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          {loop ? "Loop: on" : "Loop: off"}
        </button>
        <button
          onClick={() => setShowTab((s) => !s)}
          className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-700"
        >
          {showTab ? "Hide tab" : "Show tab"}
        </button>
        <button
          onClick={() => setShowLickLibrary((v) => !v)}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            showLickLibrary
              ? "border-teal-600 bg-teal-900/60 text-teal-300 hover:bg-teal-900"
              : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
        >
          {showLickLibrary ? "Hide lick library" : "Lick library"}
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {showLickLibrary && (
        <div className="mb-4">
          <PhraseLibrary
            onLickLoad={handleLickLoad}
            defaultScaleRoot={solo?.scaleRoot ?? 9}
          />
        </div>
      )}

      {/* ── Note readout ── */}
      {currentNote ? (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-300">
          <span
            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ background: colorForPitchClass(currentNote.pitchClass) }}
          />
          <span className="font-semibold text-white">
            {NOTE_NAMES[currentNote.pitchClass]}
            {Math.floor(currentNote.midi / 12) - 1}
          </span>
          <span className="text-zinc-600">·</span>
          <span className="text-zinc-400">
            String {currentNote.stringIndex + 1} · Fret {currentNote.fret}
          </span>
        </div>
      ) : (
        <div className="mb-3 h-7" />
      )}

      {/* ── Piano roll ── */}
      {solo && (
        <PianoRoll
          solo={solo}
          playheadBeat={playheadBeat}
          chords={chordList}
        />
      )}

      {/* ── Guitar tab ── */}
      {solo && showTab && (
        <TabDisplay
          solo={solo}
          chords={chordList}
          beatsPerChord={beatsPerChord}
        />
      )}

      {/* ── Fretboard ── */}
      {solo && (
        <>
          <Fretboard
            numFrets={22}
            playedPitchClasses={new Set<number>()}
            scalePitchClasses={solo.scalePitchClasses}
            rootPitchClass={solo.scaleRoot}
            highlightFretPosition={
              currentNote
                ? { stringIndex: currentNote.stringIndex, fret: currentNote.fret }
                : null
            }
            boxCenterFret={boxCenter}
            boxWindow={4}
          />
          <p className="mt-2 text-xs text-zinc-600">
            Outlined = scale notes in position box · Pulsing = note being played right now
          </p>
        </>
      )}
    </div>
  );
}
