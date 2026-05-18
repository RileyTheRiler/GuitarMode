"use client";

import { colorForPitchClass, pitchClassName } from "@/lib/music/notes";

type Props = {
  chroma: number[];
};

const BAR_W = 20;
const GAP = 3;
const CHART_H = 56;
const LABEL_H = 14;

export function ChromaChart({ chroma }: Props) {
  const max = Math.max(...chroma, 1e-9);
  const totalW = 12 * (BAR_W + GAP) - GAP;

  return (
    <div className="w-full">
      <p className="mb-1 text-xs text-zinc-500">Pitch-class energy (live)</p>
      <svg
        viewBox={`0 0 ${totalW} ${CHART_H + LABEL_H}`}
        width="100%"
        style={{ display: "block", maxWidth: `${totalW}px` }}
        aria-label="Pitch-class energy chart"
      >
        {chroma.map((v, pc) => {
          const barH = Math.max(2, (v / max) * CHART_H);
          const x = pc * (BAR_W + GAP);
          const color = colorForPitchClass(pc);
          return (
            <g key={pc}>
              <rect
                x={x}
                y={CHART_H - barH}
                width={BAR_W}
                height={barH}
                fill={color}
                opacity={v > 0 ? 0.85 : 0.15}
                rx={2}
              />
              <text
                x={x + BAR_W / 2}
                y={CHART_H + LABEL_H - 1}
                textAnchor="middle"
                fontSize={9}
                fill={v > max * 0.2 ? color : "#52525b"}
              >
                {pitchClassName(pc)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
