/// <reference types="vitest/globals" />
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SoloTutor } from "./SoloTutor";

vi.mock("@/lib/audio/tonePlayer", () => ({
  getToneContext: vi.fn(() => ({ currentTime: 0 })),
  schedulePluck: vi.fn(() => ({ stopAt: 0, cancel: vi.fn() })),
  playPluck: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.clear();
});

// Non-streaming response (no body) — exercises the JSON fallback path.
function mockFetchReply(reply: string) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ reply }),
  } as Response);
}

// Streaming response — body is a ReadableStream of UTF-8 chunks.
function mockFetchStream(chunks: string[]) {
  const enc = new TextEncoder();
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(enc.encode(c));
        controller.close();
      },
    }),
  } as unknown as Response);
}

const SIX_LINE_TAB =
  "```\n" +
  "e|-------------------|\n" +
  "B|-------------------|\n" +
  "G|-------------------|\n" +
  "D|-------------------|\n" +
  "A|-3-5-7-------------|\n" +
  "E|-------------------|\n" +
  "```";

function mockFetchError(message = "AI service unavailable. Try again shortly.") {
  global.fetch = vi.fn().mockResolvedValue({
    ok: false,
    json: () => Promise.resolve({ error: message }),
  } as Response);
}

function typeMessage(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/ask the solo coach/i), {
    target: { value: text },
  });
}

describe("SoloTutor", () => {
  it("renders lesson topic chips and the input", () => {
    render(<SoloTutor />);
    expect(screen.getByRole("button", { name: /phrasing & space/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /bends & vibrato/i })).toBeTruthy();
    expect(screen.getByPlaceholderText(/ask the solo coach/i)).toBeTruthy();
  });

  it("shows the detected key and scale when provided", () => {
    render(<SoloTutor detectedKey="A" detectedScale="Minor Pentatonic" />);
    expect(screen.getByText(/coaching in a minor pentatonic/i)).toBeTruthy();
  });

  it("Send is disabled until text is entered", () => {
    render(<SoloTutor />);
    const send = screen.getByRole("button", { name: /send/i });
    expect(send.hasAttribute("disabled")).toBe(true);
    typeMessage("How do I phrase?");
    expect(send.hasAttribute("disabled")).toBe(false);
  });

  it("tapping a topic sends a request and renders the assistant reply", async () => {
    mockFetchReply("Leave space between phrases.");
    render(<SoloTutor />);
    fireEvent.click(screen.getByRole("button", { name: /phrasing & space/i }));
    await waitFor(() => {
      expect(screen.getByText(/leave space between phrases/i)).toBeTruthy();
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/solo-coach", expect.anything());
  });

  it("sends the personalization context in the request body", async () => {
    mockFetchReply("ok");
    render(
      <SoloTutor detectedKey="A" detectedScale="Minor Pentatonic" playedNotes={["A3", "C4"]} />
    );
    typeMessage("Help me");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const body = JSON.parse((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
    expect(body.context.detectedKey).toBe("A");
    expect(body.context.detectedScale).toBe("Minor Pentatonic");
    expect(body.context.playedNotes).toEqual(["A3", "C4"]);
    expect(body.messages[body.messages.length - 1].role).toBe("user");
  });

  it("renders fenced ASCII tab in a preformatted block", async () => {
    mockFetchReply("Try this:\n```\ne|--5--|\nB|--7--|\n```\nNice and slow.");
    const { container } = render(<SoloTutor />);
    typeMessage("give me a lick");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      const pre = container.querySelector("pre");
      expect(pre).not.toBeNull();
      expect(pre?.textContent).toContain("e|--5--|");
    });
  });

  it("strips a language hint from a fenced block but keeps tab content", async () => {
    mockFetchReply("```tab\ne|--3--|\n```");
    const { container } = render(<SoloTutor />);
    typeMessage("lick");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      const pre = container.querySelector("pre");
      expect(pre?.textContent).toBe("e|--3--|");
    });
  });

  it("renders an unterminated code fence as plain text, not a code block", async () => {
    mockFetchReply("Start playing ```here we go and keep going");
    const { container } = render(<SoloTutor />);
    typeMessage("go");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => screen.getByText(/here we go/i));
    expect(container.querySelector("pre")).toBeNull();
  });

  it("shows an error and a Try again button on a failed response", async () => {
    mockFetchError("Too many requests. Please wait a moment.");
    render(<SoloTutor />);
    typeMessage("Help");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText(/too many requests/i)).toBeTruthy();
    });
    expect(screen.getByRole("button", { name: /try again/i })).toBeTruthy();
  });

  it("Try again re-submits the last user message", async () => {
    let calls = 0;
    global.fetch = vi.fn().mockImplementation(async () => {
      calls++;
      return { ok: false, json: () => Promise.resolve({ error: "Error" }) };
    });
    render(<SoloTutor />);
    typeMessage("Coach me");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    const retry = await screen.findByRole("button", { name: /try again/i });
    fireEvent.click(retry);
    await waitFor(() => expect(calls).toBe(2));
  });

  it("persists the transcript to localStorage", async () => {
    mockFetchReply("Persisted advice.");
    render(<SoloTutor />);
    typeMessage("Remember this");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => screen.getByText(/persisted advice/i));
    const stored = JSON.parse(localStorage.getItem("guitarmode:solo-tutor:v1") ?? "[]");
    expect(stored.some((m: { content: string }) => m.content === "Persisted advice.")).toBe(true);
  });

  it("renders a streamed reply as chunks arrive", async () => {
    mockFetchStream(["Use ", "more ", "space."]);
    render(<SoloTutor />);
    typeMessage("How?");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => {
      expect(screen.getByText(/use more space\./i)).toBeTruthy();
    });
  });

  it("treats an empty stream as an error", async () => {
    mockFetchStream([]);
    render(<SoloTutor />);
    typeMessage("hi");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => screen.getByText(/empty response/i));
  });

  it("shows a Regenerate button after a reply and re-requests on click", async () => {
    let calls = 0;
    const enc = new TextEncoder();
    global.fetch = vi.fn().mockImplementation(async () => {
      calls++;
      return {
        ok: true,
        body: new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(enc.encode(calls === 1 ? "First answer." : "Second answer."));
            c.close();
          },
        }),
      } as unknown as Response;
    });
    render(<SoloTutor />);
    typeMessage("teach me");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => screen.getByText(/first answer/i));
    fireEvent.click(screen.getByRole("button", { name: /regenerate/i }));
    await waitFor(() => screen.getByText(/second answer/i));
    expect(calls).toBe(2);
    // The old reply should be gone (replaced, not appended).
    expect(screen.queryByText(/first answer/i)).toBeNull();
  });

  it("renders a fretboard with a Play lick button when the reply contains tab", async () => {
    mockFetchReply(`Here is a lick:\n${SIX_LINE_TAB}\nHave fun.`);
    const { container } = render(<SoloTutor />);
    typeMessage("give me a lick");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => screen.getByText(/lick on the fretboard/i));
    expect(screen.getByRole("button", { name: /play lick/i })).toBeTruthy();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("Clear empties the transcript and storage", async () => {
    mockFetchReply("Some advice.");
    render(<SoloTutor />);
    typeMessage("Hi");
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => screen.getByText(/some advice/i));
    fireEvent.click(screen.getByRole("button", { name: /^clear$/i }));
    expect(screen.queryByText(/some advice/i)).toBeNull();
    expect(localStorage.getItem("guitarmode:solo-tutor:v1")).toBeNull();
  });
});
