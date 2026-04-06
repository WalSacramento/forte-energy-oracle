"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslations } from "next-intl";

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
  const t = useTranslations("priceDecayChart");
  const durationS = Number(endTime - startTime);
  const points = 60;

  const data = Array.from({ length: points + 1 }, (_, index) => {
    const elapsed = (index / points) * durationS;
    const decay = BigInt(Math.floor(elapsed)) * priceDecayRate;
    const price = decay >= startPrice - minPrice ? minPrice : startPrice - decay;

    return {
      minute: Math.round(elapsed / 60),
      price: Number(price) / 1e18,
    };
  });

  const nowS = Math.floor(Date.now() / 1000);
  const elapsedS = Math.max(0, nowS - Number(startTime));
  const currentMinute = Math.min(elapsedS / 60, durationS / 60);
  const currentPriceEth = Number(currentPrice) / 1e18;
  const minPriceEth = Number(minPrice) / 1e18;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" />
          <XAxis
            dataKey="minute"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            label={{
              value: t("minutes"),
              position: "insideBottomRight",
              fill: "hsl(var(--muted-foreground))",
              fontSize: 12,
            }}
          />
          <YAxis
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            tickFormatter={(value: number) => value.toFixed(4)}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 12,
            }}
            formatter={(value) => [`${Number(value ?? 0).toFixed(6)} ETH`, t("pricePerWh")]}
          />
          <ReferenceLine
            y={minPriceEth}
            stroke="hsl(var(--chart-2))"
            strokeDasharray="4 4"
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="hsl(var(--chart-1))"
            fill="hsl(var(--chart-1))"
            fillOpacity={0.18}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <ReferenceDot
            x={Math.round(currentMinute)}
            y={currentPriceEth}
            r={5}
            fill="hsl(var(--chart-2))"
            stroke="hsl(var(--background))"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
