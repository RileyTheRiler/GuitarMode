"use client";

import type { PitchDetectorConfig } from "@/lib/audio/usePitchDetector";
import type { MicDevice } from "@/lib/audio/useMicStream";

type Props = {
  config: PitchDetectorConfig;
  onChange: (patch: Partial<PitchDetectorConfig>) => void;
  devices: MicDevice[];
  currentDeviceId: string | null;
  onDeviceChange: (id: string) => void;
  micOn: boolean;
};

export function InputSettings({
  config,
  onChange,
  devices,
  currentDeviceId,
  onDeviceChange,
  micOn,
}: Props) {
  return (
    <details className="group rounded-lg border border-zinc-800/80 bg-zinc-900/50 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <summary className="flex cursor-pointer select-none items-center justify-between px-4 py-3 text-sm font-medium text-zinc-300 group-open:border-b group-open:border-zinc-800 hover:text-zinc-100 transition-colors">
        <span className="flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M2 4h12M2 8h12M2 12h12"/>
            <circle cx="5" cy="4" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="10" cy="8" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
          Input &amp; detection
        </span>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-transform duration-200 group-open:rotate-180" aria-hidden="true">
          <path d="M4 6l4 4 4-4"/>
        </svg>
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
      </div>
    </details>
  );
}
