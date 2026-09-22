"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from "react";
import type { LangCode, Level } from "./languages";
import { type Card, seedDeck } from "./decks";
import { type CardState, type Rating, isDue, newCardState, schedule } from "./srs";

export interface ReviewLogEntry {
  cardId: string;
  rating: Rating;
  at: number;
}

export interface PronunciationLogEntry {
  cardId?: string;
  text: string;
  score: number;
  at: number;
}

export interface SessionLogEntry {
  scenarioId: string;
  at: number;
  durationSec: number;
  turns: number;
  score?: number;
}

export interface LangProgress {
  cards: Record<string, CardState>;
  customCards: Card[];
  removed: string[];
  reviewLog: ReviewLogEntry[];
  pronunciationLog: PronunciationLogEntry[];
  sessions: SessionLogEntry[];
}

export type SupportMode = "script" | "fade" | "hints" | "none";

export interface Settings {
  lang: LangCode;
  level: Level;
  newPerDay: number;
  onboarded: boolean;
  support: SupportMode;
  /** "auto" picks the scenario's character voice. */
  voice: string;
  transcriptEnglish: "off" | "lines" | "gloss";
}

export interface StoreData {
  version: 1;
  settings: Settings;
  progress: Record<LangCode, LangProgress>;
}

const KEY = "lingua:v1";

const emptyProgress = (): LangProgress => ({
  cards: {},
  customCards: [],
  removed: [],
  reviewLog: [],
  pronunciationLog: [],
  sessions: [],
});

const defaultData = (): StoreData => ({
  version: 1,
  settings: { lang: "es", level: "A2", newPerDay: 10, onboarded: false, support: "fade", voice: "auto", transcriptEnglish: "lines" },
  progress: { es: emptyProgress(), zh: emptyProgress() },
});

function load(): StoreData {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as StoreData;
    const d = defaultData();
    return {
      ...d,
      ...parsed,
      settings: { ...d.settings, ...parsed.settings },
      progress: {
        es: { ...emptyProgress(), ...parsed.progress?.es },
        zh: { ...emptyProgress(), ...parsed.progress?.zh },
      },
    };
  } catch {
    return defaultData();
  }
}

// Module-level store so localStorage is read exactly once and React subscribes via useSyncExternalStore.
const SERVER_SNAPSHOT: StoreData = defaultData();
let snapshot: StoreData | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): StoreData {
  if (snapshot === null) snapshot = load();
  return snapshot;
}
function getServerSnapshot(): StoreData {
  return SERVER_SNAPSHOT;
}
function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function commit(next: StoreData) {
  snapshot = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked; keep going in memory */
  }
  for (const l of listeners) l();
}
function setData(fn: (d: StoreData) => StoreData) {
  commit(fn(getSnapshot()));
}

/** Current time that re-renders every `every` ms, so derived "due" state stays fresh without impure reads in render. */
export function useNow(every = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), every);
    return () => clearInterval(t);
  }, [every]);
  return now;
}

interface StoreApi {
  data: StoreData;
  ready: boolean;
  lang: LangCode;
  level: Level;
  progress: LangProgress;
  setSettings: (patch: Partial<Settings>) => void;
  deck: Card[];
  cardState: (id: string) => CardState;
  rate: (cardId: string, rating: Rating) => void;
  addCard: (card: Omit<Card, "id" | "lang"> & { id?: string }) => Card;
  removeCard: (id: string) => void;
  logPronunciation: (entry: Omit<PronunciationLogEntry, "at">) => void;
  logSession: (entry: Omit<SessionLogEntry, "at">) => void;
  resetLanguage: (lang: LangCode) => void;
}

const StoreContext = createContext<StoreApi | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const data = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const ready = data !== SERVER_SNAPSHOT;

  const lang = data.settings.lang;
  const progress = data.progress[lang];

  const deck = useMemo(() => {
    const removed = new Set(progress.removed);
    return [...seedDeck(lang), ...progress.customCards].filter((c) => !removed.has(c.id));
  }, [lang, progress.customCards, progress.removed]);

  const updateProgress = useCallback((l: LangCode, fn: (p: LangProgress) => LangProgress) => {
    setData((d) => ({ ...d, progress: { ...d.progress, [l]: fn(d.progress[l]) } }));
  }, []);

  const api: StoreApi = {
    data,
    ready,
    lang,
    level: data.settings.level,
    progress,
    setSettings: (patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } })),
    deck,
    cardState: (id) => progress.cards[id] ?? newCardState(0),
    rate: (cardId, rating) => {
      const now = Date.now();
      updateProgress(lang, (p) => {
        const prev = p.cards[cardId] ?? newCardState(now);
        return {
          ...p,
          cards: { ...p.cards, [cardId]: schedule(prev, rating, now) },
          reviewLog: [...p.reviewLog, { cardId, rating, at: now }].slice(-5000),
        };
      });
    },
    addCard: (card) => {
      const full: Card = { ...card, lang, id: card.id ?? `${lang}-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` };
      updateProgress(lang, (p) => {
        if (p.customCards.some((c) => c.text === full.text)) return p;
        return { ...p, customCards: [...p.customCards, full], removed: p.removed.filter((r) => r !== full.id) };
      });
      return full;
    },
    removeCard: (id) => updateProgress(lang, (p) => ({ ...p, removed: [...new Set([...p.removed, id])], customCards: p.customCards.filter((c) => c.id !== id) })),
    logPronunciation: (entry) =>
      updateProgress(lang, (p) => ({ ...p, pronunciationLog: [...p.pronunciationLog, { ...entry, at: Date.now() }].slice(-2000) })),
    logSession: (entry) => updateProgress(lang, (p) => ({ ...p, sessions: [...p.sessions, { ...entry, at: Date.now() }].slice(-500) })),
    resetLanguage: (l) => updateProgress(l, () => emptyProgress()),
  };

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/** Derived queue for today's review: due cards first (oldest due first), then new cards up to the daily limit. */
export function useReviewQueue() {
  const { deck, progress, data } = useStore();
  const now = useNow();
  return useMemo(() => {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const introducedToday = progress.reviewLog.filter((e) => e.at >= startOfDay.getTime()).reduce((set, e) => {
      const st = progress.cards[e.cardId];
      // A card counts as "new today" if its first review happened today.
      const first = progress.reviewLog.find((x) => x.cardId === e.cardId);
      if (first && first.at >= startOfDay.getTime() && st) set.add(e.cardId);
      return set;
    }, new Set<string>());

    const due: Card[] = [];
    const fresh: Card[] = [];
    for (const card of deck) {
      const st = progress.cards[card.id];
      if (!st) fresh.push(card);
      else if (isDue(st, now)) due.push(card);
    }
    due.sort((a, b) => progress.cards[a.id].due - progress.cards[b.id].due);
    const newAllowance = Math.max(0, data.settings.newPerDay - introducedToday.size);
    const learningSoon = deck.filter((c) => {
      const st = progress.cards[c.id];
      return st && !isDue(st, now) && (st.phase === "learning" || st.phase === "relearning") && st.due - now < 20 * 60_000;
    });
    return { due, fresh: fresh.slice(0, newAllowance), totalNew: fresh.length, learningSoon, newAllowance };
  }, [deck, progress, data.settings.newPerDay, now]);
}

export function useStats() {
  const { progress, deck } = useStore();
  const now = useNow(60_000);
  return useMemo(() => {
    const dayKey = (t: number) => {
      const d = new Date(t);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };
    const activeDays = new Set<string>();
    for (const e of progress.reviewLog) activeDays.add(dayKey(e.at));
    for (const s of progress.sessions) activeDays.add(dayKey(s.at));
    for (const p of progress.pronunciationLog) activeDays.add(dayKey(p.at));

    let streak = 0;
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    // Allow today to be empty without breaking the streak.
    if (!activeDays.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1);
    while (activeDays.has(dayKey(cursor.getTime()))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const states = deck.map((c) => progress.cards[c.id]);
    const known = states.filter((s) => s && s.phase === "review" && s.interval >= 7).length;
    const learning = states.filter((s) => s && (s.phase !== "review" || s.interval < 7)).length;
    const untouched = states.filter((s) => !s).length;
    const talkMinutes = Math.round(progress.sessions.reduce((a, s) => a + s.durationSec, 0) / 60);
    const recentPron = progress.pronunciationLog.slice(-20);
    const pronAvg = recentPron.length ? Math.round(recentPron.reduce((a, p) => a + p.score, 0) / recentPron.length) : null;

    // last 12 weeks of daily activity for a heat strip
    const days: { key: string; count: number; date: Date }[] = [];
    const counts = new Map<string, number>();
    for (const e of progress.reviewLog) counts.set(dayKey(e.at), (counts.get(dayKey(e.at)) ?? 0) + 1);
    for (const s of progress.sessions) counts.set(dayKey(s.at), (counts.get(dayKey(s.at)) ?? 0) + 5);
    for (const p of progress.pronunciationLog) counts.set(dayKey(p.at), (counts.get(dayKey(p.at)) ?? 0) + 1);
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    for (let i = 83; i >= 0; i--) {
      const x = new Date(d);
      x.setDate(d.getDate() - i);
      const k = dayKey(x.getTime());
      days.push({ key: k, count: counts.get(k) ?? 0, date: x });
    }

    return { streak, known, learning, untouched, total: deck.length, talkMinutes, pronAvg, sessions: progress.sessions.length, reviews: progress.reviewLog.length, days };
  }, [progress, deck, now]);
}
