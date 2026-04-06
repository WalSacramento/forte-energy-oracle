"use client";

import { useTranslations } from "next-intl";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { OracleHealthMini } from "@/components/dashboard/OracleHealthMini";
import { StatCard } from "@/components/dashboard/StatCard";
import { useEnergyAuction } from "@/hooks/useEnergyAuction";
import { useEnergyTrading } from "@/hooks/useEnergyTrading";

export function DashboardPage() {
  const t = useTranslations("dashboard");
  const { activeOffers } = useEnergyTrading();
  const { activeAuctions } = useEnergyAuction();

  return (
    <div className="space-y-6">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
        {t("title")}
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t("activeOffers")}
          value={activeOffers?.length ?? 0}
          unit={t("offers")}
          sparkData={[1, 2, 2, 3, activeOffers?.length ?? 0]}
          accentColor="amber"
        />
        <StatCard
          label={t("activeAuctions")}
          value={activeAuctions?.length ?? 0}
          unit={t("auctionsUnit")}
          sparkData={[1, 1, 2, 2, activeAuctions?.length ?? 0]}
          accentColor="cyan"
        />
        <StatCard
          label={t("oracleNodes")}
          value={3}
          unit={t("nodes")}
          accentColor="emerald"
        />
        <StatCard
          label={t("network")}
          value="Hardhat"
          unit={t("local")}
          accentColor="gray"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[2fr_1fr]">
        <ActivityFeed />
        <OracleHealthMini />
      </div>
    </div>
  );
}
