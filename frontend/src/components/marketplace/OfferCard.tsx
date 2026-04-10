"use client";

import { useTranslations } from "next-intl";
import { useReadContract } from "wagmi";
import { AddressBadge } from "@/components/shared/AddressBadge";
import { ValidationBadge } from "@/components/shared/ValidationBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EnergyTradingABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { formatCountdown, formatEthPrice, formatWh } from "@/lib/formatters";
import { hardhatLocal } from "@/lib/wagmi-config";
import { cn } from "@/lib/utils";

interface OfferCardProps {
  offerId: bigint;
  onBuy: () => void;
}

const ORACLE_STATUS_MAP: Record<number, "PENDING" | "AGGREGATING" | "COMPLETED" | "FAILED"> = {
  0: "PENDING",
  1: "AGGREGATING",
  2: "COMPLETED",
  3: "FAILED",
};

export function OfferCard({ offerId, onBuy }: OfferCardProps) {
  const t = useTranslations("offerCard");
  const { data: offer } = useReadContract({
    address: CONTRACT_ADDRESSES.energyTrading,
    abi: EnergyTradingABI,
    chainId: hardhatLocal.id,
    functionName: "getOffer",
    args: [offerId],
  });

  if (!offer) {
    return (
      <Card className="card-accent-gray">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex justify-between">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-20" />
          </div>
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-6 w-24" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-4 w-full" />
        </CardContent>
        <CardFooter>
          <Skeleton className="h-8 w-full" />
        </CardFooter>
      </Card>
    );
  }

  const currentOffer = offer as {
    seller: string;
    meterId: string;
    amount: bigint;
    pricePerWh: bigint;
    expiresAt: bigint;
    status: number;
  };

  const expiresIn = Number(currentOffer.expiresAt) - Math.floor(Date.now() / 1000);
  const isExpiringSoon = expiresIn < 300;
  const validationState = ORACLE_STATUS_MAP[currentOffer.status] ?? "PENDING";

  return (
    <Card className={cn("h-full", isExpiringSoon ? "card-accent-red" : "card-accent-amber")} data-testid={`offer-card-${offerId.toString()}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            #{offerId.toString()}
          </Badge>
          <ValidationBadge state={validationState} />
        </div>

        {/* Price hero — primary datum */}
        <div className="pt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono text-3xl font-bold text-primary">
              {formatEthPrice(currentOffer.pricePerWh)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">/Wh</span>
          </div>
          <p className="font-mono text-lg font-semibold text-foreground">
            {formatWh(currentOffer.amount)}
          </p>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <AddressBadge address={currentOffer.seller} />
          <span
            className={cn(
              "font-mono text-xs",
              isExpiringSoon ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {t("expires")} {formatCountdown(expiresIn)}
          </span>
        </div>
      </CardContent>

      <CardFooter>
        <Button onClick={onBuy} size="sm" className="w-full" data-testid="buy-btn">
          {t("buy")}
        </Button>
      </CardFooter>
    </Card>
  );
}
