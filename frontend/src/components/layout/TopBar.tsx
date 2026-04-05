"use client";

import { useAccount, useConnect, useDisconnect, useBlockNumber } from "wagmi";
import { useTranslations } from "next-intl";
import { truncateAddress } from "@/lib/formatters";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function TopBar() {
  const t = useTranslations("topbar");
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const injectedConnector = connectors.find((connector) => connector.id === "injected");

  const handleConnect = () => {
    if (!injectedConnector || isPending) {
      return;
    }

    connect({ connector: injectedConnector });
  };

  return (
    <header
      className="flex items-center justify-between h-14 px-4 border-b shrink-0"
      style={{ background: "var(--bg-panel)", borderColor: "var(--bg-border)" }}
    >
      <span
        className="font-display text-lg tracking-widest"
        style={{ color: "var(--cyan)" }}
      >
        {t("title")}
      </span>

      <div className="flex items-center gap-4">
        {/* Block badge */}
        {blockNumber !== undefined && (
          <span
            className="font-data text-xs px-2 py-1 rounded border"
            style={{
              color: "var(--emerald)",
              borderColor: "var(--bg-border)",
              background: "rgba(0,230,118,0.07)",
            }}
          >
            #{blockNumber.toString()}
          </span>
        )}

        {/* Language switcher */}
        <LanguageSwitcher />

        {/* Wallet */}
        {isConnected ? (
          <div className="flex items-center gap-2">
            <span
              className="font-data text-xs"
              style={{ color: "var(--text-secondary)" }}
            >
              {truncateAddress(address ?? "")}
            </span>
            <button
              onClick={() => disconnect()}
              className="font-data text-xs px-2 py-1 rounded border transition-colors"
              style={{
                color: "var(--red)",
                borderColor: "var(--bg-border)",
              }}
            >
              {t("disconnect")}
            </button>
          </div>
        ) : (
          <button
            onClick={handleConnect}
            disabled={!injectedConnector || isPending}
            className="font-data text-xs px-3 py-1.5 rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              color: "var(--cyan)",
              borderColor: "var(--cyan)",
              background: "rgba(0,229,255,0.08)",
            }}
          >
            {isPending ? t("connecting") : t("connectWallet")}
          </button>
        )}
      </div>
    </header>
  );
}
