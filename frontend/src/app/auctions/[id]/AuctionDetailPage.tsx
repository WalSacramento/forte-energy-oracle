"use client";

import { useTranslations } from "next-intl";
import { AuctionDetail } from "@/components/auctions/AuctionDetail";

export function AuctionDetailPage({ auctionId }: { auctionId: bigint }) {
  const t = useTranslations("auctionDetail");

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t("title", { id: auctionId.toString() })}
        </h1>
        <p className="text-sm text-muted-foreground">
          Detailed auction pricing, validation status and bid actions.
        </p>
      </div>
      <AuctionDetail auctionId={auctionId} />
    </div>
  );
}
