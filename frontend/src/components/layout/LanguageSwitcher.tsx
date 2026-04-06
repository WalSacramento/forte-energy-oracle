"use client";

import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { locales, type Locale } from "@/lib/locale";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
    <div className="flex items-center rounded-lg border bg-background p-1">
      {locales.map((item) => (
        <Button
          key={item}
          variant="ghost"
          size="sm"
          disabled={isPending}
          onClick={() => handleSwitch(item)}
          className={cn(
            "h-7 rounded-md px-2 text-xs font-medium",
            item === locale && "bg-muted text-foreground"
          )}
        >
          {LOCALE_LABELS[item]}
        </Button>
      ))}
    </div>
  );
}
