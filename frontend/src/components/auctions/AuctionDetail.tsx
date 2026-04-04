"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import { EnergyAuctionABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { hardhatLocal } from "@/lib/wagmi-config";
import { formatEth, formatEthPrice, formatWh } from "@/lib/formatters";
import { useDutchPrice } from "@/hooks/useDutchPrice";
import { useEnergyAuction } from "@/hooks/useEnergyAuction";
import { PriceDecayChart } from "./PriceDecayChart";
import { ValidationBadge } from "@/components/shared/ValidationBadge";
import { TxToast, type TxState } from "@/components/shared/TxToast";
import { motion } from "framer-motion";

const AUCTION_STATUS_LABELS = ["Active", "Pending Validation", "Finalized", "Cancelled"];

export function AuctionDetail({ auctionId }: { auctionId: bigint }) {
  const [txState, setTxState] = useState<TxState>("idle");
  const { placeBid, finalizeAuction } = useEnergyAuction();

  const { data: auction } = useReadContract({
    address: CONTRACT_ADDRESSES.energyAuction,
    abi: EnergyAuctionABI,
    chainId: hardhatLocal.id,
    functionName: "getAuction",
    args: [auctionId],
    query: { refetchInterval: 2000 },
  }) as {
    data: {
      id: bigint;
      seller: string;
      meterId: string;
      energyAmount: bigint;
      startPrice: bigint;
      minPrice: bigint;
      priceDecayRate: bigint;
      startTime: bigint;
      endTime: bigint;
      oracleRequestId: bigint;
      winner: string;
      finalPrice: bigint;
      status: number;
    } | undefined;
  };

  const { currentPrice, isExpired } = useDutchPrice({
    startPrice: auction?.startPrice ?? 0n,
    priceDecayRate: auction?.priceDecayRate ?? 0n,
    startTime: auction?.startTime ?? 0n,
    minPrice: auction?.minPrice ?? 0n,
    endTime: auction?.endTime ?? 0n,
  });

  if (!auction) {
    return <div className="panel p-6 animate-pulse h-64" />;
  }

  const totalCost = currentPrice * auction.energyAmount;
  const isActive = auction.status === 0;
  const isPendingValidation = auction.status === 1;

  const validationState = isPendingValidation
    ? "PENDING"
    : auction.status === 2
    ? "COMPLETED"
    : auction.status === 3
    ? "FAILED"
    : "PENDING";

  const handleBid = () => {
    setTxState("pending");
    placeBid(auctionId, totalCost);
    setTxState("confirming");
    setTimeout(() => setTxState("success"), 3000);
  };

  const handleFinalize = () => {
    setTxState("pending");
    finalizeAuction(auctionId);
    setTxState("confirming");
    setTimeout(() => setTxState("success"), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Chart */}
      <div className="panel p-4 space-y-2">
        <p className="font-data text-xs uppercase" style={{ color: "var(--text-muted)" }}>
          Price Decay
        </p>
        <PriceDecayChart
          startPrice={auction.startPrice}
          minPrice={auction.minPrice}
          priceDecayRate={auction.priceDecayRate}
          startTime={auction.startTime}
          endTime={auction.endTime}
          currentPrice={currentPrice}
        />
        <div className="flex justify-between font-data text-xs" style={{ color: "var(--text-muted)" }}>
          <span>Start: {formatEthPrice(auction.startPrice)}</span>
          <span style={{ color: "var(--red)" }}>Min: {formatEthPrice(auction.minPrice)}</span>
        </div>
      </div>

      {/* Right: Bid panel */}
      <div className="panel p-6 space-y-6">
        <div>
          <p className="font-data text-xs uppercase" style={{ color: "var(--text-muted)" }}>
            Current Price / Wh
          </p>
          <motion.span
            key={currentPrice.toString()}
            className="font-display block"
            style={{ fontSize: "56px", lineHeight: 1, color: "var(--cyan)" }}
            animate={{ scale: [1.02, 1] }}
            transition={{ duration: 0.2 }}
          >
            {formatEthPrice(currentPrice)}
          </motion.span>
        </div>

        <div className="space-y-2 font-data text-sm">
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>Energy</span>
            <span style={{ color: "var(--amber)" }}>{formatWh(auction.energyAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>Total Cost</span>
            <span style={{ color: "var(--text-primary)" }}>{formatEth(totalCost)}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>Status</span>
            <span>{AUCTION_STATUS_LABELS[auction.status]}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>Oracle</span>
            <ValidationBadge state={validationState} />
          </div>
        </div>

        <div className="space-y-2">
          {isActive && !isExpired && (
            <button
              onClick={handleBid}
              className="w-full font-data text-sm py-3 rounded border transition-colors"
              style={{
                color: "var(--cyan)",
                borderColor: "var(--cyan)",
                background: "rgba(0,229,255,0.1)",
              }}
            >
              Place Bid — {formatEth(totalCost)}
            </button>
          )}

          {isPendingValidation && (
            <button
              onClick={handleFinalize}
              className="w-full font-data text-sm py-3 rounded border"
              style={{
                color: "var(--emerald)",
                borderColor: "var(--emerald)",
                background: "rgba(0,230,118,0.1)",
              }}
            >
              Finalize Auction
            </button>
          )}

          {isExpired && isActive && (
            <p className="font-data text-xs text-center" style={{ color: "var(--text-muted)" }}>
              Auction expired — seller can cancel
            </p>
          )}
        </div>
      </div>

      <TxToast state={txState} onDismiss={() => setTxState("idle")} />
    </div>
  );
}
