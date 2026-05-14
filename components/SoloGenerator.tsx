"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fretboard } from "./Fretboard";
import { generateSolo, type GeneratedSolo, type SoloNote } from "@/lib/music/soloGenerator";
import { createSoloPlayer, type SoloPlayer } from "@/lib/audio/soloPlayer";
import { NOTE_NAMES, colorForPitchClass } from "@/lib/music/notes";
import { parseChord } from "@/lib/music/chords";

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

  const midiValues = notes.map((n) => n.midi);
  const minMidi = Math.min(...midiValues) - 1;
  const maxMidi = Math.max(...midiValues) + 2;
  const midiRange = maxMidi - minMidi;

  // viewBox units: x = beats×12, y = semitones from bottom
  const VX = (beat: number) => beat * 12;
  const VY = (midi: number) => (maxMidi - midi) * (60 / midiRange);
  const VH = 60; // total viewBox height in semitone-units
  const VW = totalBeats * 12;

  const beatsPerChord = totalBeats / Math.max(chords.length, 1);

  return (
    <div className="mb-3 overflow-hidden rounded-md border border-zinc-700 bg-zinc-900">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${VW} ${VH + 12}`}
          preserveAspectRatio="none"
          style={{ width: "100%", minWidth: Math.max(VW * 4, 300), height: 90, display: "block" }}
        >
          {/* Background */}
          <rect x={0} y={0} width={VW} height={VH} fill="#18181b" />

          {/* Chord boundary lines + labels */}
          {chords.map((chord, i) => {
            const x = VX(i * beatsPerChord);
            return (
              <g key={i}>
                <line
                  x1={x}
                  x2={x}
                  y1={0}
                  y2={VH}
                  stroke="#3f3f46"
                  strokeWidth={0.6}
                />
                <text
                  x={x + 1.2}
                  y={VH + 9}
                  fontSize={7}
                  fill="#71717a"
                  fontFamily="monospace"
                >
                  {chord}
                </text>
              </g>
            );
          })}

          {/* Notes */}
          {notes.map((note, i) => {
            const x = VX(note.startBeat);
            const y = VY(note.midi);
            const w = Math.max(VX(note.durationBeats) - 0.8, 1.5);
            const h = Math.max(VH / midiRange - 0.4, 1.5);
            const color = colorForPitchClass(note.pitchClass);
            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={w}
                height={h}
                fill={color}
                opacity={0.75}
                rx={0.5}
              />
            );
          })}

          {/* Playhead */}
          {playheadBeat != null && playheadBeat >= 0 && playheadBeat <= totalBeats && (
            <line
              x1={VX(playheadBeat)}
              x2={VX(playheadBeat)}
              y1={0}
              y2={VH}
              stroke="white"
              strokeWidth={1.2}
              opacity={0.8}
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

// ─── Main component ───────────────────────────────────────────────────────────

export function SoloGenerator() {
  const [chordsInput, setChordsInput] = useState("Am G F E");
  const [bpm, setBpm] = useState(100);
  const [style, setStyle] = useState<"rock" | "blues" | "jazz">("rock");
  const [loop, setLoop] = useState(false);
  const [solo, setSolo] = useState<GeneratedSolo | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentNote, setCurrentNote] = useState<SoloNote | null>(null);
  const [playheadBeat, setPlayheadBeat] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<SoloPlayer | null>(null);
  const loopRef = useRef(false);
  const soloRef = useRef<GeneratedSolo | null>(null);
  const playStartWallRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Keep refs in sync with state
  useEffect(() => { loopRef.current = loop; }, [loop]);
  useEffect(() => { soloRef.current = solo; }, [solo]);

  function parseChordList(input: string) {
    return input.split(/[\s,]+/).filter(Boolean);
  }

  // Animated playhead via rAF
  function startPlayheadRaf(thisSolo: GeneratedSolo) {
    const LOOKAHEAD_MS = 120; // must match soloPlayer.ts LOOKAHEAD_S × 1000
    const startWall = performance.now() + LOOKAHEAD_MS;

    function tick() {
      const elapsed = (performance.now() - startWall) / 1000; // seconds
      const beat = elapsed * (thisSolo.bpm / 60);
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

  // Start the player (called on Play and on each loop iteration)
  const startPlayer = useCallback((targetSolo: GeneratedSolo) => {
    playerRef.current?.stop();

    const player = createSoloPlayer(targetSolo, {
      onNoteStart: (note) => setCurrentNote(note),
      onNoteEnd: () => setCurrentNote(null),
      onComplete: () => {
        if (loopRef.current && soloRef.current) {
          startPlayer(soloRef.current);
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = useCallback(() => {
    const chords = parseChordList(chordsInput);
    if (chords.length === 0) {
      setError("Enter at least one chord (e.g. Am G F E)");
      return;
    }
    // Validate at least one chord is parseable
    if (!chords.some((c) => parseChord(c.trim()))) {
      setError("No valid chords found. Try: Am G F E");
      return;
    }
    setError(null);

    playerRef.current?.stop();
    stopPlayheadRaf();
    setPlaying(false);
    setCurrentNote(null);

    const generated = generateSolo({
      chords,
      beatsPerChord: 4,
      bpm,
      seed: Date.now(),
      style,
    });

    if (generated.notes.length === 0) {
      setError("Could not build a solo — check chord names and try again.");
      return;
    }

    setSolo(generated);
  }, [chordsInput, bpm, style]);

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
    startPlayer(solo);
  }, [solo, playing, startPlayer]);

  // Generate default solo on first mount
  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      playerRef.current?.stop();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const rootName = solo ? NOTE_NAMES[solo.scaleRoot] : null;
  const chordList = parseChordList(chordsInput);

  // Box covers [centerFret, centerFret+7]: center at +3, window=4 → [−1, +7]
  const boxCenter = solo ? solo.centerFret + 3 : null;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
      {/* Header */}
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
        </div>

        {/* Live indicator */}
        {playing && (
          <span className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            {loopRef.current ? "Looping" : "Playing"}
          </span>
        )}
      </div>

      {/* Controls row */}
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
            min={60}
            max={200}
            step={5}
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-28 accent-violet-500"
          />
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

      {/* Preset progressions */}
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

      {/* Action buttons */}
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

        {/* Loop toggle */}
        <button
          onClick={() => setLoop((l) => !l)}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            loop
              ? "border-amber-600 bg-amber-900/60 text-amber-300 hover:bg-amber-900"
              : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
          }`}
          title="Loop solo"
        >
          {loop ? "Loop: on" : "Loop: off"}
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {/* Currently playing note info */}
      {currentNote ? (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-300">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
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
        <div className="mb-3 h-7" /> /* placeholder to avoid layout shift */
      )}

      {/* Piano roll */}
      {solo && (
        <PianoRoll
          solo={solo}
          playheadBeat={playheadBeat}
          chords={chordList}
        />
      )}

      {/* Fretboard visualization */}
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
            Outlined = scale notes in position box. Pulsing dot = note being played right now.
          </p>
        </>
      )}
    </div>
  );
}
