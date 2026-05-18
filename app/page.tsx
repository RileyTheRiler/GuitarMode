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
import { Tuner } from "@/components/Tuner";
import { SoloGenerator } from "@/components/SoloGenerator";
import { RiffGenerator } from "@/components/RiffGenerator";
import { SoloGuide } from "@/components/SoloGuide";
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
import { DEFAULT_TUNING_ID, getTuning } from "@/lib/guitar/tunings";
import { downloadMidi } from "@/lib/export/midi";
import { diatonicTriads } from "@/lib/music/diatonicChords";
import { findVoicings, type Voicing } from "@/lib/guitar/chordVoicings";
import { DiatonicChords } from "@/components/DiatonicChords";
import { SCALE_TEMPLATES } from "@/lib/music/scales";
import { soloScalePitchClasses } from "@/lib/music/soloGuide";

const NUM_FRETS = 22;
const TUNING_STORAGE_KEY = "guitarmode:tuning:v1";
const TUNING_OFFSETS_STORAGE_KEY = "guitarmode:tuning-offsets:v1";
const EMPTY_OFFSETS: number[] = [0, 0, 0, 0, 0, 0];
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

  const [highContrast, setHighContrastState] = useState(false);
  const [showDegrees, setShowDegrees] = useState(false);
  const [capoFret, setCapoFretState] = useState(0);
  const [selectedDiatonicDegree, setSelectedDiatonicDegree] = useState<number | null>(null);
  const [activeVoicing, setActiveVoicing] = useState<Voicing | null>(null);
  const [snappedChordMatches, setSnappedChordMatches] = useState<ChordMatch[] | null>(null);

  // Persist high-contrast and capo selections
  useEffect(() => {
    try {
      const hc = window.localStorage.getItem(HIGH_CONTRAST_KEY);
      if (hc === "1") setHighContrastState(true);
      const capo = window.localStorage.getItem(CAPO_KEY);
      if (capo) setCapoFretState(Math.max(0, Math.min(12, Number(capo) || 0)));
    } catch {}
  }, []);

  const handleHighContrastChange = useCallback((v: boolean) => {
    setHighContrastState(v);
    try { window.localStorage.setItem(HIGH_CONTRAST_KEY, v ? "1" : "0"); } catch {}
  }, []);

  const handleCapoChange = useCallback((n: number) => {
    setCapoFretState(n);
    try { window.localStorage.setItem(CAPO_KEY, String(n)); } catch {}
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

  // RiffGenerator overlay: when the AI-generated riff loads, light up its
  // pitch classes on the fretboard and follow the playhead with a pulse.
  const [riffPitchClasses, setRiffPitchClasses] = useState<Set<number> | undefined>(undefined);
  const [riffRoot, setRiffRoot] = useState<number | null>(null);
  const [riffPlayingPc, setRiffPlayingPc] = useState<number | null>(null);
  const handleRiffNotes = useCallback((pcs: Set<number>, root: number | null) => {
    setRiffPitchClasses(pcs);
    setRiffRoot(root);
  }, []);

  const [tuningId, setTuningId] = useState<string>(DEFAULT_TUNING_ID);
  const tuningHydratedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") {
      tuningHydratedRef.current = true;
      return;
    }
    try {
      const saved = window.localStorage.getItem(TUNING_STORAGE_KEY);
      if (saved) setTuningId(saved);
    } catch {
      /* ignore */
    }
    tuningHydratedRef.current = true;
  }, []);
  useEffect(() => {
    if (!tuningHydratedRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TUNING_STORAGE_KEY, tuningId);
    } catch {
      /* ignore */
    }
  }, [tuningId]);
  const tuning = useMemo(() => getTuning(tuningId), [tuningId]);

  const [tuningOffsets, setTuningOffsets] = useState<number[]>(EMPTY_OFFSETS);
  const offsetsHydratedRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") {
      offsetsHydratedRef.current = true;
      return;
    }
    try {
      const raw = window.localStorage.getItem(TUNING_OFFSETS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (
          Array.isArray(parsed) &&
          parsed.length === 6 &&
          parsed.every((n) => typeof n === "number" && Number.isFinite(n))
        ) {
          setTuningOffsets(parsed as number[]);
        }
      }
    } catch {
      /* ignore */
    }
    offsetsHydratedRef.current = true;
  }, []);
  useEffect(() => {
    if (!offsetsHydratedRef.current || typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        TUNING_OFFSETS_STORAGE_KEY,
        JSON.stringify(tuningOffsets)
      );
    } catch {
      /* ignore */
    }
  }, [tuningOffsets]);
  const setOffsetAt = useCallback((i: number, cents: number) => {
    setTuningOffsets((prev) => {
      const next = prev.slice();
      next[i] = Math.max(-50, Math.min(50, cents));
      return next;
    });
  }, []);
  const resetOffsets = useCallback(() => setTuningOffsets(EMPTY_OFFSETS), []);

  const [progression, setProgressionState] = useState<ChordEvent[]>([]);
  // Two possible sources for the currently-active chord: time-driven from a
  // loaded waveform, or live-driven from the standalone progression player.
  // Player wins when it's running so the fretboard tracks the synth.
  const [waveformChord, setWaveformChord] = useState<ChordEvent | null>(null);
  const [playbackChord, setPlaybackChord] = useState<ChordEvent | null>(null);
  const currentChord = playbackChord ?? waveformChord;

  const [soloRoot, setSoloRoot] = useState(0); // C
  const [soloScaleIdx, setSoloScaleIdx] = useState(8); // Minor Pentatonic

  const setProgression = useCallback((next: ChordEvent[]) => {
    const sorted = sortProgression(next);
    setProgressionState(sorted);
    setWaveformChord(null);
    setPlaybackChord(null);
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

  const handleDiatonicSelect = useCallback((degree: number) => {
    setSelectedDiatonicDegree((prev) => {
      const next = prev === degree ? null : degree;
      if (next == null || !selected) {
        setActiveVoicing(null);
        return null;
      }
      const triads = diatonicTriads(selected.template, selected.root);
      const triad = triads.find((t) => t.degree === next);
      if (triad) {
        const voicings = findVoicings(triad.root, triad.quality, tuning.midi);
        setActiveVoicing(voicings[0] ?? null);
      } else {
        setActiveVoicing(null);
      }
      return next;
    });
  }, [selected, tuning]);

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
        mic.stop();
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
          mic.stop();
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
      // Pick a MIME the browser actually supports — Safari can't record webm.
      // Reuse the chosen type for the Blob so decoding doesn't see a mismatch.
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg",
      ];
      const mimeType = candidates.find(
        (m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)
      );
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      const blobType = recorder.mimeType || mimeType || "audio/webm";
      recordedChunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) recordedChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: blobType });
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
    () => soloScalePitchClasses(soloRoot, SCALE_TEMPLATES[soloScaleIdx]),
    [soloRoot, soloScaleIdx]
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
      <header className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="shrink-0 text-emerald-400">
            <path d="M16 3C10.477 3 6 7.477 6 13c0 4.418 4 9 10 16 6-7 10-11.582 10-16 0-5.523-4.477-10-10-10Z" fill="currentColor" opacity="0.9"/>
            <circle cx="16" cy="13" r="2.5" fill="#0a0a0a"/>
          </svg>
          <div>
            <h1 className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent text-2xl font-bold tracking-tight sm:text-3xl">
              GuitarMode
            </h1>
            <p className="text-sm text-zinc-400 mt-0.5">
              Play your guitar. I&rsquo;ll name the notes, guess the scale, and show you what&rsquo;s
              next on the fretboard.
            </p>
          </div>
        </div>
      </header>

      <section className="mb-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
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

      <section className="mb-4 sm:mb-6">
        <Tuner
          micOn={detector.active}
          frequency={detector.currentNote?.frequency ?? null}
          a4Hz={detector.config.a4Hz}
          tuning={tuning}
          tuningOffsetsCents={tuningOffsets}
        />
      </section>


      <section className="mb-4 sm:mb-6">
        <InputSettings
          config={detector.config}
          onChange={detector.setConfig}
          devices={mic.devices}
          currentDeviceId={mic.currentDeviceId}
          onDeviceChange={handleDeviceChange}
          micOn={detector.active}
          tuningId={tuningId}
          onTuningChange={setTuningId}
          tuning={tuning}
          tuningOffsetsCents={tuningOffsets}
          onTuningOffsetChange={setOffsetAt}
          onResetTuningOffsets={resetOffsets}
          highContrast={highContrast}
          onHighContrastChange={handleHighContrastChange}
        />
      </section>

      <section className="mb-4 grid gap-4 sm:mb-6 sm:gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2 before:content-[''] before:block before:h-[3px] before:w-1 before:rounded-full before:bg-emerald-500/70 before:shrink-0">
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
              onTimeUpdate={(t) => setWaveformChord(activeChordAt(progression, t))}
            />
          )}
        </div>
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2 before:content-[''] before:block before:h-[3px] before:w-1 before:rounded-full before:bg-emerald-500/70 before:shrink-0">
            Scale &amp; mode suggestions
          </h2>
          <ScaleSuggestions
            matches={matches}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            detectedCount={playedPitchClasses.size}
            a4Hz={detector.config.a4Hz}
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
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-600">
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

      <section className="mb-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:mb-6 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2 before:content-[''] before:block before:h-[3px] before:w-1 before:rounded-full before:bg-emerald-500/70 before:shrink-0">
            Timeline
          </h2>
          <p className="text-xs text-zinc-500">
            Height = pitch, width = how long you held the note.
          </p>
        </div>
        <Timeline notes={detector.notes} />
      </section>

      <section className="mb-4 sm:mb-6">
        <SoloGenerator />
      </section>

      <section className="mb-4 sm:mb-6">
        <RiffGenerator
          onRiffNotes={handleRiffNotes}
          onRiffNoteActive={setRiffPlayingPc}
        />
      </section>

      <section className="mb-4 sm:mb-6">
        <Metronome />
      </section>

      <section className="mb-4 sm:mb-6">
        <ProgressionEditor
          progression={progression}
          onChange={setProgression}
          currentChord={currentChord?.chord ?? null}
          a4Hz={detector.config.a4Hz}
          onPlaybackChordChange={setPlaybackChord}
        />
      </section>

      <section className="mb-4 sm:mb-6">
        <SoloGuide
          root={soloRoot}
          scaleIdx={soloScaleIdx}
          chordInfo={chordInfo}
          currentChord={currentChord?.chord ?? null}
          onRootChange={setSoloRoot}
          onScaleIdxChange={setSoloScaleIdx}
        />
      </section>

      <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2 before:content-[''] before:block before:h-[3px] before:w-1 before:rounded-full before:bg-emerald-500/70 before:shrink-0">
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
          highContrast={highContrast}
          showDegrees={showDegrees}
          degreeMap={degreeMap}
          capo={capoFret}
          voicingPositions={activeVoicing ?? undefined}
          playedPitchClasses={playedPitchClasses}
          scalePitchClasses={riffPitchClasses ?? scaleSet}
          rootPitchClass={riffRoot ?? soloRoot}
          currentPitchClass={riffPlayingPc ?? detector.currentNote?.pitchClass ?? null}
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
