"use client";

import { Fragment, useState } from "react";
import { useTranslations } from "next-intl";
import { useReadContract, useWatchContractEvent } from "wagmi";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OracleAggregatorABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { formatTimestamp } from "@/lib/formatters";
import { hardhatLocal } from "@/lib/wagmi-config";
import { OracleVotePanel } from "./OracleVotePanel";

interface RequestRow {
  requestId: bigint;
  meterId: string;
  status: number;
  aggregatedValue: bigint;
  responseCount: number;
  timestamp: number;
}

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
  const t = useTranslations("requestTable");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [requests, setRequests] = useState<RequestRow[]>([]);

  const statusBadge = (status: number) => {
    if (status === 2) return <Badge>{t("statusCompleted")}</Badge>;
    if (status === 3) return <Badge variant="destructive">{t("statusFailed")}</Badge>;
    return <Badge variant="secondary">{status === 1 ? t("statusAggregating") : t("statusPending")}</Badge>;
  };

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
          timestamp: Math.floor(Date.now() / 1000),
        };

        setRequests((current) => {
          const exists = current.find((item) => item.requestId === row.requestId);
          if (exists) return current;
          return [row, ...current].slice(0, 50);
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
        setRequests((current) =>
          current.map((item) =>
            item.requestId === args.requestId
              ? {
                  ...item,
                  status: 2,
                  aggregatedValue: (args.aggregatedValue as bigint) ?? 0n,
                  responseCount: Number(args.responseCount ?? 0),
                }
              : item
          )
        );
      });
    },
  });

  if (requests.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        {t("noRequests")}
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("colRequestId")}</TableHead>
            <TableHead>{t("colMeter")}</TableHead>
            <TableHead>{t("colResponses")}</TableHead>
            <TableHead>{t("colStatus")}</TableHead>
            <TableHead className="text-right">{t("colAggregated")}</TableHead>
            <TableHead className="text-right">Timestamp</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((row) => {
            const key = row.requestId.toString();
            const isExpanded = expandedId === key;

            return (
              <Fragment key={key}>
                <TableRow
                  className="cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : key)}
                  data-testid={`request-row-${key}`}
                >
                  <TableCell className="font-mono">#{key}</TableCell>
                  <TableCell>{row.meterId}</TableCell>
                  <TableCell>{row.responseCount}</TableCell>
                  <TableCell>{statusBadge(row.status)}</TableCell>
                  <TableCell className="text-right font-mono">
                    {row.aggregatedValue > 0n ? row.aggregatedValue.toString() : "—"}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatTimestamp(row.timestamp)}
                  </TableCell>
                </TableRow>
                {isExpanded ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <RequestDetailRow requestId={row.requestId} />
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
