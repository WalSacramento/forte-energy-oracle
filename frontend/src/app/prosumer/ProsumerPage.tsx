"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useTranslations } from "next-intl";
import { PositionTimeline } from "@/components/prosumer/PositionTimeline";
import { CreateOfferForm } from "@/components/prosumer/CreateOfferForm";
import { CreateAuctionForm } from "@/components/prosumer/CreateAuctionForm";

type MainTab = "positions" | "create";
type CreateTab = "offer" | "auction";

export function ProsumerPage() {
  const t = useTranslations("prosumer");
  const { isConnected } = useAccount();
  const [mainTab, setMainTab] = useState<MainTab>("positions");
  const [createTab, setCreateTab] = useState<CreateTab>("offer");

  const tabStyle = (active: boolean) => ({
    color: active ? "var(--cyan)" : "var(--text-muted)",
    borderBottom: active ? "2px solid var(--cyan)" : "2px solid transparent",
    paddingBottom: "4px",
    cursor: "pointer",
    background: "none",
    border: "none",
    fontFamily: "var(--font-space)",
    fontSize: "0.75rem",
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  });

  if (!isConnected) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="font-data text-sm" style={{ color: "var(--text-muted)" }}>
          {t("connectWallet")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl" style={{ color: "var(--amber)" }}>
        {t("title")}
      </h1>

      {/* Main tabs */}
      <div className="flex gap-6 border-b" style={{ borderColor: "var(--bg-border)" }}>
        <button style={tabStyle(mainTab === "positions")} onClick={() => setMainTab("positions")}>
          {t("myPositions")}
        </button>
        <button style={tabStyle(mainTab === "create")} onClick={() => setMainTab("create")}>
          {t("create")}
        </button>
      </div>

      {mainTab === "positions" && <PositionTimeline />}

      {mainTab === "create" && (
        <div className="space-y-4">
          {/* Create inner tabs */}
          <div className="flex gap-4 border-b" style={{ borderColor: "var(--bg-border)" }}>
            <button style={tabStyle(createTab === "offer")} onClick={() => setCreateTab("offer")}>
              {t("fixedOffer")}
            </button>
            <button style={tabStyle(createTab === "auction")} onClick={() => setCreateTab("auction")}>
              {t("dutchAuction")}
            </button>
          </div>

          {createTab === "offer" && <CreateOfferForm />}
          {createTab === "auction" && <CreateAuctionForm />}
        </div>
      )}
    </div>
  );
}
