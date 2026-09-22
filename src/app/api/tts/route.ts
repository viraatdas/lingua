import { NextResponse } from "next/server";
import { isLang, isVoice, LANGUAGES } from "@/lib/languages";
import { MODELS, openai } from "@/lib/server/openai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { text?: string; lang?: string; voice?: string };
  if (!isLang(body.lang) || !body.text) return new NextResponse("Bad request", { status: 400 });
  const text = body.text.slice(0, 300);
  const L = LANGUAGES[body.lang];
  try {
    const res = await openai().audio.speech.create({
      model: MODELS.tts,
      voice: isVoice(body.voice) ? body.voice : L.ttsVoice,
      input: text,
      response_format: "mp3",
      instructions: `You are a ${L.name} teacher modelling a phrase for a learner. Speak in ${L.name} with a clear, neutral accent, slightly slower than natural, with careful articulation${body.lang === "zh" ? " and precise tones" : ""}. Do not add anything.`,
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buf, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" } });
  } catch (e) {
    console.error("tts failed", e);
    return new NextResponse("Could not synthesize audio", { status: 502 });
  }
}
