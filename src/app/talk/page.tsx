"use client";

import Link from "next/link";
import { LANGUAGES } from "@/lib/languages";
import { SCENARIOS } from "@/lib/scenarios";
import { useStore } from "@/lib/store";
import { LevelPicker } from "@/components/ui";

export default function TalkPage() {
  const { lang, progress, ready } = useStore();
  const L = LANGUAGES[lang];
  const counts = new Map<string, number>();
  for (const s of progress.sessions) counts.set(s.scenarioId, (counts.get(s.scenarioId) ?? 0) + 1);
  const travel = SCENARIOS.filter((s) => s.kind === "travel");
  const other = SCENARIOS.filter((s) => s.kind !== "travel");
  if (!ready) return null;

  return (
    <div className="rise">
      <h1 className="display text-5xl sm:text-6xl">Talk.</h1>
      <p className="mt-3 max-w-lg text-ink-2">
        A live voice conversation in {L.name}. The tutor plays the other person, keeps to your level, and corrects you by example. End the call to get written feedback and new phrases for your deck.
      </p>

      <div className="mt-8">
        <LevelPicker compact />
      </div>

      <h2 className="mt-12 text-sm text-ink-3">On the road</h2>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {travel.map((s) => (
          <Row key={s.id} id={s.id} title={s.title} tagline={s.tagline} opener={s.opener[lang]} count={counts.get(s.id) ?? 0} />
        ))}
      </ul>

      <h2 className="mt-12 text-sm text-ink-3">Open-ended</h2>
      <ul className="mt-2 divide-y divide-line border-y border-line">
        {other.map((s) => (
          <Row key={s.id} id={s.id} title={s.title} tagline={s.tagline} opener={s.opener[lang]} count={counts.get(s.id) ?? 0} />
        ))}
      </ul>
    </div>
  );
}

function Row({ id, title, tagline, opener, count }: { id: string; title: string; tagline: string; opener: string; count: number }) {
  return (
    <li>
      <Link href={`/talk/${id}`} className="group flex items-center gap-4 py-5">
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-medium leading-tight">{title}</span>
          <span className="mt-0.5 block text-sm text-ink-2">{tagline}</span>
          <span className="phrase mt-2 block text-base text-ink-3">“{opener}”</span>
        </span>
        <span className="shrink-0 text-right">
          {count > 0 && <span className="block text-xs text-ink-3">{count}×</span>}
          <span className="btn btn-ghost btn-sm mt-1 group-hover:bg-ink group-hover:text-paper">Start</span>
        </span>
      </Link>
    </li>
  );
}
