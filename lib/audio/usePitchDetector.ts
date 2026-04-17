"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PitchDetector } from "pitchy";
import { freqToMidi, midiToNoteName, midiToPitchClass } from "../music/notes";

export type DetectedNote = {
  midi: number;
  noteName: string;
  pitchClass: number;
  frequency: number;
  clarity: number;
  at: number; // performance.now()
};

export type PitchDetectorOptions = {
  minFreq?: number;
  maxFreq?: number;
  minClarity?: number;
  minRms?: number;
  framesToConfirm?: number;
};

const DEFAULTS: Required<PitchDetectorOptions> = {
  minFreq: 70,
  maxFreq: 1400,
  minClarity: 0.9,
  minRms: 0.01,
  framesToConfirm: 3,
};

export function usePitchDetector(opts: PitchDetectorOptions = {}) {
  const cfg = { ...DEFAULTS, ...opts };
  const [active, setActive] = useState(false);
  const [currentNote, setCurrentNote] = useState<DetectedNote | null>(null);
  const [level, setLevel] = useState(0);
  const [notes, setNotes] = useState<DetectedNote[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<PitchDetector<Float32Array<ArrayBuffer>> | null>(null);
  const bufferRef = useRef<Float32Array<ArrayBuffer> | null>(null);

  // Debouncer state: require N consecutive frames of the same MIDI note.
  const lastEmittedMidiRef = useRef<number | null>(null);
  const candidateMidiRef = useRef<number | null>(null);
  const candidateCountRef = useRef(0);
  const silenceFramesRef = useRef(0);

  const start = useCallback(
    async (stream: MediaStream) => {
      if (active) return;
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);

      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      const buffer = new Float32Array(
        new ArrayBuffer(analyser.fftSize * Float32Array.BYTES_PER_ELEMENT)
      );

      audioContextRef.current = ctx;
      sourceRef.current = source;
      analyserRef.current = analyser;
      detectorRef.current = detector;
      bufferRef.current = buffer;

      setActive(true);

      const loop = () => {
        const a = analyserRef.current;
        const d = detectorRef.current;
        const buf = bufferRef.current;
        const c = audioContextRef.current;
        if (!a || !d || !buf || !c) return;

        a.getFloatTimeDomainData(buf);

        // RMS for level meter + noise gate
        let sumSq = 0;
        for (let i = 0; i < buf.length; i++) sumSq += buf[i] * buf[i];
        const rms = Math.sqrt(sumSq / buf.length);
        setLevel(rms);

        const [freq, clarity] = d.findPitch(buf, c.sampleRate);

        const passes =
          rms >= cfg.minRms &&
          clarity >= cfg.minClarity &&
          freq >= cfg.minFreq &&
          freq <= cfg.maxFreq;

        if (passes) {
          const midi = Math.round(freqToMidi(freq));
          silenceFramesRef.current = 0;

          if (midi === candidateMidiRef.current) {
            candidateCountRef.current += 1;
          } else {
            candidateMidiRef.current = midi;
            candidateCountRef.current = 1;
          }

          if (
            candidateCountRef.current >= cfg.framesToConfirm &&
            midi !== lastEmittedMidiRef.current
          ) {
            const note: DetectedNote = {
              midi,
              noteName: midiToNoteName(midi),
              pitchClass: midiToPitchClass(midi),
              frequency: freq,
              clarity,
              at: performance.now(),
            };
            lastEmittedMidiRef.current = midi;
            setCurrentNote(note);
            setNotes((prev) => [...prev, note]);
          }
        } else {
          silenceFramesRef.current += 1;
          // After ~200ms of silence, allow the same note to re-trigger
          if (silenceFramesRef.current > 12) {
            lastEmittedMidiRef.current = null;
            candidateMidiRef.current = null;
            candidateCountRef.current = 0;
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    },
    [active, cfg.framesToConfirm, cfg.maxFreq, cfg.minClarity, cfg.minFreq, cfg.minRms]
  );

  const stop = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (sourceRef.current) {
      try {
        sourceRef.current.disconnect();
      } catch {}
      sourceRef.current = null;
    }
    if (analyserRef.current) {
      try {
        analyserRef.current.disconnect();
      } catch {}
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    detectorRef.current = null;
    bufferRef.current = null;
    lastEmittedMidiRef.current = null;
    candidateMidiRef.current = null;
    candidateCountRef.current = 0;
    silenceFramesRef.current = 0;
    setLevel(0);
    setCurrentNote(null);
    setActive(false);
  }, []);

  const reset = useCallback(() => {
    setNotes([]);
    setCurrentNote(null);
    lastEmittedMidiRef.current = null;
    candidateMidiRef.current = null;
    candidateCountRef.current = 0;
  }, []);

  const addNotes = useCallback((more: DetectedNote[]) => {
    setNotes((prev) => [...prev, ...more]);
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    };
  }, []);

  return { active, start, stop, reset, addNotes, currentNote, level, notes };
}
