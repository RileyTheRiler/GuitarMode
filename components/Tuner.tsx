"use client";

import { useEffect, useRef, useState } from "react";
import { tunerReading, type TuningReading } from "@/lib/music/tuner";

type Props = {
  micOn: boolean;
  frequency: number | null;
  a4Hz: number;
};

// Hold the last reading on screen briefly after the note decays so users
// have time to read it instead of seeing "—" the instant they stop sustaining.
const HOLD_MS = 1500;
// Within this many cents, the string is considered in tune.
const IN_TUNE_CENTS = 5;
// Cap the meter at ±50 cents; further-off readings clamp to the edge.
const METER_RANGE = 50;

function colorForCents(cents: number): string {
  const a = Math.abs(cents);
  if (a <= IN_TUNE_CENTS) return "#10b981"; // emerald
  if (a <= 20) return "#fbbf24"; // amber
  return "#ef4444"; // red
}

export function Tuner({ micOn, frequency, a4Hz }: Props) {
  const [held, setHeld] = useState<TuningReading | null>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const r = frequency != null ? tunerReading(frequency, a4Hz) : null;
    if (r) {
      setHeld(r);
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      expireTimerRef.current = setTimeout(() => setHeld(null), HOLD_MS);
    }
  }, [frequency, a4Hz]);

  useEffect(() => {
    return () => {
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
    };
  }, []);

  // Clear stale reading when the mic turns off.
  useEffect(() => {
    if (!micOn) {
      if (expireTimerRef.current) clearTimeout(expireTimerRef.current);
      setHeld(null);
    }
  }, [micOn]);

  const reading = held;
  const cents = reading?.cents ?? 0;
  const clampedCents = Math.max(-METER_RANGE, Math.min(METER_RANGE, cents));
  const needlePct = ((clampedCents + METER_RANGE) / (METER_RANGE * 2)) * 100;
  const inTune = reading != null && Math.abs(cents) <= IN_TUNE_CENTS;
  const meterColor = reading ? colorForCents(cents) : "#52525b";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Tuner
        </h2>
        <span className="text-xs text-zinc-500">Standard tuning (EADGBE)</span>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="flex items-baseline gap-3">
          <span
            className={`font-mono text-4xl font-semibold tabular-nums sm:text-5xl ${
              reading ? "text-zinc-100" : "text-zinc-600"
            }`}
            aria-live="polite"
          >
            {reading?.targetName ?? "—"}
          </span>
          <span
            className="font-mono text-sm tabular-nums"
            style={{ color: meterColor }}
          >
            {reading
              ? `${cents > 0 ? "+" : ""}${cents.toFixed(0)}¢`
              : ""}
          </span>
        </div>

        <div className="relative w-full max-w-md">
          <div className="relative h-3 w-full overflow-hidden rounded-full bg-zinc-800">
            {/* center reference */}
            <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-zinc-600" />
            {/* in-tune zone */}
            <div
              className="absolute top-0 h-full bg-emerald-500/15"
              style={{
                left: `${50 - (IN_TUNE_CENTS / METER_RANGE) * 50}%`,
                width: `${(IN_TUNE_CENTS / METER_RANGE) * 100}%`,
              }}
            />
            {reading && (
              <div
                className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full transition-[left] duration-75"
                style={{
                  left: `${needlePct}%`,
                  backgroundColor: meterColor,
                  boxShadow: inTune ? "0 0 8px #10b981" : undefined,
                }}
                aria-hidden="true"
              />
            )}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
            <span>−50¢</span>
            <span>flat</span>
            <span>0</span>
            <span>sharp</span>
            <span>+50¢</span>
          </div>
        </div>

        <p className="min-h-[1.25rem] text-xs text-zinc-500">
          {!micOn
            ? "Turn on the mic and pluck a string."
            : reading == null
            ? "Pluck a string…"
            : inTune
            ? "In tune."
            : cents < 0
            ? "Tune up."
            : "Tune down."}
        </p>
      </div>
    </div>
  );
}
