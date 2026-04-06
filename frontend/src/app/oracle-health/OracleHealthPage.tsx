"use client";

import { useTranslations } from "next-intl";
import { Activity } from "lucide-react";
import { OracleNodeCard } from "@/components/oracle/OracleNodeCard";
import { RequestTable } from "@/components/oracle/RequestTable";
import { useOracleAggregator } from "@/hooks/useOracleAggregator";
import { useOracleNodes } from "@/hooks/useOracleNodes";

const ORACLE_NODE_URLS = [
  "http://localhost:4001",
  "http://localhost:4002",
  "http://localhost:4003",
] as const;

export function OracleHealthPage() {
  const t = useTranslations("oracleHealth");
  const nodes = useOracleNodes();
  const { oracles } = useOracleAggregator();

  const onlineCount = nodes.filter((n) => n?.status === "online").length;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Activity className="size-5 text-primary" />
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          Monitor oracle node availability, throughput and recent aggregation requests.{" "}
          <span className="text-market-up">{onlineCount}/3 nodes online.</span>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <OracleNodeCard
            key={index}
            nodeIndex={index}
            nodeUrl={ORACLE_NODE_URLS[index]}
            metrics={nodes[index]}
            oracleAddress={oracles?.[index]}
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Aggregation Requests
        </p>
        <RequestTable />
      </div>
    </div>
  );
}
