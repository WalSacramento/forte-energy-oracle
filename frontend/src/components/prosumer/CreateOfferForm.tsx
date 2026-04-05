"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useEnergyTrading } from "@/hooks/useEnergyTrading";
import { TxToast, type TxState } from "@/components/shared/TxToast";
import { waitForLocalTransaction } from "@/lib/transactions";

export function CreateOfferForm() {
  const [meterId, setMeterId] = useState("METER001");
  const [amount, setAmount] = useState("1000");
  const [pricePerWh, setPricePerWh] = useState("0.0001");
  const [txState, setTxState] = useState<TxState>("idle");

  const { createOffer, isCreatingOffer } = useEnergyTrading();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("pending");
    try {
      const hash = await createOffer(
        meterId,
        BigInt(amount),
        parseEther(pricePerWh),
        0n // use default duration
      );

      setTxState("confirming");
      await waitForLocalTransaction(hash);
      setTxState("success");
    } catch {
      setTxState("error");
    }
  };

  const inputStyle = {
    background: "var(--bg-base)",
    border: "1px solid var(--bg-border)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-space)",
    fontSize: "0.75rem",
    padding: "6px 10px",
    borderRadius: "4px",
    width: "100%",
    outline: "none",
  };

  const labelStyle = {
    color: "var(--text-muted)",
    fontFamily: "var(--font-space)",
    fontSize: "0.7rem",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    display: "block",
    marginBottom: "4px",
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label style={labelStyle}>Meter ID</label>
          <input style={inputStyle} value={meterId} onChange={(e) => setMeterId(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Energy Amount (Wh)</label>
          <input style={inputStyle} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>Price per Wh (ETH)</label>
          <input style={inputStyle} type="number" step="0.00001" value={pricePerWh} onChange={(e) => setPricePerWh(e.target.value)} />
        </div>
        <button
          type="submit"
          disabled={isCreatingOffer || txState === "pending" || txState === "confirming"}
          className="font-data text-xs px-4 py-2 rounded border disabled:opacity-50"
          style={{
            color: "var(--amber)",
            borderColor: "var(--amber)",
            background: "rgba(255,165,0,0.1)",
          }}
        >
          {txState === "pending" || txState === "confirming" ? "Processing..." : "Create Offer"}
        </button>
      </form>
      <TxToast state={txState} onDismiss={() => setTxState("idle")} />
    </>
  );
}
