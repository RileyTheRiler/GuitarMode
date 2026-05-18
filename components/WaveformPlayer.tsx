"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { stretchOLA } from "@/lib/audio/timeStretch";

type Props = {
  audioBuffer: AudioBuffer;
  onTimeUpdate?: (seconds: number) => void;
};

const CANVAS_H = 64;
// Don't let A and B collapse onto the same sample — Web Audio silently
// drops the loop if loopEnd <= loopStart.
const MIN_LOOP_S = 0.05;
// Available playback speeds. Pitch-preserving (OLA), so safe for practice.
const RATE_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5] as const;

function drawWaveform(canvas: HTMLCanvasElement, buffer: AudioBuffer) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  const data = buffer.getChannelData(0);
  const step = Math.max(1, Math.floor(data.length / W));

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#18181b";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#3b82f6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < W; x++) {
    const start = x * step;
    let min = 1, max = -1;
    for (let i = 0; i < step; i++) {
      const v = data[start + i] ?? 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const y1 = ((1 - max) / 2) * H;
    const y2 = ((1 - min) / 2) * H;
    if (x === 0) ctx.moveTo(x, y1);
    ctx.lineTo(x, y1);
    ctx.lineTo(x, y2);
  }
  ctx.stroke();
}

export function WaveformPlayer({ audioBuffer, onTimeUpdate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const startAtRef = useRef(0);
  const startOffsetRef = useRef(0);
  const rafRef = useRef<number>(0);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loopA, setLoopA] = useState<number | null>(null);
  const [loopB, setLoopB] = useState<number | null>(null);
  const [loopOn, setLoopOn] = useState(false);
  const [rate, setRate] = useState<number>(1);
  const duration = audioBuffer.duration;

  // Pitch-preserving stretched buffer for non-1 rates. Recomputes on
  // buffer or rate change; for the typical 5–30 s clip the OLA pass
  // takes well under 100 ms, so we keep it synchronous.
  const playBuffer = useMemo(
    () => (rate === 1 ? audioBuffer : stretchOLA(audioBuffer, rate)),
    [audioBuffer, rate]
  );
  const rateRef = useRef(rate);
  rateRef.current = rate;

  const loopActive =
    loopOn && loopA != null && loopB != null && loopB - loopA >= MIN_LOOP_S;
  // Mirror into refs so the running tick / source-config reads the latest values
  // without us needing to recreate the source on every state change.
  const loopARef = useRef<number | null>(loopA);
  const loopBRef = useRef<number | null>(loopB);
  const loopActiveRef = useRef(loopActive);
  loopARef.current = loopA;
  loopBRef.current = loopB;
  loopActiveRef.current = loopActive;

  // Draw waveform whenever buffer changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      drawWaveform(canvas, audioBuffer);
    });
    ro.observe(canvas);
    canvas.width = canvas.offsetWidth || 400;
    drawWaveform(canvas, audioBuffer);
    return () => ro.disconnect();
  }, [audioBuffer]);

  // Drop stale markers if a new (shorter) buffer comes in.
  useEffect(() => {
    if (loopA != null && loopA > duration) setLoopA(null);
    if (loopB != null && loopB > duration) setLoopB(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioBuffer]);

  const stopSource = useCallback(() => {
    if (sourceRef.current) {
      try { sourceRef.current.stop(); } catch {}
      sourceRef.current = null;
    }
    cancelAnimationFrame(rafRef.current);
  }, []);

  const handleStop = useCallback(() => {
    stopSource();
    startOffsetRef.current = 0;
    setPlaying(false);
    setProgress(0);
    onTimeUpdate?.(0);
  }, [stopSource, onTimeUpdate]);

  const startPlayback = useCallback(() => {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioCtx();
    }
    const audioCtx = ctxRef.current;

    // When looping, snap the start position into [A, B] so the AudioBufferSourceNode
    // doesn't have to seek past loopEnd before wrapping.
    if (loopActiveRef.current) {
      const a = loopARef.current!;
      const b = loopBRef.current!;
      if (startOffsetRef.current < a || startOffsetRef.current >= b) {
        startOffsetRef.current = a;
      }
    }

    const r = rateRef.current;
    const src = audioCtx.createBufferSource();
    src.buffer = playBuffer;
    src.connect(audioCtx.destination);
    if (loopActiveRef.current) {
      // Source positions are in stretched-buffer time, but A/B are stored in
      // original time. Convert at the boundary.
      src.loop = true;
      src.loopStart = loopARef.current! / r;
      src.loopEnd = loopBRef.current! / r;
    }
    src.start(0, startOffsetRef.current / r);
    src.onended = () => {
      if (sourceRef.current !== src) return;
      sourceRef.current = null;
      cancelAnimationFrame(rafRef.current);
      // Natural end (only fires when not looping): leave playhead at the end so
      // users see where playback finished. An explicit Stop resets via handleStop.
      startOffsetRef.current = duration;
      setPlaying(false);
      setProgress(1);
      onTimeUpdate?.(duration);
    };
    sourceRef.current = src;
    startAtRef.current = performance.now();
    setPlaying(true);

    const tick = () => {
      const elapsed = (performance.now() - startAtRef.current) / 1000;
      // elapsed is wallclock seconds; original time advances at `rate × wallclock`
      // because the stretched buffer plays at its own sample rate.
      const rNow = rateRef.current;
      const rawPos = startOffsetRef.current + elapsed * rNow;
      let pos: number;
      if (loopActiveRef.current) {
        const a = loopARef.current!;
        const b = loopBRef.current!;
        const len = b - a;
        pos = rawPos < b ? rawPos : a + ((rawPos - a) % len);
      } else {
        pos = Math.min(rawPos, duration);
      }
      setProgress(pos / duration);
      onTimeUpdate?.(pos);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [playBuffer, duration, onTimeUpdate]);

  const handlePlay = useCallback(() => {
    if (playing) {
      // Compute & store playhead position (original time) so resume picks up
      // where pause left off.
      const elapsed = (performance.now() - startAtRef.current) / 1000;
      const rawPos = startOffsetRef.current + elapsed * rateRef.current;
      let pausePos = Math.min(rawPos, duration);
      if (loopActiveRef.current) {
        const a = loopARef.current!;
        const b = loopBRef.current!;
        const len = b - a;
        pausePos = rawPos < b ? rawPos : a + ((rawPos - a) % len);
      }
      startOffsetRef.current = pausePos;
      stopSource();
      setPlaying(false);
      return;
    }
    if (startOffsetRef.current >= duration) startOffsetRef.current = 0;
    startPlayback();
  }, [duration, playing, stopSource, startPlayback]);

  // Compute the current visible playhead time (original time), for "Set A/B".
  const currentPlayheadSeconds = useCallback(() => {
    if (!playing) return startOffsetRef.current;
    const elapsed = (performance.now() - startAtRef.current) / 1000;
    const rawPos = startOffsetRef.current + elapsed * rateRef.current;
    if (loopActiveRef.current) {
      const a = loopARef.current!;
      const b = loopBRef.current!;
      const len = b - a;
      return rawPos < b ? rawPos : a + ((rawPos - a) % len);
    }
    return Math.min(rawPos, duration);
  }, [playing, duration]);

  // Apply A/B/loopOn changes to a running source by restarting at the current
  // playhead. Re-run on every change to those refs.
  const restartIfPlaying = useCallback(() => {
    if (!playing) return;
    const pos = currentPlayheadSeconds();
    startOffsetRef.current = pos;
    stopSource();
    startPlayback();
  }, [playing, currentPlayheadSeconds, stopSource, startPlayback]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const target = fraction * duration;
      startOffsetRef.current = target;
      onTimeUpdate?.(target);
      if (playing) {
        stopSource();
        startPlayback();
      } else {
        setProgress(fraction);
      }
    },
    [duration, playing, stopSource, startPlayback, onTimeUpdate]
  );

  const handleSetA = useCallback(() => {
    const t = currentPlayheadSeconds();
    setLoopA(t);
    // Keep A < B; if B is now invalid, drop it.
    if (loopB != null && loopB - t < MIN_LOOP_S) setLoopB(null);
  }, [currentPlayheadSeconds, loopB]);

  const handleSetB = useCallback(() => {
    const t = currentPlayheadSeconds();
    if (loopA != null && t - loopA < MIN_LOOP_S) return;
    setLoopB(t);
  }, [currentPlayheadSeconds, loopA]);

  const handleClearLoop = useCallback(() => {
    setLoopA(null);
    setLoopB(null);
    setLoopOn(false);
  }, []);

  const handleToggleLoop = useCallback(() => {
    setLoopOn((v) => !v);
  }, []);

  // After the user changes loop / rate settings while playing, restart so
  // the source picks up the new config or stretched buffer.
  useEffect(() => {
    restartIfPlaying();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loopA, loopB, loopOn, rate, playBuffer]);

  useEffect(() => {
    return () => {
      stopSource();
      ctxRef.current?.close().catch((err) => {
        console.warn("WaveformPlayer: AudioContext close failed", err);
      });
    };
  }, [stopSource]);

  const aFrac = loopA != null ? loopA / duration : null;
  const bFrac = loopB != null ? loopB / duration : null;
  const loopReady = loopA != null && loopB != null && loopB - loopA >= MIN_LOOP_S;

  return (
    <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950 p-3">
      <p className="mb-2 text-xs text-zinc-500">
        Recording · {duration.toFixed(1)} s — click waveform to seek
      </p>
      <div className="relative">
        <canvas
          ref={canvasRef}
          height={CANVAS_H}
          className="w-full rounded cursor-pointer"
          style={{ height: CANVAS_H }}
          onClick={handleSeek}
          aria-label="Audio waveform — click to seek"
        />
        {/* Loop region shading */}
        {aFrac != null && bFrac != null && bFrac > aFrac && (
          <div
            className={`absolute top-0 bottom-0 pointer-events-none ${
              loopActive ? "bg-amber-400/15" : "bg-amber-400/5"
            }`}
            style={{
              left: `${aFrac * 100}%`,
              width: `${(bFrac - aFrac) * 100}%`,
            }}
          />
        )}
        {/* A marker */}
        {aFrac != null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-amber-300 pointer-events-none"
            style={{ left: `${aFrac * 100}%` }}
            aria-hidden="true"
          >
            <span className="absolute -top-3 -translate-x-1/2 text-[9px] font-semibold text-amber-300">
              A
            </span>
          </div>
        )}
        {/* B marker */}
        {bFrac != null && (
          <div
            className="absolute top-0 bottom-0 w-px bg-amber-300 pointer-events-none"
            style={{ left: `${bFrac * 100}%` }}
            aria-hidden="true"
          >
            <span className="absolute -top-3 -translate-x-1/2 text-[9px] font-semibold text-amber-300">
              B
            </span>
          </div>
        )}
        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-400 pointer-events-none"
          style={{ left: `${progress * 100}%` }}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 gap-y-1.5">
        <button
          onClick={handlePlay}
          className="rounded px-3 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-100 transition-colors"
        >
          {playing ? "Pause" : "Play"}
        </button>
        <button
          onClick={handleStop}
          className="rounded px-3 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
        >
          Stop
        </button>
        <span className="text-xs text-zinc-500 tabular-nums">
          {(progress * duration).toFixed(1)}s / {duration.toFixed(1)}s
        </span>
        <label className="flex items-center gap-1 text-xs text-zinc-400">
          Speed
          <select
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
            aria-label="Playback speed (pitch preserved)"
            className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-100"
          >
            {RATE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}x
              </option>
            ))}
          </select>
        </label>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <button
            onClick={handleSetA}
            className="rounded px-2 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
            title="Set loop start at the current playhead"
          >
            Set A
            {loopA != null && (
              <span className="ml-1 text-amber-300 tabular-nums">
                {loopA.toFixed(1)}s
              </span>
            )}
          </button>
          <button
            onClick={handleSetB}
            disabled={loopA == null}
            className="rounded px-2 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
            title="Set loop end at the current playhead (must be after A)"
          >
            Set B
            {loopB != null && (
              <span className="ml-1 text-amber-300 tabular-nums">
                {loopB.toFixed(1)}s
              </span>
            )}
          </button>
          <button
            onClick={handleToggleLoop}
            disabled={!loopReady}
            aria-pressed={loopActive}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              loopActive
                ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
                : "bg-zinc-800 hover:bg-zinc-700 text-zinc-200"
            }`}
            title={loopReady ? "Loop between A and B" : "Set A and B first"}
          >
            Loop
          </button>
          {(loopA != null || loopB != null) && (
            <button
              onClick={handleClearLoop}
              className="rounded px-2 py-1 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 transition-colors"
              title="Clear A/B markers"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
