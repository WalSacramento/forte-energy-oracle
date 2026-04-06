"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Gavel } from "lucide-react";
import { AuctionCard } from "@/components/auctions/AuctionCard";
import { useEnergyAuction } from "@/hooks/useEnergyAuction";

export function AuctionsPage() {
  const t = useTranslations("auctions");
  const { activeAuctions } = useEnergyAuction();
  const ids = activeAuctions ?? [];
  const [heroId, ...restIds] = ids;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Gavel className="size-5 text-primary" />
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          Track Dutch auctions in real time and act before the best price window closes.
        </p>
      </div>

      {ids.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-card/50 py-12 text-center">
          <span className="size-1.5 rounded-full bg-muted-foreground/40 dot-pulse" />
          <p className="font-mono text-sm text-muted-foreground">{t("noActiveAuctions")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              {t("featured")}
            </p>
            <Link href={`/auctions/${heroId}`} className="block transition-opacity hover:opacity-90">
              <AuctionCard auctionId={heroId} hero />
            </Link>
          </div>

          {restIds.length > 0 && (
            <div className="space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {t("allAuctions")}
              </p>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {restIds.map((id) => (
                  <Link key={id.toString()} href={`/auctions/${id}`} className="block transition-opacity hover:opacity-90">
                    <AuctionCard auctionId={id} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
