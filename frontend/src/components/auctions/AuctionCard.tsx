"use client";

import { useReadContract } from "wagmi";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { EnergyAuctionABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { hardhatLocal } from "@/lib/wagmi-config";
import { formatWh, formatEthPrice, formatEth, formatCountdown } from "@/lib/formatters";
import { useDutchPrice } from "@/hooks/useDutchPrice";

interface AuctionCardProps {
  auctionId: bigint;
  hero?: boolean;
}

export function AuctionCard({ auctionId, hero = false }: AuctionCardProps) {
  const t = useTranslations("auctionCard");
  const { data: auction } = useReadContract({
    address: CONTRACT_ADDRESSES.energyAuction,
    abi: EnergyAuctionABI,
    chainId: hardhatLocal.id,
    functionName: "getAuction",
    args: [auctionId],
  }) as {
    data: {
      id: bigint;
      seller: string;
      energyAmount: bigint;
      startPrice: bigint;
      minPrice: bigint;
      priceDecayRate: bigint;
      startTime: bigint;
      endTime: bigint;
      status: number;
    } | undefined;
  };

  const { currentPrice, percentDecayed, isExpired } = useDutchPrice({
    startPrice: auction?.startPrice ?? 0n,
    priceDecayRate: auction?.priceDecayRate ?? 0n,
    startTime: auction?.startTime ?? 0n,
    minPrice: auction?.minPrice ?? 0n,
    endTime: auction?.endTime ?? 0n,
  });

  if (!auction) {
    return <div className="panel p-4 animate-pulse" style={{ height: hero ? 200 : 140 }} />;
  }

  const expiresIn = Number(auction.endTime) - Math.floor(Date.now() / 1000);
  const totalCost = currentPrice * auction.energyAmount;

  // Color: interpolate from cyan → amber → red as price decays
  const priceColor = percentDecayed > 70
    ? "var(--red)"
    : percentDecayed > 40
    ? "var(--amber)"
    : "var(--cyan)";

  return (
    <div
      className="panel p-4 flex flex-col gap-3 transition-colors"
      style={{ borderColor: isExpired ? "var(--text-muted)" : "var(--cyan)33" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
          #{auctionId.toString()} · {auction.energyAmount ? formatWh(auction.energyAmount) : "—"}
        </span>
        <span className="font-data text-xs" style={{ color: expiresIn < 60 ? "var(--red)" : "var(--text-muted)" }}>
          {formatCountdown(expiresIn)}
        </span>
      </div>

      {/* Current Price — big Bebas Neue number with Framer Motion pulse */}
      <div>
        <span className="font-data text-xs block mb-1" style={{ color: "var(--text-muted)" }}>
          {t("currentPricePerWh")}
        </span>
        <motion.span
          key={currentPrice.toString()}
          className="font-display block"
          style={{
            fontSize: hero ? "72px" : "40px",
            lineHeight: 1,
            color: priceColor,
          }}
          animate={{ scale: [1.03, 1] }}
          transition={{ duration: 0.2 }}
        >
          {formatEthPrice(currentPrice)}
        </motion.span>
      </div>

      {/* Decay bar */}
      <div>
        <div
          className="h-1 rounded-full overflow-hidden"
          style={{ background: "var(--bg-border)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{
              width: `${percentDecayed}%`,
              background: priceColor,
            }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
            {formatEthPrice(auction.startPrice)}
          </span>
          <span className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
            {formatEthPrice(auction.minPrice)}
          </span>
        </div>
      </div>

      {/* Total cost */}
      <div className="flex items-center justify-between">
        <span className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
          {t("total")} <span style={{ color: "var(--text-primary)" }}>{formatEth(totalCost)}</span>
        </span>
      </div>
    </div>
  );
}
