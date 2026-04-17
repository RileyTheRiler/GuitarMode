"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MicControls } from "@/components/MicControls";
import { Fretboard } from "@/components/Fretboard";
import { DetectedNotes } from "@/components/DetectedNotes";
import { ScaleSuggestions } from "@/components/ScaleSuggestions";
import { useMicStream } from "@/lib/audio/useMicStream";
import { usePitchDetector, type DetectedNote } from "@/lib/audio/usePitchDetector";
import { analyzeAudioBuffer, decodeArrayBuffer } from "@/lib/audio/analyzeBuffer";
import { detectScales } from "@/lib/music/detectScale";

export default function Home() {
  const mic = useMicStream();
  const detector = usePitchDetector();

  const [analyzing, setAnalyzing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const playedPitchClasses = useMemo(() => {
    const s = new Set<number>();
    for (const n of detector.notes) s.add(n.pitchClass);
    return s;
  }, [detector.notes]);

  const matches = useMemo(() => detectScales(playedPitchClasses, 5), [playedPitchClasses]);

  // Reset the selected scale when matches change shape significantly.
  useEffect(() => {
    if (matches.length === 0) {
      setSelectedIndex(null);
    } else if (selectedIndex == null || selectedIndex >= matches.length) {
      setSelectedIndex(0);
    }
  }, [matches, selectedIndex]);

  const selected = selectedIndex != null ? matches[selectedIndex] ?? null : null;

  const handleToggleMic = useCallback(async () => {
    if (detector.active) {
      detector.stop();
      mic.stop();
      return;
    }
    try {
      const stream = await mic.start();
      await detector.start(stream);
    } catch {
      /* error already surfaced via mic.error */
    }
  }, [detector, mic]);

  const handleReset = useCallback(() => {
    detector.reset();
    setSelectedIndex(null);
    setFileError(null);
  }, [detector]);

  const handleUpload = useCallback(
    async (file: File) => {
      setFileError(null);
      setAnalyzing(true);
      try {
        const arr = await file.arrayBuffer();
        const buffer = await decodeArrayBuffer(arr);
        const notes = await analyzeAudioBuffer(buffer);
        detector.reset();
        detector.addNotes(notes);
      } catch (e) {
        setFileError(e instanceof Error ? e.message : "Could not analyze file");
      } finally {
        setAnalyzing(false);
      }
    },
    [detector]
  );

  const handleStartRecording = useCallback(async () => {
    setFileError(null);
    try {
      const stream = mic.streamRef.current ?? (await mic.start());
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        recordedChunksRef.current = [];
        setAnalyzing(true);
        try {
          const arr = await blob.arrayBuffer();
          const buffer = await decodeArrayBuffer(arr);
          const notes: DetectedNote[] = await analyzeAudioBuffer(buffer);
          detector.reset();
          detector.addNotes(notes);
        } catch (e) {
          setFileError(e instanceof Error ? e.message : "Could not analyze recording");
        } finally {
          setAnalyzing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "Recording failed");
    }
  }, [detector, mic]);

  const handleStopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  const scaleSet = useMemo(
    () => (selected ? new Set(selected.scale) : undefined),
    [selected]
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">GuitarMode</h1>
        <p className="text-sm text-zinc-400">
          Play your guitar. I&rsquo;ll name the notes, guess the scale, and show you what&rsquo;s next on the fretboard.
        </p>
      </header>

      <section className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <MicControls
          micOn={detector.active}
          onToggleMic={handleToggleMic}
          onReset={handleReset}
          onUpload={handleUpload}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          recording={recording}
          analyzing={analyzing}
          level={detector.level}
          error={mic.error ?? fileError}
        />
      </section>

      <section className="mb-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Detected notes
          </h2>
          <DetectedNotes notes={detector.notes} />
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Scale &amp; mode suggestions
          </h2>
          <ScaleSuggestions
            matches={matches}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            detectedCount={playedPitchClasses.size}
          />
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Fretboard
        </h2>
        <Fretboard
          playedPitchClasses={playedPitchClasses}
          scalePitchClasses={scaleSet}
          rootPitchClass={selected?.root ?? null}
        />
        <p className="mt-3 text-xs text-zinc-500">
          Solid circles = notes you played. Outlined circles = other notes in the selected scale.
          The thicker ring marks the scale&rsquo;s root.
        </p>
      </section>

      <footer className="mt-8 text-xs text-zinc-500">
        Clean tone works best. Mic access requires HTTPS (Vercel provides it automatically, and localhost works for dev).
      </footer>
    </main>
  );
}
