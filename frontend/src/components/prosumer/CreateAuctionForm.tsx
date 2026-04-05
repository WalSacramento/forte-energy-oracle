"use client";

import { useState, useMemo } from "react";
import { parseEther } from "viem";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import { useEnergyAuction } from "@/hooks/useEnergyAuction";
import { TxToast, type TxState } from "@/components/shared/TxToast";
import { waitForLocalTransaction } from "@/lib/transactions";

export function CreateAuctionForm() {
  const [meterId, setMeterId] = useState("METER001");
  const [energyAmount, setEnergyAmount] = useState("500");
  const [startPriceEth, setStartPriceEth] = useState("0.01");
  const [minPriceEth, setMinPriceEth] = useState("0.004");
  const [durationMin, setDurationMin] = useState("60");
  const [txState, setTxState] = useState<TxState>("idle");

  const { createAuction } = useEnergyAuction();

  // Build decay preview chart data
  const chartData = useMemo(() => {
    const startP = parseFloat(startPriceEth) || 0;
    const minP = parseFloat(minPriceEth) || 0;
    const dur = parseInt(durationMin) || 60;
    const points = 30;
    return Array.from({ length: points + 1 }, (_, i) => {
      const t = (i / points) * dur;
      const decayed = startP - (startP - minP) * (i / points);
      return { t: Math.round(t), price: Math.max(minP, decayed) };
    });
  }, [startPriceEth, minPriceEth, durationMin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxState("pending");
    try {
      const hash = await createAuction(
        meterId,
        BigInt(energyAmount),
        parseEther(startPriceEth),
        parseEther(minPriceEth),
        BigInt(parseInt(durationMin) * 60)
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-2xl">
        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label style={labelStyle}>Meter ID</label>
            <input style={inputStyle} value={meterId} onChange={(e) => setMeterId(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Energy Amount (Wh)</label>
            <input style={inputStyle} type="number" value={energyAmount} onChange={(e) => setEnergyAmount(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Start Price (ETH/Wh)</label>
            <input style={inputStyle} type="number" step="0.0001" value={startPriceEth} onChange={(e) => setStartPriceEth(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Min Price (ETH/Wh)</label>
            <input style={inputStyle} type="number" step="0.0001" value={minPriceEth} onChange={(e) => setMinPriceEth(e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>Duration (minutes)</label>
            <input style={inputStyle} type="number" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
          </div>
          <button
            type="submit"
            disabled={txState === "pending" || txState === "confirming"}
            className="font-data text-xs px-4 py-2 rounded border"
            style={{
              color: "var(--cyan)",
              borderColor: "var(--cyan)",
              background: "rgba(0,229,255,0.1)",
            }}
          >
            {txState === "pending" || txState === "confirming" ? "Processing..." : "Create Auction"}
          </button>
        </form>

        {/* Live decay preview */}
        <div>
          <p style={labelStyle}>Price Decay Preview</p>
          <div className="panel p-3" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
                <XAxis
                  dataKey="t"
                  tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-space)" }}
                  label={{ value: "min", position: "insideRight", fill: "var(--text-muted)", fontSize: 10 }}
                />
                <YAxis
                  tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-space)" }}
                />
                <Tooltip
                  contentStyle={{ background: "var(--bg-panel)", border: "1px solid var(--bg-border)", fontFamily: "var(--font-space)", fontSize: 10 }}
                  labelStyle={{ color: "var(--text-muted)" }}
                  itemStyle={{ color: "var(--cyan)" }}
                />
                <ReferenceLine y={parseFloat(minPriceEth) || 0} stroke="var(--red)" strokeDasharray="4 4" />
                <Line type="linear" dataKey="price" stroke="var(--cyan)" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <TxToast state={txState} onDismiss={() => setTxState("idle")} />
    </>
  );
}
