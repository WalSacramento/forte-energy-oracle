"use client";

import { OracleNodeCard } from "@/components/oracle/OracleNodeCard";
import { RequestTable } from "@/components/oracle/RequestTable";
import { useOracleNodes } from "@/hooks/useOracleNodes";
import { useOracleAggregator } from "@/hooks/useOracleAggregator";

const ORACLE_NODE_URLS = [
  "http://localhost:4001",
  "http://localhost:4002",
  "http://localhost:4003",
] as const;

export function OracleHealthPage() {
  const nodes = useOracleNodes();
  const { oracles } = useOracleAggregator();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl" style={{ color: "var(--cyan)" }}>
        ORACLE HEALTH
      </h1>

      {/* 3 Oracle node cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <OracleNodeCard
            key={i}
            nodeIndex={i}
            nodeUrl={ORACLE_NODE_URLS[i]}
            metrics={nodes[i]}
            oracleAddress={oracles?.[i]}
          />
        ))}
      </div>

      {/* Request table with expandable vote panels */}
      <RequestTable />
    </div>
  );
}
