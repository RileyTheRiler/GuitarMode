"use client";

import type { PitchDetectorConfig } from "@/lib/audio/usePitchDetector";
import type { MicDevice } from "@/lib/audio/useMicStream";
import { TUNING_PRESETS, type TuningPreset } from "@/lib/guitar/tunings";

type Props = {
  config: PitchDetectorConfig;
  onChange: (patch: Partial<PitchDetectorConfig>) => void;
  devices: MicDevice[];
  currentDeviceId: string | null;
  onDeviceChange: (id: string) => void;
  micOn: boolean;
  tuning: TuningPreset;
  onTuningChange: (preset: TuningPreset) => void;
};

export function InputSettings({
  config,
  onChange,
  devices,
  currentDeviceId,
  onDeviceChange,
  micOn,
  tuning,
  onTuningChange,
}: Props) {
  return (
    <details className="group rounded-lg border border-zinc-800 bg-zinc-900/60">
      <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-zinc-300 group-open:border-b group-open:border-zinc-800">
        Input &amp; detection
      </summary>
      <div className="grid gap-4 p-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1 text-xs text-zinc-400">
          <label htmlFor="input-device">Input device</label>
          <select
            id="input-device"
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
        </div>

        <div className="flex flex-col gap-1 text-xs text-zinc-400">
          <label htmlFor="concert-pitch">Concert pitch (A4)</label>
          <select
            id="concert-pitch"
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
        </div>

        <div className="flex flex-col gap-1 text-xs text-zinc-400">
          <label htmlFor="tuning-preset">Guitar tuning</label>
          <select
            id="tuning-preset"
            className="rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
            value={tuning.id}
            onChange={(e) => {
              const preset = TUNING_PRESETS.find((p) => p.id === e.target.value);
              if (preset) onTuningChange(preset);
            }}
          >
            {TUNING_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-400">
          <input
            id="high-pass"
            type="checkbox"
            checked={config.highPass}
            onChange={(e) => onChange({ highPass: e.target.checked })}
          />
          <span>
            High-pass filter at{" "}
            <input
              type="number"
              min={40}
              max={200}
              step={5}
              value={config.highPassHz}
              onChange={(e) => onChange({ highPassHz: Number(e.target.value) })}
              className="w-16 rounded bg-zinc-800 px-2 py-1 text-sm text-zinc-100"
              aria-label="High-pass filter frequency in Hz"
            />{" "}
            Hz
          </span>
        </label>

        <div className="flex flex-col gap-1 text-xs text-zinc-400">
          <label htmlFor="noise-gate">
            Noise gate:{" "}
            <span className="text-zinc-200">{config.minRms.toFixed(3)}</span> RMS
          </label>
          <input
            id="noise-gate"
            type="range"
            min={0}
            max={0.1}
            step={0.001}
            value={config.minRms}
            onChange={(e) => onChange({ minRms: Number(e.target.value) })}
          />
        </div>

        <div className="flex flex-col gap-1 text-xs text-zinc-400">
          <label htmlFor="pitch-confidence">
            Pitch confidence:{" "}
            <span className="text-zinc-200">{config.minClarity.toFixed(2)}</span>
          </label>
          <input
            id="pitch-confidence"
            type="range"
            min={0.6}
            max={0.99}
            step={0.01}
            value={config.minClarity}
            onChange={(e) => onChange({ minClarity: Number(e.target.value) })}
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-zinc-400 sm:col-span-2">
          <input
            id="polyphonic"
            type="checkbox"
            checked={config.polyphonic}
            onChange={(e) => onChange({ polyphonic: e.target.checked })}
          />
          Polyphonic mode (chord/chroma detection) &mdash; experimental
        </label>
      </div>
    </details>
  );
}
