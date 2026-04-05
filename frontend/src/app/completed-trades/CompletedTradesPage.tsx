"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import { useCompletedTrades } from "@/hooks/useCompletedTrades";
import { formatEth, formatTimestamp, formatWh, truncateAddress } from "@/lib/formatters";
import type { CompletedTradeFilter } from "@/lib/completed-trades";

export function CompletedTradesPage() {
  const t = useTranslations("completedTrades");
  const { address, isConnected } = useAccount();
  const [filter, setFilter] = useState<CompletedTradeFilter>("all");
  const { data: trades = [], isLoading } = useCompletedTrades();

  const filteredTrades = useMemo(() => {
    if (!address || filter === "all") {
      return trades;
    }

    const normalizedAddress = address.toLowerCase();

    if (filter === "purchases") {
      return trades.filter((trade) => trade.buyer.toLowerCase() === normalizedAddress);
    }

    return trades.filter((trade) => trade.seller.toLowerCase() === normalizedAddress);
  }, [address, filter, trades]);

  const filterStyle = (active: boolean) => ({
    color: active ? "var(--cyan)" : "var(--text-muted)",
    borderColor: active ? "var(--cyan)" : "var(--bg-border)",
    background: active ? "rgba(0,229,255,0.08)" : "transparent",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl" style={{ color: "var(--emerald)" }}>
            {t("title")}
          </h1>
          <p className="font-data text-sm" style={{ color: "var(--text-muted)" }}>
            {t("subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFilter("all")}
            className="font-data text-xs px-3 py-1.5 rounded border transition-colors"
            style={filterStyle(filter === "all")}
          >
            {t("allTrades")}
          </button>
          <button
            onClick={() => setFilter("purchases")}
            disabled={!isConnected}
            className="font-data text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-40"
            style={filterStyle(filter === "purchases")}
          >
            {t("myPurchases")}
          </button>
          <button
            onClick={() => setFilter("sales")}
            disabled={!isConnected}
            className="font-data text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-40"
            style={filterStyle(filter === "sales")}
          >
            {t("mySales")}
          </button>
        </div>
      </div>

      {!isConnected && (
        <div className="panel p-4">
          <p className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
            {t("connectWalletHint")}
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="panel p-6">
          <p className="font-data text-sm" style={{ color: "var(--text-muted)" }}>
            {t("loading")}
          </p>
        </div>
      ) : filteredTrades.length === 0 ? (
        <div className="panel p-6 space-y-3">
          <p className="font-data text-sm" style={{ color: "var(--text-muted)" }}>
            {t("noTrades")}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/marketplace"
              className="font-data text-xs px-3 py-1.5 rounded border transition-colors"
              style={{
                color: "var(--amber)",
                borderColor: "var(--amber)",
                background: "rgba(245,158,11,0.08)",
              }}
            >
              {t("goToMarketplace")}
            </Link>
            <Link
              href="/auctions"
              className="font-data text-xs px-3 py-1.5 rounded border transition-colors"
              style={{
                color: "var(--cyan)",
                borderColor: "var(--cyan)",
                background: "rgba(0,229,255,0.08)",
              }}
            >
              {t("goToAuctions")}
            </Link>
          </div>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full font-data text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--bg-border)", color: "var(--text-muted)" }}>
                <th className="text-left p-3">{t("colType")}</th>
                <th className="text-left p-3">{t("colRef")}</th>
                <th className="text-left p-3">{t("colMeter")}</th>
                <th className="text-right p-3">{t("colEnergy")}</th>
                <th className="text-right p-3">{t("colTotal")}</th>
                <th className="text-left p-3">{t("colBuyer")}</th>
                <th className="text-left p-3">{t("colSeller")}</th>
                <th className="text-left p-3">{t("colTime")}</th>
                <th className="text-left p-3">{t("colTx")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((trade) => (
                <tr key={trade.id} style={{ borderBottom: "1px solid var(--bg-border)" }}>
                  <td className="p-3">
                    <span style={{ color: trade.source === "auction" ? "var(--cyan)" : "var(--amber)" }}>
                      {trade.source === "auction" ? t("typeAuction") : t("typeOffer")}
                    </span>
                  </td>
                  <td className="p-3">#{trade.referenceId}</td>
                  <td className="p-3">{trade.meterId || "—"}</td>
                  <td className="p-3 text-right">{formatWh(BigInt(trade.energyAmount))}</td>
                  <td className="p-3 text-right" style={{ color: "var(--emerald)" }}>
                    {formatEth(BigInt(trade.totalPriceWei))}
                  </td>
                  <td className="p-3">{truncateAddress(trade.buyer)}</td>
                  <td className="p-3">{truncateAddress(trade.seller)}</td>
                  <td className="p-3">{formatTimestamp(trade.timestamp)}</td>
                  <td className="p-3">
                    <span title={trade.txHash}>{truncateAddress(trade.txHash, 6)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
