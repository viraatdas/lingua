import { NextResponse } from "next/server";
import { isLang } from "@/lib/languages";
import { pronunciationPrompt } from "@/lib/prompts";
import { MODELS, extractJson, openai } from "@/lib/server/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

export interface PronunciationResult {
  score: number;
  heard: string;
  verdict: string;
  issues: { part: string; problem: string; fix: string }[];
  tip: string;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { lang?: string; target?: string; reading?: string; wavBase64?: string };
  if (!isLang(body.lang)) return new NextResponse("Unknown language", { status: 400 });
  if (!body.target || !body.wavBase64) return new NextResponse("Missing target or audio", { status: 400 });
  if (body.wavBase64.length > 6_000_000) return new NextResponse("Recording too long", { status: 413 });

  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.audioGrader,
      modalities: ["text"],
      messages: [
        { role: "system", content: pronunciationPrompt(body.lang, body.target, body.reading) },
        {
          role: "user",
          content: [
            { type: "text", text: "Here is my attempt." },
            { type: "input_audio", input_audio: { data: body.wavBase64, format: "wav" } },
          ],
        },
      ],
    });
    const text = completion.choices[0]?.message?.content ?? "";
    const parsed = extractJson<PronunciationResult>(text);
    const result: PronunciationResult = {
      score: Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0))),
      heard: String(parsed.heard ?? ""),
      verdict: String(parsed.verdict ?? ""),
      issues: Array.isArray(parsed.issues) ? parsed.issues.slice(0, 5) : [],
      tip: String(parsed.tip ?? ""),
    };
    return NextResponse.json(result);
  } catch (e) {
    console.error("pronounce failed", e);
    return new NextResponse("Could not grade that recording", { status: 502 });
  }
}
