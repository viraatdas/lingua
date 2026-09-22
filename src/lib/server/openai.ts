import OpenAI from "openai";

let client: OpenAI | null = null;

export function openai(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set");
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}

export const MODELS = {
  realtime: process.env.REALTIME_MODEL ?? "gpt-realtime-2.1",
  transcribe: "gpt-4o-mini-transcribe",
  audioGrader: process.env.AUDIO_MODEL ?? "gpt-audio-1.5",
  text: process.env.TEXT_MODEL ?? "gpt-5.4-mini",
  fast: process.env.FAST_MODEL ?? "gpt-4.1-mini",
  tts: "gpt-4o-mini-tts",
};

/** Pull the first JSON object out of a model reply that may have prose or fences around it. */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("no JSON in reply");
  return JSON.parse(candidate.slice(start, end + 1)) as T;
}
