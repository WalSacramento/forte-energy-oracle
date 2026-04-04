"use client";

import { useState } from "react";
import { useReadContract, useWatchContractEvent } from "wagmi";
import { OracleAggregatorABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { hardhatLocal } from "@/lib/wagmi-config";
import { OracleVotePanel } from "./OracleVotePanel";

interface RequestRow {
  requestId: bigint;
  meterId: string;
  status: number;
  aggregatedValue: bigint;
  responseCount: number;
}

const STATUS_LABELS = ["Pending", "Aggregating", "Completed", "Failed"];
const STATUS_COLORS = ["var(--amber)", "var(--cyan)", "var(--emerald)", "var(--red)"];

function RequestDetailRow({ requestId }: { requestId: bigint }) {
  const { data: responses } = useReadContract({
    address: CONTRACT_ADDRESSES.oracleAggregator,
    abi: OracleAggregatorABI,
    chainId: hardhatLocal.id,
    functionName: "getResponses",
    args: [requestId],
  }) as {
    data: { oracle: string; value: bigint; isOutlier: boolean }[] | undefined;
  };

  const { data: request } = useReadContract({
    address: CONTRACT_ADDRESSES.oracleAggregator,
    abi: OracleAggregatorABI,
    chainId: hardhatLocal.id,
    functionName: "getRequest",
    args: [requestId],
  }) as {
    data: { aggregatedValue: bigint } | undefined;
  };

  return (
    <OracleVotePanel
      votes={responses ?? []}
      median={request?.aggregatedValue ?? 0n}
    />
  );
}

export function RequestTable() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.oracleAggregator,
    abi: OracleAggregatorABI,
    chainId: hardhatLocal.id,
    eventName: "DataRequested",
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = (log as { args?: Record<string, unknown> }).args ?? {};
        const row: RequestRow = {
          requestId: (args.requestId as bigint) ?? 0n,
          meterId: (args.meterId as string) ?? "",
          status: 0,
          aggregatedValue: 0n,
          responseCount: 0,
        };
        setRequests((prev) => {
          const exists = prev.find((r) => r.requestId === row.requestId);
          if (exists) return prev;
          return [row, ...prev].slice(0, 50);
        });
      });
    },
  });

  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.oracleAggregator,
    abi: OracleAggregatorABI,
    chainId: hardhatLocal.id,
    eventName: "DataAggregated",
    onLogs: (logs) => {
      logs.forEach((log) => {
        const args = (log as { args?: Record<string, unknown> }).args ?? {};
        setRequests((prev) =>
          prev.map((r) =>
            r.requestId === args.requestId
              ? {
                  ...r,
                  status: 2,
                  aggregatedValue: (args.aggregatedValue as bigint) ?? 0n,
                  responseCount: Number(args.responseCount ?? 0),
                }
              : r
          )
        );
      });
    },
  });

  if (requests.length === 0) {
    return (
      <div className="panel p-6">
        <p className="font-data text-xs text-center" style={{ color: "var(--text-muted)" }}>
          No oracle requests yet. Events will appear here live.
        </p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <table className="w-full font-data text-xs">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--bg-border)", color: "var(--text-muted)" }}>
            <th className="text-left p-3">Request ID</th>
            <th className="text-left p-3">Meter</th>
            <th className="text-center p-3">Status</th>
            <th className="text-right p-3">Aggregated</th>
            <th className="text-center p-3">Responses</th>
            <th className="text-right p-3"></th>
          </tr>
        </thead>
        <tbody>
          {requests.map((row) => {
            const key = row.requestId.toString();
            const isExpanded = expandedId === key;
            return (
              <>
                <tr
                  key={key}
                  style={{
                    borderBottom: "1px solid var(--bg-border)",
                    cursor: "pointer",
                    background: isExpanded ? "rgba(0,229,255,0.04)" : "transparent",
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : key)}
                >
                  <td className="p-3" style={{ color: "var(--text-secondary)" }}>
                    #{key}
                  </td>
                  <td className="p-3">{row.meterId}</td>
                  <td className="p-3 text-center">
                    <span style={{ color: STATUS_COLORS[row.status] }}>
                      {STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td className="p-3 text-right" style={{ color: "var(--cyan)" }}>
                    {row.aggregatedValue > 0n ? row.aggregatedValue.toString() : "—"}
                  </td>
                  <td className="p-3 text-center">{row.responseCount}</td>
                  <td className="p-3 text-right" style={{ color: "var(--text-muted)" }}>
                    {isExpanded ? "▲" : "▼"}
                  </td>
                </tr>

                {isExpanded && (
                  <tr key={`${key}-detail`} style={{ borderBottom: "1px solid var(--bg-border)" }}>
                    <td colSpan={6} style={{ background: "var(--bg-base)" }}>
                      <RequestDetailRow requestId={row.requestId} />
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
