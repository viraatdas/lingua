import { NextResponse } from "next/server";
import { isLang, type Level } from "@/lib/languages";
import { getScenario } from "@/lib/scenarios";
import { suggestPrompt } from "@/lib/prompts";
import { MODELS, extractJson, openai } from "@/lib/server/openai";

export const runtime = "nodejs";
export const maxDuration = 30;

export interface Suggestion {
  say: string;
  reading?: string;
  meaning: string;
  gist: string;
  keywords: { word: string; reading?: string; meaning: string }[];
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    lang?: string;
    level?: Level;
    scenarioId?: string;
    transcript?: { role: string; text: string }[];
    deckSample?: string[];
  };
  if (!isLang(body.lang)) return new NextResponse("Unknown language", { status: 400 });
  const scenario = getScenario(body.scenarioId ?? "free");
  if (!scenario) return new NextResponse("Unknown scenario", { status: 400 });
  const transcript = (body.transcript ?? []).filter((t) => t && typeof t.text === "string" && t.text.trim()).slice(-16);
  if (!transcript.length) return new NextResponse("Nothing to answer yet", { status: 400 });
  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.fast,
      messages: [{ role: "user", content: suggestPrompt(body.lang, body.level ?? "A2", scenario, transcript, body.deckSample?.slice(0, 12)) }],
      response_format: { type: "json_object" },
      temperature: 0.4,
    });
    const parsed = extractJson<Suggestion>(completion.choices[0]?.message?.content ?? "{}");
    const result: Suggestion = {
      say: String(parsed.say ?? ""),
      reading: parsed.reading ? String(parsed.reading) : undefined,
      meaning: String(parsed.meaning ?? ""),
      gist: String(parsed.gist ?? ""),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 3) : [],
    };
    if (!result.say) throw new Error("empty suggestion");
    return NextResponse.json(result);
  } catch (e) {
    console.error("suggest failed", e);
    return new NextResponse("Could not write a suggestion", { status: 502 });
  }
}
