"use client";

import { useState } from "react";
import { useWatchContractEvent } from "wagmi";
import { useTranslations } from "next-intl";
import { EnergyTradingABI, EnergyAuctionABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { hardhatLocal } from "@/lib/wagmi-config";
import { formatTimestamp } from "@/lib/formatters";

interface FeedEvent {
  id: string;
  type: string;
  description: string;
  color: string;
  timestamp: number;
}

export function ActivityFeed() {
  const t = useTranslations("activityFeed");
  const [events, setEvents] = useState<FeedEvent[]>([]);

  const addEvent = (e: Omit<FeedEvent, "id">) => {
    setEvents((prev) => [
      { ...e, id: `${Date.now()}-${Math.random()}` },
      ...prev.slice(0, 49),
    ]);
  };

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.energyTrading,
    abi: EnergyTradingABI,
    chainId: hardhatLocal.id,
    eventName: "OfferCreated",
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = (log as { args?: Record<string, unknown> }).args ?? {};
        addEvent({
          type: "OFFER_CREATED",
          description: t("offerCreated", { id: String(args.offerId ?? "?"), amount: String(args.amount ?? "?") }),
          color: "var(--amber)",
          timestamp: Date.now(),
        });
      });
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.energyTrading,
    abi: EnergyTradingABI,
    chainId: hardhatLocal.id,
    eventName: "TradeExecuted",
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = (log as { args?: Record<string, unknown> }).args ?? {};
        addEvent({
          type: "TRADE",
          description: t("tradeExecuted", { id: String(args.tradeId ?? "?"), amount: String(args.amount ?? "?") }),
          color: "var(--emerald)",
          timestamp: Date.now(),
        });
      });
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.energyAuction,
    abi: EnergyAuctionABI,
    chainId: hardhatLocal.id,
    eventName: "AuctionCreated",
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = (log as { args?: Record<string, unknown> }).args ?? {};
        addEvent({
          type: "AUCTION",
          description: t("auctionCreated", { id: String(args.auctionId ?? "?"), amount: String(args.energyAmount ?? "?") }),
          color: "var(--cyan)",
          timestamp: Date.now(),
        });
      });
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.energyAuction,
    abi: EnergyAuctionABI,
    chainId: hardhatLocal.id,
    eventName: "BidAccepted",
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = (log as { args?: Record<string, unknown> }).args ?? {};
        addEvent({
          type: "BID",
          description: t("bidAccepted", { id: String(args.auctionId ?? "?") }),
          color: "var(--cyan)",
          timestamp: Date.now(),
        });
      });
    },
  });

  return (
    <div className="panel p-4 h-64 overflow-y-auto">
      <p className="font-data text-xs mb-3 uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        {t("liveActivity")}
      </p>

      {events.length === 0 ? (
        <p className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
          {t("waiting")}
        </p>
      ) : (
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-2">
              <span
                className="w-1.5 h-1.5 rounded-full mt-1 shrink-0"
                style={{ background: e.color }}
              />
              <div className="flex-1 min-w-0">
                <span
                  className="font-data text-xs block truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {e.description}
                </span>
                <span className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
                  {formatTimestamp(Math.floor(e.timestamp / 1000))}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
