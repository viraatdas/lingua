"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import { LANGUAGES, type LangCode } from "@/lib/languages";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/review", label: "Review" },
  { href: "/talk", label: "Talk" },
  { href: "/pronounce", label: "Pronounce" },
  { href: "/progress", label: "Progress" },
];

export function Shell({ children }: { children: ReactNode }) {
  const { lang, setSettings, ready } = useStore();
  const pathname = usePathname();
  const inCall = /^\/talk\/[^/]+/.test(pathname);

  useEffect(() => {
    document.documentElement.dataset.lang = lang;
  }, [lang]);

  const switchTo = (l: LangCode) => setSettings({ lang: l });

  return (
    <div className="flex min-h-screen flex-col">
      {!inCall && (
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4">
            <Link href="/" className="display text-[22px] leading-none" aria-label="Lingua home">
              lingua
            </Link>
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Sections">
              {NAV.map((n) => {
                const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.href}
                    href={n.href}
                    className={`rounded-full px-3 py-1.5 text-sm transition-colors ${active ? "bg-ink text-paper" : "text-ink-2 hover:bg-wash hover:text-ink"}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="flex items-center rounded-full border border-line p-0.5" role="group" aria-label="Language">
              {(Object.keys(LANGUAGES) as LangCode[]).map((l) => (
                <button
                  key={l}
                  onClick={() => switchTo(l)}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${lang === l ? "bg-accent-soft text-ink" : "text-ink-3 hover:text-ink"}`}
                  aria-pressed={lang === l}
                  disabled={!ready}
                >
                  {LANGUAGES[l].nativeName}
                </button>
              ))}
            </div>
          </div>
        </header>
      )}
      <main className={`flex-1 ${inCall ? "" : "mx-auto w-full max-w-3xl px-4 pb-24 pt-8 sm:pb-12"}`}>{children}</main>
      {!inCall && (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 backdrop-blur sm:hidden" aria-label="Sections">
          <div className="grid grid-cols-5">
            {NAV.map((n) => {
              const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} className={`py-3 text-center text-xs ${active ? "text-ink font-medium" : "text-ink-3"}`} aria-current={active ? "page" : undefined}>
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
