"use client";

import { useEffect, useRef, useState } from "react";
import { Recorder, playTts } from "@/lib/audio";
import { useStore } from "@/lib/store";
import type { PronunciationResult } from "@/app/api/pronounce/route";
import { ScoreRing, Spinner } from "./ui";

type Phase = "idle" | "recording" | "grading" | "done" | "error";

export function PronounceDrill({
  text,
  reading,
  cardId,
  onResult,
  autoFocus,
}: {
  text: string;
  reading?: string;
  cardId?: string;
  onResult?: (r: PronunciationResult) => void;
  autoFocus?: boolean;
}) {
  const { lang, logPronunciation } = useStore();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<PronunciationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rec = useRef<Recorder | null>(null);
  const raf = useRef<number>(0);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (autoFocus) btnRef.current?.focus();
  }, [autoFocus, text]);

  useEffect(() => () => {
    rec.current?.cancel();
    cancelAnimationFrame(raf.current);
  }, []);

  const tick = () => {
    setLevel(rec.current?.level() ?? 0);
    raf.current = requestAnimationFrame(tick);
  };

  const start = async () => {
    setError(null);
    setResult(null);
    try {
      rec.current = new Recorder();
      await rec.current.start();
      setPhase("recording");
      tick();
    } catch {
      setError("Microphone access is needed to grade your pronunciation.");
      setPhase("error");
    }
  };

  const stop = async () => {
    cancelAnimationFrame(raf.current);
    setLevel(0);
    if (!rec.current) return;
    setPhase("grading");
    try {
      const { wavBase64, durationSec } = await rec.current.stop();
      if (durationSec < 0.4) {
        setError("That was too short. Say the whole phrase.");
        setPhase("idle");
        return;
      }
      const res = await fetch("/api/pronounce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang, target: text, reading, wavBase64 }),
      });
      if (!res.ok) throw new Error(await res.text());
      const r = (await res.json()) as PronunciationResult;
      setResult(r);
      setPhase("done");
      logPronunciation({ cardId, text, score: r.score });
      onResult?.(r);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Grading failed. Try again.");
      setPhase("idle");
    }
  };

  const listen = async () => {
    if (playing) return;
    setPlaying(true);
    try {
      await playTts(text, lang);
    } catch {
      setError("Couldn't play the audio.");
    } finally {
      setPlaying(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        {phase === "recording" ? (
          <button ref={btnRef} onClick={stop} className="btn btn-accent relative overflow-hidden" aria-label="Stop and grade">
            <span className="absolute inset-0 bg-ink/10" style={{ transform: `scaleX(${level})`, transformOrigin: "left", transition: "transform 60ms linear" }} aria-hidden />
            <span className="relative flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-sm bg-ink" aria-hidden />
              Stop and grade
            </span>
          </button>
        ) : (
          <button ref={btnRef} onClick={start} className="btn btn-primary" disabled={phase === "grading"}>
            {phase === "grading" ? (
              <>
                <Spinner className="border-paper/60 border-t-transparent" /> Listening back
              </>
            ) : (
              <>
                <MicIcon /> {phase === "done" ? "Try again" : "Say it"}
              </>
            )}
          </button>
        )}
        <button onClick={listen} className="btn btn-ghost" disabled={playing}>
          {playing ? <Spinner /> : <SpeakerIcon />} Hear it
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-bad">{error}</p>}
      {result && (
        <div className="rise mt-5 rounded-2xl border border-line p-4 sm:p-5">
          <div className="flex items-start gap-4">
            <ScoreRing score={result.score} size={88} />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{result.verdict}</p>
              {result.heard && (
                <p className="mt-1 text-sm text-ink-2">
                  Heard: <span className="text-ink">{result.heard}</span>
                </p>
              )}
            </div>
          </div>
          {result.issues.length > 0 && (
            <ul className="mt-4 divide-y divide-line-2 border-t border-line-2">
              {result.issues.map((it, i) => (
                <li key={i} className="grid gap-1 py-2.5 sm:grid-cols-[110px_1fr]">
                  <span className="phrase text-lg leading-snug">{it.part}</span>
                  <span className="text-sm">
                    <span className="text-ink-2">{it.problem}</span>
                    {it.fix && <span className="text-ink"> {it.fix}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {result.tip && <p className="mt-3 rounded-xl bg-wash px-3 py-2 text-sm">{result.tip}</p>}
        </div>
      )}
    </div>
  );
}

export function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
    </svg>
  );
}

export function SpeakerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12" />
    </svg>
  );
}
