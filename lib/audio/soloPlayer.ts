"use client";

import { getToneContext, schedulePluck } from "./tonePlayer";
import type { GeneratedSolo, SoloNote } from "../music/soloGenerator";

export interface SoloPlayerCallbacks {
  onNoteStart: (note: SoloNote) => void;
  onNoteEnd: () => void;
  onComplete: () => void;
}

export interface SoloPlayer {
  start: () => void;
  stop: () => void;
  isPlaying: () => boolean;
}

/**
 * Pre-schedules all solo notes on the Web Audio clock (sample-accurate timing)
 * and fires React callbacks via setTimeout so the fretboard updates in sync.
 *
 * The audio is scheduled at ctx.currentTime + LOOKAHEAD so the browser has
 * time to process the nodes before playback begins. UI callbacks mirror the
 * same offset so visuals stay aligned.
 */
export function createSoloPlayer(
  solo: GeneratedSolo,
  callbacks: SoloPlayerCallbacks
): SoloPlayer {
  const LOOKAHEAD_S = 0.12; // 120 ms initial buffer
  let active = false;
  const handles: ReturnType<typeof setTimeout>[] = [];

  function beatsToSec(beats: number) {
    return (beats * 60) / solo.bpm;
  }

  function stop() {
    active = false;
    handles.forEach(clearTimeout);
    handles.length = 0;
    callbacks.onNoteEnd();
  }

  function start() {
    if (active) stop();
    active = true;

    const ctx = getToneContext();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const audioStart = ctx.currentTime + LOOKAHEAD_S;

    // Pre-schedule every note on the audio clock for glitch-free playback.
    for (const note of solo.notes) {
      const noteAudioTime = audioStart + beatsToSec(note.startBeat);
      schedulePluck(note.midi, noteAudioTime);
    }

    // Fire UI callbacks via wall-clock timeouts (≈1–2 ms jitter is fine for visuals).
    for (const note of solo.notes) {
      const noteWallMs = (beatsToSec(note.startBeat) + LOOKAHEAD_S) * 1000;
      const durationMs = beatsToSec(note.durationBeats) * 1000;

      const startT = setTimeout(() => {
        if (!active) return;
        callbacks.onNoteStart(note);

        const endT = setTimeout(() => {
          if (!active) return;
          callbacks.onNoteEnd();
        }, durationMs);
        handles.push(endT);
      }, noteWallMs);
      handles.push(startT);
    }

    // Completion callback
    const totalMs = (beatsToSec(solo.totalBeats) + LOOKAHEAD_S) * 1000 + 200;
    const doneT = setTimeout(() => {
      if (!active) return;
      active = false;
      callbacks.onComplete();
    }, totalMs);
    handles.push(doneT);

  }

  return { start, stop, isPlaying: () => active };
}
