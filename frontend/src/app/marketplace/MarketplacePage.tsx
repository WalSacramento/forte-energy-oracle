"use client";

import { useState } from "react";
import { useEnergyTrading } from "@/hooks/useEnergyTrading";
import { OfferCard } from "@/components/marketplace/OfferCard";
import { BuyModal } from "@/components/marketplace/BuyModal";

export function MarketplacePage() {
  const { activeOffers } = useEnergyTrading();
  const [selectedOffer, setSelectedOffer] = useState<bigint | null>(null);

  const offerIds = activeOffers ?? [];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl" style={{ color: "var(--amber)" }}>
        ENERGY MARKETPLACE
      </h1>

      {offerIds.length === 0 ? (
        <p className="font-data text-sm" style={{ color: "var(--text-muted)" }}>
          No active offers. Sellers can create offers in the Prosumer panel.
        </p>
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
