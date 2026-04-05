"use client";

import { useReadContract } from "wagmi";
import { useTranslations } from "next-intl";
import { EnergyTradingABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { hardhatLocal } from "@/lib/wagmi-config";
import { formatWh, formatEthPrice, formatCountdown } from "@/lib/formatters";
import { ValidationBadge } from "@/components/shared/ValidationBadge";
import { AddressBadge } from "@/components/shared/AddressBadge";

interface OfferCardProps {
  offerId: bigint;
  onBuy: () => void;
}

const ORACLE_STATUS_MAP: Record<number, "PENDING" | "AGGREGATING" | "COMPLETED" | "FAILED"> = {
  0: "PENDING",
  1: "AGGREGATING",
  2: "COMPLETED",
  3: "FAILED",
};

export function OfferCard({ offerId, onBuy }: OfferCardProps) {
  const t = useTranslations("offerCard");
  const { data: offer } = useReadContract({
    address: CONTRACT_ADDRESSES.energyTrading,
    abi: EnergyTradingABI,
    chainId: hardhatLocal.id,
    functionName: "getOffer",
    args: [offerId],
  });

  if (!offer) {
    return (
      <div className="panel p-4 animate-pulse h-36" />
    );
  }

  const o = offer as {
    id: bigint;
    seller: string;
    meterId: string;
    amount: bigint;
    pricePerWh: bigint;
    expiresAt: bigint;
    requestId: bigint;
    status: number;
  };

  const expiresIn = Number(o.expiresAt) - Math.floor(Date.now() / 1000);
  const validationState = ORACLE_STATUS_MAP[0] ?? "PENDING"; // simplified

  return (
    <div
      className="panel p-4 flex flex-col gap-3 hover:border-amber transition-colors cursor-default"
      style={{ borderColor: "var(--bg-border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
          #{offerId.toString()} · {o.meterId}
        </span>
        <ValidationBadge state={validationState} />
      </div>

      {/* Energy amount */}
      <div>
        <span className="font-display text-4xl" style={{ color: "var(--amber)" }}>
          {formatWh(o.amount)}
        </span>
      </div>

      {/* Price */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-sm" style={{ color: "var(--cyan)" }}>
          {formatEthPrice(o.pricePerWh)}
        </span>
        <span className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
          {t("perWh")}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: "var(--bg-border)" }}>
        <div className="flex flex-col gap-0.5">
          <AddressBadge address={o.seller} />
          <span className="font-data text-xs" style={{ color: expiresIn < 300 ? "var(--red)" : "var(--text-muted)" }}>
            {t("expires")} {formatCountdown(expiresIn)}
          </span>
        </div>

        <button
          onClick={onBuy}
          className="font-data text-xs px-3 py-1.5 rounded border transition-colors"
          style={{
            color: "var(--amber)",
            borderColor: "var(--amber)",
            background: "rgba(255,165,0,0.1)",
          }}
        >
          {t("buy")}
        </button>
      </div>
    </div>
  );
}
