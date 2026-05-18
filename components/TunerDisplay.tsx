"use client";

import { freqToMidi, midiToFreq, midiToNoteName } from "@/lib/music/notes";

type Props = {
  frequency: number | null;
  a4Hz?: number;
};

const CENT_RANGE = 50;

export function TunerDisplay({ frequency, a4Hz = 440 }: Props) {
  if (!frequency || frequency <= 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Tuner
        </h2>
        <p className="text-sm text-zinc-500">Play a note to see tuning.</p>
      </div>
    );
  }

  const midiExact = freqToMidi(frequency, a4Hz);
  const midiRounded = Math.round(midiExact);
  const targetFreq = midiToFreq(midiRounded, a4Hz);
  const cents = Math.round(1200 * Math.log2(frequency / targetFreq));
  const noteName = midiToNoteName(midiRounded);
  const clamped = Math.max(-CENT_RANGE, Math.min(CENT_RANGE, cents));
  const pct = ((clamped + CENT_RANGE) / (CENT_RANGE * 2)) * 100;

  const inTune = Math.abs(cents) <= 5;
  const slightlyOff = Math.abs(cents) <= 15;
  const indicatorColor = inTune
    ? "#22c55e"
    : slightlyOff
    ? "#f59e0b"
    : "#ef4444";

  const centsLabel =
    cents === 0 ? "in tune" : cents > 0 ? `+${cents}¢ sharp` : `${cents}¢ flat`;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-400">
        Tuner
      </h2>
      <div className="flex items-center gap-4">
        <span
          className="text-3xl font-bold tracking-tight"
          style={{ color: indicatorColor, minWidth: "3.5rem" }}
          aria-label={`${noteName}, ${centsLabel}`}
        >
          {noteName}
        </span>
        <div className="flex flex-1 flex-col gap-1.5">
          {/* Needle bar */}
          <div
            className="relative h-3 overflow-hidden rounded-full bg-zinc-800"
            role="meter"
            aria-valuenow={cents}
            aria-valuemin={-CENT_RANGE}
            aria-valuemax={CENT_RANGE}
            aria-label="Tuning meter"
          >
            {/* Centre tick */}
            <div className="absolute left-1/2 top-0 h-full w-0.5 -translate-x-1/2 bg-zinc-600" />
            {/* Indicator dot */}
            <div
              className="absolute top-0.5 h-2 w-2 -translate-x-1/2 rounded-full transition-all duration-75"
              style={{ left: `${pct}%`, backgroundColor: indicatorColor }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-500">
            <span>−{CENT_RANGE}¢</span>
            <span style={{ color: indicatorColor }}>{centsLabel}</span>
            <span>+{CENT_RANGE}¢</span>
          </div>
        </div>
      </div>
      <p className="mt-1.5 text-xs text-zinc-500">
        {frequency.toFixed(1)} Hz &mdash; target {targetFreq.toFixed(1)} Hz
      </p>
    </div>
  );
}
