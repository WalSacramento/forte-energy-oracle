"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { LiveNumber } from "@/components/shared/LiveNumber";
import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  unit?: string;
  sparkData?: number[];
  accentColor?: "amber" | "cyan" | "emerald" | "gray";
}

const accentMap = {
  amber:   "card-accent-amber",
  cyan:    "card-accent-cyan",
  emerald: "card-accent-emerald",
  gray:    "card-accent-gray",
};

const chartColorMap = {
  amber:   "hsl(38 92% 52%)",
  cyan:    "hsl(192 90% 48%)",
  emerald: "hsl(158 64% 48%)",
  gray:    "hsl(var(--muted-foreground))",
};

export function StatCard({ label, value, unit, sparkData, accentColor = "amber" }: StatCardProps) {
  const chartData = (sparkData ?? [Number(value) || 0]).map((item, index) => ({
    index,
    value: Number(item),
  }));

  const chartColor = chartColorMap[accentColor];

  return (
    <Card className={cn("h-full overflow-hidden", accentMap[accentColor])}>
      <CardHeader className="pb-2 pt-5">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-4xl font-bold leading-none tracking-tight">
          <LiveNumber value={value} />
        </p>
        {unit && (
          <p className="font-mono text-xs text-muted-foreground">{unit}</p>
        )}
      </CardHeader>

      {sparkData && (
        <CardContent className="px-0 pb-0 pt-2">
          <div className="h-12 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={chartColor}
                  fill={chartColor}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
