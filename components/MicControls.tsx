"use client";

import { useRef, useState } from "react";
import { LevelMeter } from "./LevelMeter";

type Props = {
  micOn: boolean;
  onToggleMic: () => void;
  onReset: () => void;
  onUpload: (file: File) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  recording: boolean;
  analyzing: boolean;
  level: number;
  error?: string | null;
};

export function MicControls({
  micOn,
  onToggleMic,
  onReset,
  onUpload,
  onStartRecording,
  onStopRecording,
  recording,
  analyzing,
  level,
  error,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    onUpload(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggleMic}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            micOn
              ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.35)]"
              : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <rect x="5" y="1" width="6" height="9" rx="3"/>
            <path d="M3 8a5 5 0 0 0 10 0M8 13v2M5 15h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          </svg>
          {micOn ? "Mic on" : "Start listening"}
        </button>

        <button
          type="button"
          onClick={recording ? onStopRecording : onStartRecording}
          disabled={!micOn && !recording}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
            recording
              ? "bg-rose-600 text-white hover:bg-rose-500"
              : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700"
          }`}
        >
          {recording ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
              <rect x="1" y="1" width="8" height="8" rx="1.5"/>
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
              <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
              <circle cx="6" cy="6" r="2.5"/>
            </svg>
          )}
          {recording ? "Stop & analyze" : "Record sample"}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 10V3M5 6l3-3 3 3"/>
            <path d="M3 13h10"/>
          </svg>
          Upload audio
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />

        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-transparent px-3 py-2.5 text-sm font-medium text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-200"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
            <path d="M3 8a5 5 0 1 0 1-3.5"/>
            <path d="M3 4.5V8H6.5"/>
          </svg>
          Start over
        </button>

        {micOn && <LevelMeter level={level} />}
      </div>

      <div className="text-xs text-zinc-400">
        {recording && (
          <span className="inline-flex items-center gap-1.5 text-rose-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
            </span>
            Recording…
          </span>
        )}
        {analyzing && !recording && <span>Analyzing…</span>}
        {fileName && !analyzing && !recording && <span>Loaded: {fileName}</span>}
        {error && <span className="text-rose-400">{error}</span>}
      </div>
    </div>
  );
}
