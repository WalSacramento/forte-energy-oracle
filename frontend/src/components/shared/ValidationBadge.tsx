"use client";

import { useState } from "react";
import { formatEth } from "@/lib/formatters";

type ValidationState = "PENDING" | "AGGREGATING" | "COMPLETED" | "FAILED";

interface ValidationBadgeProps {
  state: ValidationState;
  aggregatedValue?: bigint;
}

const CONFIG: Record<ValidationState, { label: string; color: string; bg: string; pulse: boolean }> = {
  PENDING:     { label: "PENDING",     color: "var(--amber)",   bg: "rgba(255,165,0,0.1)",   pulse: true },
  AGGREGATING: { label: "AGGREGATING", color: "var(--cyan)",    bg: "rgba(0,229,255,0.1)",   pulse: true },
  COMPLETED:   { label: "VALIDATED",   color: "var(--emerald)", bg: "rgba(0,230,118,0.1)",   pulse: false },
  FAILED:      { label: "FAILED",      color: "var(--red)",     bg: "rgba(255,23,68,0.1)",   pulse: false },
};

export function ValidationBadge({ state, aggregatedValue }: ValidationBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const cfg = CONFIG[state];

  return (
    <span
      className="relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-data text-xs cursor-default"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.color}33` }}
      onMouseEnter={() => state === "COMPLETED" && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${cfg.pulse ? "dot-pulse" : ""}`}
        style={{ background: cfg.color }}
      />
      {cfg.label}

      {/* Tooltip for COMPLETED showing aggregated value */}
      {showTooltip && aggregatedValue !== undefined && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 rounded text-xs whitespace-nowrap z-50"
          style={{
            background: "var(--bg-panel)",
            border: "1px solid var(--bg-border)",
            color: "var(--text-primary)",
          }}
        >
          Oracle reading: {formatEth(aggregatedValue)}
        </span>
      )}
    </span>
  );
}
