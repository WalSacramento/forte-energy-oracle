"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { locales, type Locale } from "@/lib/locale";

const LOCALE_LABELS: Record<Locale, string> = {
  en: "EN",
  "pt-BR": "PT",
};

export function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSwitch = (next: Locale) => {
    if (next === locale || isPending) return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; SameSite=Lax`;
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div
      className="flex items-center gap-0.5 font-data text-xs border rounded px-1"
      style={{ borderColor: "var(--bg-border)" }}
    >
      {locales.map((l, i) => (
        <span key={l} className="flex items-center">
          <button
            onClick={() => handleSwitch(l)}
            disabled={isPending}
            className="px-1 py-0.5 rounded transition-colors disabled:opacity-50"
            style={{
              color: l === locale ? "var(--cyan)" : "var(--text-muted)",
              fontWeight: l === locale ? 700 : 400,
            }}
          >
            {LOCALE_LABELS[l]}
          </button>
          {i < locales.length - 1 && (
            <span style={{ color: "var(--bg-border)" }}>|</span>
          )}
        </span>
      ))}
    </div>
  );
}
