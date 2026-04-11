"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useReadContract } from "wagmi";
import { ValidationBadge } from "@/components/shared/ValidationBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { dismissTxToast, showTxError, showTxLoading, showTxSuccess } from "@/components/shared/TxToast";
import { EnergyAuctionABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { formatEth, formatEthPrice, formatWh } from "@/lib/formatters";
import { waitForLocalTransaction } from "@/lib/transactions";
import { useDutchPrice } from "@/hooks/useDutchPrice";
import { useEnergyAuction } from "@/hooks/useEnergyAuction";
import { hardhatLocal } from "@/lib/wagmi-config";
import { PriceDecayChart } from "./PriceDecayChart";

export function AuctionDetail({ auctionId }: { auctionId: bigint }) {
  const t = useTranslations("auctionDetail");
  const tx = useTranslations("txToast");
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const { placeBid, finalizeAuction } = useEnergyAuction();

  const { data: auction } = useReadContract({
    address: CONTRACT_ADDRESSES.energyAuction,
    abi: EnergyAuctionABI,
    chainId: hardhatLocal.id,
    functionName: "getAuction",
    args: [auctionId],
    query: { refetchInterval: 2000 },
  }) as {
    data:
      | {
          meterId: string;
          energyAmount: bigint;
          startPrice: bigint;
          minPrice: bigint;
          priceDecayRate: bigint;
          startTime: bigint;
          endTime: bigint;
          finalPrice: bigint;
          status: number;
        }
      | undefined;
  };

  const { currentPrice, isExpired } = useDutchPrice({
    startPrice: auction?.startPrice ?? 0n,
    priceDecayRate: auction?.priceDecayRate ?? 0n,
    startTime: auction?.startTime ?? 0n,
    minPrice: auction?.minPrice ?? 0n,
    endTime: auction?.endTime ?? 0n,
  });

  if (!auction) {
    return <Card className="h-64 animate-pulse" />;
  }

  const totalCost = currentPrice * auction.energyAmount;
  const isActive = auction.status === 0;
  const isPendingValidation = auction.status === 1;
  const validationState = isPendingValidation
    ? "PENDING"
    : auction.status === 2
      ? "COMPLETED"
      : auction.status === 3
        ? "FAILED"
        : "PENDING";

  const handleAction = async (type: "bid" | "finalize") => {
    setIsProcessing(true);
    const toastId = showTxLoading(tx("pending"));

    try {
      const hash =
        type === "bid"
          ? await placeBid(auctionId, totalCost)
          : await finalizeAuction(auctionId);

      showTxLoading(tx("confirming"), toastId);
      await waitForLocalTransaction(hash);
      dismissTxToast(toastId);
      showTxSuccess(tx("success"), {
        description: t("viewCompletedTrades"),
        action: {
          label: t("viewCompletedTrades"),
          onClick: () => router.push("/completed-trades"),
        },
      });
    } catch {
      dismissTxToast(toastId);
      showTxError(tx("error"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>{t("priceDecay")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PriceDecayChart
                startPrice={auction.startPrice}
                minPrice={auction.minPrice}
                priceDecayRate={auction.priceDecayRate}
                startTime={auction.startTime}
                endTime={auction.endTime}
                currentPrice={currentPrice}
              />
              <div className="grid gap-2 text-sm md:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">{t("start")}</p>
                  <p className="font-mono">{formatEthPrice(auction.startPrice)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">{t("min")}</p>
                  <p className="font-mono text-market-down">{formatEthPrice(auction.minPrice)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-3xl">
                <span className="font-mono" data-testid="current-price">{formatEthPrice(currentPrice)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("energy")}</span>
                  <span className="font-mono">{formatWh(auction.energyAmount)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("totalCost")}</span>
                  <span className="font-mono text-market-up">{formatEth(totalCost)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("status")}</span>
                  <span>{isPendingValidation ? t("statusPendingValidation") : isActive ? t("statusActive") : isExpired ? t("statusCancelled") : t("statusFinalized")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">{t("oracle")}</span>
                  <ValidationBadge state={validationState} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Meter</span>
                  <span className="font-mono">{auction.meterId}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {isActive && !isExpired ? (
                  <Button onClick={() => handleAction("bid")} disabled={isProcessing}>
                    {t("placeBid", { cost: formatEth(totalCost) })}
                  </Button>
                ) : null}

                {isPendingValidation ? (
                  <Button
                    variant="outline"
                    onClick={() => handleAction("finalize")}
                    disabled={isProcessing}
                  >
                    {t("finalizeAuction")}
                  </Button>
                ) : null}

                {isExpired && isActive ? (
                  <p className="text-sm text-muted-foreground">{t("auctionExpired")}</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="history">
        <Card>
          <CardHeader>
            <CardTitle>Auction Timeline</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">{t("currentPricePerWh")}</p>
              <p className="font-mono">{formatEthPrice(currentPrice)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Final Price</p>
              <p className="font-mono">
                {auction.finalPrice > 0n ? formatEthPrice(auction.finalPrice) : "—"}
              </p>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
