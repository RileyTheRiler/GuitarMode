"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fretboard } from "./Fretboard";
import { generateSolo, type GeneratedSolo, type SoloNote } from "@/lib/music/soloGenerator";
import { createSoloPlayer, type SoloPlayer } from "@/lib/audio/soloPlayer";
import { NOTE_NAMES } from "@/lib/music/notes";

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

export function SoloGenerator() {
  const [chordsInput, setChordsInput] = useState("Am G F E");
  const [bpm, setBpm] = useState(100);
  const [style, setStyle] = useState<"rock" | "blues" | "jazz">("rock");
  const [solo, setSolo] = useState<GeneratedSolo | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentNote, setCurrentNote] = useState<SoloNote | null>(null);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<SoloPlayer | null>(null);

  function parseChordList(input: string) {
    return input.split(/[\s,]+/).filter(Boolean);
  }

  const handleGenerate = useCallback(() => {
    const chords = parseChordList(chordsInput);
    if (chords.length === 0) {
      setError("Enter at least one chord (e.g. Am G F E)");
      return;
    }
    setError(null);

    // Stop any current playback before replacing the solo
    playerRef.current?.stop();
    setPlaying(false);
    setCurrentNote(null);

    const generated = generateSolo({ chords, beatsPerChord: 4, bpm, seed: Date.now(), style });

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
      setPlaying(false);
      setCurrentNote(null);
      return;
    }

    const player = createSoloPlayer(solo, {
      onNoteStart: (note) => setCurrentNote(note),
      onNoteEnd: () => setCurrentNote(null),
      onComplete: () => {
        setPlaying(false);
        setCurrentNote(null);
      },
    });
    playerRef.current = player;
    player.start();
    setPlaying(true);
  }, [solo, playing]);

  // Generate a default solo on first mount
  useEffect(() => {
    handleGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => { playerRef.current?.stop(); };
  }, []);

  const rootName = solo ? NOTE_NAMES[solo.scaleRoot] : null;

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
              Scale: <span className="text-zinc-300">{rootName} {solo.scaleName}</span>
              {" · "}{solo.notes.length} notes
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {playing && (
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              Playing
            </span>
          )}
        </div>
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
      <div className="mb-4 flex flex-wrap gap-1.5">
        <span className="self-center text-xs text-zinc-600">Presets:</span>
        {PRESET_PROGRESSIONS.map((p) => (
          <button
            key={p.label}
            onClick={() => setChordsInput(p.value)}
            className="rounded border border-zinc-700 bg-zinc-800/50 px-2 py-0.5 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200 transition-colors"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="mb-4 flex gap-2">
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
      </div>

      {error && (
        <p className="mb-3 rounded-md border border-red-800 bg-red-950/50 px-3 py-2 text-xs text-red-400">
          {error}
        </p>
      )}

      {/* Currently playing note info */}
      {currentNote && (
        <div className="mb-3 flex items-center gap-2 rounded-md bg-zinc-800/60 px-3 py-1.5 text-xs text-zinc-300">
          <span className="font-semibold text-violet-400">
            {NOTE_NAMES[currentNote.pitchClass]}{Math.floor(currentNote.midi / 12) - 1}
          </span>
          <span className="text-zinc-500">·</span>
          <span>String {currentNote.stringIndex + 1} · Fret {currentNote.fret}</span>
        </div>
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
            boxCenterFret={solo.centerFret}
            boxWindow={5}
          />
          <p className="mt-2 text-xs text-zinc-600">
            Outlined = scale notes in position. Pulsing = note being played right now.
          </p>
        </>
      )}
    </div>
  );
}
