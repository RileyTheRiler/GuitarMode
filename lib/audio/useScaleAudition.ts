"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getToneContext, schedulePluck, type ScheduledNote } from "./tonePlayer";

// Audition voicing anchor — places the scale's tonic at MIDI 48 (C3) plus
// the root pitch class, so C major starts at C3 and F#major at F#3.
export const AUDITION_BASE_MIDI = 48;
const NOTE_SPACING_S = 0.28;
const NOTE_DUR_S = 0.5;

/**
 * Build the ascending-then-descending MIDI sequence for a scale audition.
 * Pure helper, exported for tests.
 */
export function buildAuditionSequence(rootMidi: number, intervals: number[]): number[] {
  const ascend = [...intervals.map((i) => rootMidi + i), rootMidi + 12];
  const descend = ascend.slice(0, -1).reverse();
  return [...ascend, ...descend];
}

/**
 * Audition state hook. Only one scale plays at a time; calling `play` while
 * another scale is auditioning cancels it first.
 */
export function useScaleAudition() {
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const handlesRef = useRef<ScheduledNote[]>([]);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelAll = useCallback(() => {
    for (const h of handlesRef.current) {
      try { h.cancel(); } catch {}
    }
    handlesRef.current = [];
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    cancelAll();
    setPlayingKey(null);
  }, [cancelAll]);

  const play = useCallback(
    (key: string, rootPc: number, intervals: number[], a4Hz = 440) => {
      cancelAll();
      const ctx = getToneContext();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      const rootMidi = AUDITION_BASE_MIDI + rootPc;
      const sequence = buildAuditionSequence(rootMidi, intervals);
      const startAt = ctx.currentTime + 0.05;

      sequence.forEach((m, i) => {
        handlesRef.current.push(
          schedulePluck(m, startAt + i * NOTE_SPACING_S, NOTE_DUR_S, a4Hz)
        );
      });

      const totalMs =
        (sequence.length * NOTE_SPACING_S + NOTE_DUR_S) * 1000 + 100;
      stopTimerRef.current = setTimeout(() => {
        handlesRef.current = [];
        stopTimerRef.current = null;
        setPlayingKey(null);
      }, totalMs);

      setPlayingKey(key);
    },
    [cancelAll]
  );

  useEffect(() => () => cancelAll(), [cancelAll]);

  return { playingKey, play, stop };
}
