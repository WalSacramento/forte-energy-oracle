"use client";

import { AuctionDetail } from "@/components/auctions/AuctionDetail";

export function AuctionDetailPage({ auctionId }: { auctionId: bigint }) {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl" style={{ color: "var(--cyan)" }}>
        AUCTION #{auctionId.toString()}
      </h1>
      <AuctionDetail auctionId={auctionId} />
    </div>
  );
}
