"use client";

import { useState } from "react";
import { useWatchContractEvent } from "wagmi";
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
          description: `Offer #${args.offerId ?? "?"} created — ${args.amount ?? "?"} Wh`,
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
          description: `Trade #${args.tradeId ?? "?"} — ${args.amount ?? "?"} Wh`,
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
          description: `Auction #${args.auctionId ?? "?"} created — ${args.energyAmount ?? "?"} Wh`,
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
          description: `Bid on Auction #${args.auctionId ?? "?"}`,
          color: "var(--cyan)",
          timestamp: Date.now(),
        });
      });
    },
  });

  return (
    <div className="panel p-4 h-64 overflow-y-auto">
      <p className="font-data text-xs mb-3 uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        Live Activity
      </p>

      {events.length === 0 ? (
        <p className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
          Waiting for events…
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
