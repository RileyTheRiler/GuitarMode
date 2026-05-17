"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MicControls } from "@/components/MicControls";
import { Fretboard } from "@/components/Fretboard";
import { FretboardControls } from "@/components/FretboardControls";
import { DetectedNotes } from "@/components/DetectedNotes";
import { ScaleSuggestions } from "@/components/ScaleSuggestions";
import { ChordSuggestions } from "@/components/ChordSuggestions";
import { SessionManager, type SavedSession } from "@/components/SessionManager";
import { InputSettings } from "@/components/InputSettings";
import { Timeline } from "@/components/Timeline";
import { ChromaChart } from "@/components/ChromaChart";
import { WaveformPlayer } from "@/components/WaveformPlayer";
import { ProgressionEditor } from "@/components/ProgressionEditor";
import { Metronome } from "@/components/Metronome";
import { TimbreVisualizer } from "@/components/TimbreVisualizer";
import { useMicStream } from "@/lib/audio/useMicStream";
import { usePitchDetector, type DetectedNote } from "@/lib/audio/usePitchDetector";
import { analyzeAudioBuffer, decodeArrayBuffer } from "@/lib/audio/analyzeBuffer";
import { detectScales } from "@/lib/music/detectScale";
import { detectChords, type ChordMatch } from "@/lib/music/detectChord";
import { buildProfile, profilePitchClassSet } from "@/lib/music/profile";
import { playPluck } from "@/lib/audio/tonePlayer";
import {
  activeChordAt,
  sortProgression,
  type ChordEvent,
} from "@/lib/music/progression";
import { chordPitchClasses, parseChord } from "@/lib/music/chords";
import { TUNING_PRESETS, STANDARD_TUNING_PRESET, type TuningPreset } from "@/lib/guitar/tunings";
import { downloadMidi } from "@/lib/export/midi";
import { diatonicTriads } from "@/lib/music/diatonicChords";
import { findVoicings, type Voicing } from "@/lib/guitar/chordVoicings";
import { DiatonicChords } from "@/components/DiatonicChords";
import { TunerDisplay } from "@/components/TunerDisplay";

const NUM_FRETS = 22;
const TUNING_STORAGE_KEY = "guitarmode:tuning:v1";
const HIGH_CONTRAST_KEY = "guitarmode:high-contrast:v1";
const CAPO_KEY = "guitarmode:capo:v1";
const DEGREE_NAMES = ["1","♭2","2","♭3","3","4","♯4","5","♭6","6","♭7","7"] as const;

export default function Home() {
  const mic = useMicStream();
  const detector = usePitchDetector();

  const [analyzing, setAnalyzing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [lastAudioBuffer, setLastAudioBuffer] = useState<AudioBuffer | null>(null);

  const [tuning, setTuningState] = useState<TuningPreset>(STANDARD_TUNING_PRESET);
  const [highContrast, setHighContrastState] = useState(false);
  const [showDegrees, setShowDegrees] = useState(false);
  const [capoFret, setCapoFretState] = useState(0);
  const [selectedDiatonicDegree, setSelectedDiatonicDegree] = useState<number | null>(null);
  const [activeVoicing, setActiveVoicing] = useState<Voicing | null>(null);
  const [snappedChordMatches, setSnappedChordMatches] = useState<ChordMatch[] | null>(null);

  // Persist tuning and high-contrast selections
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(TUNING_STORAGE_KEY);
      if (saved) {
        const preset = TUNING_PRESETS.find((p) => p.id === saved);
        if (preset) setTuningState(preset);
      }
      const hc = window.localStorage.getItem(HIGH_CONTRAST_KEY);
      if (hc === "1") setHighContrastState(true);
      const capo = window.localStorage.getItem(CAPO_KEY);
      if (capo) setCapoFretState(Math.max(0, Math.min(12, Number(capo) || 0)));
    } catch {}
  }, []);

  const handleTuningChange = useCallback((preset: TuningPreset) => {
    setTuningState(preset);
    try { window.localStorage.setItem(TUNING_STORAGE_KEY, preset.id); } catch {}
  }, []);

  const handleHighContrastChange = useCallback((v: boolean) => {
    setHighContrastState(v);
    try { window.localStorage.setItem(HIGH_CONTRAST_KEY, v ? "1" : "0"); } catch {}
  }, []);

  const handleCapoChange = useCallback((n: number) => {
    setCapoFretState(n);
    try { window.localStorage.setItem(CAPO_KEY, String(n)); } catch {}
  }, []);

  const handleDiatonicSelect = useCallback((degree: number) => {
    setSelectedDiatonicDegree((prev) => (prev === degree ? null : degree));
  }, []);

  // Mirror mic errors into appError so the most recent error wins over a stale one.
  useEffect(() => {
    if (mic.error) setAppError(mic.error);
  }, [mic.error]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const recordingGenRef = useRef(0);

  const [boxOn, setBoxOn] = useState(false);
  const [boxCenterFret, setBoxCenterFret] = useState(7);
  const [boxWindow, setBoxWindow] = useState(5);

  const [progression, setProgressionState] = useState<ChordEvent[]>([]);
  const [currentChord, setCurrentChord] = useState<ChordEvent | null>(null);

  const setProgression = useCallback((next: ChordEvent[]) => {
    const sorted = sortProgression(next);
    setProgressionState(sorted);
    setCurrentChord(null);
  }, []);

  const chordInfo = useMemo(() => {
    if (!currentChord) return null;
    const parsed = parseChord(currentChord.chord);
    return parsed ? chordPitchClasses(parsed.root, parsed.quality) : null;
  }, [currentChord]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const profile = useMemo(
    () => buildProfile(detector.notes, detector.chromaProfile, 1),
    [detector.notes, detector.chromaProfile]
  );
  const playedPitchClasses = useMemo(() => profilePitchClassSet(profile), [profile]);
  const matches = useMemo(() => detectScales(profile, 5), [profile]);
  const chordMatches = useMemo(() => detectChords(profile, 4), [profile]);

  useEffect(() => {
    if (matches.length === 0) setSelectedIndex(null);
    else if (selectedIndex == null || selectedIndex >= matches.length) setSelectedIndex(0);
  }, [matches, selectedIndex]);

  const selected = selectedIndex != null ? matches[selectedIndex] ?? null : null;

  const handleToggleMic = useCallback(async () => {
    if (detector.active) {
      detector.stop();
      mic.stop();
      return;
    }
    setAppError(null);
    try {
      const stream = await mic.start(mic.currentDeviceId);
      await detector.start(stream);
    } catch (e) {
      if (mic.streamRef.current) {
        setAppError(e instanceof Error ? e.message : "Could not start analysis");
      }
    }
  }, [detector, mic]);

  const handleDeviceChange = useCallback(
    async (id: string) => {
      const nextId = id === "" ? null : id;
      const wasActive = detector.active;
      if (wasActive) {
        detector.stop();
      }
      setAppError(null);
      try {
        const stream = await mic.start(nextId);
        if (wasActive) await detector.start(stream);
      } catch (e) {
        if (mic.streamRef.current) {
          setAppError(e instanceof Error ? e.message : "Could not switch input");
        }
      }
    },
    [detector, mic]
  );

  const handleReset = useCallback(() => {
    detector.reset();
    setSelectedIndex(null);
    setAppError(null);
    setLastAudioBuffer(null);
  }, [detector]);

  const handleUpload = useCallback(
    async (file: File) => {
      setAppError(null);
      if (detector.active) detector.stop();
      setAnalyzing(true);
      try {
        const arr = await file.arrayBuffer();
        const buffer = await decodeArrayBuffer(arr);
        const result = await analyzeAudioBuffer(buffer, {
          a4Hz: detector.config.a4Hz,
          polyphonic: detector.config.polyphonic,
          minClarity: detector.config.minClarity,
          minRms: detector.config.minRms,
          highPass: detector.config.highPass,
          highPassHz: detector.config.highPassHz,
        });
        if (!mountedRef.current) return;
        detector.reset();
        detector.addNotes(result.notes);
        if (result.chroma.some((v) => v > 0)) detector.addChroma(result.chroma);
        setLastAudioBuffer(buffer);
      } catch (e) {
        if (!mountedRef.current) return;
        setAppError(e instanceof Error ? e.message : "Could not analyze file");
      } finally {
        if (mountedRef.current) setAnalyzing(false);
      }
    },
    [detector]
  );

  const handleStartRecording = useCallback(async () => {
    setAppError(null);
    if (detector.active) detector.stop();
    const gen = ++recordingGenRef.current;
    const cfgSnapshot = {
      a4Hz: detector.config.a4Hz,
      polyphonic: detector.config.polyphonic,
      minClarity: detector.config.minClarity,
      minRms: detector.config.minRms,
      highPass: detector.config.highPass,
      highPassHz: detector.config.highPassHz,
    };
    try {
      const stream = mic.streamRef.current ?? (await mic.start(mic.currentDeviceId));
      const recorder = new MediaRecorder(stream);
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: "audio/webm" });
        recordedChunksRef.current = [];
        if (mountedRef.current) setAnalyzing(true);
        try {
          const arr = await blob.arrayBuffer();
          const buffer = await decodeArrayBuffer(arr);
          const result = await analyzeAudioBuffer(buffer, cfgSnapshot);
          if (!mountedRef.current || gen !== recordingGenRef.current) return;
          const newNotes: DetectedNote[] = result.notes;
          detector.reset();
          detector.addNotes(newNotes);
          if (result.chroma.some((v) => v > 0)) detector.addChroma(result.chroma);
          setLastAudioBuffer(buffer);
        } catch (e) {
          if (!mountedRef.current || gen !== recordingGenRef.current) return;
          setAppError(e instanceof Error ? e.message : "Could not analyze recording");
        } finally {
          if (mountedRef.current && gen === recordingGenRef.current) setAnalyzing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (e) {
      setAppError(e instanceof Error ? e.message : "Recording failed");
    }
  }, [detector, mic]);

  const handleStopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  const handleExportMidi = useCallback(() => {
    downloadMidi(detector.notes);
  }, [detector.notes]);

  const handleSnapChord = useCallback(() => {
    setSnappedChordMatches((prev) => (prev ? null : chordMatches));
  }, [chordMatches]);

  const handleRestoreSession = useCallback((session: SavedSession) => {
    detector.reset();
    detector.addNotes(session.notes);
    if (session.chromaProfile.some((v) => v > 0)) detector.addChroma(session.chromaProfile);
    setSnappedChordMatches(null);
    setSelectedDiatonicDegree(null);
    setActiveVoicing(null);
  }, [detector]);

  const scaleSet = useMemo(
    () => (selected ? new Set(selected.scale) : undefined),
    [selected]
  );

  const degreeMap = useMemo(() => {
    if (!selected) return undefined;
    const map = new Map<number, string>();
    for (const interval of selected.template.intervals) {
      const pc = (selected.root + interval) % 12;
      map.set(pc, DEGREE_NAMES[interval] ?? String(interval));
    }
    return map;
  }, [selected]);

  const diatonicChordList = useMemo(
    () => (selected ? diatonicTriads(selected.template, selected.root) : []),
    [selected]
  );

  useEffect(() => {
    if (selectedDiatonicDegree == null) {
      setActiveVoicing(null);
      return;
    }
    const triad = diatonicChordList[selectedDiatonicDegree];
    if (!triad) { setActiveVoicing(null); return; }
    const voicings = findVoicings(triad.root, triad.quality, tuning.midi);
    setActiveVoicing(voicings[0] ?? null);
  }, [selectedDiatonicDegree, diatonicChordList, tuning.midi]);

  const handleFretClick = useCallback(
    (_s: number, _f: number, midi: number) => {
      playPluck(midi, detector.config.a4Hz);
    },
    [detector.config.a4Hz]
  );

  // Keyboard shortcuts: Space = mic, Escape = reset, R = record
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      // Don't intercept when typing in an input, textarea, or select
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        handleToggleMic();
      } else if (e.key === "Escape") {
        handleReset();
      } else if (e.key === "r" || e.key === "R") {
        if (recording) handleStopRecording();
        else if (detector.active || mic.streamRef.current) handleStartRecording();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleToggleMic, handleReset, handleStartRecording, handleStopRecording, recording, detector.active, mic.streamRef]);

  const hasChroma = detector.chromaProfile.some((v) => v > 0);

  return (
    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-8">
      <header className="mb-4 sm:mb-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">GuitarMode</h1>
        <p className="text-sm text-zinc-400">
          Play your guitar. I&rsquo;ll name the notes, guess the scale, and show you what&rsquo;s
          next on the fretboard.
        </p>
      </header>

      <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
        <MicControls
          micOn={detector.active}
          onToggleMic={handleToggleMic}
          onReset={handleReset}
          onUpload={handleUpload}
          onStartRecording={handleStartRecording}
          onStopRecording={handleStopRecording}
          onExportMidi={handleExportMidi}
          recording={recording}
          analyzing={analyzing}
          level={detector.level}
          error={appError}
          hasNotes={detector.notes.length > 0}
        />
      </section>

      <section className="mb-4 sm:mb-6">
        <SessionManager
          notes={detector.notes}
          chromaProfile={detector.chromaProfile}
          onRestore={handleRestoreSession}
        />
      </section>

      {detector.currentNote && (
        <section className="mb-4 sm:mb-6">
          <TunerDisplay
            frequency={detector.currentNote.frequency}
            a4Hz={detector.config.a4Hz}
          />
        </section>
      )}

      <section className="mb-4 sm:mb-6">
        <InputSettings
          config={detector.config}
          onChange={detector.setConfig}
          devices={mic.devices}
          currentDeviceId={mic.currentDeviceId}
          onDeviceChange={handleDeviceChange}
          micOn={detector.active}
          tuning={tuning}
          onTuningChange={handleTuningChange}
          highContrast={highContrast}
          onHighContrastChange={handleHighContrastChange}
        />
      </section>

      <section className="mb-4 grid gap-4 sm:mb-6 sm:gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Detected notes
            </h2>
            {detector.currentNote && (
              <span className="flex items-center gap-1.5 text-xs text-zinc-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                {detector.currentNote.noteName}
              </span>
            )}
          </div>
          <DetectedNotes notes={detector.notes} onDelete={detector.deleteNote} />
          {lastAudioBuffer && (
            <WaveformPlayer
              audioBuffer={lastAudioBuffer}
              onTimeUpdate={(t) => setCurrentChord(activeChordAt(progression, t))}
            />
          )}
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Scale &amp; mode suggestions
          </h2>
          <ScaleSuggestions
            matches={matches}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            detectedCount={playedPitchClasses.size}
          />
          {detector.notes.length >= 2 && (
            <ChordSuggestions
              matches={snappedChordMatches ?? chordMatches}
              onSnap={handleSnapChord}
              snapped={snappedChordMatches !== null}
            />
          )}
          {diatonicChordList.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                Diatonic chords
              </h3>
              <DiatonicChords
                triads={diatonicChordList}
                scaleName={`${selected!.rootName} ${selected!.templateName}`}
                selectedDegree={selectedDiatonicDegree}
                onSelect={handleDiatonicSelect}
              />
            </div>
          )}
          {hasChroma && (
            <div className="mt-4">
              <ChromaChart chroma={detector.chromaProfile} />
            </div>
          )}
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Timbre (harmonic envelope)
            </h3>
            <TimbreVisualizer
              harmonics={detector.harmonics}
              currentPitchClass={detector.currentNote?.pitchClass ?? null}
              polyphonicEnabled={detector.config.polyphonic}
            />
          </div>
        </div>
      </section>

      <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:mb-6 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Timeline
          </h2>
          <p className="text-xs text-zinc-500">
            Height = pitch, width = how long you held the note.
          </p>
        </div>
        <Timeline notes={detector.notes} />
      </section>

      <section className="mb-4 sm:mb-6">
        <Metronome />
      </section>

      <section className="mb-4 sm:mb-6">
        <ProgressionEditor
          progression={progression}
          onChange={setProgression}
          currentChord={currentChord?.chord ?? null}
        />
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
            Fretboard
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <FretboardControls
              boxOn={boxOn}
              boxCenterFret={boxCenterFret}
              boxWindow={boxWindow}
              onBoxOnChange={setBoxOn}
              onCenterChange={setBoxCenterFret}
              onWindowChange={setBoxWindow}
              numFrets={NUM_FRETS}
              capo={capoFret}
              onCapoChange={handleCapoChange}
            />
            {selected && (
              <button
                type="button"
                onClick={() => setShowDegrees((v) => !v)}
                aria-pressed={showDegrees}
                title="Toggle between note names and scale degrees"
                className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                  showDegrees
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500"
                }`}
              >
                {showDegrees ? "Degrees" : "Notes"}
              </button>
            )}
          </div>
        </div>
        <Fretboard
          numFrets={NUM_FRETS}
          tuning={tuning.midi}
          stringLabels={tuning.stringLabels}
          highContrast={highContrast}
          showDegrees={showDegrees}
          degreeMap={degreeMap}
          capo={capoFret}
          voicingPositions={activeVoicing ?? undefined}
          playedPitchClasses={playedPitchClasses}
          scalePitchClasses={scaleSet}
          rootPitchClass={selected?.root ?? null}
          currentPitchClass={detector.currentNote?.pitchClass ?? null}
          chordPitchClasses={chordInfo?.all}
          chordRootPitchClass={chordInfo?.root ?? null}
          chordThirdPitchClass={chordInfo?.third ?? null}
          chordFifthPitchClass={chordInfo?.fifth ?? null}
          boxCenterFret={boxOn ? boxCenterFret : null}
          boxWindow={boxWindow}
          onFretClick={handleFretClick}
        />
        <p className="mt-3 text-xs text-zinc-500">
          Solid circles = notes you played. Outlined circles = other notes in the selected scale.
          Pulsing = currently playing. Click any fret to audition it.
        </p>
      </section>

      <footer className="mt-8 text-xs text-zinc-500">
        Clean tone works best. Mic access requires HTTPS (Vercel provides it automatically; localhost works for dev).
        Keyboard shortcuts: <kbd className="rounded bg-zinc-800 px-1">Space</kbd> mic &middot;{" "}
        <kbd className="rounded bg-zinc-800 px-1">R</kbd> record &middot;{" "}
        <kbd className="rounded bg-zinc-800 px-1">Esc</kbd> reset
      </footer>
    </main>
  );
}
