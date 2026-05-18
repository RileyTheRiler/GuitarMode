"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { colorForPitchClass, pitchClassName } from "@/lib/music/notes";
import {
  STANDARD_TUNING,
  getNoteAt,
  stringLabelsFor,
} from "@/lib/guitar/fretboard";

type Props = {
  numFrets?: number;
  tuning?: number[];
  highContrast?: boolean;
  showDegrees?: boolean;
  degreeMap?: Map<number, string>;
  capo?: number;
  voicingPositions?: { stringIndex: number; fret: number }[];
  playedPitchClasses: Set<number>;
  scalePitchClasses?: Set<number>;
  rootPitchClass?: number | null;
  currentPitchClass?: number | null;
  /** When set, pulsing animation is shown only at this exact string+fret instead of all positions with currentPitchClass. */
  highlightFretPosition?: { stringIndex: number; fret: number } | null;
  chordPitchClasses?: Set<number>;
  chordRootPitchClass?: number | null;
  chordThirdPitchClass?: number | null;
  chordFifthPitchClass?: number | null;
  boxCenterFret?: number | null;
  boxWindow?: number;
  onFretClick?: (stringIndex: number, fret: number, midi: number) => void;
};

const DOUBLE_MARKERS = new Set([12, 24]);
const SINGLE_MARKERS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);

// Pattern ID per pitch-class group (3 patterns, 4 pitch classes each).
const HC_PATTERN = (pc: number) => ["hc-stripe", "hc-dot", "hc-cross"][pc % 3];

function useCompactFretboard() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return compact;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function Fretboard({
  numFrets = 22,
  tuning = STANDARD_TUNING,
  highContrast = false,
  showDegrees = false,
  degreeMap,
  capo = 0,
  voicingPositions,
  playedPitchClasses,
  scalePitchClasses,
  rootPitchClass,
  currentPitchClass,
  highlightFretPosition,
  chordPitchClasses,
  chordRootPitchClass,
  chordThirdPitchClass,
  chordFifthPitchClass,
  boxCenterFret,
  boxWindow = 5,
  onFretClick,
}: Props) {
  const chordActive = !!chordPitchClasses && chordPitchClasses.size > 0;
  const numStrings = tuning.length;
  const stringLabels = useMemo(() => stringLabelsFor(tuning), [tuning]);
  const compact = useCompactFretboard();
  const reducedMotion = useReducedMotion();

  const nutWidth = compact ? 8 : 10;
  const leftPad = compact ? 30 : 44;
  const rightPad = compact ? 10 : 16;
  const topPad = compact ? 18 : 24;
  const bottomPad = compact ? 18 : 24;
  const fretWidth = compact ? 34 : 52;
  const stringSpacing = compact ? 22 : 30;
  const noteRadius = compact ? 9 : 11;
  const noteFontSize = compact ? 9 : 10;
  const stringLabelFontSize = compact ? 10 : 12;
  const fretNumFontSize = compact ? 9 : 10;

  const boardWidth = numFrets * fretWidth;
  const width = leftPad + nutWidth + boardWidth + rightPad;
  const boardHeight = (numStrings - 1) * stringSpacing;
  const height = topPad + boardHeight + bottomPad;

  const stringY = (i: number) => topPad + (numStrings - 1 - i) * stringSpacing;
  const fretX = (fret: number) => {
    if (fret === 0) return leftPad - 20;
    return leftPad + nutWidth + (fret - 0.5) * fretWidth;
  };
  const fretLineX = (fret: number) => leftPad + nutWidth + fret * fretWidth;

  const inBox = (fret: number) => {
    if (boxCenterFret == null) return true;
    if (fret === 0) return true;
    return fret >= boxCenterFret - boxWindow && fret <= boxCenterFret + boxWindow;
  };

  // Keyboard navigation state
  const [focusedPos, setFocusedPos] = useState<{ s: number; f: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleSvgFocus = () => {
    if (!focusedPos) setFocusedPos({ s: 0, f: 0 });
  };

  const handleSvgBlur = () => setFocusedPos(null);

  const handleKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!focusedPos) return;
    let { s, f } = focusedPos;
    switch (e.key) {
      case "ArrowRight": e.preventDefault(); f = Math.min(numFrets, f + 1); break;
      case "ArrowLeft":  e.preventDefault(); f = Math.max(0, f - 1); break;
      case "ArrowUp":    e.preventDefault(); s = Math.min(numStrings - 1, s + 1); break;
      case "ArrowDown":  e.preventDefault(); s = Math.max(0, s - 1); break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (onFretClick) {
          const pos = getNoteAt(s, f, tuning);
          onFretClick(s, f, pos.midi);
        }
        return;
      default: return;
    }
    setFocusedPos({ s, f });
  };

  const voicingSet = useMemo(
    () => voicingPositions
      ? new Set(voicingPositions.map((v) => `${v.stringIndex}:${v.fret}`))
      : null,
    [voicingPositions]
  );

  const circles: React.ReactNode[] = [];
  const hitTargets: React.ReactNode[] = [];
  for (let s = 0; s < numStrings; s++) {
    for (let f = 0; f <= numFrets; f++) {
      // Hide frets that are physically behind the capo
      if (capo > 0 && f < capo) continue;

      const pos = getNoteAt(s, f, tuning);
      const isPlayed = playedPitchClasses.has(pos.pitchClass);
      const isInScale = scalePitchClasses?.has(pos.pitchClass) ?? false;
      const isRoot = rootPitchClass != null && pos.pitchClass === rootPitchClass;
      const isLive = highlightFretPosition
        ? highlightFretPosition.stringIndex === s && highlightFretPosition.fret === f
        : currentPitchClass != null && pos.pitchClass === currentPitchClass;
      const isChordTone = chordActive && (chordPitchClasses?.has(pos.pitchClass) ?? false);
      const isChordRoot =
        chordActive && chordRootPitchClass != null && pos.pitchClass === chordRootPitchClass;
      const isChordThird =
        chordActive && chordThirdPitchClass != null && pos.pitchClass === chordThirdPitchClass;
      const isFocused = focusedPos?.s === s && focusedPos?.f === f;
      const isVoicing = voicingSet?.has(`${s}:${f}`) ?? false;
      // Chord tones override the box focus so they stay visible outside the window.
      const visible =
        (inBox(f) && (isPlayed || isInScale || isLive)) || isChordTone || isVoicing || isLive;

      const cx = fretX(f);
      const cy = stringY(s);

      if (onFretClick) {
        const label =
          f === 0
            ? `Open ${stringLabels[s]} string, ${pos.noteName}`
            : `${stringLabels[s]} string fret ${f}, ${pos.noteName}`;
        hitTargets.push(
          <rect
            key={`hit-${s}-${f}`}
            x={f === 0 ? leftPad - 32 : leftPad + nutWidth + (f - 1) * fretWidth}
            y={cy - stringSpacing / 2}
            width={f === 0 ? 24 : fretWidth}
            height={stringSpacing}
            fill="transparent"
            cursor="pointer"
            role="button"
            aria-label={label}
            onClick={() => onFretClick(s, f, pos.midi)}
          >
            <title>{label}</title>
          </rect>
        );
      }

      // Keyboard focus indicator — always visible when focused
      if (isFocused) {
        const pos2 = getNoteAt(s, f, tuning);
        circles.push(
          <rect
            key={`focus-${s}-${f}`}
            x={cx - noteRadius - 4}
            y={cy - noteRadius - 4}
            width={(noteRadius + 4) * 2}
            height={(noteRadius + 4) * 2}
            rx={4}
            fill="none"
            stroke="#fff"
            strokeWidth={2}
            strokeDasharray="4 3"
            opacity={0.85}
            pointerEvents="none"
            aria-label={`Focused: ${pos2.noteName}`}
          />
        );
      }

      if (!visible) continue;

      const color = colorForPitchClass(pos.pitchClass);
      const baseR = noteRadius;
      const r = isChordTone ? baseR + 1 : baseR;
      let groupOpacity = 1;
      if (chordActive && !isChordTone && !isLive) {
        groupOpacity = isPlayed ? 0.6 : 0.35;
      }

      circles.push(
        <g key={`note-${s}-${f}`} pointerEvents="none" opacity={groupOpacity}>
          {isLive && (
            <circle
              cx={cx}
              cy={cy}
              r={r + 5}
              fill="none"
              stroke={color}
              strokeWidth={2}
              opacity={reducedMotion ? 0.6 : undefined}
            >
              {!reducedMotion && (
                <>
                  <animate
                    attributeName="r"
                    values={`${r + 3};${r + 9};${r + 3}`}
                    dur="0.9s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    values="0.7;0;0.7"
                    dur="0.9s"
                    repeatCount="indefinite"
                  />
                </>
              )}
            </circle>
          )}
          {isChordRoot && (
            <circle cx={cx} cy={cy} r={r + 4} fill="none" stroke="#fff" strokeWidth={1.5} opacity={0.5} />
          )}
          {isChordThird && (
            <circle cx={cx} cy={cy} r={r + 3} fill="none" stroke="#fbbf24" strokeWidth={2} />
          )}
          {isPlayed ? (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={color}
              stroke={isChordRoot ? "#fff" : isRoot ? "#fff" : color}
              strokeWidth={isChordRoot ? 3 : isChordTone ? 2.5 : isRoot ? 2.5 : 1}
            />
          ) : (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={isLive || isChordTone ? color : "#0a0a0a"}
              stroke={isChordRoot ? "#fff" : color}
              strokeWidth={isChordRoot ? 3 : isChordTone ? 2.5 : isRoot ? 3 : 2}
              opacity={isLive && !isChordTone ? 0.85 : 1}
            />
          )}
          {/* High-contrast pattern overlay — secondary encoding independent of color */}
          {highContrast && (
            <circle
              cx={cx}
              cy={cy}
              r={r - 1}
              fill={`url(#${HC_PATTERN(pos.pitchClass)})`}
              pointerEvents="none"
            />
          )}
          {/* Voicing ring — dashed white ring marks specific chord fingering position */}
          {isVoicing && (
            <circle
              cx={cx}
              cy={cy}
              r={r + 5}
              fill="none"
              stroke="#ffffff"
              strokeWidth={2}
              strokeDasharray="3 2"
              opacity={0.9}
              pointerEvents="none"
            />
          )}
          <text
            x={cx}
            y={cy + 3.5}
            textAnchor="middle"
            fontSize={noteFontSize}
            fontWeight={isChordRoot || isRoot ? 700 : 500}
            fill={isPlayed || isLive || isChordTone ? "#0a0a0a" : color}
          >
            {showDegrees && degreeMap?.has(pos.pitchClass)
              ? degreeMap.get(pos.pitchClass)
              : pitchClassName(pos.pitchClass)}
          </text>
        </g>
      );
    }
  }

  const focusedNote = focusedPos ? getNoteAt(focusedPos.s, focusedPos.f, tuning) : null;

  return (
    <div className="overflow-x-auto">
      {focusedNote && (
        <p className="sr-only" aria-live="polite">
          Focused: {focusedNote.noteName}, string {focusedPos!.s + 1}, fret {focusedPos!.f}
        </p>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ minWidth: width, maxWidth: "100%", height: "auto" }}
        aria-label="Guitar fretboard — use arrow keys to navigate, Enter to play"
        tabIndex={onFretClick ? 0 : undefined}
        onFocus={handleSvgFocus}
        onBlur={handleSvgBlur}
        onKeyDown={handleKeyDown}
      >
        <defs>
          {/* High-contrast pattern fills */}
          <pattern id="hc-stripe" patternUnits="userSpaceOnUse" width="5" height="5">
            <path d="M0,5 L5,0" stroke="rgba(0,0,0,0.45)" strokeWidth="1.2" />
          </pattern>
          <pattern id="hc-dot" patternUnits="userSpaceOnUse" width="5" height="5">
            <circle cx="2.5" cy="2.5" r="1" fill="rgba(0,0,0,0.45)" />
          </pattern>
          <pattern id="hc-cross" patternUnits="userSpaceOnUse" width="5" height="5">
            <path d="M0,2.5 L5,2.5 M2.5,0 L2.5,5" stroke="rgba(0,0,0,0.45)" strokeWidth="1" />
          </pattern>
        </defs>

        <rect
          x={leftPad + nutWidth}
          y={topPad - 10}
          width={boardWidth}
          height={boardHeight + 20}
          fill="#2a1b10"
          rx={4}
        />

        {boxCenterFret != null && (
          <rect
            x={fretLineX(Math.max(0, boxCenterFret - boxWindow))}
            y={topPad - 10}
            width={
              fretLineX(Math.min(numFrets, boxCenterFret + boxWindow)) -
              fretLineX(Math.max(0, boxCenterFret - boxWindow))
            }
            height={boardHeight + 20}
            fill="#fbbf24"
            opacity={0.08}
          />
        )}

        {Array.from({ length: numFrets }, (_, idx) => idx + 1).map((f) => {
          const cx = leftPad + nutWidth + (f - 0.5) * fretWidth;
          if (DOUBLE_MARKERS.has(f)) {
            return (
              <g key={`marker-${f}`}>
                <circle cx={cx} cy={topPad + stringSpacing * 1} r={4} fill="#d1b48e" opacity={0.45} />
                <circle cx={cx} cy={topPad + stringSpacing * 3} r={4} fill="#d1b48e" opacity={0.45} />
              </g>
            );
          }
          if (SINGLE_MARKERS.has(f)) {
            return (
              <circle
                key={`marker-${f}`}
                cx={cx}
                cy={topPad + boardHeight / 2}
                r={4}
                fill="#d1b48e"
                opacity={0.45}
              />
            );
          }
          return null;
        })}

        {Array.from({ length: numFrets + 1 }, (_, f) => (
          <line
            key={`fret-${f}`}
            x1={fretLineX(f)}
            x2={fretLineX(f)}
            y1={topPad - 10}
            y2={topPad + boardHeight + 10}
            stroke={f === 0 ? "#f5f5f5" : "#8a8a8a"}
            strokeWidth={f === 0 ? 6 : 2}
          />
        ))}

        {/* Capo bar */}
        {capo > 0 && (
          <rect
            x={fretLineX(capo) - 4}
            y={topPad - 12}
            width={8}
            height={boardHeight + 24}
            rx={3}
            fill="#d4a843"
            opacity={0.9}
            aria-label={`Capo at fret ${capo}`}
          />
        )}

        {Array.from({ length: numStrings }, (_, s) => (
          <line
            key={`string-${s}`}
            x1={leftPad + nutWidth}
            x2={leftPad + nutWidth + boardWidth}
            y1={stringY(s)}
            y2={stringY(s)}
            stroke="#d4d4d4"
            strokeWidth={1 + (numStrings - 1 - s) * 0.25}
          />
        ))}

        {Array.from({ length: numStrings }, (_, s) => (
          <text
            key={`label-${s}`}
            x={leftPad - (compact ? 14 : 22)}
            y={stringY(s) + 4}
            fontSize={stringLabelFontSize}
            fill="#e5e5e5"
            textAnchor="middle"
          >
            {stringLabels[s]}
          </text>
        ))}

        {Array.from({ length: numFrets }, (_, idx) => idx + 1).map((f) => (
          <text
            key={`fretnum-${f}`}
            x={leftPad + nutWidth + (f - 0.5) * fretWidth}
            y={topPad + boardHeight + (compact ? 14 : 18)}
            fontSize={fretNumFontSize}
            fill="#a1a1aa"
            textAnchor="middle"
          >
            {f}
          </text>
        ))}

        {hitTargets}
        {circles}
      </svg>
    </div>
  );
}
