"use client";

import { useState, useCallback } from "react";
import { schedulePluck, getToneContext } from "@/lib/audio/tonePlayer";
import { CHORD_TEMPLATES, type ChordQuality } from "@/lib/music/chords";
import { INTERVAL_NAMES } from "@/lib/music/intervals";

type TrainingMode = "interval" | "chord" | "degree";
type Phase = "idle" | "ready" | "answered";

type Question = {
  correctAnswer: string;
  midiNotes: Array<{ midi: number; delay: number }>;
  options: readonly string[];
};

// ── display labels ──────────────────────────────────────────────────────────

const INTERVAL_DISPLAY: Record<string, string> = {
  P1: "Unison", m2: "Min 2nd", M2: "Maj 2nd", m3: "Min 3rd",
  M3: "Maj 3rd", P4: "Perfect 4th", TT: "Tritone",
  P5: "Perfect 5th", m6: "Min 6th", M6: "Maj 6th", m7: "Min 7th", M7: "Maj 7th",
};

const CHORD_DISPLAY: Record<string, string> = {
  maj: "Major", min: "Minor", "7": "Dom 7th",
  maj7: "Major 7th", min7: "Minor 7th", dim: "Diminished",
};

const DEGREE_LABELS = ["1", "♭2", "2", "♭3", "3", "4", "♯4", "5", "♭6", "6", "♭7", "7"] as const;

// ── question pools ───────────────────────────────────────────────────────────

const CHORD_POOL: ChordQuality[] = ["maj", "min", "7", "maj7", "min7", "dim"];

// ── helpers ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeIntervalQuestion(): Question {
  // Exclude P1 (unison) from the pool so every question has a clear answer
  const pool = INTERVAL_NAMES.filter((n) => n !== "P1");
  const name = pickRandom(pool);
  const semitones = INTERVAL_NAMES.indexOf(name);
  const root = 48 + Math.floor(Math.random() * 25); // C3–C5
  return {
    correctAnswer: name,
    midiNotes: [
      { midi: root, delay: 0 },
      { midi: root + semitones, delay: 0.7 },
    ],
    options: shuffle(pool),
  };
}

function makeChordQuestion(): Question {
  const quality = pickRandom(CHORD_POOL);
  const root = 48 + Math.floor(Math.random() * 12); // C3–B3
  const notes = CHORD_TEMPLATES[quality].intervals.map((iv, i) => ({
    midi: root + iv,
    delay: i * 0.2,
  }));
  return {
    correctAnswer: quality,
    midiNotes: notes,
    options: shuffle(CHORD_POOL),
  };
}

function makeDegreeQuestion(): Question {
  // Pick a semitone offset 1-11 (skip unison)
  const semitones = 1 + Math.floor(Math.random() * 11);
  const root = 48 + Math.floor(Math.random() * 25);
  return {
    correctAnswer: DEGREE_LABELS[semitones],
    midiNotes: [
      { midi: root, delay: 0 },
      { midi: root + semitones, delay: 0.7 },
    ],
    options: shuffle(DEGREE_LABELS.slice(1)), // exclude "1" (unison) from options too
  };
}

function playQuestion(q: Question, a4Hz: number) {
  const ctx = getToneContext();
  const now = ctx.currentTime + 0.05;
  for (const { midi, delay } of q.midiNotes) {
    schedulePluck(midi, now + delay, 0.9, a4Hz);
  }
}

// ── component ────────────────────────────────────────────────────────────────

export function EarTraining({ a4Hz = 440 }: { a4Hz?: number }) {
  const [mode, setMode] = useState<TrainingMode>("interval");
  const [phase, setPhase] = useState<Phase>("idle");
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [total, setTotal] = useState(0);

  const buildQuestion = useCallback((m: TrainingMode): Question => {
    if (m === "interval") return makeIntervalQuestion();
    if (m === "chord") return makeChordQuestion();
    return makeDegreeQuestion();
  }, []);

  const startQuestion = useCallback((m: TrainingMode = mode) => {
    const q = buildQuestion(m);
    setQuestion(q);
    setSelectedAnswer(null);
    setPhase("ready");
    playQuestion(q, a4Hz);
  }, [mode, buildQuestion, a4Hz]);

  const handleReplay = useCallback(() => {
    if (question) playQuestion(question, a4Hz);
  }, [question, a4Hz]);

  const handleAnswer = useCallback((ans: string) => {
    if (phase !== "ready" || !question) return;
    setSelectedAnswer(ans);
    setPhase("answered");
    setTotal((t) => t + 1);
    if (ans === question.correctAnswer) {
      setScore((s) => s + 1);
      setStreak((s) => s + 1);
    } else {
      setStreak(0);
    }
  }, [phase, question]);

  const handleModeChange = useCallback((m: TrainingMode) => {
    setMode(m);
    setPhase("idle");
    setQuestion(null);
    setSelectedAnswer(null);
  }, []);

  const displayLabel = (opt: string): string => {
    if (mode === "interval") return INTERVAL_DISPLAY[opt] ?? opt;
    if (mode === "chord") return CHORD_DISPLAY[opt] ?? opt;
    return opt;
  };

  const gridClass =
    mode === "interval" ? "grid-cols-2" :
    mode === "chord"    ? "grid-cols-3" :
                          "grid-cols-4";

  const modeDesc =
    mode === "interval" ? "Two notes play in sequence — name the interval between them." :
    mode === "chord"    ? "A chord arpeggio plays — identify its quality." :
                          "A root note plays, then a scale degree — name the degree.";

  return (
    <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 flex items-center gap-2 before:content-[''] before:block before:h-[3px] before:w-1 before:rounded-full before:bg-emerald-500/70 before:shrink-0">
          Ear Training
        </h2>
        {total > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-zinc-400">{score}/{total} correct</span>
            {streak >= 3 && (
              <span className="font-semibold text-amber-400">{streak} streak!</span>
            )}
          </div>
        )}
      </div>

      {/* Mode tabs */}
      <div className="mb-3 flex rounded-lg border border-zinc-800 bg-zinc-950 p-0.5">
        {(["interval", "chord", "degree"] as TrainingMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => handleModeChange(m)}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
              mode === m
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {m === "interval" ? "Intervals" : m === "chord" ? "Chords" : "Scale Degrees"}
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs text-zinc-500">{modeDesc}</p>

      {/* Controls */}
      <div className="mb-4 flex items-center gap-2">
        {phase === "idle" ? (
          <button
            type="button"
            onClick={() => startQuestion(mode)}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition"
          >
            Start
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={handleReplay}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 transition"
            >
              ↺ Replay
            </button>
            {phase === "answered" && (
              <button
                type="button"
                onClick={() => startQuestion(mode)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition"
              >
                Next →
              </button>
            )}
          </>
        )}
        {/* Result inline */}
        {phase === "answered" && question && (
          <span className={`text-sm font-medium ${
            selectedAnswer === question.correctAnswer ? "text-emerald-400" : "text-red-400"
          }`}>
            {selectedAnswer === question.correctAnswer
              ? "Correct!"
              : `Answer: ${displayLabel(question.correctAnswer)}`}
          </span>
        )}
      </div>

      {/* Answer grid */}
      {phase !== "idle" && question && (
        <div className={`grid gap-2 ${gridClass}`}>
          {question.options.map((opt) => {
            let cls =
              "rounded-lg border px-2 py-2 text-xs font-medium text-center transition ";
            if (phase === "answered") {
              if (opt === question.correctAnswer) {
                cls += "border-emerald-500 bg-emerald-500/20 text-emerald-300";
              } else if (opt === selectedAnswer) {
                cls += "border-red-500 bg-red-500/20 text-red-300";
              } else {
                cls += "border-zinc-700 bg-zinc-900 text-zinc-600";
              }
            } else {
              cls +=
                "border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800 cursor-pointer";
            }
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleAnswer(opt)}
                disabled={phase === "answered"}
                className={cls}
              >
                {displayLabel(opt)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
