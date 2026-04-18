"use client";

import { colorForPitchClass, pitchClassName } from "@/lib/music/notes";
import { STANDARD_TUNING, STRING_LABELS, getNoteAt } from "@/lib/guitar/fretboard";

type Props = {
  numFrets?: number;
  playedPitchClasses: Set<number>;
  scalePitchClasses?: Set<number>;
  rootPitchClass?: number | null;
  currentPitchClass?: number | null;
  boxCenterFret?: number | null;
  boxWindow?: number;
  onFretClick?: (stringIndex: number, fret: number, midi: number) => void;
};

const DOUBLE_MARKERS = new Set([12, 24]);
const SINGLE_MARKERS = new Set([3, 5, 7, 9, 15, 17, 19, 21]);

export function Fretboard({
  numFrets = 22,
  playedPitchClasses,
  scalePitchClasses,
  rootPitchClass,
  currentPitchClass,
  boxCenterFret,
  boxWindow = 5,
  onFretClick,
}: Props) {
  const numStrings = STANDARD_TUNING.length;
  const nutWidth = 10;
  const leftPad = 44;
  const rightPad = 16;
  const topPad = 24;
  const bottomPad = 24;
  const fretWidth = 52;
  const stringSpacing = 30;

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

  const circles: React.ReactNode[] = [];
  const hitTargets: React.ReactNode[] = [];
  for (let s = 0; s < numStrings; s++) {
    for (let f = 0; f <= numFrets; f++) {
      const pos = getNoteAt(s, f);
      const isPlayed = playedPitchClasses.has(pos.pitchClass);
      const isInScale = scalePitchClasses?.has(pos.pitchClass) ?? false;
      const isRoot = rootPitchClass != null && pos.pitchClass === rootPitchClass;
      const isLive = currentPitchClass != null && pos.pitchClass === currentPitchClass;
      const visible = inBox(f) && (isPlayed || isInScale || isLive);

      const cx = fretX(f);
      const cy = stringY(s);

      if (onFretClick) {
        hitTargets.push(
          <rect
            key={`hit-${s}-${f}`}
            x={f === 0 ? leftPad - 32 : leftPad + nutWidth + (f - 1) * fretWidth}
            y={cy - stringSpacing / 2}
            width={f === 0 ? 24 : fretWidth}
            height={stringSpacing}
            fill="transparent"
            cursor="pointer"
            onClick={() => onFretClick(s, f, pos.midi)}
          />
        );
      }

      if (!visible) continue;

      const color = colorForPitchClass(pos.pitchClass);
      const r = 11;

      circles.push(
        <g key={`note-${s}-${f}`} pointerEvents="none">
          {/* Pulsing ring for the live note */}
          {isLive && (
            <circle cx={cx} cy={cy} r={r + 5} fill="none" stroke={color} strokeWidth={2}>
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
            </circle>
          )}
          {isPlayed ? (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={color}
              stroke={isRoot ? "#fff" : color}
              strokeWidth={isRoot ? 2.5 : 1}
            />
          ) : (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill={isLive ? color : "#0a0a0a"}
              stroke={color}
              strokeWidth={isRoot ? 3 : 2}
              opacity={isLive ? 0.85 : 1}
            />
          )}
          <text
            x={cx}
            y={cy + 3.5}
            textAnchor="middle"
            fontSize={10}
            fontWeight={isRoot ? 700 : 500}
            fill={isPlayed || isLive ? "#0a0a0a" : color}
          >
            {pitchClassName(pos.pitchClass)}
          </text>
        </g>
      );
    }
  }

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        style={{ minWidth: width, maxWidth: "100%", height: "auto" }}
        aria-label="Guitar fretboard"
      >
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
            x={leftPad - 22}
            y={stringY(s) + 4}
            fontSize={12}
            fill="#e5e5e5"
            textAnchor="middle"
          >
            {STRING_LABELS[s]}
          </text>
        ))}

        {Array.from({ length: numFrets }, (_, idx) => idx + 1).map((f) => (
          <text
            key={`fretnum-${f}`}
            x={leftPad + nutWidth + (f - 0.5) * fretWidth}
            y={topPad + boardHeight + 18}
            fontSize={10}
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
