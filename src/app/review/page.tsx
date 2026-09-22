"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useReviewQueue, useStore } from "@/lib/store";
import { previewIntervals, type Rating } from "@/lib/srs";
import type { Card } from "@/lib/decks";
import { CATEGORIES } from "@/lib/decks";
import { playTts } from "@/lib/audio";
import { Phrase, Spinner } from "@/components/ui";
import { PronounceDrill, SpeakerIcon } from "@/components/PronounceDrill";
import type { PronunciationResult } from "@/app/api/pronounce/route";

const RATINGS: { r: Rating; label: string; key: string }[] = [
  { r: 1, label: "Again", key: "1" },
  { r: 2, label: "Hard", key: "2" },
  { r: 3, label: "Good", key: "3" },
  { r: 4, label: "Easy", key: "4" },
];

export default function ReviewPage() {
  const { ready, lang } = useStore();
  if (!ready) return null;
  // Keyed on language so switching mid-session restarts cleanly.
  return <ReviewSession key={lang} />;
}

function ReviewSession() {
  const { lang, rate, cardState, deck } = useStore();
  const initial = useReviewQueue();
  // Snapshot the queue once on mount so ratings don't reshuffle it under the learner.
  const [queue, setQueue] = useState<Card[]>(() => [...initial.due, ...initial.fresh]);
  const [revealed, setRevealed] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [speakMode, setSpeakMode] = useState(false);
  const [suggested, setSuggested] = useState<Rating | null>(null);
  const [playing, setPlaying] = useState(false);

  const current = queue[0];
  const state = current ? cardState(current.id) : null;
  const previews = useMemo(() => (state ? previewIntervals(state) : null), [state]);

  const grade = useCallback(
    (r: Rating) => {
      if (!current) return;
      rate(current.id, r);
      const rest = queue.slice(1);
      // Again/Hard on learning cards come back within the session.
      if (r === 1 || (r === 2 && (state?.phase === "new" || state?.phase === "learning"))) {
        rest.splice(Math.min(rest.length, 3), 0, current);
      } else {
        setDoneCount((n) => n + 1);
      }
      setQueue(rest);
      setRevealed(false);
      setSuggested(null);
    },
    [current, queue, rate, state],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!current) return;
      if (e.key === " " || e.key === "Enter") {
        if (!revealed) {
          e.preventDefault();
          setRevealed(true);
        }
        return;
      }
      if (revealed) {
        const hit = RATINGS.find((x) => x.key === e.key);
        if (hit) grade(hit.r);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, revealed, grade]);

  const onPron = (r: PronunciationResult) => {
    setRevealed(true);
    setSuggested(r.score >= 90 ? 4 : r.score >= 75 ? 3 : r.score >= 55 ? 2 : 1);
  };

  const listen = async () => {
    if (!current || playing) return;
    setPlaying(true);
    try {
      await playTts(current.text, lang);
    } finally {
      setPlaying(false);
    }
  };

  if (!current) {
    const total = doneCount;
    return (
      <div className="rise">
        <h1 className="display text-5xl sm:text-6xl">{total > 0 ? "Done for now." : "Nothing due."}</h1>
        <p className="mt-3 max-w-md text-ink-2">
          {total > 0
            ? `${total} card${total === 1 ? "" : "s"} scheduled. Cards you marked Again will come back later today.`
            : initial.totalNew > 0
              ? "You've hit today's new-card limit. Change it in Progress if you want more."
              : "Your deck is empty for today. Phrases you add from conversations show up here."}
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/talk" className="btn btn-primary">
            Go talk instead
          </Link>
          <Link href="/progress" className="btn btn-ghost">
            Browse the deck
          </Link>
        </div>
        <DeckPeek deck={deck} />
      </div>
    );
  }

  const remaining = queue.length;
  const cat = CATEGORIES.find((c) => c.id === current.category)?.label ?? "";
  const isNew = state?.phase === "new";

  return (
    <div className="pb-28">
      <div className="flex items-center justify-between text-sm text-ink-3">
        <span>
          {remaining} left
          {isNew && <span className="ml-2 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-ink">new</span>}
        </span>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={speakMode} onChange={(e) => setSpeakMode(e.target.checked)} className="accent-current" />
          Say it out loud
        </label>
      </div>
      <div className="meter mt-3" aria-hidden>
        <span style={{ width: `${(doneCount / Math.max(1, doneCount + remaining)) * 100}%` }} />
      </div>

      <section className="mt-10 min-h-[40vh]" aria-live="polite">
        <p className="text-sm text-ink-3">{cat}</p>
        <h1 className="mt-2 text-3xl font-medium leading-tight sm:text-4xl">{current.meaning}</h1>
        {current.note && revealed && <p className="mt-2 text-sm text-ink-2">{current.note}</p>}

        {speakMode && !revealed && (
          <div className="mt-8">
            <PronounceDrill key={current.id} text={current.text} reading={current.reading} cardId={current.id} onResult={onPron} />
          </div>
        )}

        {revealed && (
          <div className="rise mt-8 border-t border-line pt-8">
            <Phrase text={current.text} reading={current.reading} size="xl" />
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={listen} className="btn btn-ghost btn-sm" disabled={playing}>
                {playing ? <Spinner /> : <SpeakerIcon />} Hear it
              </button>
              {!speakMode && (
                <details className="group">
                  <summary className="btn btn-ghost btn-sm cursor-pointer list-none">Check my pronunciation</summary>
                  <div className="mt-4">
                    <PronounceDrill key={current.id} text={current.text} reading={current.reading} cardId={current.id} onResult={onPron} />
                  </div>
                </details>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="fixed inset-x-0 bottom-14 z-10 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur sm:bottom-0">
        <div className="mx-auto max-w-3xl">
          {!revealed ? (
            <button onClick={() => setRevealed(true)} className="btn btn-primary w-full">
              Show answer
            </button>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {RATINGS.map(({ r, label }) => (
                <button
                  key={r}
                  onClick={() => grade(r)}
                  className={`flex h-14 flex-col items-center justify-center rounded-2xl border transition-colors ${
                    suggested === r ? "border-ink bg-ink text-paper" : r === 1 ? "border-line hover:bg-bad-soft" : r === 4 ? "border-line hover:bg-good-soft" : "border-line hover:bg-wash"
                  }`}
                >
                  <span className="text-sm font-medium">{label}</span>
                  <span className={`text-xs ${suggested === r ? "text-paper/70" : "text-ink-3"}`}>{previews?.[r]}</span>
                </button>
              ))}
            </div>
          )}
          <p className="mt-2 hidden text-center text-xs text-ink-3 sm:block">{revealed ? "Press 1 to 4 to rate" : "Press space to reveal"}</p>
        </div>
      </div>
    </div>
  );
}

function DeckPeek({ deck }: { deck: Card[] }) {
  const { cardState } = useStore();
  const soon = deck
    .map((c) => ({ c, s: cardState(c.id) }))
    .filter((x) => x.s.reps > 0)
    .sort((a, b) => a.s.due - b.s.due)
    .slice(0, 5);
  if (!soon.length) return null;
  return (
    <div className="mt-12">
      <h2 className="text-sm text-ink-3">Coming up next</h2>
      <ul className="mt-2 divide-y divide-line-2 border-y border-line-2">
        {soon.map(({ c, s }) => (
          <li key={c.id} className="flex items-baseline justify-between gap-4 py-2.5">
            <span className="phrase text-lg">{c.text}</span>
            <span className="text-xs text-ink-3">{new Date(s.due).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
