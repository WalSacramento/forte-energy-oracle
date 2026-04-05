"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { truncateAddress } from "@/lib/formatters";

interface AddressBadgeProps {
  address: string;
  chars?: number;
}

export function AddressBadge({ address, chars = 4 }: AddressBadgeProps) {
  const t = useTranslations("addressBadge");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <span
      className="inline-flex items-center gap-1.5 font-data text-xs px-2 py-0.5 rounded border cursor-default"
      style={{
        color: "var(--text-secondary)",
        borderColor: "var(--bg-border)",
        background: "var(--bg-panel)",
      }}
    >
      {truncateAddress(address, chars)}
      <button
        onClick={handleCopy}
        title={copied ? t("copied") : t("copyAddress")}
        className="opacity-60 hover:opacity-100 transition-opacity"
        style={{ color: copied ? "var(--emerald)" : "inherit" }}
      >
        {copied ? "✓" : "⎘"}
      </button>
    </span>
  );
}
