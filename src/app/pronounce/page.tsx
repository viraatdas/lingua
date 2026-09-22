"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CATEGORIES, type Card, type CategoryId } from "@/lib/decks";
import { LANGUAGES } from "@/lib/languages";
import { useStore } from "@/lib/store";
import { Phrase } from "@/components/ui";
import { PronounceDrill } from "@/components/PronounceDrill";

export default function PronouncePage() {
  const { lang, ready } = useStore();
  return (
    <Suspense>
      <PronounceInner key={`${lang}-${ready}`} />
    </Suspense>
  );
}

function PronounceInner() {
  const { lang, deck, ready, progress } = useStore();
  const L = LANGUAGES[lang];
  const params = useSearchParams();
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [selected, setSelected] = useState<Card | null>(() => {
    const id = params.get("card");
    return id ? (deck.find((x) => x.id === id) ?? null) : null;
  });
  const [custom, setCustom] = useState("");

  const best = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of progress.pronunciationLog) if (p.cardId) m.set(p.cardId, Math.max(m.get(p.cardId) ?? 0, p.score));
    return m;
  }, [progress.pronunciationLog]);

  const list = useMemo(() => deck.filter((c) => category === "all" || c.category === category), [deck, category]);

  if (!ready) return null;

  const pickRandom = () => setSelected(list[Math.floor(Math.random() * list.length)] ?? null);

  return (
    <div className="rise">
      <h1 className="display text-5xl sm:text-6xl">Pronounce.</h1>
      <p className="mt-3 max-w-lg text-ink-2">
        Pick a phrase, hear it, say it, and get graded on the sounds you actually made{lang === "zh" ? ", tone by tone" : ""}. Scores are honest, not encouraging.
      </p>

      {selected && (
        <section className="mt-8 rounded-3xl border border-line p-5 sm:p-8">
          <p className="text-sm text-ink-3">{selected.meaning}</p>
          <Phrase text={selected.text} reading={selected.reading} size="xl" className="mt-2" />
          {selected.note && <p className="mt-2 text-sm text-ink-2">{selected.note}</p>}
          <div className="mt-6">
            <PronounceDrill key={selected.id} text={selected.text} reading={selected.reading} cardId={selected.id} autoFocus />
          </div>
          <div className="mt-5 flex gap-3">
            <button onClick={pickRandom} className="btn btn-ghost btn-sm">
              Another one
            </button>
            <button onClick={() => setSelected(null)} className="btn btn-ghost btn-sm">
              Close
            </button>
          </div>
        </section>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!custom.trim()) return;
          setSelected({ id: `adhoc-${Date.now()}`, lang, text: custom.trim(), meaning: "Your own phrase", category: "smalltalk" });
          setCustom("");
        }}
        className="mt-8 flex gap-2"
      >
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder={`Or type any ${L.name} phrase to drill`}
          className="h-11 flex-1 rounded-full border border-line bg-paper px-4 text-sm outline-none placeholder:text-ink-3 focus:border-ink"
        />
        <button className="btn btn-ghost h-11" disabled={!custom.trim()}>
          Drill it
        </button>
      </form>

      <div className="mt-8 flex flex-wrap gap-2">
        <button onClick={() => setCategory("all")} className={`rounded-full border px-3 py-1 text-sm ${category === "all" ? "border-ink bg-ink text-paper" : "border-line hover:bg-wash"}`}>
          All
        </button>
        {CATEGORIES.map((c) => (
          <button key={c.id} onClick={() => setCategory(c.id)} className={`rounded-full border px-3 py-1 text-sm ${category === c.id ? "border-ink bg-ink text-paper" : "border-line hover:bg-wash"}`}>
            {c.label}
          </button>
        ))}
      </div>

      <ul className="mt-4 divide-y divide-line-2 border-y border-line-2">
        {list.map((c) => {
          const b = best.get(c.id);
          return (
            <li key={c.id}>
              <button onClick={() => { setSelected(c); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="flex w-full items-center gap-4 py-3 text-left hover:bg-wash">
                <span className="min-w-0 flex-1">
                  <span className="phrase block text-lg leading-snug">{c.text}</span>
                  <span className="block text-sm text-ink-2">
                    {c.reading && <span className="mr-2">{c.reading}</span>}
                    {c.meaning}
                  </span>
                </span>
                {b !== undefined && <span className={`text-sm tabular-nums ${b >= 85 ? "text-good" : b >= 60 ? "text-warn" : "text-bad"}`}>{b}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
