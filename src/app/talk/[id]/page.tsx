"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/languages";
import { getScenario } from "@/lib/scenarios";
import { useStore } from "@/lib/store";
import { RealtimeSession, type RealtimeStatus, type TranscriptLine, type TranscriptRole } from "@/lib/realtime";
import type { NewsStory } from "@/lib/prompts";
import type { FeedbackResult } from "@/app/api/feedback/route";
import { Phrase, ScoreRing, Spinner } from "@/components/ui";
import { MicIcon } from "@/components/PronounceDrill";

type Stage = "brief" | "call" | "wrap";

interface SavedPhrase {
  text: string;
  reading?: string;
  meaning: string;
  added: boolean;
}

export default function ConversationPage() {
  const params = useParams<{ id: string }>();
  const { lang, level, ready } = useStore();
  // Keyed so that changing language or level starts a fresh brief (and refetches news).
  return <Conversation key={`${params.id}-${lang}-${level}-${ready}`} id={params.id} />;
}

function Conversation({ id }: { id: string }) {
  const router = useRouter();
  const scenario = getScenario(id);
  const { lang, level, ready, deck, cardState, addCard, logSession } = useStore();
  const L = LANGUAGES[lang];

  const [stage, setStage] = useState<Stage>("brief");
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const [statusDetail, setStatusDetail] = useState<string | undefined>();
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [speaking, setSpeaking] = useState<TranscriptRole | null>(null);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [news, setNews] = useState<NewsStory[] | null>(null);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPhrase[]>([]);
  const [feedback, setFeedback] = useState<FeedbackResult | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const [showTranslation, setShowTranslation] = useState(false);
  const session = useRef<RealtimeSession | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const isNews = scenario?.kind === "news";

  const deckSample = useMemo(() => {
    if (!scenario) return [];
    const inCats = deck.filter((c) => scenario.categories.includes(c.category));
    const learning = inCats.filter((c) => cardState(c.id).reps > 0);
    const pool = learning.length >= 6 ? learning : [...learning, ...inCats.filter((c) => !learning.includes(c))];
    return pool.slice(0, 10).map((c) => `${c.text} = ${c.meaning}`);
  }, [deck, scenario, cardState]);

  useEffect(() => {
    if (!isNews || !ready) return;
    let cancelled = false;
    fetch(`/api/news?lang=${lang}&level=${level}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text());
        return r.json() as Promise<{ stories: NewsStory[] }>;
      })
      .then((d) => !cancelled && setNews(d.stories))
      .catch((e) => !cancelled && setNewsError(e instanceof Error ? e.message : "Could not load stories"));
    return () => {
      cancelled = true;
    };
  }, [isNews, lang, level, ready]);

  useEffect(() => {
    if (stage !== "call") return;
    const t = setInterval(() => setElapsed(session.current?.elapsedSec ?? 0), 1000);
    return () => clearInterval(t);
  }, [stage]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  useEffect(() => () => session.current?.close(), []);

  const start = useCallback(async () => {
    if (!scenario) return;
    setStage("call");
    setLines([]);
    setSaved([]);
    const s = new RealtimeSession({
      onStatus: (st, detail) => {
        setStatus(st);
        setStatusDetail(detail);
      },
      onTranscript: setLines,
      onSpeaking: setSpeaking,
      onToolCall: (name, args) => {
        if (name === "save_phrase" && typeof args.text === "string") {
          const p: SavedPhrase = { text: args.text, reading: typeof args.reading === "string" && args.reading ? args.reading : undefined, meaning: String(args.meaning ?? ""), added: false };
          setSaved((prev) => (prev.some((x) => x.text === p.text) ? prev : [...prev, p]));
          return { saved: true };
        }
        return { ok: false, error: "unknown tool" };
      },
    });
    session.current = s;
    try {
      await s.connect({ lang, level, scenarioId: scenario.id, news: isNews ? (news ?? undefined) : undefined, deckSample });
    } catch {
      /* status already reflects the error */
    }
  }, [scenario, lang, level, isNews, news, deckSample]);

  const end = useCallback(async () => {
    if (!scenario) return;
    const s = session.current;
    const transcript = (s?.transcript ?? lines).filter((l) => l.text.trim());
    const duration = s?.elapsedSec ?? elapsed;
    s?.close();
    session.current = null;
    setStage("wrap");
    setFeedback(null);
    setFeedbackError(null);
    const turns = transcript.filter((l) => l.role === "you").length;
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, level, scenarioId: scenario.id, transcript: transcript.map((l) => ({ role: l.role, text: l.text })) }),
      });
      if (!res.ok) throw new Error(await res.text());
      const fb = (await res.json()) as FeedbackResult;
      setFeedback(fb);
      logSession({ scenarioId: scenario.id, durationSec: duration, turns, score: fb.score });
    } catch (e) {
      setFeedbackError(e instanceof Error ? e.message : "Could not write feedback");
      logSession({ scenarioId: scenario.id, durationSec: duration, turns });
    }
  }, [scenario, lang, level, lines, elapsed, logSession]);

  const addPhrase = (p: { text: string; reading?: string; meaning: string }) => {
    addCard({ text: p.text, reading: p.reading, meaning: p.meaning, category: scenario?.categories[0] === "news" ? "news" : ((scenario?.categories[0] ?? "smalltalk") as "smalltalk") });
    setSaved((prev) => prev.map((x) => (x.text === p.text ? { ...x, added: true } : x)));
    setFeedback((fb) => (fb ? { ...fb, vocab: fb.vocab.map((v) => (v.text === p.text ? { ...v, added: true } as typeof v : v)) } : fb));
  };

  if (!scenario) {
    return (
      <div className="mx-auto max-w-3xl px-4 pt-8">
        <p>That scenario doesn&rsquo;t exist.</p>
        <Link href="/talk" className="btn btn-ghost mt-4">
          Back to scenarios
        </Link>
      </div>
    );
  }
  if (!ready) return null;

  // ---------- Brief ----------
  if (stage === "brief") {
    return (
      <div className="rise mx-auto w-full max-w-3xl px-4 pb-24 pt-8">
        <Link href="/talk" className="text-sm text-ink-3 hover:text-ink">
          All scenarios
        </Link>
        <h1 className="display mt-3 text-5xl sm:text-6xl">{scenario.title}</h1>
        <p className="mt-3 max-w-lg text-ink-2">{scenario.tagline}</p>

        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <h2 className="text-sm text-ink-3">Try to</h2>
            <ul className="mt-2 space-y-1.5">
              {scenario.goals.map((g) => (
                <li key={g} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-sm text-ink-3">The tutor opens with</h2>
            <Phrase text={scenario.opener[lang]} size="md" className="mt-2" />
            <p className="mt-3 text-sm text-ink-2">Level {level}. Speak {L.name}; if you&rsquo;re stuck, say it in English and you&rsquo;ll be told how.</p>
          </div>
        </div>

        {isNews && (
          <div className="mt-10">
            <h2 className="text-sm text-ink-3">Today&rsquo;s stories</h2>
            {newsError && <p className="mt-2 text-sm text-bad">{newsError}</p>}
            {!news && !newsError && (
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-2">
                <Spinner /> Reading today&rsquo;s papers from {L.region}
              </p>
            )}
            {news && (
              <ol className="mt-2 divide-y divide-line border-y border-line">
                {news.map((s, i) => (
                  <li key={i} className="py-4">
                    <Phrase text={s.headline} size="sm" />
                    <p className="mt-1.5 text-ink-2">{s.summary}</p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      {s.vocab.map((v, j) => (
                        <span key={j}>
                          <span className="phrase">{v.word}</span>
                          {v.reading && <span className="text-ink-3"> {v.reading}</span>}
                          <span className="text-ink-3"> {v.meaning}</span>
                        </span>
                      ))}
                    </div>
                    {s.url && (
                      <a href={s.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-ink-3 underline-offset-2 hover:underline">
                        {s.source || "source"}
                      </a>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <button className="btn btn-primary" onClick={start} disabled={isNews && !news}>
            <MicIcon /> Start conversation
          </button>
          <span className="text-sm text-ink-3">Uses your microphone. Headphones help.</span>
        </div>
      </div>
    );
  }

  // ---------- Call ----------
  if (stage === "call") {
    const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
    const ss = String(elapsed % 60).padStart(2, "0");
    return (
      <div className="flex h-[100dvh] flex-col">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="min-w-0">
            <div className="truncate font-medium">{scenario.title}</div>
            <div className="text-xs text-ink-3">
              {status === "connecting" && "Connecting"}
              {status === "live" && `${mm}:${ss}`}
              {status === "error" && (statusDetail || "Something went wrong")}
            </div>
          </div>
          <button onClick={end} className="btn btn-ghost btn-sm">
            End and get feedback
          </button>
        </div>

        <div ref={scroller} className="scroll-thin flex-1 overflow-y-auto px-4 py-6">
          <div className="mx-auto max-w-2xl space-y-5">
            {status === "connecting" && lines.length === 0 && (
              <p className="flex items-center gap-2 text-ink-2">
                <Spinner /> Setting up the call
              </p>
            )}
            {status === "error" && (
              <div className="rounded-2xl bg-bad-soft p-4 text-sm">
                <p>{statusDetail || "The call couldn&rsquo;t connect."}</p>
                <button onClick={start} className="btn btn-primary btn-sm mt-3">
                  Try again
                </button>
              </div>
            )}
            {lines.map((l) => (
              <div key={l.id} className={l.role === "you" ? "text-right" : ""}>
                <span className="text-xs text-ink-3">{l.role === "you" ? "You" : L.name}</span>
                <p className={l.role === "tutor" ? "phrase text-2xl leading-snug sm:text-3xl" : "text-lg text-ink-2"}>
                  {l.text}
                  {!l.final && <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-ink-3 align-middle" aria-hidden />}
                </p>
              </div>
            ))}
            {saved.length > 0 && (
              <div className="rounded-2xl bg-wash px-4 py-3 text-sm">
                <span className="text-ink-3">New for you: </span>
                {saved.map((p) => (
                  <span key={p.text} className="mr-3">
                    <span className="phrase text-base">{p.text}</span>
                    <span className="text-ink-3"> {p.meaning}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-line px-4 py-3">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line" aria-label={speaking === "tutor" ? "Tutor speaking" : speaking === "you" ? "You are speaking" : "Listening"}>
                <span className={`h-3 w-3 rounded-full ${speaking === "tutor" ? "bg-accent breathe" : speaking === "you" ? "bg-good breathe" : muted ? "bg-line" : "bg-ink-3"}`} aria-hidden />
              </div>
              <div className="flex-1 text-sm text-ink-2">
                {status !== "live" ? "" : speaking === "tutor" ? "Tutor is talking. Interrupt any time." : speaking === "you" ? "Go on" : muted ? "Muted" : "Your turn. Just talk."}
              </div>
              <button onClick={() => session.current?.nudge(`The learner asked you to slow down and simplify. Repeat your last point more slowly in simpler ${L.name}.`)} className="btn btn-ghost btn-sm" disabled={status !== "live"}>
                Slower
              </button>
              <button onClick={() => session.current?.nudge(`Give the learner a hint in English about what they could say next in this situation, then say the ${L.name} version slowly and ask them to repeat it.`)} className="btn btn-ghost btn-sm" disabled={status !== "live"}>
                Hint
              </button>
              <button
                onClick={() => {
                  const m = !muted;
                  setMuted(m);
                  session.current?.setMuted(m);
                }}
                className={`btn btn-sm ${muted ? "btn-accent" : "btn-ghost"}`}
                aria-pressed={muted}
                disabled={status !== "live"}
              >
                {muted ? "Unmute" : "Mute"}
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!typed.trim()) return;
                session.current?.sendText(typed.trim());
                setTyped("");
              }}
              className="flex gap-2"
            >
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={`Type instead, e.g. “how do I say ‘no onions’?”`}
                className="h-11 flex-1 rounded-full border border-line bg-paper px-4 text-sm outline-none placeholder:text-ink-3 focus:border-ink"
                disabled={status !== "live"}
              />
              <button className="btn btn-ghost btn-sm h-11" disabled={status !== "live" || !typed.trim()}>
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Wrap ----------
  const transcriptLines = lines.filter((l) => l.text.trim());
  return (
    <div className="rise mx-auto w-full max-w-3xl px-4 pb-24 pt-8">
      <Link href="/talk" className="text-sm text-ink-3 hover:text-ink">
        All scenarios
      </Link>
      <h1 className="display mt-3 text-5xl sm:text-6xl">How it went.</h1>
      <p className="mt-2 text-ink-2">
        {scenario.title}, {Math.max(1, Math.round(elapsed / 60))} min, {transcriptLines.filter((l) => l.role === "you").length} turns from you.
      </p>

      {!feedback && !feedbackError && (
        <p className="mt-8 flex items-center gap-2 text-ink-2">
          <Spinner /> Reading the transcript
        </p>
      )}
      {feedbackError && (
        <div className="mt-8 rounded-2xl bg-bad-soft p-4 text-sm">
          <p>{feedbackError}</p>
          <button onClick={end} className="btn btn-primary btn-sm mt-3">
            Try again
          </button>
        </div>
      )}

      {feedback && (
        <div className="mt-8">
          <div className="flex items-start gap-5">
            <ScoreRing score={feedback.score} size={104} label="overall" />
            <div>
              <p className="text-lg">{feedback.summary}</p>
              {feedback.nextTime && <p className="mt-2 text-sm text-ink-2">Next time: {feedback.nextTime}</p>}
            </div>
          </div>

          {scenario.goals.length > 0 && (
            <ul className="mt-8 grid gap-1.5 sm:grid-cols-2">
              {scenario.goals.map((g) => {
                const met = feedback.goalsMet.some((m) => m.toLowerCase().includes(g.toLowerCase().slice(0, 12)) || g.toLowerCase().includes(m.toLowerCase().slice(0, 12)));
                return (
                  <li key={g} className={`flex gap-2 text-sm ${met ? "" : "text-ink-3"}`}>
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${met ? "bg-good" : "bg-line"}`} aria-hidden />
                    {g}
                  </li>
                );
              })}
            </ul>
          )}

          {feedback.corrections.length > 0 && (
            <section className="mt-10">
              <h2 className="text-sm text-ink-3">Say it this way</h2>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {feedback.corrections.map((c, i) => (
                  <li key={i} className="py-4">
                    <p className="text-ink-3 line-through decoration-ink-3/50">{c.said}</p>
                    <p className="phrase mt-1 text-xl">{c.better}</p>
                    <p className="mt-1 text-sm text-ink-2">{c.why}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(feedback.vocab.length > 0 || saved.length > 0) && (
            <section className="mt-10">
              <h2 className="text-sm text-ink-3">Add to your deck</h2>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {[...saved, ...feedback.vocab.filter((v) => !saved.some((s) => s.text === v.text)).map((v) => ({ ...v, added: (v as { added?: boolean }).added ?? false }))].map((p) => (
                  <li key={p.text} className="flex items-center gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <span className="phrase text-xl">{p.text}</span>
                      {p.reading && <span className="ml-2 text-sm text-ink-2">{p.reading}</span>}
                      <span className="block text-sm text-ink-2">{p.meaning}</span>
                    </div>
                    <button onClick={() => addPhrase(p)} className={`btn btn-sm ${p.added ? "btn-ghost" : "btn-primary"}`} disabled={p.added}>
                      {p.added ? "Added" : "Add"}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <section className="mt-10">
        <button onClick={() => setShowTranslation((v) => !v)} className="text-sm text-ink-3 hover:text-ink">
          {showTranslation ? "Hide transcript" : "Show transcript"}
        </button>
        {showTranslation && (
          <div className="mt-3 space-y-3 border-t border-line pt-4">
            {transcriptLines.map((l) => (
              <p key={l.id} className={l.role === "you" ? "text-ink-2" : "phrase text-lg"}>
                <span className="mr-2 text-xs text-ink-3">{l.role === "you" ? "You" : L.name}</span>
                {l.text}
              </p>
            ))}
          </div>
        )}
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <button onClick={() => { setStage("brief"); setLines([]); setElapsed(0); }} className="btn btn-primary">
          Talk again
        </button>
        <button onClick={() => router.push("/review")} className="btn btn-ghost">
          Review deck
        </button>
      </div>
    </div>
  );
}
