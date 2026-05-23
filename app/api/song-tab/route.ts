import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export type SongTabRequest = {
  query: string; // song name + optional artist, e.g. "Smoke on the Water, Deep Purple"
};

export type SongTabResponse = {
  tab: string;
  key: string;
  title: string;
  note: string;
};

const client = new Anthropic();

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function sanitize(s: string, max: number): string {
  return s.replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, max);
}

const SYSTEM_PROMPT = `You are a guitar teacher. When given a song name (and optional artist), respond with the main recognizable guitar riff or melody as ASCII tablature.

Always respond with valid JSON only — no markdown, no prose outside the JSON. Use this exact schema:
{
  "tab": "the full 6-line ASCII tab",
  "key": "key/scale name, e.g. A Minor Pentatonic or E Blues",
  "title": "Song Name — Riff/Melody description",
  "note": "one sentence about the riff context or technique"
}

Tab format rules:
- Always include all 6 strings in this exact order (top to bottom): e, B, G, D, A, E
- Use lowercase e for the high e string, uppercase E for the low E string
- Use only digits (0–24) and dashes for note/rest markers
- Include 1–3 bars of the most recognizable part
- Separate bars with | characters
- No technique annotations (no h, p, b, /, ~ etc.) — keep it clean for the parser

Example format:
e|---0---3---5---|
B|---1---3---5---|
G|---0---2---4---|
D|---2---0---2---|
A|---3---2---0---|
E|---3---3---3---|

If you don't know the song well enough to provide accurate tab, write a simple melodic riff in an appropriate key for the genre instead, and mention that in the note field.`;

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  let body: SongTabRequest;
  try {
    body = (await request.json()) as SongTabRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }

  const safeQuery = sanitize(String(body.query), 150);

  let message;
  try {
    message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: `<song_query>${safeQuery}</song_query>` }],
    });
  } catch (e) {
    console.error("song-tab: Claude API error", e);
    return NextResponse.json(
      { error: "AI service unavailable. Try again shortly." },
      { status: 502 }
    );
  }

  const text =
    message.content[0].type === "text" ? message.content[0].text : "";

  let parsed: SongTabResponse;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("song-tab: failed to parse response", text.slice(0, 200));
    return NextResponse.json(
      { error: "Failed to parse AI response" },
      { status: 500 }
    );
  }

  return NextResponse.json(parsed);
}
