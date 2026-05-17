"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  audioBuffer: AudioBuffer;
  onTimeUpdate?: (seconds: number) => void;
};

const CANVAS_H = 64;

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
  const duration = audioBuffer.duration;

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

    const src = audioCtx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(audioCtx.destination);
    src.start(0, startOffsetRef.current);
    src.onended = () => {
      if (sourceRef.current !== src) return;
      sourceRef.current = null;
      cancelAnimationFrame(rafRef.current);
      startOffsetRef.current = duration;
      setPlaying(false);
      setProgress(1);
      onTimeUpdate?.(duration);
    };
    sourceRef.current = src;
    startAtRef.current = performance.now() - startOffsetRef.current * 1000;
    setPlaying(true);

    const tick = () => {
      const elapsed = (performance.now() - startAtRef.current) / 1000;
      setProgress(Math.min(elapsed / duration, 1));
      onTimeUpdate?.(Math.min(elapsed, duration));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [audioBuffer, duration, onTimeUpdate]);

  const handlePlay = useCallback(() => {
    if (playing) {
      const elapsed = (performance.now() - startAtRef.current) / 1000;
      startOffsetRef.current = Math.min(startOffsetRef.current + elapsed, duration);
      stopSource();
      setPlaying(false);
      return;
    }
    if (startOffsetRef.current >= duration) startOffsetRef.current = 0;
    startPlayback();
  }, [duration, playing, stopSource, startPlayback]);

  const handleSeek = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      startOffsetRef.current = fraction * duration;
      onTimeUpdate?.(fraction * duration);
      if (playing) {
        stopSource();
        startPlayback();
      } else {
        setProgress(fraction);
      }
    },
    [duration, playing, stopSource, startPlayback, onTimeUpdate]
  );

  useEffect(() => {
    return () => {
      stopSource();
      ctxRef.current?.close().catch((err) => {
        console.warn("WaveformPlayer: AudioContext close failed", err);
      });
    };
  }, [stopSource]);

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
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-400 pointer-events-none"
          style={{ left: `${progress * 100}%` }}
        />
      </div>
      <div className="mt-2 flex items-center gap-3">
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
      </div>
    </div>
  );
}
