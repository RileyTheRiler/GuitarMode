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
 *
 * `style` chooses between a square-wave electronic beep ("electronic") and a
 * synthesized woodblock-style hit ("wood").
 */
export function scheduleClick(time: number, accent = false, style: "electronic" | "wood" = "electronic") {
  const ctx = getContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  if (style === "wood") {
    // Tonal body: short decaying sine
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = accent ? 900 : 680;
    oscGain.gain.setValueAtTime(0, time);
    oscGain.gain.linearRampToValueAtTime(accent ? 0.5 : 0.35, time + 0.001);
    oscGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.05);

    // Noise transient for the attack "click"
    const bufSize = Math.ceil(ctx.sampleRate * 0.025);
    const noiseBuffer = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass";
    bpf.frequency.value = accent ? 2200 : 1600;
    bpf.Q.value = 1;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, time);
    noiseGain.gain.linearRampToValueAtTime(accent ? 0.3 : 0.2, time + 0.001);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.02);
    noise.connect(bpf);
    bpf.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(time);
    return;
  }

  // Electronic (original square-wave)
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
 * Schedule a guitar-ish pluck at a specific AudioContext time. Unlike
 * playPluck(), this uses the audio clock for sample-accurate timing so it can
 * be called ahead-of-time to schedule an entire solo. The decay window starts
 * at `time`; pass `ctx.currentTime` to play immediately.
 */
export function schedulePluck(midi: number, time: number, a4Hz = 440) {
  const ctx = getContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  const fundamental = midiToFreq(midi, a4Hz);

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, time);
  master.gain.linearRampToValueAtTime(0.22, time + 0.005);
  master.gain.exponentialRampToValueAtTime(0.0005, time + 0.85);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(fundamental * 8, time);
  filter.frequency.exponentialRampToValueAtTime(fundamental * 2, time + 0.85);
  filter.Q.value = 1;

  for (const detune of [-6, 6]) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = fundamental;
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(time);
    osc.stop(time + 1.0);
  }

  filter.connect(master);
  master.connect(ctx.destination);

  const cleanupMs = Math.max(0, (time - ctx.currentTime) * 1000) + 1100;
  setTimeout(() => {
    try { master.disconnect(); filter.disconnect(); } catch {}
  }, cleanupMs);
}

/**
 * Schedule a string bend: pick at `midi`, glide the pitch up by `semitones`
 * semitones over `bendMs` milliseconds, then sustain and decay.
 * Sounds convincingly like a real guitar bend because the oscillator
 * frequency is ramped on the audio clock — no timer jitter.
 */
export function scheduleBend(
  midi: number,
  semitones: number,
  time: number,
  bendMs = 220,
  a4Hz = 440
) {
  const ctx = getContext();
  if (ctx.state === "suspended") ctx.resume().catch(() => {});

  const freqStart = midiToFreq(midi, a4Hz);
  const freqEnd = midiToFreq(midi + semitones, a4Hz);
  const bendEnd = time + bendMs / 1000;
  const decay = time + 1.4;

  const master = ctx.createGain();
  master.gain.setValueAtTime(0, time);
  master.gain.linearRampToValueAtTime(0.24, time + 0.006);
  master.gain.setValueAtTime(0.24, bendEnd);
  master.gain.exponentialRampToValueAtTime(0.0005, decay);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(freqStart * 8, time);
  filter.frequency.exponentialRampToValueAtTime(freqEnd * 3, decay);
  filter.Q.value = 1.2;

  for (const detune of [-5, 5]) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freqStart, time);
    osc.frequency.linearRampToValueAtTime(freqEnd, bendEnd);
    osc.detune.value = detune;
    osc.connect(filter);
    osc.start(time);
    osc.stop(decay + 0.05);
  }

  filter.connect(master);
  master.connect(ctx.destination);

  const cleanupMs = Math.max(0, (time - ctx.currentTime) * 1000) + (decay - time) * 1000 + 200;
  setTimeout(() => {
    try { master.disconnect(); filter.disconnect(); } catch {}
  }, cleanupMs);
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
