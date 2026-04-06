"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { formatEth } from "@/lib/formatters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type ValidationState = "PENDING" | "AGGREGATING" | "COMPLETED" | "FAILED";

interface ValidationBadgeProps {
  state: ValidationState;
  aggregatedValue?: bigint;
}

const STYLE_MAP: Record<ValidationState, { bg: string; text: string; dot: string }> = {
  PENDING:     { bg: "bg-primary/10",     text: "text-primary",     dot: "bg-primary" },
  AGGREGATING: { bg: "bg-secondary/10",   text: "text-secondary",   dot: "bg-secondary" },
  COMPLETED:   { bg: "bg-market-up/10",   text: "text-market-up",   dot: "bg-market-up" },
  FAILED:      { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive" },
};

export function ValidationBadge({
  state,
  aggregatedValue,
}: ValidationBadgeProps) {
  const t = useTranslations("validationBadge");
  const [open, setOpen] = useState(false);
  const label = t(
    state.toLowerCase() as "pending" | "aggregating" | "completed" | "failed"
  );
  const styles = STYLE_MAP[state];

  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px] font-medium",
        styles.bg,
        styles.text
      )}
    >
      <span
        className={cn(
          "size-1 rounded-full",
          styles.dot,
          (state === "PENDING" || state === "AGGREGATING") && "dot-pulse"
        )}
      />
      {label}
    </span>
  );

  if (state !== "COMPLETED" || aggregatedValue === undefined) {
    return badge;
  }

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger render={badge} />
      <TooltipContent>
        {t("oracleReading")} {formatEth(aggregatedValue)}
      </TooltipContent>
    </Tooltip>
  );
}
