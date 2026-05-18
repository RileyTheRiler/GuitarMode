import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the lazy-imported package. The wrapper synthesizes notes from
// outputToNotesPoly + noteFramesToTime + addPitchBendsToNoteEvents, so we
// short-circuit those to return a known shape.
vi.mock("@spotify/basic-pitch", () => {
  class FakeBasicPitch {
    constructor(public url: string) {}
    async evaluateModel(
      _buffer: AudioBuffer,
      onComplete: (f: number[][], o: number[][], c: number[][]) => void,
      onProgress: (pct: number) => void
    ) {
      onProgress(0.5);
      onComplete([[1]], [[1]], [[1]]);
      onProgress(1.0);
    }
  }
  return {
    BasicPitch: FakeBasicPitch,
    outputToNotesPoly: () => [
      { startFrame: 0, durationFrames: 10, pitchMidi: 69, amplitude: 0.8 },
    ],
    addPitchBendsToNoteEvents: (_c: number[][], notes: unknown[]) => notes,
    noteFramesToTime: () => [
      {
        startTimeSeconds: 1.0,
        durationSeconds: 0.5,
        pitchMidi: 69,
        amplitude: 0.8,
      },
    ],
  };
});

describe("analyzeWithBasicPitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps Basic Pitch output into DetectedNote shape", async () => {
    const { analyzeWithBasicPitch } = await import("./basicPitch");
    const fakeBuffer = {} as AudioBuffer;
    const progress: number[] = [];

    const notes = await analyzeWithBasicPitch(fakeBuffer, {
      a4Hz: 440,
      onProgress: (p) => progress.push(p),
    });

    expect(progress).toEqual([0.5, 1.0]);
    expect(notes).toHaveLength(1);
    const note = notes[0];
    expect(note.midi).toBe(69);
    expect(note.noteName).toBe("A4");
    expect(note.pitchClass).toBe(9);
    expect(note.at).toBe(1000); // 1.0 s
    expect(note.endAt).toBe(1500); // 1.5 s
    expect(note.durationMs).toBe(500);
    expect(note.clarity).toBe(0.8);
    expect(note.frequency).toBeCloseTo(440, 2);
  });

  it("honors A=432 when mapping pitch to frequency", async () => {
    const { analyzeWithBasicPitch } = await import("./basicPitch");
    const notes = await analyzeWithBasicPitch({} as AudioBuffer, { a4Hz: 432 });
    expect(notes[0].frequency).toBeCloseTo(432, 2);
  });

  it("throws AbortError when the signal is already aborted", async () => {
    const { analyzeWithBasicPitch } = await import("./basicPitch");
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(
      analyzeWithBasicPitch({} as AudioBuffer, { signal: ctrl.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("clamps amplitude into [0, 1] for the clarity field", async () => {
    vi.resetModules();
    vi.doMock("@spotify/basic-pitch", () => ({
      BasicPitch: class {
        constructor(_url: string) {}
        async evaluateModel(
          _buf: AudioBuffer,
          onComplete: (f: number[][], o: number[][], c: number[][]) => void
        ) {
          onComplete([[1]], [[1]], [[1]]);
        }
      },
      outputToNotesPoly: () => [],
      addPitchBendsToNoteEvents: (_c: number[][], n: unknown[]) => n,
      noteFramesToTime: () => [
        { startTimeSeconds: 0, durationSeconds: 0.1, pitchMidi: 60, amplitude: 3.5 },
        { startTimeSeconds: 0, durationSeconds: 0.1, pitchMidi: 60, amplitude: -0.2 },
      ],
    }));
    const { analyzeWithBasicPitch } = await import("./basicPitch");
    const notes = await analyzeWithBasicPitch({} as AudioBuffer);
    expect(notes[0].clarity).toBe(1);
    expect(notes[1].clarity).toBe(0);
  });
});
