import type { DetectedNote } from "../audio/usePitchDetector";

function writeVarLen(buf: number[], value: number) {
  const bytes: number[] = [];
  bytes.unshift(value & 0x7f);
  value >>= 7;
  while (value > 0) {
    bytes.unshift((value & 0x7f) | 0x80);
    value >>= 7;
  }
  for (const b of bytes) buf.push(b);
}

function writeUint32(buf: number[], value: number) {
  buf.push((value >>> 24) & 0xff);
  buf.push((value >>> 16) & 0xff);
  buf.push((value >>> 8) & 0xff);
  buf.push(value & 0xff);
}

function writeUint16(buf: number[], value: number) {
  buf.push((value >>> 8) & 0xff);
  buf.push(value & 0xff);
}

/**
 * Converts detected notes to a Type-0 MIDI file (single track, 120 BPM).
 * Each note is encoded as note-on / note-off pair using absolute tick offsets.
 */
export function notesToMidi(notes: DetectedNote[]): Uint8Array {
  if (notes.length === 0) return new Uint8Array(0);

  const TICKS_PER_BEAT = 480;
  const BPM = 120;
  const MS_PER_TICK = (60_000 / BPM) / TICKS_PER_BEAT;

  // Build time-stamped events: [tick, type, midi, velocity]
  type MidiEvent = { tick: number; on: boolean; midi: number };
  const events: MidiEvent[] = [];

  for (const note of notes) {
    const onTick = Math.round(note.at / MS_PER_TICK);
    const offTick = Math.round((note.at + Math.max(note.durationMs, 80)) / MS_PER_TICK);
    events.push({ tick: onTick, on: true, midi: note.midi });
    events.push({ tick: offTick, on: false, midi: note.midi });
  }

  events.sort((a, b) => a.tick - b.tick || (a.on ? 1 : -1));

  // Encode track events as delta-time MIDI messages
  const trackBuf: number[] = [];
  let prevTick = 0;
  for (const ev of events) {
    const delta = Math.max(0, ev.tick - prevTick);
    writeVarLen(trackBuf, delta);
    prevTick = ev.tick;
    const velocity = ev.on ? 80 : 0;
    trackBuf.push(0x90); // note on channel 1 (note-off with vel=0 is valid)
    trackBuf.push(Math.max(0, Math.min(127, ev.midi)));
    trackBuf.push(velocity);
  }
  // End-of-track meta event
  writeVarLen(trackBuf, 0);
  trackBuf.push(0xff, 0x2f, 0x00);

  // Assemble MIDI file
  const fileBuf: number[] = [];

  // Header chunk
  fileBuf.push(0x4d, 0x54, 0x68, 0x64); // "MThd"
  writeUint32(fileBuf, 6);              // chunk length
  writeUint16(fileBuf, 0);              // format 0
  writeUint16(fileBuf, 1);              // 1 track
  writeUint16(fileBuf, TICKS_PER_BEAT);

  // Track chunk
  fileBuf.push(0x4d, 0x54, 0x72, 0x6b); // "MTrk"
  writeUint32(fileBuf, trackBuf.length);
  for (const b of trackBuf) fileBuf.push(b);

  return new Uint8Array(fileBuf);
}

export function downloadMidi(notes: DetectedNote[], filename = "guitarmode-session.mid") {
  const bytes = notesToMidi(notes);
  if (bytes.length === 0) return;
  const blob = new Blob([bytes.buffer as ArrayBuffer], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
