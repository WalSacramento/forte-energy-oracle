"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEnergyAuction } from "@/hooks/useEnergyAuction";
import { AuctionCard } from "@/components/auctions/AuctionCard";

export function AuctionsPage() {
  const t = useTranslations("auctions");
  const { activeAuctions } = useEnergyAuction();
  const ids = activeAuctions ?? [];

  const [heroId, ...restIds] = ids;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl" style={{ color: "var(--cyan)" }}>
        {t("title")}
      </h1>

      {ids.length === 0 ? (
        <p className="font-data text-sm" style={{ color: "var(--text-muted)" }}>
          {t("noActiveAuctions")}
        </p>
      ) : (
        <>
          {/* Hero — most urgent auction */}
          <div>
            <p className="font-data text-xs mb-2" style={{ color: "var(--text-muted)" }}>
              {t("featured")}
            </p>
            <Link href={`/auctions/${heroId}`}>
              <AuctionCard auctionId={heroId} hero />
            </Link>
          </div>

          {restIds.length > 0 && (
            <>
              <p className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
                {t("allAuctions")}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {restIds.map((id) => (
                  <Link key={id.toString()} href={`/auctions/${id}`}>
                    <AuctionCard auctionId={id} />
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
