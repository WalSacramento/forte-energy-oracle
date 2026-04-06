"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useOracleNodes } from "@/hooks/useOracleNodes";
import { cn } from "@/lib/utils";

function latencyColor(ms: number): string {
  if (ms < 100) return "text-market-up";
  if (ms < 500) return "text-primary";
  return "text-destructive";
}

export function OracleHealthMini() {
  const t = useTranslations("oracleHealthMini");
  const nodes = useOracleNodes();

  return (
    <Card className="h-full card-accent-cyan">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="font-display text-sm font-semibold uppercase tracking-wider">
          {t("oracleNodes")}
        </CardTitle>
        <Link
          href="/oracle-health"
          className="flex items-center gap-1 font-mono text-xs text-primary hover:underline"
        >
          {t("details")}
          <ArrowRight className="size-3" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {[0, 1, 2].map((index) => {
          const node = nodes[index];
          const isOnline = node?.status === "online";
          const reputation = node ? Math.max(15, 100 - node.queueSize * 8) : 0;

          return (
            <div key={index} className="space-y-1.5 rounded-md border border-border/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isOnline ? "bg-market-up dot-pulse" : "bg-destructive"
                    )}
                  />
                  <span className="font-mono text-xs font-medium text-foreground">
                    {t("oracle", { n: index + 1 })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {node && (
                    <span className={cn("font-mono text-xs", latencyColor(node.latencyMs))}>
                      {node.latencyMs}ms
                    </span>
                  )}
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium",
                      isOnline
                        ? "bg-market-up/10 text-market-up"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {isOnline ? "Online" : t("offline")}
                  </span>
                </div>
              </div>
              <div className="space-y-0.5">
                <div className="flex justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Reputation
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground">{reputation}%</span>
                </div>
                <Progress value={reputation} className="h-1" />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
