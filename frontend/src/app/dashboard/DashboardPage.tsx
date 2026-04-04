"use client";

import { StatCard } from "@/components/dashboard/StatCard";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { OracleHealthMini } from "@/components/dashboard/OracleHealthMini";
import { useEnergyTrading } from "@/hooks/useEnergyTrading";
import { useEnergyAuction } from "@/hooks/useEnergyAuction";

export function DashboardPage() {
  const { activeOffers } = useEnergyTrading();
  const { activeAuctions } = useEnergyAuction();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl" style={{ color: "var(--cyan)" }}>
        SYSTEM OVERVIEW
      </h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active Offers"
          value={activeOffers?.length ?? 0}
          unit="offers"
          color="amber"
        />
        <StatCard
          label="Active Auctions"
          value={activeAuctions?.length ?? 0}
          unit="auctions"
          color="cyan"
        />
        <StatCard
          label="Oracle Nodes"
          value={3}
          unit="nodes"
          color="emerald"
        />
        <StatCard
          label="Network"
          value="Hardhat"
          unit="local"
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
