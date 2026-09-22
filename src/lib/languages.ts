export type LangCode = "es" | "zh";

export type Level = "A1" | "A2" | "B1" | "B2";

export interface LanguageConfig {
  code: LangCode;
  name: string; // English name
  nativeName: string;
  region: string; // where news comes from
  voice: string; // realtime voice
  ttsVoice: string;
  accent: string; // css color
  accentSoft: string;
  hasReading: boolean; // pinyin
  greeting: string;
  greetingReading?: string;
  levelHint: Record<Level, string>;
}

export const LANGUAGES: Record<LangCode, LanguageConfig> = {
  es: {
    code: "es",
    name: "Spanish",
    nativeName: "Español",
    region: "Spain and Latin America",
    voice: "marin",
    ttsVoice: "marin",
    accent: "#E39B12",
    accentSoft: "#FBEFD2",
    hasReading: false,
    greeting: "¿Listo para hablar?",
    levelHint: {
      A1: "present tense, short sentences, the 300 most common words",
      A2: "past and future tenses, everyday topics, simple connectors",
      B1: "subjunctive in common phrases, opinions, longer exchanges",
      B2: "natural speed, idioms, nuanced opinions, regional variation",
    },
  },
  zh: {
    code: "zh",
    name: "Mandarin",
    nativeName: "中文",
    region: "mainland China, Taiwan, Singapore and the Chinese-speaking world",
    voice: "cedar",
    ttsVoice: "cedar",
    accent: "#D6452B",
    accentSoft: "#FBE3DD",
    hasReading: true,
    greeting: "准备好了吗？",
    greetingReading: "zhǔnbèi hǎo le ma?",
    levelHint: {
      A1: "HSK 1 vocabulary, very short sentences, no idioms, repeat key words",
      A2: "HSK 2 to 3 vocabulary, simple aspect particles (了, 过), everyday topics",
      B1: "HSK 4 vocabulary, complex sentences, some chengyu explained",
      B2: "HSK 5 and up, natural speed, idioms, news-register vocabulary",
    },
  },
};

export const LEVELS: { id: Level; label: string; blurb: string }[] = [
  { id: "A1", label: "Beginner", blurb: "I know a few words" },
  { id: "A2", label: "Elementary", blurb: "I can get by, slowly" },
  { id: "B1", label: "Intermediate", blurb: "I can hold a conversation" },
  { id: "B2", label: "Upper", blurb: "I want to sound natural" },
];

export function isLang(x: unknown): x is LangCode {
  return x === "es" || x === "zh";
}
