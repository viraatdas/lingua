import { NextResponse } from "next/server";
import { isLang, type Level } from "@/lib/languages";
import { getScenario } from "@/lib/scenarios";
import { feedbackPrompt } from "@/lib/prompts";
import { MODELS, extractJson, openai } from "@/lib/server/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface FeedbackResult {
  score: number;
  summary: string;
  goalsMet: string[];
  corrections: { said: string; better: string; why: string }[];
  vocab: { text: string; reading?: string; meaning: string }[];
  nextTime: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    lang?: string;
    level?: Level;
    scenarioId?: string;
    transcript?: { role: string; text: string }[];
  };
  if (!isLang(body.lang)) return new NextResponse("Unknown language", { status: 400 });
  const scenario = getScenario(body.scenarioId ?? "free");
  if (!scenario) return new NextResponse("Unknown scenario", { status: 400 });
  const transcript = (body.transcript ?? []).filter((t) => t && typeof t.text === "string").slice(-80);
  if (transcript.filter((t) => t.role === "you").length === 0) {
    return NextResponse.json({ score: 0, summary: "You didn't say anything this time. Try again and speak up, the tutor will wait for you.", goalsMet: [], corrections: [], vocab: [], nextTime: "Say one sentence, even a short one." } satisfies FeedbackResult);
  }
  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.text,
      messages: [{ role: "user", content: feedbackPrompt(body.lang, body.level ?? "A2", scenario, transcript) }],
      response_format: { type: "json_object" },
    });
    const parsed = extractJson<FeedbackResult>(completion.choices[0]?.message?.content ?? "{}");
    const result: FeedbackResult = {
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
      summary: String(parsed.summary ?? ""),
      goalsMet: Array.isArray(parsed.goalsMet) ? parsed.goalsMet.map(String) : [],
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections.slice(0, 4) : [],
      vocab: Array.isArray(parsed.vocab) ? parsed.vocab.slice(0, 6) : [],
      nextTime: String(parsed.nextTime ?? ""),
    };
    return NextResponse.json(result);
  } catch (e) {
    console.error("feedback failed", e);
    return new NextResponse("Could not write feedback", { status: 502 });
  }
}
