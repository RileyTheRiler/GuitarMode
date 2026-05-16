"use client";

import { DEFAULT_CONFIG, type PitchDetectorConfig } from "@/lib/audio/usePitchDetector";
import type { MicDevice } from "@/lib/audio/useMicStream";
import { TUNINGS, type Tuning } from "@/lib/guitar/tunings";
import { stringLabelsFor } from "@/lib/guitar/fretboard";

type Props = {
  config: PitchDetectorConfig;
  onChange: (patch: Partial<PitchDetectorConfig>) => void;
  devices: MicDevice[];
  currentDeviceId: string | null;
  onDeviceChange: (id: string) => void;
  micOn: boolean;
  tuningId: string;
  onTuningChange: (id: string) => void;
  tuning: Tuning;
  tuningOffsetsCents: number[];
  onTuningOffsetChange: (stringIndex: number, cents: number) => void;
  onResetTuningOffsets: () => void;
};

export function InputSettings({
  config,
  onChange,
  devices,
  currentDeviceId,
  onDeviceChange,
  micOn,
  tuningId,
  onTuningChange,
  tuning,
  tuningOffsetsCents,
  onTuningOffsetChange,
  onResetTuningOffsets,
}: Props) {
  const labels = stringLabelsFor(tuning.midi);
  const hasOffsets = tuningOffsetsCents.some((c) => c !== 0);
  return (
    <details className="group rounded-lg border border-zinc-800 bg-zinc-900/60">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-zinc-300 group-open:border-b group-open:border-zinc-800">
        Input &amp; detection
      </summary>
      <div className="grid gap-4 p-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Input device
          <select
            className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
            value={currentDeviceId ?? ""}
            onChange={(e) => onDeviceChange(e.target.value)}
          >
            <option value="">System default</option>
            {devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label}
              </option>
            ))}
          </select>
          {!micOn && devices.every((d) => !d.label) && (
            <span className="text-[10px] text-zinc-500">
              Turn on the mic to see device names.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Tuning
          <select
            className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
            value={tuningId}
            onChange={(e) => onTuningChange(e.target.value)}
          >
            {TUNINGS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          Concert pitch (A4)
          <select
            className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
            value={config.a4Hz}
            onChange={(e) => onChange({ a4Hz: Number(e.target.value) })}
          >
            <option value={432}>432 Hz</option>
            <option value={438}>438 Hz</option>
            <option value={440}>440 Hz (standard)</option>
            <option value={442}>442 Hz</option>
            <option value={444}>444 Hz</option>
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            type="checkbox"
            checked={config.highPass}
            onChange={(e) => onChange({ highPass: e.target.checked })}
          />
          High-pass filter at
          <input
            type="number"
            min={40}
            max={200}
            step={5}
            value={config.highPassHz}
            onChange={(e) => onChange({ highPassHz: Number(e.target.value) })}
            className="w-16 rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
          />
          Hz
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          <span>
            Noise gate:{" "}
            <span className="text-zinc-200">{config.minRms.toFixed(3)}</span> RMS
          </span>
          <input
            type="range"
            min={0}
            max={0.1}
            step={0.001}
            value={config.minRms}
            onChange={(e) => onChange({ minRms: Number(e.target.value) })}
          />
        </label>

        <label className="flex flex-col gap-1 text-xs text-zinc-400">
          <span>
            Pitch confidence:{" "}
            <span className="text-zinc-200">{config.minClarity.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0.6}
            max={0.99}
            step={0.01}
            value={config.minClarity}
            onChange={(e) => onChange({ minClarity: Number(e.target.value) })}
          />
        </label>

        <label className="flex items-center gap-2 text-xs text-zinc-400 sm:col-span-2">
          <input
            type="checkbox"
            checked={config.polyphonic}
            onChange={(e) => onChange({ polyphonic: e.target.checked })}
          />
          Polyphonic mode (chord/chroma detection) &mdash; experimental
        </label>

        <fieldset className="sm:col-span-2 rounded border border-zinc-800 p-2">
          <legend className="px-1 text-[11px] uppercase tracking-wide text-zinc-500">
            Per-string cents trim
          </legend>
          <p className="mb-2 text-[10px] text-zinc-500">
            Nudge each open-string tuner target ±50¢. Useful for guitars that
            don&rsquo;t intonate perfectly.
          </p>
          <div className="grid grid-cols-6 gap-1.5">
            {labels.map((label, i) => (
              <label
                key={`offset-${i}`}
                className="flex flex-col items-center gap-1"
              >
                <span className="text-[10px] font-medium text-zinc-300">
                  {label}
                </span>
                <input
                  type="number"
                  min={-50}
                  max={50}
                  step={1}
                  value={tuningOffsetsCents[i] ?? 0}
                  onChange={(e) =>
                    onTuningOffsetChange(i, Number(e.target.value))
                  }
                  aria-label={`${label} string cents trim`}
                  className="w-full rounded bg-zinc-800 px-1 py-0.5 text-center text-xs tabular-nums text-zinc-100"
                />
              </label>
            ))}
          </div>
          {hasOffsets && (
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={onResetTuningOffsets}
                className="text-[11px] text-zinc-400 underline hover:text-zinc-200"
              >
                Clear trims
              </button>
            </div>
          )}
        </fieldset>

        <div className="sm:col-span-2 flex justify-end">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_CONFIG)}
            className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
          >
            Reset detection settings
          </button>
        </div>
      </div>
    </details>
  );
}
