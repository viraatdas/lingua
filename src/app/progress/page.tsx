"use client";

import { useMemo, useState } from "react";
import { CATEGORIES, type CategoryId } from "@/lib/decks";
import { LANGUAGES } from "@/lib/languages";
import { SCENARIOS } from "@/lib/scenarios";
import { useNow, useStats, useStore } from "@/lib/store";
import { humanDelta } from "@/lib/srs";
import { LevelPicker } from "@/components/ui";

export default function ProgressPage() {
  const { lang, ready, deck, cardState, data, setSettings, removeCard, resetLanguage, progress } = useStore();
  const L = LANGUAGES[lang];
  const stats = useStats();
  const now = useNow();
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [confirmReset, setConfirmReset] = useState(false);

  const list = useMemo(() => deck.filter((c) => category === "all" || c.category === category), [deck, category]);
  const recent = [...progress.sessions].reverse().slice(0, 6);
  const max = Math.max(1, ...stats.days.map((d) => d.count));

  if (!ready) return null;

  return (
    <div className="rise">
      <h1 className="display text-5xl sm:text-6xl">{L.name}.</h1>

      <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <Stat n={stats.streak} label="day streak" />
        <Stat n={stats.known} label={`of ${stats.total} phrases solid`} />
        <Stat n={stats.talkMinutes} label="minutes spoken" />
        <Stat n={stats.pronAvg ?? "–"} label="recent pronunciation" />
      </dl>

      <section className="mt-10">
        <h2 className="text-sm text-ink-3">Last twelve weeks</h2>
        <div className="mt-2 grid w-fit grid-flow-col gap-[3px]" style={{ gridTemplateRows: "repeat(7, 12px)", gridAutoColumns: "12px" }} aria-label="Daily activity">
          {stats.days.map((d) => (
            <span
              key={d.key}
              title={`${d.date.toLocaleDateString()}: ${d.count} actions`}
              className="rounded-[3px]"
              style={{ background: d.count === 0 ? "var(--line-2)" : "var(--accent)", opacity: d.count === 0 ? 1 : 0.35 + 0.65 * (d.count / max) }}
            />
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="text-sm text-ink-3">Recent conversations</h2>
          <ul className="mt-2 divide-y divide-line-2 border-y border-line-2">
            {recent.map((s, i) => (
              <li key={i} className="flex items-center gap-4 py-2.5 text-sm">
                <span className="flex-1">{SCENARIOS.find((x) => x.id === s.scenarioId)?.title ?? s.scenarioId}</span>
                <span className="text-ink-3">{Math.max(1, Math.round(s.durationSec / 60))} min</span>
                <span className="text-ink-3">{new Date(s.at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
                {s.score !== undefined && <span className={`w-8 text-right tabular-nums ${s.score >= 80 ? "text-good" : s.score >= 60 ? "text-warn" : "text-bad"}`}>{s.score}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-sm text-ink-3">Settings</h2>
        <div className="mt-2">
          <LevelPicker compact />
        </div>
        <label className="mt-4 flex items-center justify-between gap-4 text-sm">
          <span>New cards per day</span>
          <input
            type="number"
            min={0}
            max={50}
            value={data.settings.newPerDay}
            onChange={(e) => setSettings({ newPerDay: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })}
            className="h-10 w-20 rounded-xl border border-line px-3 text-right outline-none focus:border-ink"
          />
        </label>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm text-ink-3">Deck, {deck.length} phrases</h2>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => setCategory("all")} className={`rounded-full border px-3 py-1 text-sm ${category === "all" ? "border-ink bg-ink text-paper" : "border-line hover:bg-wash"}`}>
            All
          </button>
          {CATEGORIES.map((c) => (
            <button key={c.id} onClick={() => setCategory(c.id)} className={`rounded-full border px-3 py-1 text-sm ${category === c.id ? "border-ink bg-ink text-paper" : "border-line hover:bg-wash"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <ul className="mt-3 divide-y divide-line-2 border-y border-line-2">
          {list.map((c) => {
            const s = cardState(c.id);
            const status = s.reps === 0 ? "new" : s.phase === "review" ? (s.interval >= 7 ? "solid" : `${s.interval}d`) : "learning";
            const dueIn = s.reps === 0 ? "" : s.due <= now ? "due" : humanDelta(s.due - now);
            return (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="phrase block text-lg leading-snug">{c.text}</span>
                  <span className="block text-sm text-ink-2">
                    {c.reading && <span className="mr-2">{c.reading}</span>}
                    {c.meaning}
                  </span>
                </span>
                <span className="w-16 text-right text-xs text-ink-3">
                  {status}
                  {dueIn && <span className="block">{dueIn}</span>}
                </span>
                <button onClick={() => removeCard(c.id)} className="text-xs text-ink-3 hover:text-bad" aria-label={`Remove ${c.text}`}>
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-12 border-t border-line pt-6">
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="text-sm text-ink-3 hover:text-bad">
            Reset all {L.name} progress
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span>This wipes reviews, scores and added phrases for {L.name}.</span>
            <button onClick={() => { resetLanguage(lang); setConfirmReset(false); }} className="btn btn-sm bg-bad text-paper">
              Reset
            </button>
            <button onClick={() => setConfirmReset(false)} className="btn btn-ghost btn-sm">
              Keep it
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div>
      <dt className="sr-only">{label}</dt>
      <dd className="display text-4xl">{n}</dd>
      <dd className="mt-1 text-sm text-ink-3">{label}</dd>
    </div>
  );
}
