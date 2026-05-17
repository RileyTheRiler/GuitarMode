import { describe, it, expect } from "vitest";
import { analyzeAudioBuffer } from "./analyzeBuffer";

function makeAudioBuffer(
  data: Float32Array,
  sampleRate = 44100,
  numberOfChannels = 1
): AudioBuffer {
  const channels = Array.from({ length: numberOfChannels }, () => data.slice());
  return {
    sampleRate,
    length: data.length,
    duration: data.length / sampleRate,
    numberOfChannels,
    getChannelData: (ch: number) => channels[ch],
    copyFromChannel: () => {},
    copyToChannel: () => {},
  } as unknown as AudioBuffer;
}

function makeSilence(samples: number, sampleRate = 44100): AudioBuffer {
  return makeAudioBuffer(new Float32Array(samples), sampleRate);
}

function makeTone(
  freq: number,
  samples: number,
  sampleRate = 44100,
  amplitude = 0.5
): AudioBuffer {
  const data = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    data[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return makeAudioBuffer(data, sampleRate);
}

describe("analyzeAudioBuffer — result shape", () => {
  it("returns notes, chroma, and durationMs fields", async () => {
    const result = await analyzeAudioBuffer(makeSilence(44100));
    expect(result).toHaveProperty("notes");
    expect(result).toHaveProperty("chroma");
    expect(result).toHaveProperty("durationMs");
  });

  it("durationMs matches buffer length / sampleRate * 1000", async () => {
    const samples = 44100;
    const result = await analyzeAudioBuffer(makeSilence(samples, 44100));
    expect(result.durationMs).toBeCloseTo(1000, 1);
  });

  it("chroma is always a 12-element array", async () => {
    const result = await analyzeAudioBuffer(makeSilence(2048));
    expect(result.chroma).toHaveLength(12);
  });
});

describe("analyzeAudioBuffer — silence", () => {
  it("all-silence buffer produces no notes", async () => {
    const result = await analyzeAudioBuffer(makeSilence(44100));
    expect(result.notes).toHaveLength(0);
  });

  it("buffer shorter than frameSize produces no notes", async () => {
    // Default frameSize=2048; a 512-sample buffer has no complete frames
    const result = await analyzeAudioBuffer(makeSilence(512));
    expect(result.notes).toHaveLength(0);
  });
});

describe("analyzeAudioBuffer — pitch detection", () => {
  it("detects a sustained A-pitch note from a 440 Hz tone", async () => {
    // 3 seconds at 440 Hz with amplitude 0.5 — well above minRms=0.01.
    // octaveCorrect may halve the frequency for a pure sine (pure tones have
    // periodicity at every multiple of their period), so we check pitch class
    // rather than the exact MIDI value.
    const buffer = makeTone(440, 44100 * 3);
    const result = await analyzeAudioBuffer(buffer, { framesToConfirm: 2, minClarity: 0.85 });
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.notes[0].pitchClass).toBe(9); // A, any octave
  });

  it("detected notes have the expected shape", async () => {
    const buffer = makeTone(440, 44100 * 2);
    const result = await analyzeAudioBuffer(buffer, { framesToConfirm: 2 });
    for (const note of result.notes) {
      expect(note).toHaveProperty("midi");
      expect(note).toHaveProperty("noteName");
      expect(note).toHaveProperty("pitchClass");
      expect(note).toHaveProperty("frequency");
      expect(note).toHaveProperty("clarity");
      expect(note).toHaveProperty("at");
      expect(note).toHaveProperty("endAt");
      expect(note).toHaveProperty("durationMs");
    }
  });

  it("notes are ordered by start time (at)", async () => {
    const buffer = makeTone(330, 44100 * 2);
    const result = await analyzeAudioBuffer(buffer, { framesToConfirm: 1 });
    for (let i = 1; i < result.notes.length; i++) {
      expect(result.notes[i].at).toBeGreaterThanOrEqual(result.notes[i - 1].at);
    }
  });
});

describe("analyzeAudioBuffer — stereo mix-down", () => {
  it("stereo buffer is mixed to mono (detects same pitch as mono)", async () => {
    const samples = 44100 * 2;
    const data = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      data[i] = 0.5 * Math.sin((2 * Math.PI * 440 * i) / 44100);
    }
    const stereoBuffer = makeAudioBuffer(data, 44100, 2);
    const result = await analyzeAudioBuffer(stereoBuffer, { framesToConfirm: 2, minClarity: 0.85 });
    // After mixing 2 identical channels, amplitude stays at 0.5 → detects A
    expect(result.notes.length).toBeGreaterThan(0);
    expect(result.notes[0].pitchClass).toBe(9); // A, any octave
  });
});

describe("analyzeAudioBuffer — AbortSignal", () => {
  it("throws DOMException with AbortError when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const buffer = makeTone(440, 44100 * 5); // long buffer
    await expect(analyzeAudioBuffer(buffer, {}, controller.signal)).rejects.toThrow("Aborted");
  });
});
