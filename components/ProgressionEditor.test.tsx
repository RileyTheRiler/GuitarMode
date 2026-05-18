/// <reference types="vitest/globals" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { ProgressionEditor } from "./ProgressionEditor";
import { useProgressionPlayer } from "@/lib/audio/useProgressionPlayer";
import type { ChordEvent } from "@/lib/music/progression";

vi.mock("@/lib/audio/useProgressionPlayer");

afterEach(cleanup);

function makePlayer(overrides: Partial<ReturnType<typeof useProgressionPlayer>> = {}) {
  return {
    play: vi.fn(),
    stop: vi.fn(),
    playing: false,
    currentChord: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(useProgressionPlayer).mockReturnValue(makePlayer());
});

const SIMPLE_PROG: ChordEvent[] = [
  { time: 0, chord: "Am" },
  { time: 2, chord: "G" },
];

describe("ProgressionEditor", () => {
  it("renders the Chord progression header", () => {
    render(<ProgressionEditor progression={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /chord progression/i })).toBeTruthy();
  });

  it("hides the textarea editor by default (collapsed)", () => {
    render(<ProgressionEditor progression={[]} onChange={vi.fn()} />);
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("expands to show textarea when the header is clicked", () => {
    render(<ProgressionEditor progression={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /chord progression/i }));
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("shows chord count in the header", () => {
    render(<ProgressionEditor progression={SIMPLE_PROG} onChange={vi.fn()} />);
    expect(screen.getByText(/2 chords/i)).toBeTruthy();
  });

  it("loading a preset calls onChange with the preset's chord events", () => {
    const onChange = vi.fn();
    render(<ProgressionEditor progression={[]} onChange={onChange} />);
    const select = screen.getByRole("combobox", { name: /load a preset/i });
    fireEvent.change(select, { target: { value: "I–IV–V–I (G major)" } });
    expect(onChange).toHaveBeenCalledWith([
      { time: 0, chord: "G" },
      { time: 2, chord: "C" },
      { time: 4, chord: "D" },
      { time: 6, chord: "G" },
    ]);
  });

  it("opening preset auto-expands the editor", () => {
    render(<ProgressionEditor progression={[]} onChange={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: /load a preset/i });
    fireEvent.change(select, { target: { value: "I–IV–V–I (G major)" } });
    expect(screen.getByRole("textbox")).toBeTruthy();
  });

  it("shows a validation error for non-array JSON in the textarea", () => {
    render(<ProgressionEditor progression={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /chord progression/i }));
    // Use an object (not array) to trigger the component's own error message
    fireEvent.change(screen.getByRole("textbox"), { target: { value: '{"not":"array"}' } });
    expect(screen.getByText(/expected an array/i)).toBeTruthy();
  });

  it("shows an error for a missing chord field in the JSON", () => {
    render(<ProgressionEditor progression={[]} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /chord progression/i }));
    const bad = JSON.stringify([{ time: 0 }]);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: bad } });
    expect(screen.getByText(/chord.*must be/i)).toBeTruthy();
  });

  it("shows success text when valid JSON is entered", () => {
    // Use a stateful wrapper so the progression prop updates when onChange fires
    function Wrapper() {
      const [prog, setProg] = useState<ChordEvent[]>([]);
      return (
        <ProgressionEditor progression={prog} onChange={setProg} />
      );
    }
    render(<Wrapper />);
    fireEvent.click(screen.getByRole("button", { name: /chord progression/i }));
    const valid = JSON.stringify([{ time: 0, chord: "Am" }]);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: valid } });
    expect(screen.getByText(/loaded 1 chord/i)).toBeTruthy();
  });

  it("play button is disabled when progression is empty", () => {
    render(<ProgressionEditor progression={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^play$/i }).hasAttribute("disabled")).toBe(true);
  });

  it("play button calls player.play with the progression", () => {
    const mockPlay = vi.fn();
    vi.mocked(useProgressionPlayer).mockReturnValue(makePlayer({ play: mockPlay }));
    render(<ProgressionEditor progression={SIMPLE_PROG} onChange={vi.fn()} a4Hz={440} />);
    fireEvent.click(screen.getByRole("button", { name: /^play$/i }));
    expect(mockPlay).toHaveBeenCalledWith(SIMPLE_PROG, 440);
  });

  it("stop button calls player.stop when player is playing", () => {
    const mockStop = vi.fn();
    vi.mocked(useProgressionPlayer).mockReturnValue(makePlayer({ playing: true, stop: mockStop }));
    render(<ProgressionEditor progression={SIMPLE_PROG} onChange={vi.fn()} />);
    // The component's useEffect([progression]) calls stop on mount when playing=true,
    // so clear the mock before asserting on the button click.
    mockStop.mockClear();
    fireEvent.click(screen.getByRole("button", { name: /^stop$/i }));
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it("clear button calls onChange with an empty array", () => {
    const onChange = vi.fn();
    render(<ProgressionEditor progression={SIMPLE_PROG} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("imports a valid JSON file and calls onChange", async () => {
    const onChange = vi.fn();
    const { container } = render(<ProgressionEditor progression={[]} onChange={onChange} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const json = JSON.stringify([{ time: 0, chord: "G" }, { time: 2, chord: "D" }]);
    const file = new File([json], "prog.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([
        { time: 0, chord: "G" },
        { time: 2, chord: "D" },
      ]);
    });
  });

  it("shows import error for an invalid JSON file", async () => {
    const { container } = render(<ProgressionEditor progression={[]} onChange={vi.fn()} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["not json at all"], "bad.json", { type: "application/json" });
    // Wrap in act(async) to flush the file.text() promise before asserting
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } });
    });
    expect(screen.getByText(/import failed/i)).toBeTruthy();
  });
});
