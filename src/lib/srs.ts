// SM-2 style scheduler with short learning steps, in the spirit of Anki.
// All times are epoch milliseconds.

export type Rating = 1 | 2 | 3 | 4; // again, hard, good, easy
export type CardPhase = "new" | "learning" | "review" | "relearning";

export interface CardState {
  phase: CardPhase;
  due: number;
  interval: number; // days, for review cards
  ease: number; // 2.5 default
  step: number; // index into learning steps
  reps: number;
  lapses: number;
  lastReview?: number;
}

const MIN = 60_000;
const DAY = 86_400_000;
const LEARNING_STEPS = [1 * MIN, 10 * MIN];
const RELEARNING_STEPS = [10 * MIN];
const GRADUATING_INTERVAL = 1;
const EASY_INTERVAL = 4;
const MIN_EASE = 1.3;

export function newCardState(now = Date.now()): CardState {
  return { phase: "new", due: now, interval: 0, ease: 2.5, step: 0, reps: 0, lapses: 0 };
}

function fuzz(days: number): number {
  if (days < 3) return days;
  const spread = Math.max(1, Math.round(days * 0.05));
  return days + Math.floor(Math.random() * (2 * spread + 1)) - spread;
}

export function schedule(state: CardState, rating: Rating, now = Date.now()): CardState {
  const s: CardState = { ...state, reps: state.reps + 1, lastReview: now };

  if (s.phase === "new" || s.phase === "learning" || s.phase === "relearning") {
    const steps = s.phase === "relearning" ? RELEARNING_STEPS : LEARNING_STEPS;
    if (rating === 1) {
      s.phase = s.phase === "relearning" ? "relearning" : "learning";
      s.step = 0;
      s.due = now + steps[0];
      return s;
    }
    if (rating === 4) {
      s.phase = "review";
      s.interval = state.phase === "relearning" ? Math.max(1, state.interval) : EASY_INTERVAL;
      s.step = 0;
      s.due = now + fuzz(s.interval) * DAY;
      return s;
    }
    const nextStep = rating === 2 ? s.step : s.step + 1;
    if (nextStep >= steps.length) {
      s.phase = "review";
      s.interval = state.phase === "relearning" ? Math.max(1, Math.round(state.interval * 0.5)) : GRADUATING_INTERVAL;
      s.step = 0;
      s.due = now + fuzz(s.interval) * DAY;
      return s;
    }
    s.phase = state.phase === "new" ? "learning" : state.phase;
    s.step = nextStep;
    s.due = now + steps[nextStep];
    return s;
  }

  // review phase
  if (rating === 1) {
    s.phase = "relearning";
    s.lapses += 1;
    s.ease = Math.max(MIN_EASE, s.ease - 0.2);
    s.step = 0;
    s.due = now + RELEARNING_STEPS[0];
    return s;
  }
  if (rating === 2) {
    s.ease = Math.max(MIN_EASE, s.ease - 0.15);
    s.interval = Math.max(1, Math.round(s.interval * 1.2));
  } else if (rating === 3) {
    s.interval = Math.max(s.interval + 1, Math.round(s.interval * s.ease));
  } else {
    s.ease = s.ease + 0.15;
    s.interval = Math.max(s.interval + 1, Math.round(s.interval * s.ease * 1.3));
  }
  s.interval = Math.min(s.interval, 365);
  s.due = now + fuzz(s.interval) * DAY;
  return s;
}

/** Human-readable preview of when the card would come back for each rating. */
export function previewIntervals(state: CardState, now = Date.now()): Record<Rating, string> {
  const out = {} as Record<Rating, string>;
  for (const r of [1, 2, 3, 4] as Rating[]) {
    const next = schedule({ ...state }, r, now);
    out[r] = humanDelta(next.due - now);
  }
  return out;
}

export function humanDelta(ms: number): string {
  if (ms < MIN) return "now";
  if (ms < 60 * MIN) return `${Math.round(ms / MIN)}m`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}h`;
  const d = Math.round(ms / DAY);
  if (d < 30) return `${d}d`;
  if (d < 365) return `${Math.round(d / 30)}mo`;
  return `${(d / 365).toFixed(1)}y`;
}

export function isDue(state: CardState, now = Date.now()): boolean {
  return state.due <= now;
}
