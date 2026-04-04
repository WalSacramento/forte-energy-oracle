"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceDot, ResponsiveContainer,
} from "recharts";

interface PriceDecayChartProps {
  startPrice: bigint;
  minPrice: bigint;
  priceDecayRate: bigint;
  startTime: bigint;
  endTime: bigint;
  currentPrice: bigint;
}

export function PriceDecayChart({
  startPrice,
  minPrice,
  priceDecayRate,
  startTime,
  endTime,
  currentPrice,
}: PriceDecayChartProps) {
  const durationS = Number(endTime - startTime);
  const POINTS = 60;

  const data = Array.from({ length: POINTS + 1 }, (_, i) => {
    const elapsed = (i / POINTS) * durationS;
    const decay = BigInt(Math.floor(elapsed)) * priceDecayRate;
    const price = decay >= startPrice - minPrice ? minPrice : startPrice - decay;
    return {
      t: Math.round(elapsed / 60), // minutes
      price: Number(price) / 1e18,
    };
  });

  const nowS = Math.floor(Date.now() / 1000);
  const elapsedS = Math.max(0, nowS - Number(startTime));
  const currentT = Math.min(elapsedS / 60, durationS / 60);
  const currentPriceEth = Number(currentPrice) / 1e18;
  const minPriceEth = Number(minPrice) / 1e18;

  return (
    <div style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" />
          <XAxis
            dataKey="t"
            tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-space)" }}
            label={{ value: "min", position: "insideBottomRight", fill: "var(--text-muted)", fontSize: 10 }}
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 10, fontFamily: "var(--font-space)" }}
            tickFormatter={(v: number) => v.toFixed(4)}
          />
          <Tooltip
            contentStyle={{
              background: "var(--bg-panel)",
              border: "1px solid var(--bg-border)",
              fontFamily: "var(--font-space)",
              fontSize: 10,
            }}
            labelStyle={{ color: "var(--text-muted)" }}
            itemStyle={{ color: "var(--cyan)" }}
            formatter={(v: number) => [`${v.toFixed(6)} ETH`, "Price/Wh"]}
          />
          {/* Min price reference line */}
          <ReferenceLine y={minPriceEth} stroke="var(--red)" strokeDasharray="4 4" />
          <Area
            type="linear"
            dataKey="price"
            stroke="var(--cyan)"
            fill="rgba(0,229,255,0.15)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {/* Animated dot at current position */}
          <ReferenceDot
            x={Math.round(currentT)}
            y={currentPriceEth}
            r={5}
            fill="var(--cyan)"
            stroke="var(--bg-base)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
