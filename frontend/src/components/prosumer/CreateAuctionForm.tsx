"use client";

import { useMemo, useState } from "react";
import { parseEther } from "viem";
import { useTranslations } from "next-intl";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
import { useEnergyAuction } from "@/hooks/useEnergyAuction";

export function CreateAuctionForm() {
  const t = useTranslations("createAuctionForm");
  const tx = useTranslations("txToast");
  const [meterId, setMeterId] = useState("METER001");
  const [energyAmount, setEnergyAmount] = useState("500");
  const [startPriceEth, setStartPriceEth] = useState("0.01");
  const [minPriceEth, setMinPriceEth] = useState("0.004");
  const [durationMin, setDurationMin] = useState("60");
  const { createAuction } = useEnergyAuction();

  const chartData = useMemo(() => {
    const start = parseFloat(startPriceEth) || 0;
    const min = parseFloat(minPriceEth) || 0;
    const duration = parseInt(durationMin, 10) || 60;
    const points = 30;

    return Array.from({ length: points + 1 }, (_, index) => {
      const minute = (index / points) * duration;
      const price = start - (start - min) * (index / points);
      return { minute: Math.round(minute), price: Math.max(min, price) };
    });
  }, [durationMin, minPriceEth, startPriceEth]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const toastId = showTxLoading(tx("pending"));

    try {
      const hash = await createAuction(
        meterId,
        BigInt(energyAmount),
        parseEther(startPriceEth),
        parseEther(minPriceEth),
        BigInt(parseInt(durationMin, 10) * 60)
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
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <CardHeader>
          <CardTitle>{t("createAuction")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="auction-meter">{t("meterId")}</Label>
              <Select
                value={meterId}
                onValueChange={(value) => {
                  if (value) {
                    setMeterId(value);
                  }
                }}
              >
                <SelectTrigger id="auction-meter">
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
              <Label htmlFor="auction-energy">{t("energyAmount")}</Label>
              <Input
                id="auction-energy"
                type="number"
                value={energyAmount}
                onChange={(event) => setEnergyAmount(event.target.value)}
              />
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="auction-start-price">{t("startPrice")}</Label>
                <Input
                  id="auction-start-price"
                  type="number"
                  step="0.0001"
                  value={startPriceEth}
                  onChange={(event) => setStartPriceEth(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="auction-min-price">{t("minPrice")}</Label>
                <Input
                  id="auction-min-price"
                  type="number"
                  step="0.0001"
                  value={minPriceEth}
                  onChange={(event) => setMinPriceEth(event.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="auction-duration">{t("duration")}</Label>
              <Input
                id="auction-duration"
                type="number"
                value={durationMin}
                onChange={(event) => setDurationMin(event.target.value)}
              />
            </div>

            <Button type="submit" data-testid="create-auction-submit">{t("createAuction")}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("priceDecayPreview")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" />
                <XAxis
                  dataKey="minute"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <YAxis
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 12,
                  }}
                />
                <ReferenceLine
                  y={parseFloat(minPriceEth) || 0}
                  stroke="hsl(var(--chart-2))"
                  strokeDasharray="4 4"
                />
                <Line
                  type="linear"
                  dataKey="price"
                  stroke="hsl(var(--chart-1))"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
