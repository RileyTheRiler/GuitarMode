"use client";

import { useCallback, useEffect, useState } from "react";
import type { DetectedNote } from "@/lib/audio/usePitchDetector";

const STORAGE_KEY = "guitarmode:sessions:v1";
const MAX_SESSIONS = 10;

export type SavedSession = {
  id: string;
  name: string;
  savedAt: number;
  notes: DetectedNote[];
  chromaProfile: number[];
};

function loadSessions(): SavedSession[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedSession[];
  } catch {
    return [];
  }
}

function persistSessions(sessions: SavedSession[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    console.warn("SessionManager: failed to save sessions");
  }
}

type Props = {
  notes: DetectedNote[];
  chromaProfile: number[];
  onRestore: (session: SavedSession) => void;
};

export function SessionManager({ notes, chromaProfile, onRestore }: Props) {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setSessions(loadSessions());
  }, [open]);

  const handleSave = useCallback(() => {
    if (notes.length === 0) return;
    const existing = loadSessions();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const name = `Session ${existing.length + 1}`;
    const entry: SavedSession = { id, name, savedAt: Date.now(), notes, chromaProfile };
    const next = [entry, ...existing].slice(0, MAX_SESSIONS);
    persistSessions(next);
    setSessions(next);
    setOpen(true);
  }, [notes, chromaProfile]);

  const handleDelete = useCallback((id: string) => {
    const next = loadSessions().filter((s) => s.id !== id);
    persistSessions(next);
    setSessions(next);
  }, []);

  const handleRename = useCallback((id: string, name: string) => {
    const next = loadSessions().map((s) => (s.id === id ? { ...s, name } : s));
    persistSessions(next);
    setSessions(next);
  }, []);

  const hasNotes = notes.length > 0;

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Sessions
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasNotes}
            title={hasNotes ? "Save current notes as a session" : "Play some notes first"}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="rounded-md bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-100 transition hover:bg-zinc-700"
          >
            {open ? "Hide" : `History${sessions.length > 0 ? ` (${sessions.length})` : ""}`}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-3">
          {sessions.length === 0 ? (
            <p className="text-sm text-zinc-500">No saved sessions yet.</p>
          ) : (
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <input
                      className="w-full truncate bg-transparent text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-600 rounded px-0.5"
                      value={s.name}
                      onChange={(e) => handleRename(s.id, e.target.value)}
                      aria-label="Session name"
                    />
                    <p className="text-[10px] text-zinc-500">
                      {s.notes.length} notes &middot;{" "}
                      {new Date(s.savedAt).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRestore(s)}
                    className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-100 hover:bg-zinc-600 transition shrink-0"
                  >
                    Restore
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(s.id)}
                    className="rounded p-1 text-zinc-500 hover:text-rose-400 hover:bg-zinc-700 transition"
                    aria-label={`Delete ${s.name}`}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
