"use client";

import { useState } from "react";
import { useReadContract } from "wagmi";
import { EnergyTradingABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { hardhatLocal } from "@/lib/wagmi-config";
import { formatEth, formatWh } from "@/lib/formatters";
import { useEnergyTrading } from "@/hooks/useEnergyTrading";
import { TxToast, type TxState } from "@/components/shared/TxToast";

interface BuyModalProps {
  offerId: bigint;
  onClose: () => void;
}

export function BuyModal({ offerId, onClose }: BuyModalProps) {
  const [txState, setTxState] = useState<TxState>("idle");
  const { acceptOffer, isAcceptingOffer } = useEnergyTrading();

  const { data: offer } = useReadContract({
    address: CONTRACT_ADDRESSES.energyTrading,
    abi: EnergyTradingABI,
    chainId: hardhatLocal.id,
    functionName: "getOffer",
    args: [offerId],
  });

  const o = offer as { amount: bigint; pricePerWh: bigint } | undefined;
  const totalCost = o ? o.amount * o.pricePerWh : 0n;

  const handleConfirm = async () => {
    if (!o) return;
    setTxState("pending");
    try {
      acceptOffer(offerId, totalCost);
      setTxState("confirming");
      // Optimistically close after a short delay
      setTimeout(() => {
        setTxState("success");
        setTimeout(onClose, 2000);
      }, 2000);
    } catch {
      setTxState("error");
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 panel p-6 w-80 space-y-4"
        style={{ borderColor: "var(--amber)" }}
      >
        <h2 className="font-display text-2xl" style={{ color: "var(--amber)" }}>
          BUY ENERGY
        </h2>

        {o && (
          <div className="space-y-2 font-data text-sm">
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Amount</span>
              <span style={{ color: "var(--text-primary)" }}>{formatWh(o.amount)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Total Cost</span>
              <span style={{ color: "var(--cyan)" }}>{formatEth(totalCost)}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: "var(--text-muted)" }}>Est. Gas</span>
              <span style={{ color: "var(--text-muted)" }}>~80,000</span>
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 font-data text-xs py-2 rounded border"
            style={{ borderColor: "var(--bg-border)", color: "var(--text-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isAcceptingOffer || txState === "pending" || txState === "confirming"}
            className="flex-1 font-data text-xs py-2 rounded border disabled:opacity-50"
            style={{
              borderColor: "var(--amber)",
              color: "var(--amber)",
              background: "rgba(255,165,0,0.1)",
            }}
          >
            {txState === "pending" || txState === "confirming" ? "Processing…" : "Confirm"}
          </button>
        </div>
      </div>

      <TxToast state={txState} onDismiss={() => setTxState("idle")} />
    </>
  );
}
