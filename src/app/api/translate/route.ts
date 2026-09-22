import { NextResponse } from "next/server";
import { isLang } from "@/lib/languages";
import { translatePrompt } from "@/lib/prompts";
import { MODELS, extractJson, openai } from "@/lib/server/openai";

export const runtime = "nodejs";
export const maxDuration = 30;

export interface GlossItem {
  word: string;
  reading?: string;
  meaning: string;
}

export interface TranslatedLine {
  id: string;
  translation: string;
  gloss: GlossItem[];
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { lang?: string; lines?: { id: string; text: string }[] };
  if (!isLang(body.lang)) return new NextResponse("Unknown language", { status: 400 });
  const lines = (body.lines ?? []).filter((l) => l && typeof l.id === "string" && typeof l.text === "string" && l.text.trim()).slice(0, 8);
  if (!lines.length) return NextResponse.json({ lines: [] });
  try {
    const completion = await openai().chat.completions.create({
      model: MODELS.fast,
      messages: [{ role: "user", content: translatePrompt(body.lang, lines) }],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });
    const parsed = extractJson<{ lines: TranslatedLine[] }>(completion.choices[0]?.message?.content ?? "{}");
    const out: TranslatedLine[] = (parsed.lines ?? [])
      .filter((l) => l && typeof l.id === "string")
      .map((l) => ({
        id: l.id,
        translation: String(l.translation ?? ""),
        gloss: Array.isArray(l.gloss) ? l.gloss.filter((g) => g && g.word).map((g) => ({ word: String(g.word), reading: g.reading ? String(g.reading) : undefined, meaning: String(g.meaning ?? "") })) : [],
      }));
    return NextResponse.json({ lines: out });
  } catch (e) {
    console.error("translate failed", e);
    return new NextResponse("Could not translate", { status: 502 });
  }
}
