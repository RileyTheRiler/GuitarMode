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
  const body = (await request.json()) as GenerateRiffRequest;

  const { song, artist, key, bpm, chords, section, hummedNotes } = body;

  if (!song || !section) {
    return NextResponse.json({ error: "song and section are required" }, { status: 400 });
  }

  let userMessage = `Song: "${song}" by ${artist || "unknown artist"}
Key: ${key || "unknown"}
${bpm ? `Tempo: ${bpm} BPM` : ""}
Chord progression: ${chords || "unknown"}
Section: ${section}`;

  if (hummedNotes && hummedNotes.length > 0) {
    userMessage += `\n\nI hummed a melody idea. These notes were detected from my voice recording: ${hummedNotes.join(", ")}
Please adapt this melody to guitar range and style, keeping the contour of the phrase where possible.`;
  } else {
    userMessage += `\n\nGenerate an original riff/lick that fits this section. Make it memorable and stylistically appropriate.`;
  }

  const message = await client.messages.create({
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

  const text = message.content[0].type === "text" ? message.content[0].text : "";

  let parsed: GenerateRiffResponse;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
  }

  return NextResponse.json(parsed);
}
