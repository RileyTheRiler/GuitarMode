"use client";

import { midiToFreq } from "../music/notes";

let sharedCtx: AudioContext | null = null;

function getContext(): AudioContext {
  if (sharedCtx && sharedCtx.state !== "closed") return sharedCtx;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  sharedCtx = new AudioCtx();
  return sharedCtx;
}

/** Shared AudioContext used for UI-triggered sounds (pluck preview, metronome). */
export function getToneContext(): AudioContext {
  return getContext();
}

/**
 * Schedule a short metronome click at an exact audio-clock time. Using the
 * audio clock (not setTimeout) keeps timing sample-accurate even under GC
 * pauses. Accented beats are higher and a touch louder.
 */
export function scheduleClick(time: number, accent = false) {
  const ctx = getContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.value = accent ? 1600 : 900;

  const peak = accent ? 0.35 : 0.2;
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(peak, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.08);
}

/**
 * Play a short, guitar-ish pluck at the given MIDI pitch. Uses a pair of
 * slightly-detuned triangle oscillators through an exponential envelope.
 * Good enough for previewing a fretboard position.
 */
export function playPluck(midi: number, a4Hz = 440) {
  const ctx = getContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  schedulePluck(midi, ctx.currentTime, 0.9, a4Hz);
}

export type ScheduledNote = {
  /** Audio-clock time when the note stops sounding (envelope end + tail). */
  stopAt: number;
  /** Fade out and free the nodes now. Idempotent. */
  cancel: () => void;
};

/**
 * Schedule a pluck at an exact audio-clock time. Returns a handle whose
 * `cancel()` releases the gain quickly and stops the oscillators, so a
 * progression player can yank everything mid-playback without clicks.
 */
export function schedulePluck(
  midi: number,
  at: number,
  durS: number,
  a4Hz = 440
): ScheduledNote {
  const ctx = getContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const fundamental = midiToFreq(midi, a4Hz);
  const envelope = Math.max(0.3, durS);
  const stopAt = at + envelope + 0.1;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, at);
  master.gain.linearRampToValueAtTime(0.22, at + 0.008);
  master.gain.exponentialRampToValueAtTime(0.0005, at + envelope);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(fundamental * 8, at);
  filter.frequency.exponentialRampToValueAtTime(fundamental * 2, at + envelope);
  filter.Q.value = 1;

  const oscs: OscillatorNode[] = [];
  for (const detune of [-6, 6]) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = fundamental;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(at);
    osc.stop(stopAt);
    oscs.push(osc);
  }

  filter.connect(master);
  master.connect(ctx.destination);

  oscs[oscs.length - 1].onended = () => {
    try {
      master.disconnect();
      filter.disconnect();
    } catch {}
  };

  let cancelled = false;
  return {
    stopAt,
    cancel: () => {
      if (cancelled) return;
      cancelled = true;
      const now = ctx.currentTime;
      try {
        master.gain.cancelScheduledValues(now);
        // Snap to current value then fade out so the abort doesn't click.
        master.gain.setValueAtTime(master.gain.value, now);
        master.gain.linearRampToValueAtTime(0.0001, now + 0.04);
      } catch {}
      for (const o of oscs) {
        try { o.stop(now + 0.05); } catch {}
      }
    },
  };
}
