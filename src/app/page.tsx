"use client";

import Link from "next/link";
import { useMemo } from "react";
import { LANGUAGES } from "@/lib/languages";
import { useReviewQueue, useStats, useStore } from "@/lib/store";
import { SCENARIOS } from "@/lib/scenarios";
import { LevelPicker } from "@/components/ui";

export default function TodayPage() {
  const { lang, ready, data, setSettings, deck, progress } = useStore();
  const L = LANGUAGES[lang];
  const queue = useReviewQueue();
  const stats = useStats();

  const suggestedScenario = useMemo(() => {
    const done = new Set(progress.sessions.map((s) => s.scenarioId));
    const travel = SCENARIOS.filter((s) => s.kind === "travel");
    return travel.find((s) => !done.has(s.id)) ?? travel[progress.sessions.length % travel.length];
  }, [progress.sessions]);

  const weakest = useMemo(() => {
    const scored = new Map<string, number[]>();
    for (const p of progress.pronunciationLog) {
      if (!p.cardId) continue;
      scored.set(p.cardId, [...(scored.get(p.cardId) ?? []), p.score]);
    }
    let worst: { id: string; avg: number } | null = null;
    for (const [id, arr] of scored) {
      const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
      if (!worst || avg < worst.avg) worst = { id, avg };
    }
    return worst ? deck.find((c) => c.id === worst!.id) : undefined;
  }, [progress.pronunciationLog, deck]);

  if (!ready) return null;

  if (!data.settings.onboarded) {
    return (
      <div className="rise">
        <h1 className="display text-5xl sm:text-7xl">
          {L.greeting}
        </h1>
        {L.greetingReading && <p className="mt-2 text-lg text-ink-2">{L.greetingReading}</p>}
        <p className="mt-6 max-w-lg text-lg text-ink-2">
          Lingua gets you talking. Live voice conversations for the situations you&rsquo;ll actually hit while travelling, spaced repetition for the phrases, and honest feedback on how you sound.
        </p>
        <div className="mt-10">
          <h2 className="mb-3 font-medium">How much {L.name} do you have right now?</h2>
          <LevelPicker />
        </div>
        <p className="mt-6 text-sm text-ink-3">You can switch between Spanish and Mandarin any time from the top right. Progress is stored in this browser.</p>
        <button className="btn btn-primary mt-8" onClick={() => setSettings({ onboarded: true })}>
          Start with {L.name}
        </button>
      </div>
    );
  }

  const dueCount = queue.due.length + queue.fresh.length;
  const hour = new Date().getHours();
  const greet = lang === "es" ? (hour < 12 ? "Buenos días." : hour < 20 ? "Buenas tardes." : "Buenas noches.") : hour < 12 ? "早上好。" : hour < 18 ? "下午好。" : "晚上好。";

  return (
    <div className="rise">
      <div className="flex items-end justify-between gap-4">
        <h1 className="display text-5xl sm:text-7xl">{greet}</h1>
        {stats.streak > 0 && (
          <div className="text-right">
            <div className="display text-3xl">{stats.streak}</div>
            <div className="text-xs text-ink-3">day streak</div>
          </div>
        )}
      </div>

      <ol className="mt-10 divide-y divide-line border-y border-line">
        <PlanRow
          href="/review"
          step="Review"
          title={dueCount > 0 ? `${dueCount} card${dueCount === 1 ? "" : "s"} waiting` : "Nothing due"}
          body={
            dueCount > 0
              ? `${queue.due.length} to review, ${queue.fresh.length} new. Five minutes.`
              : queue.totalNew > 0
                ? "Come back tomorrow, or raise your daily new-card limit in Progress."
                : "Add phrases from conversations to keep the deck growing."
          }
          cta={dueCount > 0 ? "Review" : "Browse deck"}
        />
        <PlanRow
          href={`/talk/${suggestedScenario.id}`}
          step="Talk"
          title={suggestedScenario.title}
          body={suggestedScenario.tagline}
          cta="Start"
        />
        <PlanRow href="/talk/news" step="News" title="Today's stories" body={`Three headlines from ${L.region}, at your level.`} cta="Discuss" />
        <PlanRow
          href={weakest ? `/pronounce?card=${encodeURIComponent(weakest.id)}` : "/pronounce"}
          step="Pronounce"
          title={weakest ? weakest.text : "Drill a phrase"}
          body={weakest ? "Your weakest phrase so far. One more try." : "Record yourself, get graded on the sounds you actually make."}
          cta="Practice"
          phrase={!!weakest}
        />
      </ol>

      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-3">
        <span>{stats.known} phrases solid</span>
        <span>{stats.learning} in progress</span>
        <span>{stats.talkMinutes} min spoken</span>
        <span>Level {data.settings.level}</span>
      </div>
    </div>
  );
}

function PlanRow({ href, step, title, body, cta, phrase }: { href: string; step: string; title: string; body: string; cta: string; phrase?: boolean }) {
  return (
    <li>
      <Link href={href} className="group grid grid-cols-[72px_1fr_auto] items-center gap-4 py-5 sm:grid-cols-[110px_1fr_auto]">
        <span className="text-sm text-ink-3">{step}</span>
        <span className="min-w-0">
          <span className={`block leading-tight ${phrase ? "phrase text-2xl" : "text-lg font-medium"}`}>{title}</span>
          <span className="mt-0.5 block text-sm text-ink-2">{body}</span>
        </span>
        <span className="btn btn-ghost btn-sm group-hover:bg-ink group-hover:text-paper">{cta}</span>
      </Link>
    </li>
  );
}
