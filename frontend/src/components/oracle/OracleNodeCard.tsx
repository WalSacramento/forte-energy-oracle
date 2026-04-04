"use client";

import { StatusDot } from "@/components/shared/StatusDot";
import { type OracleNodeMetrics } from "@/hooks/useOracleNodes";

interface OracleNodeCardProps {
  nodeIndex: number;
  nodeUrl: string;
  metrics?: OracleNodeMetrics;
  oracleAddress?: `0x${string}`;
}

/** SVG gauge: 220° arc, colored by reputation score 0–100 */
function ReputationGauge({ reputation = 50 }: { reputation: number }) {
  const r = 36;
  const cx = 50;
  const cy = 55;
  const startAngle = -200;
  const endAngle = 20;
  const totalDeg = endAngle - startAngle;
  const filledDeg = (reputation / 100) * totalDeg;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const arcPath = (start: number, end: number) => {
    const x1 = cx + r * Math.cos(toRad(start));
    const y1 = cy + r * Math.sin(toRad(start));
    const x2 = cx + r * Math.cos(toRad(end));
    const y2 = cy + r * Math.sin(toRad(end));
    const large = end - start > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
  };

  const trackPath = arcPath(startAngle, endAngle);
  const fillPath = arcPath(startAngle, startAngle + filledDeg);

  const color =
    reputation >= 70 ? "var(--emerald)"
    : reputation >= 40 ? "var(--amber)"
    : "var(--red)";

  return (
    <svg width="100" height="70" viewBox="0 0 100 70">
      <path d={trackPath} fill="none" stroke="var(--bg-border)" strokeWidth={6} strokeLinecap="round" />
      <path d={fillPath} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round" />
      <text x={cx} y={cy + 4} textAnchor="middle" fill={color} fontSize={18} fontFamily="var(--font-bebas)">
        {reputation}
      </text>
      <text x={cx} y={cy + 16} textAnchor="middle" fill="var(--text-muted)" fontSize={7} fontFamily="var(--font-space)">
        REP
      </text>
    </svg>
  );
}

export function OracleNodeCard({ nodeIndex, metrics, oracleAddress }: OracleNodeCardProps) {
  const isOnline = metrics?.status === "online";
  const reputation = 70; // placeholder — real value would come from OracleAggregator

  return (
    <div className="panel p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="font-display text-xl" style={{ color: "var(--cyan)" }}>
          NODE {nodeIndex + 1}
        </span>
        <StatusDot variant={isOnline ? "emerald" : "red"} pulse={isOnline} label={isOnline ? "Online" : "Offline"} />
      </div>

      <div className="flex justify-center">
        <ReputationGauge reputation={reputation} />
      </div>

      <div className="space-y-1 font-data text-xs">
        <div className="flex justify-between">
          <span style={{ color: "var(--text-muted)" }}>Latency</span>
          <span style={{ color: "var(--text-primary)" }}>
            {metrics ? `${metrics.latencyMs}ms` : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: "var(--text-muted)" }}>Queue</span>
          <span style={{ color: "var(--text-primary)" }}>
            {metrics ? metrics.queueSize : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span style={{ color: "var(--text-muted)" }}>Total Req.</span>
          <span style={{ color: "var(--text-primary)" }}>
            {metrics ? metrics.totalRequests : "—"}
          </span>
        </div>
        {oracleAddress && (
          <div className="flex justify-between">
            <span style={{ color: "var(--text-muted)" }}>Address</span>
            <span style={{ color: "var(--text-secondary)", fontFamily: "var(--font-space)" }}>
              {oracleAddress.slice(0, 6)}…{oracleAddress.slice(-4)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
