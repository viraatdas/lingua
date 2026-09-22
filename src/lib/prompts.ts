import { LANGUAGES, type LangCode, type Level } from "./languages";
import type { Scenario } from "./scenarios";

export interface NewsStory {
  headline: string;
  summary: string;
  vocab: { word: string; reading?: string; meaning: string }[];
  source: string;
  url: string;
}

export function tutorInstructions(opts: { lang: LangCode; level: Level; scenario: Scenario; news?: NewsStory[]; deckSample?: string[]; support?: string }): string {
  const L = LANGUAGES[opts.lang];
  const langName = L.name;
  const zh = opts.lang === "zh";

  const parts: string[] = [];
  parts.push(
    `You are a ${langName} conversation tutor inside a language-practice app. The learner is at CEFR level ${opts.level} (${L.levelHint[opts.level]}). Speak ${langName} only, ${zh ? "standard Mandarin with a neutral mainland accent, " : "with a clear neutral accent, "}unless the learner is clearly stuck, in which case give a short English hint (one sentence) and then return to ${langName}.`,
  );
  parts.push(
    `Roleplay this situation and stay in character: ${opts.scenario.situation}\nStart the conversation by saying, in ${langName}: "${opts.scenario.opener[opts.lang]}"`,
  );
  parts.push(
    [
      "Rules:",
      "- Keep every turn short: one or two sentences, then a question or a pause so the learner speaks. Never lecture.",
      `- Match the learner's level. At ${opts.level} that means: ${L.levelHint[opts.level]}.`,
      "- If the learner makes a mistake that would confuse a native speaker, gently recast it: say the corrected sentence naturally as part of your reply, then continue. Do not stop the roleplay to explain grammar unless asked.",
      "- If the learner says nothing for a while, offer a simple prompt or a choice of two answers.",
      "- If the learner asks how to say something (in English or the target language), tell them, have them try it, and continue.",
      "- When you introduce a word the learner probably does not know, call the save_phrase tool once with the phrase, its reading, and its English meaning so it goes into their spaced-repetition deck. Do not announce that you saved it.",
      `- Speak at a ${opts.level === "A1" || opts.level === "A2" ? "slow, clear" : "natural"} pace.`,
      zh ? "- For Mandarin: use simplified characters when writing, and pinyin with tone marks in the reading field of save_phrase." : "- Use usted or tú consistently based on the situation; a stranger in a shop is usted.",
    ].join("\n"),
  );
  if (opts.support === "script" || opts.support === "fade") {
    parts.push(
      "The app is showing the learner a suggested line to read aloud after each of your turns. So: ask exactly one clear question per turn, keep the situation linear, and wait. If they read the line with mistakes, accept it and move on; do not make them repeat unless it was unintelligible.",
    );
  } else if (opts.support === "hints") {
    parts.push("The app is showing the learner a short English hint about what to say after each of your turns. Ask one clear question per turn and give them time.");
  }
  if (opts.deckSample?.length) {
    parts.push(`Phrases the learner is currently studying (work a few of these in naturally so they get to use them): ${opts.deckSample.join(" | ")}`);
  }
  if (opts.news?.length) {
    parts.push(
      "Today's stories, already written at the learner's level. Discuss them one at a time, starting with the first:\n" +
        opts.news.map((s, i) => `${i + 1}. ${s.headline}\n${s.summary}\nKey words: ${s.vocab.map((v) => `${v.word}${v.reading ? ` (${v.reading})` : ""} = ${v.meaning}`).join(", ")}\nSource: ${s.source}`).join("\n\n"),
    );
  }
  return parts.join("\n\n");
}

export function newsPrompt(lang: LangCode, level: Level): string {
  const L = LANGUAGES[lang];
  const zh = lang === "zh";
  return [
    `Search the web for news from the last 48 hours. Pick three stories: two from ${L.region} and one major world story. Prefer stories a traveller would hear people talking about (culture, sport, transport, food, weather, big politics) over niche ones.`,
    `Write each story in ${L.name} for a learner at CEFR ${level} (${L.levelHint[level]}). The headline is one short line. The summary is two to three sentences, simple, concrete.`,
    `Give four key vocabulary items per story: the word as it appears in the summary${zh ? ", its pinyin with tone marks" : ""}, and its English meaning.`,
    zh ? "Use simplified characters." : "",
    "Return only JSON matching this shape, no prose:",
    `{"stories":[{"headline":"...","summary":"...","vocab":[{"word":"...",${zh ? '"reading":"...",' : ""}"meaning":"..."}],"source":"publisher name","url":"https://..."}]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function pronunciationPrompt(lang: LangCode, target: string, reading?: string): string {
  const L = LANGUAGES[lang];
  const zh = lang === "zh";
  return [
    `You are a strict but kind ${L.name} pronunciation coach. The learner was asked to say exactly this: "${target}"${reading ? ` (${reading})` : ""}.`,
    `Listen to the recording and grade the pronunciation. Judge the actual sounds you hear, not just whether the words are right.`,
    zh
      ? "Pay close attention to tones: identify any syllable where the tone is wrong or flat, and name the correct tone. Also check retroflex versus alveolar consonants (zh/ch/sh vs z/c/s), the ü vowel, and neutral tones."
      : "Pay attention to vowel purity (Spanish vowels are short and pure), the tapped and rolled r, the b/v sound, the soft d between vowels, syllable stress, and whether English vowel glides are creeping in.",
    "If the recording is silent, unintelligible, or in the wrong language, say so with a score of 0.",
    "Return only JSON, no prose, matching:",
    `{"score": 0-100, "heard": "what you heard, transcribed in ${L.name}", "verdict": "one short sentence in English", "issues": [{"part": "the syllable or word", "problem": "what was off", "fix": "how to say it"}], "tip": "one concrete practice tip in English"}`,
    "Scoring: 90+ near native, 75-89 clearly understandable with minor accent, 55-74 understandable with effort, below 55 would confuse a native speaker. Do not inflate scores.",
  ].join("\n");
}

export function feedbackPrompt(lang: LangCode, level: Level, scenario: Scenario, transcript: { role: string; text: string }[]): string {
  const L = LANGUAGES[lang];
  const zh = lang === "zh";
  return [
    `You are reviewing a spoken ${L.name} practice conversation. The learner is at CEFR ${level}. The scenario was "${scenario.title}": ${scenario.situation}`,
    `The learner's goals were: ${scenario.goals.join("; ")}.`,
    "Transcript (tutor and learner):",
    transcript.map((t) => `${t.role === "you" ? "LEARNER" : "TUTOR"}: ${t.text}`).join("\n"),
    "",
    "The transcript comes from speech recognition: ignore punctuation, capitalization, accents and spelling entirely, and never comment on them. Judge only what was said: word choice, grammar, naturalness, and whether the learner accomplished the goals.",
    "Write feedback for the learner. Be specific and encouraging but honest. Return only JSON matching:",
    `{"score": 0-100, "summary": "two sentences in English on how it went", "goalsMet": ["goal text that was achieved"], "corrections": [{"said": "what the learner said", "better": "a more natural version", "why": "short reason in English"}], "vocab": [{"text": "useful phrase in ${L.name} the learner should learn from this conversation", ${zh ? '"reading": "pinyin with tone marks", ' : ""}"meaning": "English"}], "nextTime": "one sentence on what to focus on next time"}`,
    "Give at most four corrections (zero is fine if the learner spoke well) and three to five vocab items. Vocab items must be phrases the learner did not produce themselves and that would have helped: things the tutor said that they should learn, or natural versions of what they struggled to say. Never include words the learner already used correctly.",
    zh ? "Use simplified characters." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function suggestPrompt(lang: LangCode, level: Level, scenario: Scenario, transcript: { role: string; text: string }[], deckSample?: string[]): string {
  const L = LANGUAGES[lang];
  const zh = lang === "zh";
  return [
    `You are helping a ${L.name} learner (CEFR ${level}: ${L.levelHint[level]}) who does not know what to say next in a spoken roleplay.`,
    `Scenario: "${scenario.title}". ${scenario.situation}`,
    `The learner's goals: ${scenario.goals.join("; ")}.`,
    deckSample?.length ? `Phrases they are studying (reuse these when they fit): ${deckSample.join(" | ")}` : "",
    "Conversation so far (the last line is the tutor's, which the learner must now answer):",
    transcript.map((t) => `${t.role === "you" ? "LEARNER" : "TUTOR"}: ${t.text}`).join("\n"),
    "",
    `Write the single best thing for the learner to say next: a natural, short reply (one sentence, two at most) that answers the tutor and moves toward a goal not yet completed. Keep it at ${level} level. ${zh ? "Use simplified characters and give pinyin with tone marks." : "Use the register the tutor is using (usted or tú)."}`,
    "Return only JSON:",
    `{"say": "the line in ${L.name}", ${zh ? '"reading": "pinyin", ' : ""}"meaning": "English translation", "gist": "a short English instruction telling the learner what to do, e.g. 'Order a coffee and ask if you can pay by card'", "keywords": [{"word": "key word from the line", ${zh ? '"reading": "pinyin", ' : ""}"meaning": "English"}]}`,
    "Give two or three keywords, the ones the learner is least likely to know.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function translatePrompt(lang: LangCode, lines: { id: string; text: string }[]): string {
  const L = LANGUAGES[lang];
  const zh = lang === "zh";
  return [
    `Translate these ${L.name} lines from a spoken conversation for a learner. They come from speech recognition, so ignore odd punctuation.`,
    `For each line give: "translation", a natural English rendering; and "gloss", a word-by-word breakdown in order, where each item is a word or fixed chunk exactly as it appears in the line${zh ? " (split by word, not by character, with pinyin with tone marks)" : ""} and its literal English meaning in this context. Keep gloss meanings to one to three words. Skip punctuation.`,
    "Return only JSON: {\"lines\": [{\"id\": \"...\", \"translation\": \"...\", \"gloss\": [{\"word\": \"...\", " + (zh ? "\"reading\": \"...\", " : "") + "\"meaning\": \"...\"}]}]}",
    "Lines:",
    JSON.stringify(lines),
  ].join("\n");
}
