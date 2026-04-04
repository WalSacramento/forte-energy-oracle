"use client";

import { useAccount, useReadContract } from "wagmi";
import { EnergyTradingABI, EnergyAuctionABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { hardhatLocal } from "@/lib/wagmi-config";

const OFFER_STEPS = ["Created", "Oracle Pending", "Active", "Filled / Cancelled"];
const AUCTION_STEPS = ["Created", "Active", "Bid Received", "Finalized"];

function ProgressBar({ steps, currentStep }: { steps: string[]; currentStep: number }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={step} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: done ? "var(--emerald)" : active ? "var(--cyan)" : "var(--bg-border)",
                }}
              />
              <span className="font-data text-[9px] mt-0.5 whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className="flex-1 h-px mx-1"
                style={{ background: done ? "var(--emerald)" : "var(--bg-border)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PositionTimeline() {
  const { address } = useAccount();

  const { data: sellerOfferIds } = useReadContract({
    address: CONTRACT_ADDRESSES.energyTrading,
    abi: EnergyTradingABI,
    chainId: hardhatLocal.id,
    functionName: "getSellerOffers",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  }) as { data: bigint[] | undefined };

  const { data: sellerAuctionIds } = useReadContract({
    address: CONTRACT_ADDRESSES.energyAuction,
    abi: EnergyAuctionABI,
    chainId: hardhatLocal.id,
    functionName: "getSellerAuctions",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  }) as { data: bigint[] | undefined };

  const hasItems = (sellerOfferIds?.length ?? 0) + (sellerAuctionIds?.length ?? 0) > 0;

  if (!address) {
    return <p className="font-data text-xs" style={{ color: "var(--text-muted)" }}>Connect wallet to see positions.</p>;
  }

  if (!hasItems) {
    return <p className="font-data text-xs" style={{ color: "var(--text-muted)" }}>No positions yet.</p>;
  }

  return (
    <div className="space-y-3">
      {sellerOfferIds?.map((id) => (
        <div key={id.toString()} className="panel p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-data text-xs" style={{ color: "var(--amber)" }}>
              OFFER #{id.toString()}
            </span>
          </div>
          <ProgressBar steps={OFFER_STEPS} currentStep={1} />
        </div>
      ))}

      {sellerAuctionIds?.map((id) => (
        <div key={id.toString()} className="panel p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="font-data text-xs" style={{ color: "var(--cyan)" }}>
              AUCTION #{id.toString()}
            </span>
          </div>
          <ProgressBar steps={AUCTION_STEPS} currentStep={1} />
        </div>
      ))}
    </div>
  );
}
