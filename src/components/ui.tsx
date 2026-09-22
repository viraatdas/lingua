"use client";

import { LEVELS, type Level } from "@/lib/languages";
import { useStore } from "@/lib/store";

export function Phrase({ text, reading, size = "lg", className = "" }: { text: string; reading?: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "text-xl", md: "text-2xl sm:text-3xl", lg: "text-3xl sm:text-4xl", xl: "text-4xl sm:text-6xl" };
  return (
    <div className={className}>
      <div className={`phrase ${sizes[size]} leading-tight text-balance`}>{text}</div>
      {reading && <div className="mt-1.5 text-ink-2 text-base sm:text-lg">{reading}</div>}
    </div>
  );
}

export function ScoreRing({ score, size = 96, label }: { score: number; size?: number; label?: string }) {
  const r = (size - 10) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, score));
  const color = pct >= 85 ? "var(--good)" : pct >= 60 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"} ${pct} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-2)" strokeWidth={8} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: "stroke-dashoffset 600ms ease" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="display text-3xl">{pct}</span>
        {label && <span className="text-[11px] text-ink-3">{label}</span>}
      </div>
    </div>
  );
}

export function LevelPicker({ compact = false }: { compact?: boolean }) {
  const { level, setSettings } = useStore();
  return (
    <div className={compact ? "flex flex-wrap gap-2" : "grid gap-2 sm:grid-cols-2"} role="radiogroup" aria-label="Level">
      {LEVELS.map((l) => (
        <button
          key={l.id}
          role="radio"
          aria-checked={level === l.id}
          onClick={() => setSettings({ level: l.id as Level })}
          className={`rounded-2xl border px-4 py-3 text-left transition-colors ${level === l.id ? "border-ink bg-ink text-paper" : "border-line hover:bg-wash"} ${compact ? "flex-1 min-w-[140px]" : ""}`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-medium">{l.label}</span>
            <span className={`text-xs ${level === l.id ? "text-paper/70" : "text-ink-3"}`}>{l.id}</span>
          </div>
          {!compact && <div className={`mt-0.5 text-sm ${level === l.id ? "text-paper/80" : "text-ink-2"}`}>{l.blurb}</div>}
        </button>
      ))}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <div className="display text-2xl">{title}</div>
      <p className="mx-auto mt-2 max-w-sm text-ink-2">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-ink-3 border-t-transparent ${className}`} aria-hidden />;
}
