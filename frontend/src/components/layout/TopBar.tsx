"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useBlockNumber, useAccount, useConnect, useDisconnect } from "wagmi";
import { useTranslations } from "next-intl";
import { Moon, Sun, Wallet } from "lucide-react";
import { truncateAddress } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function TopBar() {
  const t = useTranslations("topbar");
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: blockNumber } = useBlockNumber({ watch: true });
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const injectedConnector = connectors.find((connector) => connector.id === "injected");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnect = () => {
    if (!injectedConnector || isPending) return;
    connect({ connector: injectedConnector });
  };

  const isDark = mounted ? resolvedTheme !== "light" : true;

  return (
    <header className="sticky top-0 z-[8] flex h-12 items-center justify-between border-b border-border/50 bg-background/90 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
      </div>

      <div className="flex items-center gap-3">
        {/* Live block number */}
        {blockNumber !== undefined && (
          <div className="hidden items-center gap-1.5 sm:flex">
            <span className="size-1.5 rounded-full bg-market-up dot-pulse" />
            <span className="font-mono text-xs text-muted-foreground">
              #{blockNumber.toString()}
            </span>
          </div>
        )}

        <LanguageSwitcher />

        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>

        {isConnected ? (
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-md border border-border px-2 py-1 sm:flex">
              <Wallet className="size-3 text-primary" />
              <span className="font-mono text-xs text-foreground">
                {truncateAddress(address ?? "")}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => disconnect()}
            >
              {t("disconnect")}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={handleConnect}
            disabled={!injectedConnector || isPending}
          >
            {isPending ? t("connecting") : t("connectWallet")}
          </Button>
        )}
      </div>
    </header>
  );
}
