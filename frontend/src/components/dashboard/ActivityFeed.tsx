"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useWatchContractEvent } from "wagmi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EnergyAuctionABI, EnergyTradingABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { formatTimestamp } from "@/lib/formatters";
import { hardhatLocal } from "@/lib/wagmi-config";

interface FeedEvent {
  id: string;
  description: string;
  timestamp: number;
  borderClass: string;
  dotClass: string;
}

export function ActivityFeed() {
  const t = useTranslations("activityFeed");
  const [events, setEvents] = useState<FeedEvent[]>([]);

  const addEvent = (event: Omit<FeedEvent, "id">) => {
    setEvents((current) => [
      { ...event, id: `${Date.now()}-${Math.random()}` },
      ...current.slice(0, 49),
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
          description: t("offerCreated", {
            id: String(args.offerId ?? "?"),
            amount: String(args.amount ?? "?"),
          }),
          timestamp: Date.now(),
          borderClass: "border-l-primary/60",
          dotClass: "bg-primary",
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
          description: t("tradeExecuted", {
            id: String(args.tradeId ?? "?"),
            amount: String(args.amount ?? "?"),
          }),
          timestamp: Date.now(),
          borderClass: "border-l-market-up/60",
          dotClass: "bg-market-up",
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
          description: t("auctionCreated", {
            id: String(args.auctionId ?? "?"),
            amount: String(args.energyAmount ?? "?"),
          }),
          timestamp: Date.now(),
          borderClass: "border-l-secondary/60",
          dotClass: "bg-secondary",
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
          description: t("bidAccepted", { id: String(args.auctionId ?? "?") }),
          timestamp: Date.now(),
          borderClass: "border-l-chart-4/60",
          dotClass: "bg-chart-4",
        });
      });
    },
  });

  return (
    <Card className="h-full card-accent-cyan">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-sm font-semibold uppercase tracking-wider">
          {t("liveActivity")}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <ScrollArea className="h-64 pr-3">
          {events.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-8">
              <span className="size-1.5 rounded-full bg-muted-foreground/40 dot-pulse" />
              <p className="font-mono text-xs text-muted-foreground">{t("waiting")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-0.5">
              {events.map((event) => (
                <div
                  key={event.id}
                  className={`flex items-center justify-between gap-3 border-l-2 py-2 pl-3 animate-fade-in-up ${event.borderClass}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`size-1.5 shrink-0 rounded-full ${event.dotClass}`} />
                    <p className="truncate text-xs text-foreground/80">{event.description}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground/60">
                    {formatTimestamp(Math.floor(event.timestamp / 1000))}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
