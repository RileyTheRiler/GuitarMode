"use client";

import { useCallback, useRef, useState } from "react";
import { colorForPitchClass, midiToPitchClass, NOTE_NAMES } from "@/lib/music/notes";
import { analyzeAudioBuffer, decodeArrayBuffer } from "@/lib/audio/analyzeBuffer";
import type { GenerateRiffRequest, GenerateRiffResponse } from "@/app/api/generate-riff/route";

const KEY_ROOTS = NOTE_NAMES as readonly string[];
const SECTIONS = ["verse", "chorus", "solo", "bridge"] as const;

type Section = (typeof SECTIONS)[number];

function noteNameToMidi(name: string): number | null {
  const m = name.match(/^([A-G]#?)(-?\d+)$/);
  if (!m) return null;
  const pc = NOTE_NAMES.indexOf(m[1] as (typeof NOTE_NAMES)[number]);
  if (pc < 0) return null;
  const octave = parseInt(m[2], 10);
  return (octave + 1) * 12 + pc;
}

function transposeToGuitarRange(notes: string[]): string[] {
  const midis = notes.map(noteNameToMidi).filter((m): m is number => m !== null);
  if (midis.length === 0) return notes;
  const maxMidi = Math.max(...midis);
  // Guitar range tops out around E5 = MIDI 76; shift down by octaves
  let shift = 0;
  while (maxMidi + shift > 76) shift -= 12;
  while (maxMidi + shift < 40) shift += 12;
  return notes.map((n) => {
    const midi = noteNameToMidi(n);
    if (midi == null) return n;
    const shifted = midi + shift;
    const pc = ((shifted % 12) + 12) % 12;
    const octave = Math.floor(shifted / 12) - 1;
    return `${NOTE_NAMES[pc]}${octave}`;
  });
}

type Props = {
  onRiffNotes: (pitchClasses: Set<number>, root: number | null) => void;
};

export function RiffGenerator({ onRiffNotes }: Props) {
  const [song, setSong] = useState("");
  const [artist, setArtist] = useState("");
  const [keyRoot, setKeyRoot] = useState("A");
  const [keyQuality, setKeyQuality] = useState<"major" | "minor">("minor");
  const [bpm, setBpm] = useState("");
  const [chords, setChords] = useState("");
  const [section, setSection] = useState<Section>("solo");

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateRiffResponse | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const [humRecording, setHumRecording] = useState(false);
  const [humAnalyzing, setHumAnalyzing] = useState(false);
  const [humNotes, setHumNotes] = useState<string[]>([]);
  const [humError, setHumError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const handleStartHum = useCallback(async () => {
    setHumError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];
        setHumAnalyzing(true);
        try {
          const arr = await blob.arrayBuffer();
          const buffer = await decodeArrayBuffer(arr);
          const res = await analyzeAudioBuffer(buffer, {
            minFreq: 80,
            maxFreq: 800,
            minClarity: 0.85,
          });
          const raw = res.notes.map((n) => n.noteName);
          // Deduplicate consecutive repeated notes
          const deduped = raw.filter((n, i) => i === 0 || n !== raw[i - 1]);
          const transposed = transposeToGuitarRange(deduped);
          setHumNotes(transposed);
        } catch (e) {
          setHumError(e instanceof Error ? e.message : "Could not analyze recording");
        } finally {
          setHumAnalyzing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setHumRecording(true);
    } catch (e) {
      setHumError(e instanceof Error ? e.message : "Mic access denied");
    }
  }, []);

  const handleStopHum = useCallback(() => {
    const r = mediaRecorderRef.current;
    if (r && r.state !== "inactive") r.stop();
    mediaRecorderRef.current = null;
    setHumRecording(false);
  }, []);

  const handleGenerate = useCallback(async () => {
    setApiError(null);
    setLoading(true);
    setResult(null);
    try {
      const body: GenerateRiffRequest = {
        song,
        artist,
        key: `${keyRoot} ${keyQuality}`,
        bpm: bpm ? parseInt(bpm, 10) : undefined,
        chords,
        section,
        hummedNotes: humNotes.length > 0 ? humNotes : undefined,
      };
      const res = await fetch("/api/generate-riff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }
      const data: GenerateRiffResponse = await res.json();
      setResult(data);

      // Light up fretboard with the suggested note pitch classes
      const pcs = new Set<number>();
      for (const note of data.riffNotes) {
        const midi = noteNameToMidi(note);
        if (midi != null) pcs.add(midiToPitchClass(midi));
      }
      const rootNote = data.riffNotes[0];
      const rootMidi = rootNote ? noteNameToMidi(rootNote) : null;
      const rootPc = rootMidi != null ? midiToPitchClass(rootMidi) : null;
      onRiffNotes(pcs, rootPc);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [song, artist, keyRoot, keyQuality, bpm, chords, section, humNotes, onRiffNotes]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Riff Generator
      </h2>

      {/* Song context form */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Song title</label>
          <input
            type="text"
            value={song}
            onChange={(e) => setSong(e.target.value)}
            placeholder="Smoke on the Water"
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Artist</label>
          <input
            type="text"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="Deep Purple"
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Key</label>
          <div className="flex gap-2">
            <select
              value={keyRoot}
              onChange={(e) => setKeyRoot(e.target.value)}
              className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            >
              {KEY_ROOTS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <select
              value={keyQuality}
              onChange={(e) => setKeyQuality(e.target.value as "major" | "minor")}
              className="rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-zinc-500"
            >
              <option value="major">Major</option>
              <option value="minor">Minor</option>
            </select>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">BPM (optional)</label>
          <input
            type="number"
            value={bpm}
            onChange={(e) => setBpm(e.target.value)}
            placeholder="120"
            min={40}
            max={300}
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs text-zinc-400">Chord progression</label>
          <input
            type="text"
            value={chords}
            onChange={(e) => setChords(e.target.value)}
            placeholder="Am - F - C - G"
            className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Section</label>
          <div className="flex flex-wrap gap-1.5">
            {SECTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSection(s)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition ${
                  section === s
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hum recording */}
      <div className="mb-4 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
        <p className="mb-2 text-xs font-medium text-zinc-300">
          Hum your idea (optional)
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={humRecording ? handleStopHum : handleStartHum}
            disabled={humAnalyzing}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              humRecording
                ? "bg-rose-600 text-white hover:bg-rose-500"
                : "bg-zinc-700 text-zinc-100 hover:bg-zinc-600"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {humRecording ? "Stop recording" : "Record my idea"}
          </button>
          {humNotes.length > 0 && (
            <button
              type="button"
              onClick={() => setHumNotes([])}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              Clear
            </button>
          )}
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          {humRecording && <span className="text-rose-400">● Recording… hum or sing your melody</span>}
          {humAnalyzing && !humRecording && <span>Detecting notes…</span>}
          {humError && <span className="text-rose-400">{humError}</span>}
        </div>
        {humNotes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {humNotes.map((n, i) => {
              const midi = noteNameToMidi(n);
              const color = midi != null ? colorForPitchClass(midiToPitchClass(midi)) : "#888";
              return (
                <span
                  key={i}
                  className="rounded px-1.5 py-0.5 text-xs font-mono font-medium text-zinc-900"
                  style={{ backgroundColor: color }}
                >
                  {n}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || !song}
        className="mb-4 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate riff"}
      </button>

      {apiError && (
        <p className="mb-3 text-xs text-rose-400">{apiError}</p>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4 border-t border-zinc-700 pt-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
              Suggested scale
            </p>
            <p className="text-sm text-zinc-200">{result.scale}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
              Description
            </p>
            <p className="text-sm text-zinc-300 leading-relaxed">{result.description}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
              Note sequence
            </p>
            <div className="flex flex-wrap gap-1.5">
              {result.riffNotes.map((n, i) => {
                const midi = noteNameToMidi(n);
                const color = midi != null ? colorForPitchClass(midiToPitchClass(midi)) : "#888";
                return (
                  <span
                    key={i}
                    className="rounded px-2 py-0.5 text-xs font-mono font-semibold text-zinc-900"
                    style={{ backgroundColor: color }}
                  >
                    {n}
                  </span>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">
              Tablature
            </p>
            <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs leading-relaxed text-green-400 font-mono">
              {result.tablature}
            </pre>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-1">
              Playing tips
            </p>
            <p className="text-sm text-zinc-300 leading-relaxed">{result.tips}</p>
          </div>
        </div>
      )}
    </div>
  );
}
