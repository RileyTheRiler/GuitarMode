"use client";

import { useEffect, useMemo, useState } from "react";
import { colorForPitchClass } from "@/lib/music/notes";
import { similarity, normalizeHarmonics } from "@/lib/audio/timbre";
import { TIMBRE_SAMPLES, type TimbreSample } from "@/lib/music/timbreSamples";

const CUSTOM_STORAGE_KEY = "guitarmode:custom-timbre:v1";

type Props = {
  harmonics: number[];
  currentPitchClass?: number | null;
  polyphonicEnabled: boolean;
};

const BAR_W = 28;
const BAR_GAP = 8;
const H = 110;
const PAD = 12;

function loadCustomSample(): TimbreSample | null {
  try {
    const raw = window.localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { harmonics: number[] };
    if (!Array.isArray(parsed.harmonics)) return null;
    return {
      id: "custom",
      name: "My guitar",
      description: "Recorded reference from your own instrument.",
      harmonics: parsed.harmonics,
    };
  } catch {
    return null;
  }
}

export function TimbreVisualizer({
  harmonics,
  currentPitchClass,
  polyphonicEnabled,
}: Props) {
  const [customSample, setCustomSample] = useState<TimbreSample | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    setCustomSample(loadCustomSample());
  }, []);

  const allSamples = useMemo(
    () => (customSample ? [...TIMBRE_SAMPLES, customSample] : TIMBRE_SAMPLES),
    [customSample]
  );

  const [sampleId, setSampleId] = useState<string>(TIMBRE_SAMPLES[0].id);
  const ref = useMemo(
    () => allSamples.find((s) => s.id === sampleId) ?? allSamples[0],
    [allSamples, sampleId]
  );

  const hasSignal = harmonics.some((v) => v > 0.01);
  const sim = hasSignal ? similarity(harmonics, ref.harmonics) : 0;
  const simPct = Math.round(sim * 100);
  const simHue = Math.round(sim * 120);

  const fillColor =
    currentPitchClass != null ? colorForPitchClass(currentPitchClass) : "#fbbf24";

  const n = harmonics.length;
  const width = PAD * 2 + n * BAR_W + (n - 1) * BAR_GAP;

  const handleSaveReference = () => {
    if (!hasSignal) return;
    const normalized = normalizeHarmonics(harmonics);
    const sample: TimbreSample = {
      id: "custom",
      name: "My guitar",
      description: "Recorded reference from your own instrument.",
      harmonics: normalized,
    };
    try {
      window.localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify({ harmonics: normalized }));
    } catch {}
    setCustomSample(sample);
    setSampleId("custom");
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  if (!polyphonicEnabled) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-500">
        Turn on <span className="text-zinc-300">polyphonic mode</span> in Input Settings to
        enable harmonic/timbre analysis.
      </div>
    );
  }

  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs">
          <label htmlFor="timbre-sample" className="text-zinc-400">Reference:</label>
          <select
            id="timbre-sample"
            value={sampleId}
            onChange={(e) => setSampleId(e.target.value)}
            className="rounded bg-zinc-800 px-2 py-1 text-zinc-200"
          >
            {allSamples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleSaveReference}
            disabled={!hasSignal}
            title="Save current harmonic envelope as your reference tone"
            className="rounded px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {savedMsg ? "Saved!" : "Save current"}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">Similarity</span>
          <div className="h-2 w-20 overflow-hidden rounded bg-zinc-800">
            <div
              className="h-full"
              style={{
                width: `${simPct}%`,
                backgroundColor: `hsl(${simHue}, 80%, 50%)`,
              }}
            />
          </div>
          <span
            className="font-mono tabular-nums"
            style={{ color: hasSignal ? `hsl(${simHue}, 80%, 60%)` : "#71717a" }}
          >
            {hasSignal ? `${simPct}%` : "—"}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${H}`} width="100%" style={{ height: H }}>
        {harmonics.map((v, i) => {
          const x = PAD + i * (BAR_W + BAR_GAP);
          const refV = ref.harmonics[i] ?? 0;
          const userH = Math.max(2, v * (H - 24));
          const refH = Math.max(1, refV * (H - 24));
          return (
            <g key={i}>
              <rect
                x={x}
                y={H - 12 - refH}
                width={BAR_W}
                height={refH}
                fill="none"
                stroke="#52525b"
                strokeDasharray="3 3"
                strokeWidth={1}
                rx={2}
              />
              <rect
                x={x}
                y={H - 12 - userH}
                width={BAR_W}
                height={userH}
                fill={fillColor}
                opacity={hasSignal ? 0.9 : 0.25}
                rx={2}
              />
              <text
                x={x + BAR_W / 2}
                y={H - 2}
                textAnchor="middle"
                fontSize={9}
                fill="#71717a"
              >
                h{i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-xs text-zinc-500">
        Dashed = reference ({ref.name}). Filled = your tone.{" "}
        {hasSignal && (
          <span>Play a sustained note then click <em>Save current</em> to set your own reference.</span>
        )}
      </p>
    </div>
  );
}
