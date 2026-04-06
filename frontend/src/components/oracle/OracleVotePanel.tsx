"use client";

import { useTranslations } from "next-intl";
import { AddressBadge } from "@/components/shared/AddressBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OracleVote {
  oracle: string;
  value: bigint;
  isOutlier: boolean;
}

interface OracleVotePanelProps {
  votes: OracleVote[];
  median: bigint;
}

export function OracleVotePanel({ votes, median }: OracleVotePanelProps) {
  const t = useTranslations("oracleVotePanel");

  return (
    <Card className="border-0 shadow-none ring-0">
      <CardHeader>
        <CardTitle className="text-sm">{t("oracleVotes")}</CardTitle>
      </CardHeader>
      <CardContent>
        {votes.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noVotes")}</p>
        ) : (
          <div className="space-y-3">
            {votes.map((vote) => (
              <div
                key={vote.oracle}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
              >
                <AddressBadge address={vote.oracle} />
                <div className="flex items-center gap-2">
                  <Badge variant={vote.isOutlier ? "destructive" : "secondary"}>
                    {vote.isOutlier ? "Outlier" : t("median")}
                  </Badge>
                  <span className="font-mono">{vote.value.toString()}</span>
                </div>
              </div>
            ))}
            <div className="rounded-lg border p-3 text-sm">
              <span className="text-muted-foreground">{t("median")}: </span>
              <span className="font-mono">{median.toString()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
