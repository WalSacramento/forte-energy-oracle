"use client";

import { useState } from "react";
import { parseEther } from "viem";
import { useTranslations } from "next-intl";
import { dismissTxToast, showTxError, showTxLoading, showTxSuccess } from "@/components/shared/TxToast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { waitForLocalTransaction } from "@/lib/transactions";
import { useEnergyTrading } from "@/hooks/useEnergyTrading";

export function CreateOfferForm() {
  const t = useTranslations("createOfferForm");
  const tx = useTranslations("txToast");
  const [meterId, setMeterId] = useState("METER001");
  const [amount, setAmount] = useState("1000");
  const [pricePerWh, setPricePerWh] = useState("0.0001");
  const { createOffer, isCreatingOffer } = useEnergyTrading();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const toastId = showTxLoading(tx("pending"));

    try {
      const hash = await createOffer(
        meterId,
        BigInt(amount),
        parseEther(pricePerWh),
        0n
      );
      showTxLoading(tx("confirming"), toastId);
      await waitForLocalTransaction(hash);
      dismissTxToast(toastId);
      showTxSuccess(tx("success"));
    } catch {
      dismissTxToast(toastId);
      showTxError(tx("error"));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("createOffer")}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="offer-meter">{t("meterId")}</Label>
            <Select
              value={meterId}
              onValueChange={(value) => {
                if (value) {
                  setMeterId(value);
                }
              }}
            >
              <SelectTrigger id="offer-meter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="METER001">METER001</SelectItem>
                <SelectItem value="METER002">METER002</SelectItem>
                <SelectItem value="METER003">METER003</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="offer-amount">{t("energyAmount")}</Label>
            <Input
              id="offer-amount"
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="offer-price">{t("pricePerWh")}</Label>
            <Input
              id="offer-price"
              type="number"
              step="0.00001"
              value={pricePerWh}
              onChange={(event) => setPricePerWh(event.target.value)}
            />
          </div>

          <Button type="submit" disabled={isCreatingOffer}>
            {isCreatingOffer ? t("processing") : t("createOffer")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
