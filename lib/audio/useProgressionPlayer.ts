"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHORD_TEMPLATES, parseChord } from "../music/chords";
import { activeChordAt, sortProgression, type ChordEvent } from "../music/progression";
import {
  getToneContext,
  schedulePluck,
  type ScheduledNote,
} from "./tonePlayer";

// Seconds the final chord rings out after the progression's last event.
const TAIL_S = 1.5;
// Audio-clock delay between consecutive notes of a strum (~25 ms feels human).
const STRUM_GAP_S = 0.025;
// MIDI for a "C2" anchor; chord roots are placed at BASE_ROOT_MIDI + rootPc.
// Picks a comfortable mid-register voicing for the synth (C3..B3 root range).
const BASE_ROOT_MIDI = 48;

/** Build a stacked-intervals voicing rooted in the chosen octave. */
export function voicingMidis(rootPc: number, intervals: number[]): number[] {
  const root = BASE_ROOT_MIDI + rootPc;
  return intervals.map((i) => root + i);
}

export type ProgressionPlayerState = {
  playing: boolean;
  /** Currently-sounding chord while playback is active, otherwise null. */
  currentChord: ChordEvent | null;
  play: (progression: ChordEvent[], a4Hz?: number) => void;
  stop: () => void;
};

export function useProgressionPlayer(): ProgressionPlayerState {
  const [playing, setPlaying] = useState(false);
  const [currentChord, setCurrentChord] = useState<ChordEvent | null>(null);

  const scheduledRef = useRef<ScheduledNote[]>([]);
  const rafRef = useRef<number>(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelAll = useCallback(() => {
    for (const s of scheduledRef.current) {
      try { s.cancel(); } catch {}
    }
    scheduledRef.current = [];
    if (stopTimerRef.current) {
      clearTimeout(stopTimerRef.current);
      stopTimerRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  const stop = useCallback(() => {
    cancelAll();
    setPlaying(false);
    setCurrentChord(null);
  }, [cancelAll]);

  const play = useCallback(
    (progression: ChordEvent[], a4Hz = 440) => {
      cancelAll();
      const sorted = sortProgression(progression);
      if (sorted.length === 0) return;
      const ctx = getToneContext();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      // Small head-start so the first chord isn't truncated by scheduling latency.
      const baseTime = ctx.currentTime + 0.1;

      for (let i = 0; i < sorted.length; i++) {
        const ev = sorted[i];
        const parsed = parseChord(ev.chord);
        if (!parsed) continue;
        const tmpl = CHORD_TEMPLATES[parsed.quality];
        const midis = voicingMidis(parsed.root, tmpl.intervals);

        const next = sorted[i + 1]?.time;
        const dur = next != null ? Math.max(0, next - ev.time) : TAIL_S;
        if (dur <= 0) continue;

        midis.forEach((m, idx) => {
          const at = baseTime + ev.time + idx * STRUM_GAP_S;
          scheduledRef.current.push(schedulePluck(m, at, dur, a4Hz));
        });
      }

      const lastEv = sorted[sorted.length - 1];
      const totalS = (lastEv?.time ?? 0) + TAIL_S;
      stopTimerRef.current = setTimeout(() => {
        scheduledRef.current = [];
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
        setPlaying(false);
        setCurrentChord(null);
      }, totalS * 1000 + 200);

      // Drive the highlighted chord off the audio clock so it stays in sync
      // with the strums even under RAF jitter. Only setState when the active
      // chord changes to avoid 60 Hz re-renders of the fretboard.
      let lastIdx = -2; // -2 to force initial diff against -1 ("none")
      const tick = () => {
        const t = ctx.currentTime - baseTime;
        const active = t >= 0 ? activeChordAt(sorted, t) : null;
        const idx = active ? sorted.indexOf(active) : -1;
        if (idx !== lastIdx) {
          lastIdx = idx;
          setCurrentChord(active);
        }
        if (t <= totalS) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
      rafRef.current = requestAnimationFrame(tick);

      setPlaying(true);
    },
    [cancelAll]
  );

  useEffect(() => {
    return () => {
      cancelAll();
    };
  }, [cancelAll]);

  return { playing, currentChord, play, stop };
}
