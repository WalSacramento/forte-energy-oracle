"use client";

import { useTranslations } from "next-intl";
import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { OracleHealthMini } from "@/components/dashboard/OracleHealthMini";
import { useEnergyTrading } from "@/hooks/useEnergyTrading";
import { useEnergyAuction } from "@/hooks/useEnergyAuction";

export function DashboardPage() {
  const t = useTranslations("dashboard");
  const { activeOffers } = useEnergyTrading();
  const { activeAuctions } = useEnergyAuction();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl" style={{ color: "var(--cyan)" }}>
        {t("title")}
      </h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("activeOffers")}
          value={activeOffers?.length ?? 0}
          unit={t("offers")}
          color="amber"
        />
        <StatCard
          label={t("activeAuctions")}
          value={activeAuctions?.length ?? 0}
          unit={t("auctionsUnit")}
          color="cyan"
        />
        <StatCard
          label={t("oracleNodes")}
          value={3}
          unit={t("nodes")}
          color="emerald"
        />
        <StatCard
          label={t("network")}
          value="Hardhat"
          unit={t("local")}
          color="cyan"
        />
      </div>

      {/* Activity + Oracle mini */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ActivityFeed />
        </div>
        <OracleHealthMini />
      </div>
    </div>
  );
}
