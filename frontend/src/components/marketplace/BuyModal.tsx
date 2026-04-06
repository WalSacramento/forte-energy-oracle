"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useReadContract } from "wagmi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EnergyTradingABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { dismissTxToast, showTxError, showTxLoading, showTxSuccess } from "@/components/shared/TxToast";
import { formatEth, formatWh } from "@/lib/formatters";
import { waitForLocalTransaction } from "@/lib/transactions";
import { useEnergyTrading } from "@/hooks/useEnergyTrading";
import { hardhatLocal } from "@/lib/wagmi-config";

interface BuyModalProps {
  offerId: bigint;
  open: boolean;
  onClose: () => void;
}

export function BuyModal({ offerId, open, onClose }: BuyModalProps) {
  const t = useTranslations("buyModal");
  const tx = useTranslations("txToast");
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const { acceptOffer } = useEnergyTrading();

  const { data: offer } = useReadContract({
    address: CONTRACT_ADDRESSES.energyTrading,
    abi: EnergyTradingABI,
    chainId: hardhatLocal.id,
    functionName: "getOffer",
    args: [offerId],
  });

  const currentOffer = offer as { amount: bigint; pricePerWh: bigint } | undefined;
  const totalCost = currentOffer ? currentOffer.amount * currentOffer.pricePerWh : 0n;

  const handleConfirm = async () => {
    if (!currentOffer) return;

    setIsProcessing(true);
    const toastId = showTxLoading(tx("pending"));

    try {
      const hash = await acceptOffer(offerId, totalCost);
      showTxLoading(tx("confirming"), toastId);
      await waitForLocalTransaction(hash);
      dismissTxToast(toastId);
      showTxSuccess(tx("success"), {
        description: t("successMessage"),
        action: {
          label: t("viewCompletedTrades"),
          onClick: () => router.push("/completed-trades"),
        },
      });
      onClose();
    } catch {
      dismissTxToast(toastId);
      showTxError(tx("error"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {currentOffer ? formatWh(currentOffer.amount) : "—"} ·{" "}
            {currentOffer ? formatEth(totalCost) : "—"}
          </DialogDescription>
        </DialogHeader>

        {currentOffer ? (
          <div className="grid gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("amount")}</span>
              <span className="font-mono">{formatWh(currentOffer.amount)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("totalCost")}</span>
              <span className="font-mono text-market-up">{formatEth(totalCost)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("estGas")}</span>
              <span className="font-mono text-muted-foreground">~80,000</span>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={isProcessing || !currentOffer}>
            {isProcessing ? t("processing") : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
