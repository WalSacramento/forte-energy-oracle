"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { BuyModal } from "@/components/marketplace/BuyModal";
import { Button } from "@/components/ui/button";
import { useEnergyTrading } from "@/hooks/useEnergyTrading";

export function MarketplacePage() {
  const t = useTranslations("marketplace");
  const { activeOffers } = useEnergyTrading();
  const [selectedOffer, setSelectedOffer] = useState<bigint | null>(null);

  const offerIds = activeOffers ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-primary" />
            <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Browse validated offers and execute purchases with on-chain confirmation.
          </p>
        </div>
        <Button variant="outline" size="sm" render={<Link href="/completed-trades" />}>
          {t("viewCompletedTrades")}
        </Button>
      </div>

      {offerIds.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/60 bg-card/50 py-12 text-center">
          <span className="size-1.5 rounded-full bg-muted-foreground/40 dot-pulse" />
          <p className="font-mono text-sm text-muted-foreground">{t("noActiveOffers")}</p>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 font-mono text-xs text-primary"
            render={<Link href="/completed-trades" />}
          >
            {t("checkRecentTrades")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {offerIds.map((id) => (
            <OfferCard
              key={id.toString()}
              offerId={id}
              onBuy={() => setSelectedOffer(id)}
            />
          ))}
        </div>
      )}

      {selectedOffer !== null ? (
        <BuyModal
          offerId={selectedOffer}
          open={selectedOffer !== null}
          onClose={() => setSelectedOffer(null)}
        />
      ) : null}
    </div>
  );
}
