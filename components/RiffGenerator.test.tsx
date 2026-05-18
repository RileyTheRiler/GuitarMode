/// <reference types="vitest/globals" />
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { RiffGenerator } from "./RiffGenerator";

vi.mock("@/lib/audio/analyzeBuffer", () => ({
  decodeArrayBuffer: vi.fn().mockResolvedValue({}),
  analyzeAudioBuffer: vi.fn().mockResolvedValue({
    notes: [],
    chroma: new Array(12).fill(0),
  }),
}));

vi.mock("@/lib/audio/tonePlayer", () => ({
  playPluck: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

const MOCK_RIFF = {
  description: "A snappy minor pentatonic lick",
  riffNotes: ["A3", "C4", "D4", "E4", "G4"],
  tablature:
    "e|----------|\nB|----------|\nG|----------|\nD|----------|\nA|-0-3-5-7--|\nE|----------|",
  scale: "A Minor Pentatonic",
  tips: "Use alternate picking for speed.",
};

function mockFetchOk(data = MOCK_RIFF) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockFetchError(message = "Model overloaded") {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({ error: message }),
  } as Response);
}

function renderRiff() {
  return render(
    <RiffGenerator onRiffNotes={vi.fn()} onRiffNoteActive={vi.fn()} />
  );
}

function setSong(title = "Test Song") {
  fireEvent.change(screen.getByPlaceholderText(/smoke on the water/i), {
    target: { value: title },
  });
}

describe("RiffGenerator", () => {
  it("renders all form fields", () => {
    renderRiff();
    expect(screen.getByPlaceholderText(/smoke on the water/i)).toBeTruthy();
    expect(screen.getByPlaceholderText(/deep purple/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /generate riff/i })).toBeTruthy();
  });

  it("section buttons are all shown", () => {
    renderRiff();
    expect(screen.getByRole("button", { name: /verse/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /chorus/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /solo/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /bridge/i })).toBeTruthy();
  });

  it("generate button is disabled when song is empty", () => {
    renderRiff();
    const btn = screen.getByRole("button", { name: /generate riff/i });
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("generate button is enabled after typing a song title", () => {
    renderRiff();
    setSong();
    const btn = screen.getByRole("button", { name: /generate riff/i });
    expect(btn.hasAttribute("disabled")).toBe(false);
  });

  it("shows riff result after a successful API response", async () => {
    mockFetchOk();
    renderRiff();
    setSong();
    fireEvent.click(screen.getByRole("button", { name: /generate riff/i }));
    await waitFor(() => {
      expect(screen.getByText("A snappy minor pentatonic lick")).toBeTruthy();
    });
    expect(screen.getByText("A Minor Pentatonic")).toBeTruthy();
    expect(screen.getByText(/use alternate picking/i)).toBeTruthy();
  });

  it("shows the tablature in a preformatted block", async () => {
    mockFetchOk();
    const { container } = renderRiff();
    setSong();
    fireEvent.click(screen.getByRole("button", { name: /generate riff/i }));
    await waitFor(() => {
      const pre = container.querySelector("pre");
      expect(pre).not.toBeNull();
      expect(pre?.textContent).toContain("A|-0-3-5-7--|");
    });
  });

  it("shows an error message on a failed API response", async () => {
    mockFetchError("Rate limit exceeded");
    renderRiff();
    setSong();
    fireEvent.click(screen.getByRole("button", { name: /generate riff/i }));
    await waitFor(() => {
      expect(screen.getByText(/rate limit exceeded/i)).toBeTruthy();
    });
  });

  it("shows a Try again button alongside the error", async () => {
    mockFetchError();
    renderRiff();
    setSong();
    fireEvent.click(screen.getByRole("button", { name: /generate riff/i }));
    await waitFor(() => screen.getByRole("button", { name: /try again/i }));
  });

  it("Try again button re-submits the request", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      callCount++;
      return { ok: false, json: () => Promise.resolve({ error: "Error" }) };
    });
    renderRiff();
    setSong();
    fireEvent.click(screen.getByRole("button", { name: /generate riff/i }));
    const retryBtn = await screen.findByRole("button", { name: /try again/i });
    fireEvent.click(retryBtn);
    await waitFor(() => expect(callCount).toBe(2));
  });

  it("saves the riff to history and shows the history count", async () => {
    mockFetchOk();
    renderRiff();
    setSong("My Song");
    fireEvent.click(screen.getByRole("button", { name: /generate riff/i }));
    await waitFor(() => screen.getByText("A snappy minor pentatonic lick"));
    expect(screen.getByText(/history \(1\)/i)).toBeTruthy();
  });

  it("shows saved riffs in the history panel after toggling it open", async () => {
    mockFetchOk();
    renderRiff();
    setSong("My Song");
    fireEvent.click(screen.getByRole("button", { name: /generate riff/i }));
    await waitFor(() => screen.getByText(/history \(1\)/i));
    fireEvent.click(screen.getByText(/history \(1\)/i));
    expect(screen.getByText("My Song")).toBeTruthy();
  });

  it("calls onRiffNotes with pitch classes after successful generation", async () => {
    mockFetchOk();
    const onRiffNotes = vi.fn();
    render(<RiffGenerator onRiffNotes={onRiffNotes} onRiffNoteActive={vi.fn()} />);
    setSong();
    fireEvent.click(screen.getByRole("button", { name: /generate riff/i }));
    await waitFor(() => expect(onRiffNotes).toHaveBeenCalled());
    const [pitchClasses, root] = onRiffNotes.mock.calls[0];
    expect(pitchClasses instanceof Set).toBe(true);
    expect(pitchClasses.size).toBeGreaterThan(0);
    expect(root).not.toBeNull();
  });
});
