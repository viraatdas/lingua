import type { LangCode } from "../languages";

export type CategoryId =
  | "greetings"
  | "directions"
  | "food"
  | "transport"
  | "hotel"
  | "shopping"
  | "emergencies"
  | "numbers"
  | "smalltalk"
  | "news";

export interface Card {
  id: string;
  lang: LangCode;
  text: string; // target language
  reading?: string; // pinyin for zh
  meaning: string; // English
  category: CategoryId;
  note?: string; // usage hint
}

export const CATEGORIES: { id: CategoryId; label: string; blurb: string }[] = [
  { id: "greetings", label: "Greetings", blurb: "hello, thanks, sorry, goodbye" },
  { id: "directions", label: "Directions", blurb: "where is, left, right, how far" },
  { id: "food", label: "Ordering food", blurb: "menus, allergies, the bill" },
  { id: "transport", label: "Getting around", blurb: "taxis, trains, tickets" },
  { id: "hotel", label: "Hotel", blurb: "check-in, rooms, problems" },
  { id: "shopping", label: "Shopping and money", blurb: "prices, bargaining, cards" },
  { id: "emergencies", label: "Emergencies", blurb: "help, doctor, police" },
  { id: "numbers", label: "Numbers and time", blurb: "counting, hours, days" },
  { id: "smalltalk", label: "Small talk", blurb: "who you are, what you like" },
  { id: "news", label: "Current events", blurb: "words for talking about the news" },
];
