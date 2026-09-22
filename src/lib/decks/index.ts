import type { LangCode } from "../languages";
import { ES_DECK } from "./es";
import { ZH_DECK } from "./zh";
import type { Card } from "./types";

export * from "./types";

export const SEED_DECKS: Record<LangCode, Card[]> = { es: ES_DECK, zh: ZH_DECK };

export function seedDeck(lang: LangCode): Card[] {
  return SEED_DECKS[lang];
}
