"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  SoloCoachMessage,
  SoloCoachRequest,
  SoloCoachResponse,
} from "@/app/api/solo-coach/route";

const STORAGE_KEY = "guitarmode:solo-tutor:v1";
const MAX_STORED = 20;

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

// Render an assistant reply, putting triple-backtick fenced sections (ASCII tab)
// into a monospaced block and keeping everything else as line-broken text.
function AssistantContent({ content }: { content: string }) {
  const segments = content.split("```");
  return (
    <>
      {segments.map((seg, i) => {
        const fenced = i % 2 === 1;
        if (fenced) {
          // Drop an optional language hint on the first line of the fence.
          const body = seg.replace(/^[^\n]*\n/, (m) => (m.trim().includes(" ") ? "" : m));
          return (
            <pre
              key={i}
              className="my-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs leading-relaxed text-green-400 font-mono"
            >
              {body.replace(/\n$/, "")}
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
  const [error, setError] = useState<string | null>(null);
  const [activeTopic, setActiveTopic] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages(loadSaved());
  }, []);

  useEffect(() => {
    if (messages.length > 0) saveToDisk(messages);
  }, [messages]);

  // Keep the transcript scrolled to the latest turn.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const sendMessages = useCallback(
    async (next: SoloCoachMessage[], topicLabel?: string) => {
      setMessages(next);
      setLoading(true);
      setError(null);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

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
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          throw new Error(err.error ?? "Request failed");
        }
        const data: SoloCoachResponse = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          setError("Request timed out. Try again.");
        } else {
          setError(e instanceof Error ? e.message : "Something went wrong");
        }
      } finally {
        clearTimeout(timeout);
        setLoading(false);
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
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-400">
                Coaching…
              </div>
            </div>
          )}
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
