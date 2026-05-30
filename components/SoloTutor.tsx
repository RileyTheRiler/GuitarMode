"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SoloCoachMessage, SoloCoachRequest } from "@/app/api/solo-coach/route";
import { Fretboard } from "@/components/Fretboard";
import { parseTab, columnsToTimes, detectColumnsPerBeat } from "@/lib/music/tabParser";
import { STANDARD_TUNING } from "@/lib/guitar/fretboard";
import { midiToPitchClass } from "@/lib/music/notes";
import { getToneContext, schedulePluck, type ScheduledNote } from "@/lib/audio/tonePlayer";

const STORAGE_KEY = "guitarmode:solo-tutor:v1";
const MAX_STORED = 20;
const LICK_BPM = 100;

type Topic = { label: string; seed: string };

const TOPICS: readonly Topic[] = [
  {
    label: "Phrasing & space",
    seed: "Teach me how to use phrasing and space to make my solos breathe. Give me a short exercise based on what I've been playing.",
  },
  {
    label: "Target & guide tones",
    seed: "Explain target tones and guide tones over a progression, and show me how to land on chord tones in my detected key and scale.",
  },
  {
    label: "Bends & vibrato",
    seed: "Coach me on expressive bends, vibrato, and slides. Give me a short lick I can practice in my detected scale.",
  },
  {
    label: "Build a solo",
    seed: "Walk me through building a solo with tension and release over a simple progression in my key, with a clear dynamic arc.",
  },
  {
    label: "Scale & mode choices",
    seed: "Help me choose scales and modes for soloing in my detected key, and explain when to switch between them.",
  },
  {
    label: "Motif & call-and-response",
    seed: "Teach me motif development and call-and-response phrasing, with an example built from my playing.",
  },
] as const;

function loadSaved(): SoloCoachMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is SoloCoachMessage =>
        !!m &&
        typeof (m as SoloCoachMessage).content === "string" &&
        ((m as SoloCoachMessage).role === "user" ||
          (m as SoloCoachMessage).role === "assistant")
    );
  } catch {
    return [];
  }
}

function saveToDisk(messages: SoloCoachMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-MAX_STORED)));
  } catch {}
}

// Pull the fenced segments out of a reply (odd indices of a ``` split).
function fencedBlocks(content: string): string[] {
  const segs = content.split("```");
  const blocks: string[] = [];
  // Skip a trailing unterminated fence (even number of segments).
  const last = segs.length % 2 === 0 ? segs.length - 1 : segs.length;
  for (let i = 1; i < last; i += 2) blocks.push(segs[i]);
  return blocks;
}

type Lick = {
  events: { stringIndex: number; fret: number }[][];
  pitchClasses: Set<number>;
  rootPitchClass: number | null;
  times: number[]; // seconds, one per event
};

// Find the most substantial ASCII tab in an assistant reply and turn it into a
// playable/visualizable lick. Returns null when no tab is present.
function extractLick(content: string): Lick | null {
  let best: ReturnType<typeof parseTab> | null = null;
  for (const block of fencedBlocks(content)) {
    let parsed;
    try {
      parsed = parseTab(block);
    } catch {
      continue;
    }
    if (parsed.events.length > 0 && (!best || parsed.events.length > best.events.length)) {
      best = parsed;
    }
  }
  if (!best || best.events.length === 0) return null;

  const pitchClasses = new Set<number>();
  let rootPitchClass: number | null = null;
  const events = best.events.map((ev) =>
    ev.notes.map((n) => {
      const midi = STANDARD_TUNING[n.stringIndex] + n.fret;
      const pc = midiToPitchClass(midi);
      pitchClasses.add(pc);
      if (rootPitchClass === null) rootPitchClass = pc;
      return { stringIndex: n.stringIndex, fret: n.fret };
    })
  );
  const cpb = detectColumnsPerBeat(best.events);
  const times = columnsToTimes(best.events, LICK_BPM, cpb);
  return { events, pitchClasses, rootPitchClass, times };
}

// Render an assistant reply, putting triple-backtick fenced sections (ASCII tab)
// into a monospaced block and keeping everything else as line-broken text.
function AssistantContent({ content }: { content: string }) {
  const segments = content.split("```");
  // An odd number of fences leaves an unterminated trailing segment — render it
  // as plain text rather than swallowing the rest of the reply into a code block.
  const trailingUnterminated = segments.length % 2 === 0;
  return (
    <>
      {segments.map((seg, i) => {
        const fenced =
          i % 2 === 1 && !(trailingUnterminated && i === segments.length - 1);
        if (fenced) {
          // Drop an optional language hint (e.g. ```tab / ```text) that sits as a
          // bare word on the first line, but never touch real tab content.
          const lines = seg.split("\n");
          if (lines.length > 1 && /^[a-zA-Z]+$/.test(lines[0].trim())) lines.shift();
          const body = lines.join("\n").replace(/^\n+|\n+$/g, "");
          if (body === "") return null;
          return (
            <pre
              key={i}
              className="my-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs leading-relaxed text-green-400 font-mono"
            >
              {body}
            </pre>
          );
        }
        if (seg.trim() === "") return null;
        return (
          <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed">
            {seg.trim()}
          </p>
        );
      })}
    </>
  );
}

type Props = {
  detectedKey?: string;
  detectedScale?: string;
  playedNotes?: string[];
};

export function SoloTutor({ detectedKey, detectedScale, playedNotes }: Props) {
  const [messages, setMessages] = useState<SoloCoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(loadSaved());
  }, []);

  // Persist only completed turns — skip the noisy partial states while a reply
  // is still streaming in.
  useEffect(() => {
    if (!loading && messages.length > 0) saveToDisk(messages);
  }, [messages, loading]);

  // Keep the transcript scrolled to the latest turn.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const sendMessages = useCallback(
    async (next: SoloCoachMessage[], topicLabel?: string) => {
      setMessages(next);
      setLoading(true);
      setStreaming(false);
      setError(null);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let placeholderAdded = false;

      try {
        const body: SoloCoachRequest = {
          messages: next,
          context: {
            detectedKey,
            detectedScale,
            playedNotes,
            topic: topicLabel ?? activeTopic ?? undefined,
          },
        };
        const res = await fetch("/api/solo-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        // Headers are in — stop the time-to-first-byte guard so a long reply
        // isn't cut off mid-stream.
        clearTimeout(timeout);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error ?? "Request failed");
        }

        const reader = res.body?.getReader();
        if (!reader) {
          // Fallback for non-streaming responses.
          const data = await res.json().catch(() => null);
          const reply = data && typeof data.reply === "string" ? data.reply : "";
          if (reply.trim() === "") throw new Error("Empty response. Try again.");
          setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
          return;
        }

        const decoder = new TextDecoder();
        let acc = "";
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        placeholderAdded = true;
        setStreaming(true);
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const copy = prev.slice();
            copy[copy.length - 1] = { role: "assistant", content: acc };
            return copy;
          });
        }
        acc += decoder.decode();
        if (acc.trim() === "") throw new Error("Empty response. Try again.");
      } catch (e) {
        if (placeholderAdded) {
          // Drop the streamed assistant bubble (empty or partial) so the
          // transcript ends on the user turn and retry/regenerate start clean.
          setMessages((prev) =>
            prev.length > 0 && prev[prev.length - 1].role === "assistant"
              ? prev.slice(0, -1)
              : prev
          );
        }
        if ((e as Error).name === "AbortError") {
          setError("Request timed out. Try again.");
        } else {
          setError(e instanceof Error ? e.message : "Something went wrong");
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
        setStreaming(false);
      }
    },
    [detectedKey, detectedScale, playedNotes, activeTopic]
  );

  const handleTopic = useCallback(
    (topic: Topic) => {
      if (loading) return;
      setActiveTopic(topic.label);
      const next: SoloCoachMessage[] = [...messages, { role: "user", content: topic.seed }];
      void sendMessages(next, topic.label);
    },
    [loading, messages, sendMessages]
  );

  const handleSubmit = useCallback(() => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const next: SoloCoachMessage[] = [...messages, { role: "user", content: text }];
    void sendMessages(next);
  }, [input, loading, messages, sendMessages]);

  const handleRetry = useCallback(() => {
    if (loading || messages.length === 0) return;
    if (messages[messages.length - 1].role === "user") {
      void sendMessages(messages);
    }
  }, [loading, messages, sendMessages]);

  // Drop the trailing assistant turn(s) and ask the coach again.
  const handleRegenerate = useCallback(() => {
    if (loading || messages.length === 0) return;
    let end = messages.length;
    while (end > 0 && messages[end - 1].role === "assistant") end--;
    if (end === 0) return;
    void sendMessages(messages.slice(0, end));
  }, [loading, messages, sendMessages]);

  const handleClear = useCallback(() => {
    setMessages([]);
    setActiveTopic(null);
    setError(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  const coachingLine =
    detectedKey || detectedScale
      ? `Coaching in ${detectedKey ?? ""} ${detectedScale ?? ""}`.trim()
      : null;

  const lastIsAssistant =
    messages.length > 0 && messages[messages.length - 1].role === "assistant";

  // The lick to put on the fretboard is parsed from the latest assistant reply.
  const lastAssistant = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") return messages[i].content;
    }
    return null;
  }, [messages]);

  const lick = useMemo(
    () => (lastAssistant ? extractLick(lastAssistant) : null),
    [lastAssistant]
  );

  // --- Lick playback (audio + fretboard highlight) ---
  const [playing, setPlaying] = useState(false);
  const [activePositions, setActivePositions] = useState<
    { stringIndex: number; fret: number }[]
  >([]);
  const playTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const scheduledRef = useRef<ScheduledNote[]>([]);

  const stopLick = useCallback(() => {
    playTimersRef.current.forEach(clearTimeout);
    playTimersRef.current = [];
    scheduledRef.current.forEach((s) => s.cancel());
    scheduledRef.current = [];
    setPlaying(false);
    setActivePositions([]);
  }, []);

  const playLick = useCallback(() => {
    if (!lick) return;
    if (playing) {
      stopLick();
      return;
    }
    const ctx = getToneContext();
    const base = ctx.currentTime + 0.1;
    setPlaying(true);
    lick.events.forEach((positions, i) => {
      const tSec = lick.times[i] ?? 0;
      for (const p of positions) {
        const midi = STANDARD_TUNING[p.stringIndex] + p.fret;
        scheduledRef.current.push(schedulePluck(midi, base + tSec));
      }
      const vt = setTimeout(() => setActivePositions(positions), tSec * 1000);
      playTimersRef.current.push(vt);
    });
    const endMs = (lick.times[lick.times.length - 1] ?? 0) * 1000 + 600;
    playTimersRef.current.push(setTimeout(stopLick, endMs));
  }, [lick, playing, stopLick]);

  // Stop playback when the lick changes or the component unmounts.
  useEffect(() => {
    stopLick();
    return () => stopLick();
  }, [lick, stopLick]);

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Solo Tutor
        </h2>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            Clear
          </button>
        )}
      </div>
      <p className="mb-3 text-xs text-zinc-500">
        {coachingLine
          ? coachingLine
          : "Your personal guitar solo coach. Play in the Detect tab and I'll tailor advice to it."}
      </p>

      {/* Lesson topics */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TOPICS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => handleTopic(t)}
            disabled={loading}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              activeTopic === t.label
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Transcript */}
      {messages.length > 0 && (
        <div
          ref={scrollRef}
          className="mb-3 max-h-96 space-y-3 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 ${
                  m.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-200"
                }`}
              >
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                ) : (
                  <AssistantContent content={m.content} />
                )}
              </div>
            </div>
          ))}
          {loading && !streaming && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400">
                Coaching…
              </div>
            </div>
          )}
        </div>
      )}

      {/* Lick on the fretboard, parsed from the latest reply */}
      {lick && (
        <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Lick on the fretboard
            </span>
            <button
              type="button"
              onClick={playLick}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition ${
                playing
                  ? "bg-amber-500 text-zinc-900 hover:bg-amber-400"
                  : "bg-zinc-700 text-zinc-100 hover:bg-zinc-600"
              }`}
            >
              {playing ? "■ Stop" : "▶ Play lick"}
            </button>
          </div>
          <Fretboard
            numFrets={17}
            tuning={STANDARD_TUNING}
            playedPitchClasses={lick.pitchClasses}
            rootPitchClass={lick.rootPitchClass}
            livePositions={activePositions}
            onFretClick={(_s, _f, midi) => {
              getToneContext();
              schedulePluck(midi, getToneContext().currentTime + 0.01);
            }}
          />
          <p className="mt-2 text-xs text-zinc-500">
            Filled circles are the lick&rsquo;s notes. Press play to hear it and watch the
            positions light up.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-3 flex items-center gap-3">
          <p className="text-xs text-rose-400">{error}</p>
          <button
            type="button"
            onClick={handleRetry}
            disabled={loading}
            className="shrink-0 rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700 disabled:opacity-50"
          >
            Try again
          </button>
        </div>
      )}

      {/* Regenerate the last reply */}
      {lastIsAssistant && !loading && (
        <div className="mb-3">
          <button
            type="button"
            onClick={handleRegenerate}
            className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-zinc-700"
          >
            ↻ Regenerate reply
          </button>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Ask the solo coach anything…"
          disabled={loading}
          className="flex-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 placeholder-zinc-600 outline-none focus:border-zinc-500 disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
