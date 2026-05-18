import { vi } from "vitest";

// jsdom doesn't implement matchMedia — stub it so components that check
// `if (!window.matchMedia) return` work without throwing.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// jsdom doesn't provide AudioContext — stub it as a safety net so any
// module-level code referencing it doesn't throw. Individual test files
// mock the specific audio modules they need.
const audioNodeStub = () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
});

Object.defineProperty(global, "AudioContext", {
  writable: true,
  value: vi.fn(() => ({
    state: "running",
    currentTime: 0,
    destination: {},
    resume: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    createGain: vi.fn(() => ({
      ...audioNodeStub(),
      gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    })),
    createOscillator: vi.fn(() => ({
      ...audioNodeStub(),
      type: "sine",
      frequency: { value: 440, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
    })),
    createBiquadFilter: vi.fn(() => ({
      ...audioNodeStub(),
      type: "highpass",
      frequency: { value: 80 },
    })),
    createAnalyser: vi.fn(() => ({
      ...audioNodeStub(),
      fftSize: 2048,
      frequencyBinCount: 1024,
      getFloatTimeDomainData: vi.fn(),
      getFloatFrequencyData: vi.fn(),
    })),
  })),
});
