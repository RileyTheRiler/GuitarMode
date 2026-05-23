"use client";

import { useEffect, useState } from "react";

const ROADMAP_KEY = "guitarmode:roadmap:v1";

type Lesson = {
  number: number;
  title: string;
  description: string;
  objectives: string[];
  practice: string;
};

const LESSONS: Lesson[] = [
  {
    number: 1,
    title: "The Fretboard",
    description: "Learn the layout of the guitar neck — string names, note positions, and octave shapes.",
    objectives: [
      "Name all 6 open strings (EADGBE)",
      "Find any natural note on any string",
      "Understand how octave shapes repeat at fret 12",
      "Navigate the fretboard without charts",
    ],
    practice: "Use the Detect tab: play single notes and watch them appear on the fretboard.",
  },
  {
    number: 2,
    title: "The Major Scale",
    description: "Build the foundation of Western music theory — the 7-note major scale and its 5 neck positions.",
    objectives: [
      "Understand the W-W-H-W-W-W-H interval formula",
      "Play all 5 major scale patterns across the neck",
      "Know which notes are in any major key",
      "Hear the characteristic 'happy' major sound",
    ],
    practice: "Scale Pattern Explorer: select Ionian (Major), try all 5 patterns in C and G.",
  },
  {
    number: 3,
    title: "Keys & The Circle of Fifths",
    description: "Understand how keys are organized, how sharps and flats are counted, and how keys relate to each other.",
    objectives: [
      "Name all 12 major keys",
      "Know the key signature (sharps/flats) for common keys",
      "Read the Circle of Fifths and understand movement by fifths",
      "Identify closely related keys",
    ],
    practice: "Key Explorer: explore different root notes in Major mode and see how the scale changes.",
  },
  {
    number: 4,
    title: "Diatonic Chords & Roman Numerals",
    description: "Discover the 7 chords that naturally exist within every major and minor key.",
    objectives: [
      "Build triads on each degree of the major scale",
      "Name chords by Roman numeral (I, ii, iii, IV, V, vi, vii°)",
      "Understand major, minor, and diminished quality",
      "Identify which chords belong to a given key",
    ],
    practice: "Key Explorer: click each chord block to hear the 7 diatonic chords of any key.",
  },
  {
    number: 5,
    title: "Chord Progressions",
    description: "Learn how chords move together to create music, from the I-IV-V to the 12-bar blues.",
    objectives: [
      "Understand the I-IV-V progression (the backbone of rock and blues)",
      "Play the 12-bar blues in any key",
      "Recognize the I-V-vi-IV pop progression",
      "Transpose any progression to a new key using Roman numerals",
    ],
    practice: "Use the Progression Editor to build and play I-IV-V and 12-bar blues progressions.",
  },
  {
    number: 6,
    title: "The Pentatonic Scale",
    description: "Master the 5-note scale used in virtually every guitar solo ever recorded.",
    objectives: [
      "Play all 5 pentatonic box patterns across the neck",
      "Understand how minor pentatonic relates to the major scale",
      "Connect patterns so you can play over the whole neck",
      "Use the pentatonic to solo over I-IV-V blues progressions",
    ],
    practice: "Scale Pattern Explorer: select Minor Pentatonic, navigate all 5 patterns from position to position.",
  },
  {
    number: 7,
    title: "The Blues Scale",
    description: "Add the 'blue note' (b5) to the pentatonic scale to unlock the full blues vocabulary.",
    objectives: [
      "Understand what makes the b5 interval 'blue'",
      "Play the blues scale in all 5 positions",
      "Use the b5 as a passing note and for expression",
      "Hear the tension and release of the flat five",
    ],
    practice: "Scale Pattern Explorer: select Blues scale. Interval Workshop: build a blues scale from scratch.",
  },
  {
    number: 8,
    title: "Relative Major & Minor",
    description: "Discover that every major scale has a relative minor — the same notes, a different starting point.",
    objectives: [
      "Know that A minor = C major (same notes, different root)",
      "Find the relative minor of any major key (6th degree)",
      "Understand why the same scale shapes work in both major and minor context",
      "Hear the contrast between a major and minor feel on the same notes",
    ],
    practice: "Key Explorer: compare C Major and A Natural Minor — notice identical scale shapes, different chord progressions.",
  },
  {
    number: 9,
    title: "Minor Chord Progressions",
    description: "Learn the characteristic chord movements of minor keys, from natural minor to borrowed chords.",
    objectives: [
      "Build the 7 diatonic chords of the natural minor scale",
      "Play the i-VII-VI-VII progression (the 'minor' sound)",
      "Understand the i-iv-v minor progression",
      "Hear why the VII chord in minor has a strong pull",
    ],
    practice: "Key Explorer: switch to Minor mode, explore diatonic chords. Build minor progressions in the Progression Editor.",
  },
  {
    number: 10,
    title: "Modes of the Major Scale",
    description: "Unlock 7 distinct sounds from one scale by starting on different degrees.",
    objectives: [
      "Name the 7 modes (Ionian, Dorian, Phrygian, Lydian, Mixolydian, Aeolian, Locrian)",
      "Hear the characteristic sound of Dorian and Mixolydian",
      "Play a Dorian scale (minor with a raised 6th)",
      "Use Mixolydian for dominant 7th chord contexts",
    ],
    practice: "Scale Pattern Explorer: try Dorian and Mixolydian modes. Compare to detect scale suggestions while playing.",
  },
  {
    number: 11,
    title: "Extended Chords (7ths & 9ths)",
    description: "Go beyond triads to create richer harmonies by adding 7th and 9th intervals.",
    objectives: [
      "Build major 7, minor 7, and dominant 7 chords from intervals",
      "Understand how the 7th interval changes a chord's flavor",
      "Find the 7th and 9th on the fretboard",
      "Substitute extended chords into progressions you already know",
    ],
    practice: "Interval Workshop: build Dom 7 (R+3+5+b7) and Maj 7 (R+3+5+7), hear the difference.",
  },
  {
    number: 12,
    title: "Ear Training & Transposition",
    description: "Train your ear to recognize intervals and chords, then transpose any idea to any key.",
    objectives: [
      "Identify intervals by ear (unison through octave)",
      "Recognize major, minor, and dominant 7 chord qualities",
      "Transpose a melody or riff by number to any key",
      "Connect what you hear with what you see on the fretboard",
    ],
    practice: "Ear Training in the Detect tab. Then use the Key Explorer to transpose the same progression to 3 different keys.",
  },
];

export function LearningRoadmap() {
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ROADMAP_KEY);
      if (raw) setCompleted(new Set(JSON.parse(raw) as number[]));
    } catch {}
  }, []);

  const toggleCompleted = (lessonNumber: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(lessonNumber)) next.delete(lessonNumber);
      else next.add(lessonNumber);
      try {
        window.localStorage.setItem(ROADMAP_KEY, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const toggleExpanded = (lessonNumber: number) => {
    setExpanded((prev) => (prev === lessonNumber ? null : lessonNumber));
  };

  const completedCount = completed.size;
  const progressPct = Math.round((completedCount / LESSONS.length) * 100);

  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] p-3 sm:p-4">
      <div className="mb-5">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2 before:content-[''] before:block before:h-[3px] before:w-1 before:rounded-full before:bg-emerald-500/70 before:shrink-0">
          Learning Roadmap
        </h2>
        <p className="text-xs text-zinc-500 mb-3">
          12 lessons inspired by the fretLIVE Fretboard Mastery curriculum. Check off each lesson as you master it.
        </p>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-medium text-zinc-400 shrink-0">
            {completedCount}/{LESSONS.length} lessons
          </span>
        </div>
      </div>

      {/* Lesson grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LESSONS.map((lesson) => {
          const isDone = completed.has(lesson.number);
          const isOpen = expanded === lesson.number;

          return (
            <div
              key={lesson.number}
              className={`rounded-lg border transition ${
                isDone
                  ? "border-emerald-700/50 bg-emerald-950/20"
                  : "border-zinc-700/60 bg-zinc-900/40"
              }`}
            >
              {/* Card header */}
              <div className="flex items-start gap-3 p-3">
                {/* Lesson number badge */}
                <span
                  className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                    isDone
                      ? "bg-emerald-600 text-white"
                      : "bg-zinc-700 text-zinc-400"
                  }`}
                >
                  {isDone ? "✓" : lesson.number}
                </span>

                {/* Title + expand */}
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => toggleExpanded(lesson.number)}
                >
                  <p className={`text-sm font-semibold leading-tight ${isDone ? "text-emerald-300" : "text-zinc-200"}`}>
                    {lesson.title}
                  </p>
                  {!isOpen && (
                    <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{lesson.description}</p>
                  )}
                </button>

                {/* Complete checkbox */}
                <button
                  type="button"
                  onClick={() => toggleCompleted(lesson.number)}
                  className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium transition ${
                    isDone
                      ? "border-emerald-600/60 bg-emerald-700/20 text-emerald-400 hover:bg-emerald-700/40"
                      : "border-zinc-600 bg-zinc-800 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500"
                  }`}
                  aria-label={isDone ? `Mark lesson ${lesson.number} incomplete` : `Mark lesson ${lesson.number} complete`}
                >
                  {isDone ? "Done" : "Mark done"}
                </button>
              </div>

              {/* Expanded body */}
              {isOpen && (
                <div className="px-3 pb-3 border-t border-zinc-700/40 pt-3">
                  <p className="text-xs text-zinc-400 mb-3">{lesson.description}</p>
                  <div className="mb-3">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Skills you&apos;ll gain</p>
                    <ul className="space-y-1">
                      {lesson.objectives.map((obj, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-zinc-300">
                          <span className="mt-0.5 shrink-0 text-emerald-500">▸</span>
                          {obj}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded bg-zinc-800/60 border border-zinc-700/40 px-2.5 py-2">
                    <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Practice with this app</p>
                    <p className="text-xs text-zinc-300">{lesson.practice}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
