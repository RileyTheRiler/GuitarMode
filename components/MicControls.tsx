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
  onExportMidi?: () => void;
  recording: boolean;
  analyzing: boolean;
  level: number;
  error?: string | null;
  hasNotes?: boolean;
};

export function MicControls({
  micOn,
  onToggleMic,
  onReset,
  onUpload,
  onStartRecording,
  onStopRecording,
  onExportMidi,
  recording,
  analyzing,
  level,
  error,
  hasNotes = false,
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
          aria-pressed={micOn}
          title="Toggle microphone (Space)"
          className={`rounded-md px-3 py-2 text-sm font-medium transition ${
            micOn
              ? "bg-emerald-500 text-zinc-950 hover:bg-emerald-400"
              : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700"
          }`}
        >
          {micOn ? "Mic on" : "Turn on mic"}
        </button>

        <button
          type="button"
          onClick={recording ? onStopRecording : onStartRecording}
          disabled={!micOn && !recording}
          title={recording ? "Stop recording" : "Record sample (R)"}
          className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {recording ? "Stop & analyze" : "Record sample"}
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700"
        >
          Upload audio
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileChange}
        />

        {onExportMidi && hasNotes && (
          <button
            type="button"
            onClick={onExportMidi}
            title="Export detected notes as MIDI file"
            className="rounded-md bg-zinc-800 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700"
          >
            Export MIDI
          </button>
        )}

        <button
          type="button"
          onClick={onReset}
          title="Reset all notes (Escape)"
          className="rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
        >
          Start over
        </button>

        {micOn && <LevelMeter level={level} />}
      </div>

      <div className="text-xs text-zinc-400" aria-live="polite">
        {recording && <span className="text-rose-400">● Recording…</span>}
        {analyzing && !recording && <span>Analyzing…</span>}
        {fileName && !analyzing && !recording && <span>Loaded: {fileName}</span>}
        {error && (
          <span role="alert" className="text-rose-400">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
