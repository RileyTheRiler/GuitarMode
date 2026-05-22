"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Fretboard } from "@/components/Fretboard";
import {
  parseTab,
  columnsToTimes,
  detectColumnsPerBeat,
  type TabEvent,
} from "@/lib/music/tabParser";
import { detectScales } from "@/lib/music/detectScale";
import { scalePitchClasses } from "@/lib/music/scales";
import { STANDARD_TUNING } from "@/lib/guitar/fretboard";
import { getToneContext, schedulePluck, type ScheduledNote } from "@/lib/audio/tonePlayer";

const DEGREE_LABELS = ["1","♭2","2","♭3","3","4","♯4","5","♭6","6","♭7","7"];

const EXAMPLE_TAB = `e|---0-----------0---0-0------|
B|---1-----------1---1-1------|
G|---0-----------0---0-0------|
D|---2-----------2---2-2------|
A|---3-----------3---3-3------|
E|----------------------------|`;

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

const EMPTY_SET = new Set<number>();

interface PlaybackRef {
  ctxStartTime: number;  // AudioContext.currentTime when playback started
  songOffsetSec: number; // song position we started from (seconds)
  timings: number[];     // seconds for each event
  handles: ScheduledNote[];
}

export function TabPlayer() {
  const [inputMode, setInputMode] = useState<"songname" | "tab">("songname");
  const [songQuery, setSongQuery] = useState("");
  const [tabText, setTabText] = useState(EXAMPLE_TAB);
  const [bpm, setBpm] = useState(80);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [songMeta, setSongMeta] = useState<{ title: string; key: string; note: string } | null>(null);

  const [playState, setPlayState] = useState<"idle" | "playing" | "paused">("idle");
  const [currentEventIdx, setCurrentEventIdx] = useState<number>(-1);
  const [progressSec, setProgressSec] = useState(0);

  const playbackRef = useRef<PlaybackRef | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const pausedAtSecRef = useRef<number>(0);

  // ── Parse the tab ──────────────────────────────────────────────────────────
  const { events, columnsPerBeat } = useMemo(() => {
    const parsed = parseTab(tabText);
    const cpb = detectColumnsPerBeat(parsed.events);
    return { events: parsed.events, columnsPerBeat: cpb };
  }, [tabText]);

  const timings = useMemo(
    () => columnsToTimes(events, bpm, columnsPerBeat),
    [events, bpm, columnsPerBeat]
  );

  const totalDurationSec = timings.length > 0 ? timings[timings.length - 1] + 60 / bpm : 0;

  // ── Scale analysis from entire tab ────────────────────────────────────────
  const scaleMatch = useMemo(() => {
    if (events.length === 0) return null;
    const chroma = new Array(12).fill(0);
    for (const ev of events) {
      for (const note of ev.notes) {
        const pc = (STANDARD_TUNING[note.stringIndex] + note.fret) % 12;
        chroma[pc]++;
      }
    }
    const matches = detectScales(chroma, 1);
    return matches[0] ?? null;
  }, [events]);

  const scaleSet = useMemo(
    () => scaleMatch ? scalePitchClasses(scaleMatch.template, scaleMatch.root) : undefined,
    [scaleMatch]
  );

  const degreeMap = useMemo(() => {
    if (!scaleMatch) return undefined;
    const map = new Map<number, string>();
    for (const interval of scaleMatch.template.intervals) {
      const pc = (scaleMatch.root + interval) % 12;
      map.set(pc, DEGREE_LABELS[interval] ?? String(interval));
    }
    return map;
  }, [scaleMatch]);

  // ── Current note positions for fretboard highlight ─────────────────────────
  const currentEvent: TabEvent | undefined = events[currentEventIdx];

  const livePositions = useMemo(
    () => (currentEvent ? currentEvent.notes : undefined),
    [currentEvent]
  );

  const currentPitchClasses = useMemo(() => {
    if (!currentEvent) return EMPTY_SET;
    const s = new Set<number>();
    for (const n of currentEvent.notes) {
      s.add((STANDARD_TUNING[n.stringIndex] + n.fret) % 12);
    }
    return s;
  }, [currentEvent]);

  // ── Playback engine ────────────────────────────────────────────────────────
  const cancelAnimation = useCallback(() => {
    if (animFrameRef.current != null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  const cancelAudio = useCallback(() => {
    const pb = playbackRef.current;
    if (!pb) return;
    for (const h of pb.handles) try { h.cancel(); } catch {}
    playbackRef.current = null;
  }, []);

  const tick = useCallback(() => {
    const pb = playbackRef.current;
    if (!pb) return;
    const ctx = getToneContext();
    const elapsedSec = ctx.currentTime - pb.ctxStartTime + pb.songOffsetSec;

    setProgressSec(elapsedSec);

    // Find current event index
    let idx = -1;
    for (let i = 0; i < pb.timings.length; i++) {
      if (pb.timings[i] <= elapsedSec) idx = i;
      else break;
    }
    setCurrentEventIdx(idx);

    // Check if playback finished
    if (elapsedSec >= totalDurationSec) {
      cancelAnimation();
      cancelAudio();
      setPlayState("idle");
      setCurrentEventIdx(-1);
      setProgressSec(0);
      pausedAtSecRef.current = 0;
      return;
    }

    animFrameRef.current = requestAnimationFrame(tick);
  }, [totalDurationSec, cancelAnimation, cancelAudio]);

  const startAudio = useCallback(
    (fromSec: number) => {
      if (events.length === 0) return;
      const ctx = getToneContext();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});

      const startCtxTime = ctx.currentTime + 0.05;
      const handles: ScheduledNote[] = [];

      // Find first event at or after fromSec
      const startEvtIdx = timings.findIndex((t) => t >= fromSec - 0.01);
      const effectiveStart = startEvtIdx >= 0 ? startEvtIdx : 0;

      for (let i = effectiveStart; i < events.length; i++) {
        const eventSec = timings[i] - fromSec;
        if (eventSec < -0.05) continue;
        const audioTime = startCtxTime + Math.max(0, eventSec);

        for (const note of events[i].notes) {
          const midi = STANDARD_TUNING[note.stringIndex] + note.fret;
          handles.push(schedulePluck(midi, audioTime, 0.7));
        }
      }

      playbackRef.current = {
        ctxStartTime: startCtxTime,
        songOffsetSec: fromSec,
        timings,
        handles,
      };

      setPlayState("playing");
      animFrameRef.current = requestAnimationFrame(tick);
    },
    [events, timings, tick]
  );

  const handlePlay = useCallback(() => {
    if (events.length === 0) return;
    if (playState === "playing") return;
    cancelAnimation();
    cancelAudio();
    const from = playState === "paused" ? pausedAtSecRef.current : 0;
    startAudio(from);
  }, [events, playState, cancelAnimation, cancelAudio, startAudio]);

  const handlePause = useCallback(() => {
    if (playState !== "playing") return;
    cancelAnimation();
    cancelAudio();
    pausedAtSecRef.current = progressSec;
    setPlayState("paused");
  }, [playState, progressSec, cancelAnimation, cancelAudio]);

  const handleStop = useCallback(() => {
    cancelAnimation();
    cancelAudio();
    pausedAtSecRef.current = 0;
    setPlayState("idle");
    setCurrentEventIdx(-1);
    setProgressSec(0);
  }, [cancelAnimation, cancelAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cancelAnimation();
      cancelAudio();
    };
  }, [cancelAnimation, cancelAudio]);

  // Restart when BPM changes during playback
  useEffect(() => {
    if (playState === "playing") {
      cancelAnimation();
      cancelAudio();
      const from = progressSec;
      pausedAtSecRef.current = from;
      // Brief delay so state settles
      setTimeout(() => startAudio(from), 20);
    }
    // intentionally sparse deps — only trigger on bpm change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);

  const handleFretClick = useCallback((_s: number, _f: number, midi: number) => {
    const ctx = getToneContext();
    schedulePluck(midi, ctx.currentTime + 0.01, 0.9);
  }, []);

  // ── Song name lookup ───────────────────────────────────────────────────────
  const handleGenerateTab = useCallback(async () => {
    if (!songQuery.trim()) return;
    setIsGenerating(true);
    setGenerateError(null);
    setSongMeta(null);
    handleStop();
    try {
      const res = await fetch("/api/song-tab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: songQuery.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error ?? "Request failed");
      }
      const data = await res.json();
      setTabText(data.tab ?? "");
      setSongMeta({ title: data.title, key: data.key, note: data.note });
      setInputMode("tab");
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Failed to generate tab");
    } finally {
      setIsGenerating(false);
    }
  }, [songQuery, handleStop]);

  const progressPct =
    totalDurationSec > 0 ? Math.min(100, (progressSec / totalDurationSec) * 100) : 0;

  const hasTab = events.length > 0;

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2 before:content-[''] before:block before:h-[3px] before:w-1 before:rounded-full before:bg-emerald-500/70 before:shrink-0">
        Tab Player
      </h2>

      {/* Input mode toggle */}
      <div className="mb-4 flex rounded-lg border border-zinc-700 bg-zinc-950 p-0.5 w-fit">
        {(["songname", "tab"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setInputMode(m)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition ${
              inputMode === m
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {m === "songname" ? "Song Name" : "Paste Tab"}
          </button>
        ))}
      </div>

      {/* Song name input */}
      {inputMode === "songname" && (
        <div className="mb-4">
          <p className="text-xs text-zinc-500 mb-2">
            Enter a song name and artist — the app will generate a guitar tab for the main riff.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={songQuery}
              onChange={(e) => setSongQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleGenerateTab(); }}
              placeholder="e.g. Smoke on the Water, Deep Purple"
              className="flex-1 rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60"
            />
            <button
              type="button"
              onClick={handleGenerateTab}
              disabled={isGenerating || !songQuery.trim()}
              className="rounded-md bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition"
            >
              {isGenerating ? "Loading…" : "Get Tab"}
            </button>
          </div>
          {generateError && (
            <p className="mt-2 text-xs text-rose-400">{generateError}</p>
          )}
          {songMeta && (
            <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-800/50 px-3 py-2">
              <p className="text-xs font-semibold text-zinc-200">{songMeta.title}</p>
              <p className="text-xs text-emerald-400">{songMeta.key}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{songMeta.note}</p>
            </div>
          )}
        </div>
      )}

      {/* Tab textarea */}
      <div className="mb-4">
        {inputMode === "tab" && (
          <p className="text-xs text-zinc-500 mb-2">
            Paste standard 6-string ASCII guitar tab (e B G D A E, top to bottom).
          </p>
        )}
        <textarea
          value={tabText}
          onChange={(e) => { setTabText(e.target.value); handleStop(); }}
          rows={7}
          spellCheck={false}
          className="w-full rounded-md bg-zinc-950 border border-zinc-700 px-3 py-2 font-mono text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-emerald-500/60 resize-y"
          placeholder={EXAMPLE_TAB}
        />
        <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-600">
          {hasTab ? (
            <>
              <span>{events.length} notes detected</span>
              <span>~{formatTime(totalDurationSec * 1000)} at {bpm} BPM</span>
            </>
          ) : (
            <span>No valid tab detected — check format</span>
          )}
        </div>
      </div>

      {/* Controls */}
      {hasTab && (
        <>
          {/* BPM */}
          <div className="mb-4 flex items-center gap-3">
            <label className="text-xs text-zinc-400 shrink-0">
              BPM <span className="font-semibold text-zinc-200">{bpm}</span>
            </label>
            <input
              type="range"
              min={30}
              max={220}
              value={bpm}
              onChange={(e) => setBpm(Number(e.target.value))}
              className="flex-1 accent-emerald-500"
            />
          </div>

          {/* Play / Pause / Stop */}
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={playState === "playing" ? handlePause : handlePlay}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                playState === "playing"
                  ? "bg-amber-700/30 border border-amber-600/50 text-amber-300 hover:bg-amber-700/50"
                  : "bg-emerald-700 hover:bg-emerald-600 text-white"
              }`}
            >
              {playState === "playing" ? "⏸ Pause" : playState === "paused" ? "▶ Resume" : "▶ Play"}
            </button>
            <button
              type="button"
              onClick={handleStop}
              disabled={playState === "idle"}
              className="rounded-md px-4 py-2 text-sm font-medium bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              ■ Stop
            </button>
            <span className="text-xs text-zinc-500 ml-1">
              {formatTime(progressSec * 1000)} / {formatTime(totalDurationSec * 1000)}
            </span>
          </div>

          {/* Progress bar */}
          <div
            className="mb-4 w-full h-1.5 rounded-full bg-zinc-800 overflow-hidden cursor-pointer"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              const seekSec = pct * totalDurationSec;
              handleStop();
              pausedAtSecRef.current = seekSec;
              setProgressSec(seekSec);
              setPlayState("paused");
            }}
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-none"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </>
      )}

      {/* Scale / key analysis */}
      {scaleMatch && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Detected key</span>
          <span className="rounded-full bg-emerald-700/30 border border-emerald-600/40 px-3 py-0.5 text-xs font-semibold text-emerald-300">
            {scaleMatch.rootName} {scaleMatch.templateName}
          </span>
          <span className="text-[10px] text-zinc-600">
            {Math.round(scaleMatch.confidence * 100)}% confidence
          </span>
        </div>
      )}

      {/* Fretboard */}
      <div className="overflow-x-auto">
        <Fretboard
          numFrets={22}
          tuning={STANDARD_TUNING}
          playedPitchClasses={currentPitchClasses}
          scalePitchClasses={scaleSet}
          rootPitchClass={scaleMatch?.root ?? null}
          showDegrees={!!scaleMatch}
          degreeMap={degreeMap}
          livePositions={livePositions}
          onFretClick={handleFretClick}
        />
      </div>

      <p className="mt-2 text-xs text-zinc-600">
        {hasTab
          ? "Pulsing dots = current note/chord. Outlined = scale context. Click any dot to preview."
          : "Parse a tab or look up a song to see the fretboard come alive."}
      </p>
    </section>
  );
}
