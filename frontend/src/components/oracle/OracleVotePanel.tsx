"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

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
  if (votes.length === 0) {
    return (
      <div className="p-3 font-data text-xs" style={{ color: "var(--text-muted)" }}>
        {t("noVotes")}
      </div>
    );
  }

  const maxValue = votes.reduce((m, v) => (v.value > m ? v.value : m), 0n);
  const medianNum = Number(median);

  return (
    <div className="p-4 space-y-3">
      <p className="font-data text-xs uppercase" style={{ color: "var(--text-muted)" }}>
        {t("oracleVotes")}
      </p>

      {votes.map((vote, i) => {
        const pct = maxValue > 0n ? Number((vote.value * 100n) / maxValue) : 0;
        const deviation = medianNum > 0
          ? ((Number(vote.value) - medianNum) / medianNum) * 100
          : 0;
        const barColor = vote.isOutlier ? "var(--red)" : "var(--emerald)";

        return (
          <div key={vote.oracle} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-data text-xs" style={{ color: "var(--text-secondary)" }}>
                {vote.oracle.slice(0, 6)}…{vote.oracle.slice(-4)}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-data text-xs" style={{ color: barColor }}>
                  {Number(vote.value).toLocaleString()}
                </span>
                <span
                  className="font-data text-xs px-1 rounded"
                  style={{
                    color: vote.isOutlier ? "var(--red)" : "var(--emerald)",
                    background: vote.isOutlier ? "rgba(255,23,68,0.1)" : "rgba(0,230,118,0.1)",
                  }}
                >
                  {deviation >= 0 ? "+" : ""}{deviation.toFixed(1)}%
                </span>
              </div>
            </div>

            {/* Horizontal bar */}
            <div className="relative h-3 rounded overflow-hidden" style={{ background: "var(--bg-border)" }}>
              <motion.div
                className="absolute left-0 top-0 h-full rounded"
                style={{ background: barColor }}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.08 }}
              />
            </div>
          </div>
        );
      })}

      {/* Median reference line overlay */}
      {medianNum > 0 && maxValue > 0n && (
        <div className="relative h-2">
          <div
            className="absolute top-0 w-px h-4 -mt-2"
            style={{
              left: `${Number((median * 100n) / maxValue)}%`,
              background: "var(--cyan)",
              boxShadow: "0 0 4px var(--cyan)",
            }}
          />
          <span
            className="absolute font-data text-xs"
            style={{
              left: `calc(${Number((median * 100n) / maxValue)}% + 4px)`,
              color: "var(--cyan)",
              top: -8,
            }}
          >
            {t("median")}
          </span>
        </div>
      )}
    </div>
  );
}
