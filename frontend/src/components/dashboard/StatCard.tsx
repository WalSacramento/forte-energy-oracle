"use client";

import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { LiveNumber } from "@/components/shared/LiveNumber";

interface StatCardProps {
  label: string;
  value: number | string;
  unit?: string;
  color?: "cyan" | "amber" | "emerald" | "red";
  sparkData?: number[];
}

const COLOR_VAR: Record<string, string> = {
  cyan:    "var(--cyan)",
  amber:   "var(--amber)",
  emerald: "var(--emerald)",
  red:     "var(--red)",
};

export function StatCard({ label, value, unit, color = "cyan", sparkData }: StatCardProps) {
  const c = COLOR_VAR[color];
  const chartData = (sparkData ?? [value, value]).map((v, i) => ({ i, v: Number(v) }));

  return (
    <div
      className="panel p-4 flex flex-col gap-2"
      style={{ borderColor: `${c}33` }}
    >
      <div className="flex items-end justify-between gap-2">
        <span className="font-display text-5xl leading-none" style={{ color: c }}>
          <LiveNumber value={value} />
        </span>

        {sparkData && (
          <div style={{ width: 50, height: 30 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={c}
                  fill={`${c}22`}
                  strokeWidth={1}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="font-data text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          {label}
        </span>
        {unit && (
          <span className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
