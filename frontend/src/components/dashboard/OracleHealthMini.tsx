"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useOracleNodes } from "@/hooks/useOracleNodes";
import { StatusDot } from "@/components/shared/StatusDot";

export function OracleHealthMini() {
  const t = useTranslations("oracleHealthMini");
  const nodes = useOracleNodes();

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-data text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
          {t("oracleNodes")}
        </p>
        <Link
          href="/oracle-health"
          className="font-data text-xs"
          style={{ color: "var(--cyan)" }}
        >
          {t("details")}
        </Link>
      </div>

      <div className="space-y-3">
        {[0, 1, 2].map((i) => {
          const node = nodes[i];
          const isOnline = node?.status === "online";
          return (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusDot
                  variant={isOnline ? "emerald" : "red"}
                  pulse={isOnline}
                />
                <span className="font-data text-xs" style={{ color: "var(--text-primary)" }}>
                  {t("oracle", { n: i + 1 })}
                </span>
              </div>
              <div className="text-right">
                {node ? (
                  <span className="font-data text-xs" style={{ color: "var(--text-secondary)" }}>
                    {isOnline ? `${node.latencyMs}ms` : t("offline")}
                  </span>
                ) : (
                  <span className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
                    —
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
