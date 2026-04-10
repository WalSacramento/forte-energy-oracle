"use client";

import { useTranslations } from "next-intl";
import { AddressBadge } from "@/components/shared/AddressBadge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { type OracleNodeMetrics } from "@/hooks/useOracleNodes";
import { cn } from "@/lib/utils";

interface OracleNodeCardProps {
  nodeIndex: number;
  nodeUrl: string;
  metrics?: OracleNodeMetrics;
  oracleAddress?: `0x${string}`;
}

function latencyColor(ms: number): string {
  if (ms < 100) return "text-market-up";
  if (ms < 500) return "text-primary";
  return "text-destructive";
}

export function OracleNodeCard({
  nodeIndex,
  metrics,
  oracleAddress,
}: OracleNodeCardProps) {
  const t = useTranslations("oracleNodeCard");
  const isOnline = metrics?.status === "online";
  const reputation = metrics ? Math.round(metrics.successRate * 100) : 0;

  return (
    <Card
      className={cn(
        "card-accent-cyan transition-shadow",
        isOnline && "oracle-online-glow"
      )}
      data-testid={`oracle-card-${nodeIndex}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "size-2 rounded-full",
                isOnline ? "bg-market-up dot-pulse" : "bg-destructive"
              )}
            />
            <span className="font-display text-sm font-semibold">
              {t("node", { n: nodeIndex + 1 })}
            </span>
          </div>
          <span
            className={cn(
              "rounded px-2 py-0.5 font-mono text-xs font-medium",
              isOnline
                ? "bg-market-up/10 text-market-up"
                : "bg-destructive/10 text-destructive"
            )}
            data-testid={`oracle-status-${nodeIndex}`}
          >
            {isOnline ? t("online") : t("offline")}
          </span>
        </div>

        {/* Reputation bar */}
        <div className="space-y-1 pt-1">
          <div className="flex justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Reputation
            </span>
            <span className="font-mono text-[10px] text-muted-foreground" data-testid={`oracle-reputation-${nodeIndex}`}>{reputation}%</span>
          </div>
          <Progress value={reputation} className="h-1.5" />
        </div>
      </CardHeader>

      <CardContent className="space-y-0 pt-0">
        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border/50 p-3 text-xs">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("latency")}
            </p>
            <p
              className={cn(
                "font-mono font-semibold",
                metrics ? latencyColor(metrics.latencyMs) : "text-muted-foreground"
              )}
            >
              {metrics ? `${metrics.latencyMs}ms` : "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("queue")}
            </p>
            <p className="font-mono font-semibold text-foreground">
              {metrics ? metrics.queueSize : "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {t("totalRequests")}
            </p>
            <p className="font-mono font-semibold text-foreground">
              {metrics ? metrics.totalRequests : "—"}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Status
            </p>
            <p className={cn("font-mono font-semibold", isOnline ? "text-market-up" : "text-muted-foreground")}>
              {metrics?.status ?? "—"}
            </p>
          </div>
        </div>

        {oracleAddress && (
          <div className="pt-3">
            <AddressBadge address={oracleAddress} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
