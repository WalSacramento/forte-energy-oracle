"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import { ReceiptText } from "lucide-react";
import { AddressBadge } from "@/components/shared/AddressBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCompletedTrades } from "@/hooks/useCompletedTrades";
import { formatEth, formatTimestamp, formatWh } from "@/lib/formatters";
import type { CompletedTradeFilter, CompletedTradeView } from "@/lib/completed-trades";

function TradesTable({
  trades,
  t,
}: {
  trades: CompletedTradeView[];
  t: ReturnType<typeof useTranslations<"completedTrades">>;
}) {
  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <p className="font-mono text-xs text-muted-foreground">{t("noTrades")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20 hover:bg-muted/20">
            <TableHead className="font-mono text-[10px] uppercase tracking-wider">{t("colType")}</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider">{t("colRef")}</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider">{t("colMeter")}</TableHead>
            <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider">{t("colEnergy")}</TableHead>
            <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider">{t("colTotal")}</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider">{t("colBuyer")}</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider">{t("colSeller")}</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider">{t("colTime")}</TableHead>
            <TableHead className="font-mono text-[10px] uppercase tracking-wider">{t("colTx")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="divide-y divide-border">
          {trades.map((trade) => (
            <TableRow key={trade.id} className="hover:bg-muted/10">
              <TableCell>
                <span
                  className={
                    trade.source === "auction"
                      ? "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium bg-primary/10 text-primary"
                      : "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium bg-secondary/10 text-secondary"
                  }
                >
                  {trade.source === "auction" ? t("typeAuction") : t("typeOffer")}
                </span>
              </TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">#{trade.referenceId}</TableCell>
              <TableCell className="font-mono text-xs">{trade.meterId || "—"}</TableCell>
              <TableCell className="text-right font-mono text-xs">
                {formatWh(BigInt(trade.energyAmount))}
              </TableCell>
              <TableCell className="text-right font-mono text-xs font-semibold text-market-up">
                {formatEth(BigInt(trade.totalPriceWei))}
              </TableCell>
              <TableCell><AddressBadge address={trade.buyer} /></TableCell>
              <TableCell><AddressBadge address={trade.seller} /></TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">
                {formatTimestamp(trade.timestamp)}
              </TableCell>
              <TableCell><AddressBadge address={trade.txHash} chars={6} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CompletedTradesPage() {
  const t = useTranslations("completedTrades");
  const { address, isConnected } = useAccount();
  const { data: trades = [], isLoading } = useCompletedTrades();

  const groupedTrades = useMemo(() => {
    const normalizedAddress = address?.toLowerCase();

    const byFilter = (filter: CompletedTradeFilter) => {
      if (!normalizedAddress || filter === "all") return trades;
      if (filter === "purchases") {
        return trades.filter((trade) => trade.buyer.toLowerCase() === normalizedAddress);
      }
      return trades.filter((trade) => trade.seller.toLowerCase() === normalizedAddress);
    };

    return {
      all: byFilter("all"),
      purchases: byFilter("purchases"),
      sales: byFilter("sales"),
    };
  }, [address, trades]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ReceiptText className="size-5 text-primary" />
            <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" render={<Link href="/marketplace" />}>
            {t("goToMarketplace")}
          </Button>
          <Button variant="outline" size="sm" render={<Link href="/auctions" />}>
            {t("goToAuctions")}
          </Button>
        </div>
      </div>

      {!isConnected && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 font-mono text-xs text-muted-foreground">
          {t("connectWalletHint")}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col items-center gap-2 py-10">
          <span className="size-1.5 rounded-full bg-muted-foreground/40 dot-pulse" />
          <p className="font-mono text-xs text-muted-foreground">{t("loading")}</p>
        </div>
      ) : (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="border-b border-border bg-transparent p-0">
            {(["all", "purchases", "sales"] as const).map((tab) => (
              <TabsTrigger
                key={tab}
                value={tab}
                className="rounded-none border-b-2 border-transparent px-4 pb-2 font-mono text-xs uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent"
              >
                {tab === "all" ? t("allTrades") : tab === "purchases" ? t("myPurchases") : t("mySales")}
                {tab !== "all" && (
                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                    ({groupedTrades[tab].length})
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all">
            <TradesTable trades={groupedTrades.all} t={t} />
          </TabsContent>
          <TabsContent value="purchases">
            <TradesTable trades={groupedTrades.purchases} t={t} />
          </TabsContent>
          <TabsContent value="sales">
            <TradesTable trades={groupedTrades.sales} t={t} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
