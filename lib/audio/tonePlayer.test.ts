import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

function makeOscillatorNode() {
  return {
    type: "sine" as OscillatorType,
    frequency: { value: 0 },
    detune: { value: 0 },
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    disconnect: vi.fn(),
  };
}

function makeGainNode() {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function makeBiquadFilterNode() {
  return {
    type: "lowpass" as BiquadFilterType,
    frequency: {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    Q: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

function makeMockAudioContext(state: AudioContextState = "running") {
  return {
    state,
    currentTime: 1.0,
    destination: {},
    createOscillator: vi.fn(makeOscillatorNode),
    createGain: vi.fn(makeGainNode),
    createBiquadFilter: vi.fn(makeBiquadFilterNode),
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

// Returns a proper class whose instances are the provided mock object.
// vi.fn() with an arrow fn can't be used with `new`; using a class avoids that.
function makeConstructor(instance: object) {
  return class {
    constructor() {
      return instance;
    }
  } as unknown as typeof AudioContext;
}

describe("tonePlayer — scheduleClick", () => {
  let mockCtx: ReturnType<typeof makeMockAudioContext>;

  beforeEach(() => {
    vi.resetModules();
    mockCtx = makeMockAudioContext();
    vi.stubGlobal("window", { AudioContext: makeConstructor(mockCtx) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates an oscillator and a gain node", async () => {
    const { scheduleClick } = await import("./tonePlayer");
    scheduleClick(0);
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(1);
    expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
  });

  it("accent click uses higher frequency (1600 Hz) than normal (900 Hz)", async () => {
    const { scheduleClick } = await import("./tonePlayer");
    const osc1 = makeOscillatorNode();
    const osc2 = makeOscillatorNode();
    let call = 0;
    mockCtx.createOscillator.mockImplementation(() => (call++ === 0 ? osc1 : osc2));

    scheduleClick(0, false); // normal
    scheduleClick(0, true); // accent
    expect(osc1.frequency.value).toBe(900);
    expect(osc2.frequency.value).toBe(1600);
  });

  it("schedules start and stop on the oscillator at the given time", async () => {
    const { scheduleClick } = await import("./tonePlayer");
    const osc = makeOscillatorNode();
    mockCtx.createOscillator.mockReturnValue(osc);
    scheduleClick(2.0);
    expect(osc.start).toHaveBeenCalledWith(2.0);
    expect(osc.stop).toHaveBeenCalledWith(2.0 + 0.08);
  });

  it("resumes a suspended context", async () => {
    vi.resetModules();
    const suspendedCtx = makeMockAudioContext("suspended");
    vi.stubGlobal("window", { AudioContext: makeConstructor(suspendedCtx) });
    const { scheduleClick } = await import("./tonePlayer");
    scheduleClick(0);
    expect(suspendedCtx.resume).toHaveBeenCalled();
  });
});

describe("tonePlayer — playPluck", () => {
  let mockCtx: ReturnType<typeof makeMockAudioContext>;

  beforeEach(() => {
    vi.resetModules();
    mockCtx = makeMockAudioContext();
    vi.stubGlobal("window", { AudioContext: makeConstructor(mockCtx) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("creates two detuned oscillators", async () => {
    const { playPluck } = await import("./tonePlayer");
    playPluck(69); // A4
    expect(mockCtx.createOscillator).toHaveBeenCalledTimes(2);
  });

  it("creates a master gain and a lowpass filter", async () => {
    const { playPluck } = await import("./tonePlayer");
    playPluck(69);
    expect(mockCtx.createGain).toHaveBeenCalledTimes(1);
    expect(mockCtx.createBiquadFilter).toHaveBeenCalledTimes(1);
  });

  it("sets oscillator type to triangle", async () => {
    const { playPluck } = await import("./tonePlayer");
    const oscs: ReturnType<typeof makeOscillatorNode>[] = [];
    mockCtx.createOscillator.mockImplementation(() => {
      const o = makeOscillatorNode();
      oscs.push(o);
      return o;
    });
    playPluck(69);
    for (const o of oscs) {
      expect(o.type).toBe("triangle");
    }
  });
});

describe("tonePlayer — getToneContext", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", { AudioContext: makeConstructor(makeMockAudioContext()) });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns an AudioContext-like object with currentTime", async () => {
    const { getToneContext } = await import("./tonePlayer");
    const ctx = getToneContext();
    expect(ctx).toBeDefined();
    expect(typeof ctx.currentTime).toBe("number");
  });

  it("reuses the same context across calls", async () => {
    const { getToneContext } = await import("./tonePlayer");
    const ctx1 = getToneContext();
    const ctx2 = getToneContext();
    expect(ctx1).toBe(ctx2);
  });
});
