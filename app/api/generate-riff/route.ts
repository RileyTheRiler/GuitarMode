import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export type GenerateRiffRequest = {
  song: string;
  artist: string;
  key: string;
  bpm?: number;
  chords: string;
  section: "verse" | "chorus" | "solo" | "bridge";
  hummedNotes?: string[];
};

export type GenerateRiffResponse = {
  description: string;
  riffNotes: string[];
  tablature: string;
  scale: string;
  tips: string;
};

const client = new Anthropic();

// In-memory rate limiter: max 10 requests per minute per IP.
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

const VALID_SECTIONS = new Set(["verse", "chorus", "solo", "bridge"]);

// Strip control characters (including newlines) and truncate to prevent prompt injection.
function sanitize(value: string, maxLen: number): string {
  return value.replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, maxLen);
}

const SYSTEM_PROMPT = `You are an expert guitarist and music theory teacher helping a cover band lead guitarist write original riffs and solos. You understand rock, blues, metal, pop, and country guitar styles deeply.

Always respond with valid JSON only — no markdown, no prose outside the JSON. Your response must match this exact schema:
{
  "description": "string — what the riff is going for stylistically",
  "riffNotes": ["array", "of", "note", "names", "like", "E4"],
  "tablature": "string — ASCII guitar tab, use standard 6-string format (e B G D A E from top to bottom)",
  "scale": "string — scale/mode name, e.g. A Minor Pentatonic",
  "tips": "string — technique tips (bends, slides, vibrato, picking, etc.)"
}

Rules for riffNotes: use scientific pitch notation (e.g. "E4", "G3", "A4"). Keep notes within guitar range (E2 to E5). Provide 6–16 notes that form a coherent musical phrase.

Rules for tablature: use this format exactly:
e|---------|
B|---------|
G|---------|
D|---------|
A|---------|
E|---------|

Use realistic, playable fret numbers. Include bends (b), slides (/\\), hammer-ons (h), pull-offs (p), and vibrato (~) where musically appropriate.`;

export async function POST(request: Request) {
  // Rate limiting
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  let body: GenerateRiffRequest;
  try {
    body = (await request.json()) as GenerateRiffRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { song, artist, key, bpm, chords, section, hummedNotes } = body;

  if (!song || !section) {
    return NextResponse.json({ error: "song and section are required" }, { status: 400 });
  }
  if (!VALID_SECTIONS.has(section)) {
    return NextResponse.json({ error: "Invalid section value" }, { status: 400 });
  }

  // Sanitize all user-controlled inputs before embedding in the prompt.
  const safeSong = sanitize(String(song), 100);
  const safeArtist = sanitize(String(artist || ""), 100);
  const safeKey = sanitize(String(key || ""), 30);
  const safeChords = sanitize(String(chords || ""), 200);
  const safeBpm = bpm != null ? Math.max(20, Math.min(400, Number(bpm) || 120)) : null;

  // Validate hummedNotes: must be an array of scientific pitch strings.
  const PITCH_RE = /^[A-G]#?-?\d+$/;
  const safeHummedNotes = Array.isArray(hummedNotes)
    ? hummedNotes
        .filter((n) => typeof n === "string" && PITCH_RE.test(n))
        .slice(0, 32)
    : [];

  // Use XML tags to clearly delimit user data from instructions.
  let userMessage = `<song>${safeSong}</song>
<artist>${safeArtist || "unknown artist"}</artist>
<key>${safeKey || "unknown"}</key>
${safeBpm != null ? `<tempo>${safeBpm} BPM</tempo>` : ""}
<chords>${safeChords || "unknown"}</chords>
<section>${section}</section>`;

  if (safeHummedNotes.length > 0) {
    userMessage += `\n<hummed_melody>${safeHummedNotes.join(", ")}</hummed_melody>\nPlease adapt this melody to guitar range and style, keeping the contour of the phrase where possible.`;
  } else {
    userMessage += `\n\nGenerate an original riff/lick that fits this section. Make it memorable and stylistically appropriate.`;
  }

  let message;
  try {
    message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (e) {
    console.error("generate-riff: Claude API error", e);
    return NextResponse.json({ error: "AI service unavailable. Try again shortly." }, { status: 502 });
  }

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  let parsed: GenerateRiffResponse;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    console.error("generate-riff: failed to parse response", e, text.slice(0, 200));
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  return NextResponse.json(parsed);
}
