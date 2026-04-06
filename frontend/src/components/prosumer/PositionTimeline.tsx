"use client";

import { useAccount, useReadContract } from "wagmi";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { EnergyAuctionABI, EnergyTradingABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { hardhatLocal } from "@/lib/wagmi-config";

function TimelineItem({
  title,
  progress,
  type,
}: {
  title: string;
  progress: number;
  type: "offer" | "auction";
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <Badge variant={type === "offer" ? "secondary" : "default"}>
          {type === "offer" ? "Offer" : "Auction"}
        </Badge>
      </div>
      <Progress value={progress} />
    </div>
  );
}

export function PositionTimeline() {
  const t = useTranslations("positionTimeline");
  const { address } = useAccount();

  const { data: sellerOfferIds } = useReadContract({
    address: CONTRACT_ADDRESSES.energyTrading,
    abi: EnergyTradingABI,
    chainId: hardhatLocal.id,
    functionName: "getSellerOffers",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  }) as { data: bigint[] | undefined };

  const { data: sellerAuctionIds } = useReadContract({
    address: CONTRACT_ADDRESSES.energyAuction,
    abi: EnergyAuctionABI,
    chainId: hardhatLocal.id,
    functionName: "getSellerAuctions",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: !!address },
  }) as { data: bigint[] | undefined };

  const hasItems = (sellerOfferIds?.length ?? 0) + (sellerAuctionIds?.length ?? 0) > 0;

  if (!address) {
    return <p className="text-sm text-muted-foreground">{t("connectWallet")}</p>;
  }

  if (!hasItems) {
    return <p className="text-sm text-muted-foreground">{t("noPositions")}</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-80 pr-4">
          <div className="space-y-3">
            {sellerOfferIds?.map((id) => (
              <TimelineItem
                key={id.toString()}
                title={t("offer", { id: id.toString() })}
                progress={50}
                type="offer"
              />
            ))}
            {sellerAuctionIds?.map((id) => (
              <TimelineItem
                key={id.toString()}
                title={t("auction", { id: id.toString() })}
                progress={65}
                type="auction"
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
