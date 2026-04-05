"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useEnergyTrading } from "@/hooks/useEnergyTrading";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { BuyModal } from "@/components/marketplace/BuyModal";

export function MarketplacePage() {
  const t = useTranslations("marketplace");
  const { activeOffers } = useEnergyTrading();
  const [selectedOffer, setSelectedOffer] = useState<bigint | null>(null);

  const offerIds = activeOffers ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-display text-3xl" style={{ color: "var(--amber)" }}>
          {t("title")}
        </h1>
        <Link
          href="/completed-trades"
          className="font-data text-xs px-3 py-1.5 rounded border transition-colors"
          style={{
            color: "var(--emerald)",
            borderColor: "var(--emerald)",
            background: "rgba(16,185,129,0.08)",
          }}
        >
          {t("viewCompletedTrades")}
        </Link>
      </div>

      {offerIds.length === 0 ? (
        <div className="space-y-2">
          <p className="font-data text-sm" style={{ color: "var(--text-muted)" }}>
            {t("noActiveOffers")}
          </p>
          <Link
            href="/completed-trades"
            className="inline-flex font-data text-xs px-3 py-1.5 rounded border transition-colors"
            style={{
              color: "var(--emerald)",
              borderColor: "var(--emerald)",
              background: "rgba(16,185,129,0.08)",
            }}
          >
            {t("checkRecentTrades")}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {offerIds.map((id) => (
            <OfferCard
              key={id.toString()}
              offerId={id}
              onBuy={() => setSelectedOffer(id)}
            />
          ))}
        </div>
      )}

      {selectedOffer !== null && (
        <BuyModal
          offerId={selectedOffer}
          onClose={() => setSelectedOffer(null)}
        />
      )}
    </div>
  );
}
