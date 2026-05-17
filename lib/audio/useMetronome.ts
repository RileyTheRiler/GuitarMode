"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getToneContext, scheduleClick } from "./tonePlayer";

const STORAGE_KEY = "guitarmode:metronome:v1";
const LOOKAHEAD_S = 0.1;
const POLL_MS = 25;
const MIN_BPM = 30;
const MAX_BPM = 240;
const MIN_BEATS = 1;
const MAX_BEATS = 12;

function clampBpm(n: number): number {
  if (!Number.isFinite(n)) return 100;
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(n)));
}
function clampBeats(n: number): number {
  if (!Number.isFinite(n)) return 4;
  return Math.max(MIN_BEATS, Math.min(MAX_BEATS, Math.round(n)));
}

type ClickStyle = "electronic" | "wood";
type Persisted = { bpm?: number; beatsPerBar?: number; clickStyle?: ClickStyle };

export function useMetronome() {
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpmState] = useState(100);
  const [beatsPerBar, setBeatsPerBarState] = useState(4);
  const [clickStyle, setClickStyleState] = useState<ClickStyle>("electronic");
  // 1-based beat index for display; 0 means "not playing".
  const [currentBeat, setCurrentBeat] = useState(0);

  const bpmRef = useRef(bpm);
  const beatsRef = useRef(beatsPerBar);
  const clickStyleRef = useRef(clickStyle);
  bpmRef.current = bpm;
  beatsRef.current = beatsPerBar;
  clickStyleRef.current = clickStyle;

  // Scheduler state lives in refs so changes don't tear the setInterval loop.
  const playingRef = useRef(false);
  const nextNoteTimeRef = useRef(0);
  const beatCounterRef = useRef(0);
  const pollerIdRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Pending UI updates: promote currentBeat when the audio clock reaches `time`.
  const pendingBeatsRef = useRef<Array<{ time: number; beat: number }>>([]);

  // Hydrate persisted settings. Gated ref so the first write doesn't clobber
  // storage before we read it on mount.
  const hydratedRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") {
      hydratedRef.current = true;
      return;
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        if (typeof parsed.bpm === "number") setBpmState(clampBpm(parsed.bpm));
        if (typeof parsed.beatsPerBar === "number") {
          setBeatsPerBarState(clampBeats(parsed.beatsPerBar));
        }
        if (parsed.clickStyle === "wood" || parsed.clickStyle === "electronic") {
          setClickStyleState(parsed.clickStyle);
        }
      }
    } catch (err) {
      console.warn("useMetronome: failed to read persisted settings", err);
    }
    hydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (!hydratedRef.current || typeof window === "undefined") return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ bpm, beatsPerBar, clickStyle } satisfies Persisted)
        );
      } catch (err) {
        console.warn("useMetronome: failed to persist settings", err);
      }
    }, 500);
  }, [bpm, beatsPerBar, clickStyle]);

  const tick = useCallback(() => {
    const ctx = getToneContext();
    const now = ctx.currentTime;
    // Schedule any beats that fall within the lookahead window.
    while (nextNoteTimeRef.current < now + LOOKAHEAD_S) {
      const beatsInBar = beatsRef.current;
      const zeroBasedBeat = beatCounterRef.current % beatsInBar;
      scheduleClick(nextNoteTimeRef.current, zeroBasedBeat === 0, clickStyleRef.current);
      pendingBeatsRef.current.push({
        time: nextNoteTimeRef.current,
        beat: zeroBasedBeat + 1,
      });
      beatCounterRef.current += 1;
      nextNoteTimeRef.current += 60.0 / bpmRef.current;
    }
    // Promote UI state for beats whose audio time has arrived.
    while (
      pendingBeatsRef.current.length > 0 &&
      pendingBeatsRef.current[0].time <= now
    ) {
      const b = pendingBeatsRef.current.shift()!;
      setCurrentBeat(b.beat);
    }
  }, []);

  const stop = useCallback(() => {
    if (!playingRef.current) return;
    if (pollerIdRef.current) {
      clearInterval(pollerIdRef.current);
      pollerIdRef.current = null;
    }
    pendingBeatsRef.current = [];
    playingRef.current = false;
    setPlaying(false);
    setCurrentBeat(0);
  }, []);

  const start = useCallback(() => {
    if (playingRef.current) return;
    const ctx = getToneContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    beatCounterRef.current = 0;
    nextNoteTimeRef.current = ctx.currentTime + 0.05;
    pendingBeatsRef.current = [];
    playingRef.current = true;
    setPlaying(true);
    tick();
    pollerIdRef.current = setInterval(tick, POLL_MS);
  }, [tick]);

  const toggle = useCallback(() => {
    if (playingRef.current) stop();
    else start();
  }, [start, stop]);

  const setBpm = useCallback((next: number) => setBpmState(clampBpm(next)), []);
  const setBeatsPerBar = useCallback(
    (next: number) => setBeatsPerBarState(clampBeats(next)),
    []
  );
  const setClickStyle = useCallback((s: ClickStyle) => setClickStyleState(s), []);

  useEffect(() => {
    return () => {
      if (pollerIdRef.current) clearInterval(pollerIdRef.current);
    };
  }, []);

  return {
    playing,
    bpm,
    beatsPerBar,
    clickStyle,
    currentBeat,
    start,
    stop,
    toggle,
    setBpm,
    setBeatsPerBar,
    setClickStyle,
  };
}
