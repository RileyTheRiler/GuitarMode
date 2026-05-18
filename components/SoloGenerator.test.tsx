/// <reference types="vitest/globals" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, act } from "@testing-library/react";
import { SoloGenerator } from "./SoloGenerator";
import { generateSolo } from "@/lib/music/soloGenerator";
import { createSoloPlayer } from "@/lib/audio/soloPlayer";
import type { GeneratedSolo } from "@/lib/music/soloGenerator";

vi.mock("@/lib/music/soloGenerator", () => ({
  generateSolo: vi.fn(),
}));

vi.mock("@/lib/audio/soloPlayer", () => ({
  createSoloPlayer: vi.fn(),
}));

// Fretboard is an SVG-heavy component — stub it so tests stay focused on SoloGenerator.
vi.mock("./Fretboard", () => ({
  Fretboard: () => null,
}));

const MOCK_SOLO: GeneratedSolo = {
  notes: [
    { stringIndex: 1, fret: 5, midi: 64, pitchClass: 4, startBeat: 0, durationBeats: 1 },
    { stringIndex: 1, fret: 7, midi: 67, pitchClass: 7, startBeat: 1, durationBeats: 1 },
    { stringIndex: 2, fret: 5, midi: 69, pitchClass: 9, startBeat: 2, durationBeats: 1 },
    { stringIndex: 0, fret: 5, midi: 72, pitchClass: 0, startBeat: 3, durationBeats: 1 },
  ],
  bpm: 100,
  totalBeats: 8,
  scaleRoot: 9, // A
  scaleName: "Minor Pentatonic",
  scalePitchClasses: new Set([9, 0, 2, 4, 7]),
  centerFret: 5,
};

const mockStart = vi.fn();
const mockStop = vi.fn();

beforeEach(() => {
  vi.mocked(generateSolo).mockReturnValue(MOCK_SOLO);
  vi.mocked(createSoloPlayer).mockReturnValue({
    start: mockStart,
    stop: mockStop,
    isPlaying: () => false,
  });
  mockStart.mockReset();
  mockStop.mockReset();

  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
    writable: true,
    configurable: true,
  });
});

afterEach(cleanup);

describe("SoloGenerator", () => {
  it("calls generateSolo on mount with the default chord input", () => {
    render(<SoloGenerator />);
    expect(vi.mocked(generateSolo)).toHaveBeenCalled();
    const call = vi.mocked(generateSolo).mock.calls[0][0];
    expect(call.chords).toContain("Am");
  });

  it("shows scale info in the header after solo is generated", () => {
    render(<SoloGenerator />);
    // "A Minor Pentatonic" — use exact match to avoid matching the preset button "Minor pentatonic"
    expect(screen.getByText("A Minor Pentatonic")).toBeTruthy();
  });

  it("shows note count and fret range in the header", () => {
    render(<SoloGenerator />);
    expect(screen.getByText(/4 notes/i)).toBeTruthy();
    expect(screen.getByText(/frets 5/i)).toBeTruthy();
  });

  it("shows an error when the chord input is empty on generate", async () => {
    render(<SoloGenerator />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "" } });
    // Click generate — need to find the generate button
    const genBtn = screen.getByRole("button", { name: /generate new solo/i });
    fireEvent.click(genBtn);
    expect(screen.getByText(/enter at least one chord/i)).toBeTruthy();
  });

  it("clicking a preset populates the chord input", () => {
    render(<SoloGenerator />);
    fireEvent.click(screen.getByRole("button", { name: /i–v–vi–iv/i }));
    const input = screen.getByRole("textbox") as HTMLInputElement;
    expect(input.value).toBe("C G Am F");
  });

  it("style buttons update the active selection", () => {
    render(<SoloGenerator />);
    const bluesBtn = screen.getByRole("button", { name: /^blues$/i });
    fireEvent.click(bluesBtn);
    // After clicking Blues, clicking Generate should pass style: "blues"
    vi.mocked(generateSolo).mockClear();
    fireEvent.click(screen.getByRole("button", { name: /generate new solo/i }));
    const call = vi.mocked(generateSolo).mock.calls[0][0];
    expect(call.style).toBe("blues");
  });

  it("BPM slider updates the value passed to generateSolo", () => {
    render(<SoloGenerator />);
    const slider = screen.getByRole("slider");
    fireEvent.change(slider, { target: { value: "140" } });
    vi.mocked(generateSolo).mockClear();
    fireEvent.click(screen.getByRole("button", { name: /generate new solo/i }));
    const call = vi.mocked(generateSolo).mock.calls[0][0];
    expect(call.bpm).toBe(140);
  });

  it("play button is enabled after generation and calls createSoloPlayer", async () => {
    render(<SoloGenerator />);
    const playBtn = screen.getByRole("button", { name: /play solo/i });
    expect(playBtn.hasAttribute("disabled")).toBe(false);
    fireEvent.click(playBtn);
    expect(vi.mocked(createSoloPlayer)).toHaveBeenCalledWith(MOCK_SOLO, expect.any(Object));
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("play button is disabled before any solo is generated", () => {
    // Return an empty-notes solo so setSolo is never called (error path)
    vi.mocked(generateSolo).mockReturnValueOnce({ ...MOCK_SOLO, notes: [] });
    render(<SoloGenerator />);
    const playBtn = screen.getByRole("button", { name: /play solo/i });
    expect(playBtn.hasAttribute("disabled")).toBe(true);
  });

  it("tab section is visible by default", () => {
    render(<SoloGenerator />);
    // The "Guitar Tab" heading and the pre block are shown when showTab=true (default)
    expect(screen.getByText(/guitar tab/i)).toBeTruthy();
  });

  it("copy button shows 'Copied!' after clicking", async () => {
    render(<SoloGenerator />);
    // Tab is shown by default (showTab starts true)
    fireEvent.click(screen.getByRole("button", { name: /^copy$/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /copied!/i })).toBeTruthy();
    });
  });

  it("generating a new solo re-calls generateSolo", () => {
    render(<SoloGenerator />);
    vi.mocked(generateSolo).mockClear();
    fireEvent.click(screen.getByRole("button", { name: /generate new solo/i }));
    expect(vi.mocked(generateSolo)).toHaveBeenCalledTimes(1);
  });
});
