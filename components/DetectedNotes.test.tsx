/// <reference types="vitest/globals" />
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DetectedNotes } from "./DetectedNotes";
import type { DetectedNote } from "@/lib/audio/usePitchDetector";

afterEach(cleanup);

function makeNote(noteName: string, at: number): DetectedNote {
  return {
    midi: 60,
    noteName,
    pitchClass: 0,
    frequency: 440,
    clarity: 0.95,
    at,
    endAt: at + 500,
    durationMs: 500,
  };
}

describe("DetectedNotes", () => {
  it("shows empty-state message when no notes", () => {
    render(<DetectedNotes notes={[]} />);
    expect(screen.getByText(/no notes yet/i)).toBeTruthy();
  });

  it("renders note names", () => {
    const notes = [makeNote("C4", 0), makeNote("G4", 600)];
    render(<DetectedNotes notes={notes} />);
    expect(screen.getByText("C4")).toBeTruthy();
    expect(screen.getByText("G4")).toBeTruthy();
  });

  it("calls onDelete when the remove button is clicked", () => {
    const onDelete = vi.fn();
    render(<DetectedNotes notes={[makeNote("A4", 0)]} onDelete={onDelete} />);
    const btn = screen.getByRole("button", { name: /remove A4/i });
    fireEvent.click(btn);
    expect(onDelete).toHaveBeenCalledWith(0);
  });

  it("shows duration in ms for short notes", () => {
    const notes = [makeNote("E4", 0)];
    render(<DetectedNotes notes={notes} />);
    expect(screen.getByText("500ms")).toBeTruthy();
  });

  it("shows duration in seconds for long notes", () => {
    const note: DetectedNote = { ...makeNote("E4", 0), durationMs: 2500, endAt: 2500 };
    render(<DetectedNotes notes={[note]} />);
    expect(screen.getByText("2.5s")).toBeTruthy();
  });

  it("has an ARIA live region for screen reader announcements", () => {
    const notes = [makeNote("D4", 0)];
    render(<DetectedNotes notes={notes} />);
    expect(screen.getByRole("status")).toBeTruthy();
  });
});
