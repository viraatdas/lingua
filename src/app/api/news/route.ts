import { NextResponse } from "next/server";
import { isLang, type Level } from "@/lib/languages";
import { newsPrompt, type NewsStory } from "@/lib/prompts";
import { MODELS, extractJson, openai } from "@/lib/server/openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const TTL = 3 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; stories: NewsStory[] }>();

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lang = url.searchParams.get("lang");
  const level = (url.searchParams.get("level") ?? "A2") as Level;
  if (!isLang(lang)) return new NextResponse("Unknown language", { status: 400 });
  const key = `${lang}:${level}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL && !url.searchParams.get("fresh")) {
    return NextResponse.json({ stories: hit.stories, cached: true });
  }
  try {
    const res = await openai().responses.create({
      model: MODELS.text,
      tools: [{ type: "web_search" }],
      input: newsPrompt(lang, level),
      reasoning: { effort: "low" },
    });
    const parsed = extractJson<{ stories: NewsStory[] }>(res.output_text);
    const stories = (parsed.stories ?? []).slice(0, 3).map((s) => ({
      headline: String(s.headline ?? ""),
      summary: String(s.summary ?? ""),
      vocab: Array.isArray(s.vocab) ? s.vocab.slice(0, 6) : [],
      source: String(s.source ?? ""),
      url: String(s.url ?? ""),
    }));
    if (!stories.length) throw new Error("no stories");
    cache.set(key, { at: Date.now(), stories });
    return NextResponse.json({ stories, cached: false });
  } catch (e) {
    console.error("news failed", e);
    return new NextResponse("Could not fetch today's stories", { status: 502 });
  }
}
