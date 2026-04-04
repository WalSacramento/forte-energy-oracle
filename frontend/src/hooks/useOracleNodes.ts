"use client";

import { useQuery } from "@tanstack/react-query";

export interface OracleNodeMetrics {
  nodeId: string;
  status: "online" | "offline";
  latencyMs: number;
  queueSize: number;
  totalRequests: number;
  successRate: number;
}

const NODE_URLS = [
  "http://localhost:4001",
  "http://localhost:4002",
  "http://localhost:4003",
] as const;

async function fetchNodeMetrics(url: string, index: number): Promise<OracleNodeMetrics> {
  const start = performance.now();
  try {
    const res = await fetch(`${url}/metrics`, { signal: AbortSignal.timeout(3000) });
    const latencyMs = performance.now() - start;
    if (!res.ok) throw new Error("non-200");
    const data = await res.json();
    return {
      nodeId: `node${index + 1}`,
      status: "online",
      latencyMs: Math.round(latencyMs),
      queueSize: data.queueSize ?? 0,
      totalRequests: data.totalRequests ?? 0,
      successRate: data.successRate ?? 1,
    };
  } catch {
    return {
      nodeId: `node${index + 1}`,
      status: "offline",
      latencyMs: 0,
      queueSize: 0,
      totalRequests: 0,
      successRate: 0,
    };
  }
}

// Three separate hooks — fixed number, no conditional calls
function useNodeQuery(index: 0 | 1 | 2) {
  return useQuery({
    queryKey: ["oracle-metrics", index],
    queryFn: () => fetchNodeMetrics(NODE_URLS[index], index),
    refetchInterval: 5000,
    retry: false,
  });
}

/**
 * Returns metrics for all 3 oracle nodes. Uses 3 fixed hook calls (no .map).
 */
export function useOracleNodes(): (OracleNodeMetrics | undefined)[] {
  const r0 = useNodeQuery(0);
  const r1 = useNodeQuery(1);
  const r2 = useNodeQuery(2);
  return [r0.data, r1.data, r2.data];
}
