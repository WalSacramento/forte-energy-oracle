"use client";

import { useEffect } from "react";

export type TxState = "idle" | "pending" | "confirming" | "success" | "error";

interface TxToastProps {
  state: TxState;
  onDismiss?: () => void;
  message?: string;
}

const STATE_CONFIG: Record<TxState, { color: string; label: string } | null> = {
  idle:       null,
  pending:    { color: "var(--amber)",   label: "Sending transaction…" },
  confirming: { color: "var(--cyan)",    label: "Waiting for confirmation…" },
  success:    { color: "var(--emerald)", label: "Transaction confirmed!" },
  error:      { color: "var(--red)",     label: "Transaction failed" },
};

export function TxToast({ state, onDismiss, message }: TxToastProps) {
  const config = STATE_CONFIG[state];

  useEffect(() => {
    if (state === "success" || state === "error") {
      const t = setTimeout(() => onDismiss?.(), 4000);
      return () => clearTimeout(t);
    }
  }, [state, onDismiss]);

  if (!config) return null;

  return (
    <div
      className="fixed bottom-6 right-6 flex items-center gap-3 px-4 py-3 rounded border shadow-lg z-50 font-data text-sm"
      style={{
        background: "var(--bg-panel)",
        borderColor: config.color,
        color: config.color,
        boxShadow: `0 0 16px ${config.color}33`,
      }}
    >
      <span
        className="w-2 h-2 rounded-full dot-pulse"
        style={{ background: config.color }}
      />
      <span>{message ?? config.label}</span>
      {(state === "success" || state === "error") && (
        <button
          onClick={onDismiss}
          className="ml-2 opacity-60 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      )}
    </div>
  );
}
