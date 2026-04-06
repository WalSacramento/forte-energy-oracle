"use client";

import { useAccount, useConnect } from "wagmi";
import { useTranslations } from "next-intl";
import { User, Zap } from "lucide-react";
import { CreateAuctionForm } from "@/components/prosumer/CreateAuctionForm";
import { CreateOfferForm } from "@/components/prosumer/CreateOfferForm";
import { PositionTimeline } from "@/components/prosumer/PositionTimeline";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ProsumerPage() {
  const t = useTranslations("prosumer");
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();

  const injectedConnector = connectors.find((c) => c.id === "injected");

  if (!isConnected) {
    return (
      <div className="flex min-h-[20rem] flex-col items-center justify-center gap-4 rounded-lg border border-primary/20 bg-primary/5 p-8 text-center">
        <div className="flex size-12 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
          <Zap className="size-6 text-primary" />
        </div>
        <div className="space-y-1">
          <p className="font-display text-lg font-semibold">{t("connectWallet")}</p>
          <p className="font-mono text-xs text-muted-foreground">
            Connect your wallet to manage positions and create supply opportunities.
          </p>
        </div>
        <Button
          onClick={() => injectedConnector && connect({ connector: injectedConnector })}
          disabled={!injectedConnector || isPending}
          className="gap-2"
        >
          <Zap className="size-4" />
          {isPending ? "Connecting…" : "Connect Wallet"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <User className="size-5 text-primary" />
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
        </div>
        <p className="font-mono text-xs text-muted-foreground">
          Manage active positions and create new supply opportunities.
        </p>
      </div>

      <Tabs defaultValue="positions" className="space-y-4">
        <TabsList className="border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="positions"
            className="rounded-none border-b-2 border-transparent px-4 pb-2 font-mono text-xs uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent"
          >
            {t("myPositions")}
          </TabsTrigger>
          <TabsTrigger
            value="create"
            className="rounded-none border-b-2 border-transparent px-4 pb-2 font-mono text-xs uppercase tracking-wider data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent"
          >
            {t("create")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-4">
          <PositionTimeline />
        </TabsContent>

        <TabsContent value="create" className="mt-4">
          <Tabs defaultValue="offer" className="space-y-4">
            <TabsList className="flex w-fit gap-1 rounded-md border border-border bg-card p-1">
              <TabsTrigger
                value="offer"
                className="rounded px-3 py-1 font-mono text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
              >
                {t("fixedOffer")}
              </TabsTrigger>
              <TabsTrigger
                value="auction"
                className="rounded px-3 py-1 font-mono text-xs data-[state=active]:bg-primary/10 data-[state=active]:text-primary"
              >
                {t("dutchAuction")}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="offer">
              <CreateOfferForm />
            </TabsContent>
            <TabsContent value="auction">
              <CreateAuctionForm />
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
