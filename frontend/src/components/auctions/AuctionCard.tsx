"use client";

import { useTranslations } from "next-intl";
import { useReadContract } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EnergyAuctionABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { formatCountdown, formatEth, formatEthPrice, formatWh } from "@/lib/formatters";
import { useDutchPrice } from "@/hooks/useDutchPrice";
import { hardhatLocal } from "@/lib/wagmi-config";
import { cn } from "@/lib/utils";

interface AuctionCardProps {
  auctionId: bigint;
  hero?: boolean;
}

export function AuctionCard({ auctionId, hero = false }: AuctionCardProps) {
  const t = useTranslations("auctionCard");
  const { data: auction } = useReadContract({
    address: CONTRACT_ADDRESSES.energyAuction,
    abi: EnergyAuctionABI,
    chainId: hardhatLocal.id,
    functionName: "getAuction",
    args: [auctionId],
  }) as {
    data:
      | {
          energyAmount: bigint;
          startPrice: bigint;
          minPrice: bigint;
          priceDecayRate: bigint;
          startTime: bigint;
          endTime: bigint;
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
    return (
      <Card className="card-accent-gray">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className={cn("w-40", hero ? "h-12" : "h-9")} />
          <Skeleton className="h-4 w-24" />
        </CardHeader>
      </Card>
    );
  }

  const expiresIn = Number(auction.endTime) - Math.floor(Date.now() / 1000);
  const isExpiringSoon = expiresIn < 60;
  const totalCost = currentPrice * auction.energyAmount;

  return (
    <Card className={cn("h-full", isExpired ? "card-accent-gray" : "card-accent-amber")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="outline" className="font-mono text-xs">
            #{auctionId.toString()}
          </Badge>
          <span
            className={cn(
              "rounded px-2 py-0.5 font-mono text-xs font-medium",
              isExpired
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary"
            )}
          >
            {isExpired ? "Closed" : "Active"}
          </span>
        </div>

        {/* Current price — primary datum */}
        <div className="pt-1">
          <div className="flex items-baseline gap-1.5">
            <span className={cn("font-mono font-bold text-primary", hero ? "text-4xl" : "text-3xl")}>
              {formatEthPrice(currentPrice)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">/Wh</span>
          </div>
          <p className="font-mono text-sm text-muted-foreground">{t("currentPricePerWh")}</p>
        </div>
      </CardHeader>

      <CardContent className="space-y-2 pb-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{formatWh(auction.energyAmount)}</span>
          <span className="font-mono font-semibold text-market-up">{formatEth(totalCost)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{t("total")}</span>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 font-mono text-xs",
              isExpiringSoon
                ? "bg-destructive/10 text-destructive"
                : "bg-muted/50 text-muted-foreground"
            )}
          >
            {formatCountdown(expiresIn)}
          </span>
        </div>
      </CardContent>

      <CardFooter className="justify-end pt-0">
        <Button size="sm" variant={isExpired ? "ghost" : "default"} disabled={isExpired}>
          Place Bid
        </Button>
      </CardFooter>
    </Card>
  );
}
