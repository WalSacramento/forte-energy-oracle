"use client";

import { useTranslations } from "next-intl";
import { AuctionDetail } from "@/components/auctions/AuctionDetail";

export function AuctionDetailPage({ auctionId }: { auctionId: bigint }) {
  const t = useTranslations("auctionDetail");
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl" style={{ color: "var(--cyan)" }}>
        {t("title", { id: auctionId.toString() })}
      </h1>
      <AuctionDetail auctionId={auctionId} />
    </div>
  );
}
