import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import type { SheetAnalysis } from "@/lib/sheet/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_NOTES = 64;

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an expert music transcriber analyzing a PDF page of music. The PDF may contain standard staff notation, guitar tablature, chord charts, or a mix. Your job is to extract structured information about the piece so a guitar practice app can suggest scales, modes, and solos that fit.

Always respond with valid JSON only — no markdown, no prose outside the JSON. Your response must match this exact schema:
{
  "title": "string — song title, empty string if unknown",
  "artist": "string — artist/composer, empty string if unknown",
  "key": "string — key of the piece, e.g. \\"E minor\\", \\"A major\\", \\"D dorian\\". Best guess if not explicit.",
  "bpm": number | null,
  "timeSignature": "string like \\"4/4\\" | null",
  "chordsText": "string — chord progression as a comma-separated list, e.g. \\"Em, C, G, D\\"",
  "notes": [
    { "noteName": "E4", "midi": 64, "beats": 1 }
  ],
  "sections": [ { "name": "verse", "chords": "Em, C, G, D" } ],
  "notesSummary": "string — one sentence describing the melodic/harmonic character"
}

Rules:
- Note names use scientific pitch notation (C4 = middle C). Use sharps, not flats (write "F#4" not "Gb4").
- For each note also include the MIDI number (C4 = 60, A4 = 69).
- "beats" is the note's duration in quarter-note beats (1 = quarter, 0.5 = eighth, 2 = half). Default to 1 if unclear.
- Prefer the lead/melody line. If the score contains both melody and accompaniment staves, extract the melody. If it is pure tablature, extract the picked notes. If it is a chord chart with no melody, leave "notes" as an empty array.
- Provide at most ${MAX_NOTES} notes — pick a representative phrase if the piece is longer.
- "chordsText" should reflect the actual progression shown (or implied by chord symbols above the staff).
- If a value is genuinely unknown, use an empty string for strings, null for numbers, or an empty array.
- Never invent details that contradict the PDF.`;

function isSheetAnalysis(value: unknown): value is SheetAnalysis {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.title === "string" &&
    typeof v.artist === "string" &&
    typeof v.key === "string" &&
    typeof v.chordsText === "string" &&
    Array.isArray(v.notes)
  );
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' field" }, { status: 400 });
  }

  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json({ error: "File must be a PDF" }, { status: 415 });
  }

  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "PDF exceeds 10 MB limit" }, { status: 413 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");

  let message;
  try {
    message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: base64,
              },
            },
            {
              type: "text",
              text: "Analyze this music PDF and return the JSON described in the system prompt.",
            },
          ],
        },
      ],
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Claude request failed: ${detail}` },
      { status: 502 }
    );
  }

  const text = message.content[0]?.type === "text" ? message.content[0].text : "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  if (!isSheetAnalysis(parsed)) {
    return NextResponse.json({ error: "AI response did not match expected shape" }, { status: 500 });
  }

  if (parsed.notes.length > MAX_NOTES) {
    parsed.notes = parsed.notes.slice(0, MAX_NOTES);
  }

  return NextResponse.json(parsed);
}
