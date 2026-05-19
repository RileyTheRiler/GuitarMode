"use client";

import type { ScaleMatch } from "@/lib/music/detectScale";

// Pitch classes in circle-of-fifths order (clockwise, starting from top = C)
const FIFTHS_ORDER = [0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5] as const;

const MAJOR_NAMES = ["C", "G", "D", "A", "E", "B", "F♯", "D♭", "A♭", "E♭", "B♭", "F"];
const MINOR_NAMES = ["a", "e", "b", "f♯", "c♯", "g♯", "d♯", "b♭", "f", "c", "g", "d"];

const PC_TO_POS = new Map<number, number>(FIFTHS_ORDER.map((pc, i) => [pc, i]));

function hasMajorThird(intervals: number[]): boolean {
  return intervals.includes(4);
}

function sectorPath(
  cx: number, cy: number,
  r1: number, r2: number,
  startDeg: number, endDeg: number
): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const s = toRad(startDeg);
  const e = toRad(endDeg);
  return [
    `M ${cx + r2 * Math.cos(s)} ${cy + r2 * Math.sin(s)}`,
    `A ${r2} ${r2} 0 0 1 ${cx + r2 * Math.cos(e)} ${cy + r2 * Math.sin(e)}`,
    `L ${cx + r1 * Math.cos(e)} ${cy + r1 * Math.sin(e)}`,
    `A ${r1} ${r1} 0 0 0 ${cx + r1 * Math.cos(s)} ${cy + r1 * Math.sin(s)}`,
    "Z",
  ].join(" ");
}

type SegState = "root" | "relative" | "adj" | "none";

type Props = {
  selectedMatch: ScaleMatch | null;
};

export function CircleOfFifths({ selectedMatch }: Props) {
  const cx = 140, cy = 140;
  const outerR1 = 91, outerR2 = 134;
  const innerR1 = 53, innerR2 = 91;
  const GAP = 0.5;

  const isMajor = selectedMatch
    ? hasMajorThird(selectedMatch.template.intervals)
    : true;

  // Each wedge i hosts one major key and its relative minor.
  // rootPos = the wedge index that contains the detected key.
  const rootPos: number = selectedMatch
    ? isMajor
      ? (PC_TO_POS.get(selectedMatch.root) ?? -1)
      : (PC_TO_POS.get((selectedMatch.root + 3) % 12) ?? -1)
    : -1;

  const circleDist = (a: number, b: number) =>
    Math.min(Math.abs(a - b), 12 - Math.abs(a - b));

  const majorState = (pos: number): SegState => {
    if (rootPos < 0) return "none";
    if (pos === rootPos) return isMajor ? "root" : "relative";
    if (circleDist(pos, rootPos) === 1) return "adj";
    return "none";
  };

  const minorState = (pos: number): SegState => {
    if (rootPos < 0) return "none";
    if (pos === rootPos) return isMajor ? "relative" : "root";
    if (circleDist(pos, rootPos) === 1) return "adj";
    return "none";
  };

  const majorFill = (s: SegState) => {
    if (s === "root") return "#10b981";
    if (s === "relative") return "#0e7490";
    if (s === "adj") return "#3f3f46";
    return "#27272a";
  };

  const minorFill = (s: SegState) => {
    if (s === "root") return "#059669";
    if (s === "relative") return "#0e7490";
    if (s === "adj") return "#3f3f46";
    return "#1c1c1f";
  };

  const textFill = (s: SegState) => {
    if (s === "root") return "#ecfdf5";
    if (s === "relative") return "#bae6fd";
    if (s === "adj") return "#d4d4d8";
    return "#52525b";
  };

  const shortName = selectedMatch
    ? selectedMatch.templateName
        .replace(" (Major)", "")
        .replace(" (Natural Minor)", "")
    : "";

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox="0 0 280 280"
        width="100%"
        style={{ maxWidth: 240 }}
        role="img"
        aria-label="Circle of Fifths"
      >
        {FIFTHS_ORDER.map((_, i) => {
          const startDeg = -90 + i * 30 + GAP;
          const endDeg = -90 + (i + 1) * 30 - GAP;
          const midDeg = (startDeg + endDeg) / 2;
          const midRad = (midDeg * Math.PI) / 180;

          const mjs = majorState(i);
          const mns = minorState(i);

          const majorTextR = (outerR1 + outerR2) / 2;
          const minorTextR = (innerR1 + innerR2) / 2;

          return (
            <g key={i}>
              <path
                d={sectorPath(cx, cy, outerR1, outerR2, startDeg, endDeg)}
                fill={majorFill(mjs)}
                stroke="#09090b"
                strokeWidth="1"
              />
              <text
                x={cx + majorTextR * Math.cos(midRad)}
                y={cy + majorTextR * Math.sin(midRad)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={11}
                fontWeight={mjs !== "none" ? 600 : 400}
                fill={textFill(mjs)}
                style={{ fontFamily: "inherit", userSelect: "none" }}
              >
                {MAJOR_NAMES[i]}
              </text>
              <path
                d={sectorPath(cx, cy, innerR1, innerR2, startDeg, endDeg)}
                fill={minorFill(mns)}
                stroke="#09090b"
                strokeWidth="1"
              />
              <text
                x={cx + minorTextR * Math.cos(midRad)}
                y={cy + minorTextR * Math.sin(midRad)}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={9}
                fontWeight={mns !== "none" ? 600 : 400}
                fill={textFill(mns)}
                style={{ fontFamily: "inherit", userSelect: "none" }}
              >
                {MINOR_NAMES[i]}
              </text>
            </g>
          );
        })}
        {/* Center */}
        <circle
          cx={cx} cy={cy} r={innerR1 - 1}
          fill="#18181b"
          stroke="#3f3f46"
          strokeWidth="1"
        />
        {selectedMatch ? (
          <>
            <text
              x={cx} y={cy - 7}
              textAnchor="middle"
              fontSize={15}
              fontWeight={700}
              fill="#10b981"
              style={{ fontFamily: "inherit" }}
            >
              {selectedMatch.rootName}
            </text>
            <text
              x={cx} y={cy + 9}
              textAnchor="middle"
              fontSize={8}
              fill="#a1a1aa"
              style={{ fontFamily: "inherit" }}
            >
              {shortName}
            </text>
          </>
        ) : (
          <text
            x={cx} y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={9}
            fill="#52525b"
            style={{ fontFamily: "inherit" }}
          >
            play notes
          </text>
        )}
      </svg>
      <div className="flex flex-wrap justify-center gap-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-emerald-500 shrink-0" />
          detected key
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-cyan-700 shrink-0" />
          relative
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-zinc-700 shrink-0" />
          adjacent
        </span>
      </div>
    </div>
  );
}
