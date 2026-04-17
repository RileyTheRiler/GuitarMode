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

/**
 * Play a short, guitar-ish pluck at the given MIDI pitch. Uses a pair of
 * slightly-detuned triangle oscillators through an exponential envelope.
 * Good enough for previewing a fretboard position.
 */
export function playPluck(midi: number, a4Hz = 440) {
  const ctx = getContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const fundamental = midiToFreq(midi, a4Hz);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(0.25, now + 0.005);
  master.gain.exponentialRampToValueAtTime(0.0005, now + 0.9);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(fundamental * 8, now);
  filter.frequency.exponentialRampToValueAtTime(fundamental * 2, now + 0.9);
  filter.Q.value = 1;

  for (const detune of [-6, 6]) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = fundamental;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(now);
    osc.stop(now + 1.0);
  }

  filter.connect(master);
  master.connect(ctx.destination);

  // Disconnect after the envelope has fully decayed.
  setTimeout(() => {
    try {
      master.disconnect();
      filter.disconnect();
    } catch {}
  }, 1100);
}
