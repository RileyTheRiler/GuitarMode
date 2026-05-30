import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { clientIp, createRateLimiter } from "@/lib/server/rateLimit";
import { sanitize, sanitizeMultiline } from "@/lib/server/sanitize";

export type SoloCoachMessage = { role: "user" | "assistant"; content: string };

export type SoloCoachContext = {
  detectedKey?: string; // e.g. "A" (scale rootName)
  detectedScale?: string; // e.g. "Minor Pentatonic" (templateName)
  playedNotes?: string[]; // scientific pitch names, e.g. ["A3", "C4", "E4"]
  topic?: string; // chosen lesson-topic label, optional
};

export type SoloCoachRequest = {
  messages: SoloCoachMessage[];
  context?: SoloCoachContext;
};

export type SoloCoachResponse = { reply: string };

const client = new Anthropic();

// Max 10 requests per minute per IP, scoped to this route.
const checkRateLimit = createRateLimiter(10, 60_000);

const MAX_MESSAGES = 20;
const MAX_MSG_LEN = 4000;
const MAX_PLAYED_NOTES = 48;
const PITCH_RE = /^[A-G]#?-?\d+$/;

const SYSTEM_PROMPT = `You are a world-class electric guitar solo teacher coaching an improvising student one-on-one. You specialize in helping players make their solos more musical and expressive. You understand rock, blues, metal, jazz, and pop lead guitar deeply.

Your teaching covers, among other things:
- Phrasing and space: breathing, leaving room, not over-playing, question/answer phrases.
- Motif development and call-and-response: stating an idea and varying it.
- Target tones and guide tones: landing chord tones on strong beats, voice-leading through a progression.
- Expressive technique: bends (and bending in tune), vibrato, slides, hammer-ons/pull-offs, rakes.
- Dynamics and articulation: volume, attack, palm muting, accenting.
- Rhythm and note density: syncopation, varying subdivisions, avoiding constant 16th-note runs.
- Building a solo: tension and release, dynamic arc, climax, starting low and building.
- Scale and mode choices: pentatonic, blues, the modes, and when to switch.

Coaching style:
- Be concrete, encouraging, and concise. Prefer a few short paragraphs over a wall of text.
- When the student's detected key/scale and recently played notes are provided, reference them and tailor exercises to them. If no context is given, ask a brief clarifying question or give a sensible general example.
- When you show a lick or exercise, write ASCII guitar tab inside a triple-backtick code fence, using standard 6-string format (e B G D A E from top to bottom) with realistic, playable fret numbers. Mark bends (b), slides (/\\), hammer-ons (h), pull-offs (p), and vibrato (~) where appropriate.
- End most replies with one small, actionable thing to try next.`;

export async function POST(request: Request) {
  // Rate limiting
  const ip = clientIp(request);
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  let body: SoloCoachRequest;
  try {
    body = (await request.json()) as SoloCoachRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "messages are required" }, { status: 400 });
  }

  // Keep only the most recent turns, validate roles, sanitize content, drop empties.
  const safeMessages: SoloCoachMessage[] = body.messages
    .slice(-MAX_MESSAGES)
    .filter(
      (m): m is SoloCoachMessage =>
        !!m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string"
    )
    .map((m) => ({ role: m.role, content: sanitizeMultiline(m.content, MAX_MSG_LEN) }))
    .filter((m) => m.content.length > 0);

  if (safeMessages.length === 0) {
    return NextResponse.json({ error: "messages are required" }, { status: 400 });
  }
  // The conversation must end on a user turn for Claude to reply.
  if (safeMessages[safeMessages.length - 1].role !== "user") {
    return NextResponse.json({ error: "Last message must be from the user" }, { status: 400 });
  }

  // Validate optional personalization context.
  const ctx = body.context ?? {};
  const safeKey = sanitize(String(ctx.detectedKey ?? ""), 30);
  const safeScale = sanitize(String(ctx.detectedScale ?? ""), 60);
  const safeTopic = sanitize(String(ctx.topic ?? ""), 80);
  const safePlayedNotes = Array.isArray(ctx.playedNotes)
    ? ctx.playedNotes
        .filter((n) => typeof n === "string" && PITCH_RE.test(n))
        .slice(0, MAX_PLAYED_NOTES)
    : [];

  // Inject context as an XML-tagged preamble on the first user turn. This keeps
  // the system prompt byte-identical across requests so its cache prefix holds,
  // and keeps user-derived data clearly delimited from instructions.
  const contextBlock = `<student_context>
<detected_key>${safeKey || "unknown"}</detected_key>
<detected_scale>${safeScale || "unknown"}</detected_scale>
<recently_played_notes>${safePlayedNotes.join(", ") || "none captured"}</recently_played_notes>
${safeTopic ? `<lesson_topic>${safeTopic}</lesson_topic>` : ""}</student_context>
The above describes what the student has been playing. Use it to personalize your coaching when relevant.`;

  const firstUserIdx = safeMessages.findIndex((m) => m.role === "user");
  const apiMessages = safeMessages.map((m, i) =>
    i === firstUserIdx
      ? { role: m.role, content: `${contextBlock}\n\n${m.content}` }
      : m
  );

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
      messages: apiMessages,
    });
  } catch (e) {
    console.error("solo-coach: Claude API error", e);
    return NextResponse.json({ error: "AI service unavailable. Try again shortly." }, { status: 502 });
  }

  const reply = message.content[0]?.type === "text" ? message.content[0].text : "";

  if (reply.trim() === "") {
    return NextResponse.json({ error: "Empty response. Try again." }, { status: 502 });
  }

  return NextResponse.json({ reply } satisfies SoloCoachResponse);
}
