/// <reference types="vitest/globals" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MicControls } from "./MicControls";

afterEach(cleanup);

function makeProps(overrides: Partial<Parameters<typeof MicControls>[0]> = {}) {
  return {
    micOn: false,
    onToggleMic: vi.fn(),
    onReset: vi.fn(),
    onUpload: vi.fn(),
    onStartRecording: vi.fn(),
    onStopRecording: vi.fn(),
    recording: false,
    analyzing: false,
    level: 0,
    ...overrides,
  };
}

describe("MicControls", () => {
  it("shows 'Start listening' when mic is off", () => {
    render(<MicControls {...makeProps()} />);
    expect(screen.getByRole("button", { name: /start listening/i })).toBeTruthy();
  });

  it("shows 'Mic on' with aria-pressed when mic is active", () => {
    render(<MicControls {...makeProps({ micOn: true })} />);
    const btn = screen.getByRole("button", { name: /mic on/i });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("calls onToggleMic when the mic button is clicked", () => {
    const onToggleMic = vi.fn();
    render(<MicControls {...makeProps({ onToggleMic })} />);
    fireEvent.click(screen.getByRole("button", { name: /start listening/i }));
    expect(onToggleMic).toHaveBeenCalledTimes(1);
  });

  it("calls onReset when Start over is clicked", () => {
    const onReset = vi.fn();
    render(<MicControls {...makeProps({ onReset })} />);
    fireEvent.click(screen.getByRole("button", { name: /start over/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("record button is disabled when mic is off and not recording", () => {
    render(<MicControls {...makeProps({ micOn: false, recording: false })} />);
    const btn = screen.getByRole("button", { name: /record sample/i });
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("record button is enabled and shows stop text when recording", () => {
    render(<MicControls {...makeProps({ recording: true })} />);
    const btn = screen.getByRole("button", { name: /stop & analyze/i });
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  it("calls onStopRecording when the stop button is clicked while recording", () => {
    const onStopRecording = vi.fn();
    render(<MicControls {...makeProps({ recording: true, onStopRecording })} />);
    fireEvent.click(screen.getByRole("button", { name: /stop & analyze/i }));
    expect(onStopRecording).toHaveBeenCalledTimes(1);
  });

  it("shows recording indicator in the live region when recording", () => {
    render(<MicControls {...makeProps({ recording: true })} />);
    expect(screen.getByText(/recording/i)).toBeTruthy();
  });

  it("shows analyzing label and progress when analyzing", () => {
    render(
      <MicControls
        {...makeProps({ analyzing: true, analyzeProgress: 0.6, analyzeLabel: "Loading model…" })}
      />
    );
    expect(screen.getByText("Loading model…")).toBeTruthy();
  });

  it("shows error message in an alert role when error prop is set", () => {
    render(<MicControls {...makeProps({ error: "Microphone access denied." })} />);
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByText("Microphone access denied.")).toBeTruthy();
  });

  it("calls onUpload with the selected file when a file is chosen", () => {
    const onUpload = vi.fn();
    const { container } = render(<MicControls {...makeProps({ onUpload })} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["audio data"], "test.wav", { type: "audio/wav" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it("hides Export MIDI button when hasNotes is false", () => {
    render(<MicControls {...makeProps({ onExportMidi: vi.fn(), hasNotes: false })} />);
    expect(screen.queryByText(/export midi/i)).toBeNull();
  });

  it("shows Export MIDI button when hasNotes is true", () => {
    const onExportMidi = vi.fn();
    render(<MicControls {...makeProps({ onExportMidi, hasNotes: true })} />);
    expect(screen.getByText(/export midi/i)).toBeTruthy();
  });

  it("calls onExportMidi when Export MIDI is clicked", () => {
    const onExportMidi = vi.fn();
    render(<MicControls {...makeProps({ onExportMidi, hasNotes: true })} />);
    fireEvent.click(screen.getByText(/export midi/i));
    expect(onExportMidi).toHaveBeenCalledTimes(1);
  });
});
