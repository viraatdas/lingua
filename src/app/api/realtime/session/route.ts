import { NextResponse } from "next/server";
import { isLang, type Level } from "@/lib/languages";
import { getScenario } from "@/lib/scenarios";
import { tutorInstructions, type NewsStory } from "@/lib/prompts";
import { LANGUAGES } from "@/lib/languages";
import { MODELS } from "@/lib/server/openai";

export const runtime = "nodejs";

const LEVELS = new Set(["A1", "A2", "B1", "B2"]);

export async function POST(req: Request) {
  if (!process.env.OPENAI_API_KEY) return new NextResponse("Server is missing OPENAI_API_KEY", { status: 500 });
  const body = (await req.json().catch(() => ({}))) as {
    lang?: string;
    level?: string;
    scenarioId?: string;
    news?: NewsStory[];
    deckSample?: string[];
  };
  if (!isLang(body.lang)) return new NextResponse("Unknown language", { status: 400 });
  const level = (LEVELS.has(body.level ?? "") ? body.level : "A2") as Level;
  const scenario = getScenario(body.scenarioId ?? "free");
  if (!scenario) return new NextResponse("Unknown scenario", { status: 400 });
  const L = LANGUAGES[body.lang];

  const instructions = tutorInstructions({
    lang: body.lang,
    level,
    scenario,
    news: Array.isArray(body.news) ? body.news.slice(0, 3) : undefined,
    deckSample: Array.isArray(body.deckSample) ? body.deckSample.slice(0, 12).map(String) : undefined,
  });

  const session = {
    type: "realtime",
    model: MODELS.realtime,
    instructions,
    output_modalities: ["audio"],
    audio: {
      input: {
        transcription: { model: MODELS.transcribe, language: body.lang },
        noise_reduction: { type: "near_field" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 800,
          create_response: true,
          interrupt_response: true,
        },
      },
      output: { voice: L.voice, speed: level === "A1" ? 0.85 : level === "A2" ? 0.9 : 1.0 },
    },
    tools: [
      {
        type: "function",
        name: "save_phrase",
        description: "Save a new word or phrase to the learner's spaced-repetition deck. Call this when you use a word the learner probably does not know yet.",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string", description: `The phrase in ${L.name}` },
            reading: { type: "string", description: body.lang === "zh" ? "Pinyin with tone marks" : "Leave empty" },
            meaning: { type: "string", description: "Short English meaning" },
          },
          required: ["text", "meaning"],
        },
      },
    ],
    tool_choice: "auto",
    max_output_tokens: 600,
  };

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expires_after: { anchor: "created_at", seconds: 600 }, session }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("client_secrets failed", res.status, text);
    return new NextResponse("Could not create a realtime session", { status: 502 });
  }
  const data = (await res.json()) as { value: string; expires_at: number };
  return NextResponse.json({ clientSecret: data.value, expiresAt: data.expires_at, model: MODELS.realtime });
}
