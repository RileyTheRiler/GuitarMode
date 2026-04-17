"use client";

import { useEffect, useMemo, useRef } from "react";
import { colorForPitchClass, midiToNoteName } from "@/lib/music/notes";
import type { DetectedNote } from "@/lib/audio/usePitchDetector";

type Props = {
  notes: DetectedNote[];
  // Show at least this many seconds even when few notes have been played.
  minSeconds?: number;
  // When true, auto-scroll so the most recent note stays visible.
  followLive?: boolean;
};

export function Timeline({ notes, minSeconds = 8, followLive = true }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const { minMidi, maxMidi, startMs, endMs } = useMemo(() => {
    if (notes.length === 0) {
      return { minMidi: 55, maxMidi: 76, startMs: 0, endMs: minSeconds * 1000 };
    }
    let lo = Infinity;
    let hi = -Infinity;
    let s = Infinity;
    let e = -Infinity;
    for (const n of notes) {
      if (n.midi < lo) lo = n.midi;
      if (n.midi > hi) hi = n.midi;
      if (n.at < s) s = n.at;
      if (n.endAt > e) e = n.endAt;
    }
    // Pad the pitch range by a few semitones for breathing room.
    lo = Math.max(0, lo - 2);
    hi = Math.min(127, hi + 2);
    // Ensure at least ~12 semitones of vertical range.
    if (hi - lo < 12) {
      const mid = (hi + lo) / 2;
      lo = Math.floor(mid - 6);
      hi = Math.ceil(mid + 6);
    }
    const span = Math.max(minSeconds * 1000, e - s + 500);
    return { minMidi: lo, maxMidi: hi, startMs: s, endMs: s + span };
  }, [notes, minSeconds]);

  const rowH = 14;
  const pxPerMs = 0.12;
  const width = Math.max(400, (endMs - startMs) * pxPerMs);
  const rows = maxMidi - minMidi + 1;
  const height = rows * rowH + 24;

  useEffect(() => {
    if (!followLive) return;
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollLeft = el.scrollWidth;
  }, [notes.length, width, followLive]);

  return (
    <div ref={scrollerRef} className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        style={{ display: "block" }}
      >
        {/* Row backgrounds (alternating for readability) */}
        {Array.from({ length: rows }, (_, i) => (
          <rect
            key={`row-${i}`}
            x={0}
            y={i * rowH}
            width={width}
            height={rowH}
            fill={i % 2 === 0 ? "#0f0f0f" : "#161616"}
          />
        ))}

        {/* Octave grid lines */}
        {Array.from({ length: rows }, (_, i) => minMidi + i)
          .filter((m) => m % 12 === 0)
          .map((m) => {
            const y = (maxMidi - m) * rowH;
            return (
              <g key={`oct-${m}`}>
                <line x1={0} x2={width} y1={y} y2={y} stroke="#3f3f46" strokeWidth={1} />
                <text x={4} y={y + 10} fontSize={9} fill="#a1a1aa">
                  {midiToNoteName(m)}
                </text>
              </g>
            );
          })}

        {/* Time gridlines every second */}
        {Array.from(
          { length: Math.ceil((endMs - startMs) / 1000) + 1 },
          (_, i) => i * 1000
        ).map((t) => {
          const x = t * pxPerMs;
          return (
            <g key={`tgrid-${t}`}>
              <line
                x1={x}
                x2={x}
                y1={0}
                y2={rows * rowH}
                stroke="#27272a"
                strokeWidth={1}
              />
              <text x={x + 2} y={rows * rowH + 12} fontSize={9} fill="#71717a">
                {(t / 1000).toFixed(0)}s
              </text>
            </g>
          );
        })}

        {/* Notes */}
        {notes.map((n, i) => {
          const x = (n.at - startMs) * pxPerMs;
          const w = Math.max(4, n.durationMs * pxPerMs);
          const y = (maxMidi - n.midi) * rowH + 1;
          const color = colorForPitchClass(n.pitchClass);
          return (
            <g key={`note-${i}-${n.at}`}>
              <rect
                x={x}
                y={y}
                width={w}
                height={rowH - 2}
                fill={color}
                rx={2}
                opacity={0.9}
              />
              {w > 28 && (
                <text
                  x={x + 4}
                  y={y + rowH - 4}
                  fontSize={9}
                  fill="#0a0a0a"
                  fontWeight={600}
                >
                  {midiToNoteName(n.midi)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
