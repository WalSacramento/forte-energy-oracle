"use client";

import { useCallback, useEffect, useState } from "react";

interface UseDutchPriceParams {
  startPrice: bigint;
  priceDecayRate: bigint;
  startTime: bigint;   // unix seconds
  minPrice: bigint;
  endTime: bigint;     // unix seconds
}

interface DutchPriceResult {
  currentPrice: bigint;
  percentDecayed: number;
  isExpired: boolean;
}

/**
 * Returns a live-updating Dutch auction price, ticking every second.
 * All values are in wei per Wh.
 */
export function useDutchPrice({
  startPrice,
  priceDecayRate,
  startTime,
  minPrice,
  endTime,
}: UseDutchPriceParams): DutchPriceResult {
  const compute = useCallback((): DutchPriceResult => {
    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const isExpired = nowSeconds >= endTime;

    if (isExpired) {
      return { currentPrice: minPrice, percentDecayed: 100, isExpired: true };
    }

    if (nowSeconds <= startTime) {
      return { currentPrice: startPrice, percentDecayed: 0, isExpired: false };
    }

    const elapsed = nowSeconds - startTime;
    const decay = elapsed * priceDecayRate;
    const range = startPrice - minPrice;
    const currentPrice = decay >= range ? minPrice : startPrice - decay;
    const percentDecayed = range > 0n ? Number((decay * 100n) / range) : 0;

    return { currentPrice, percentDecayed: Math.min(100, percentDecayed), isExpired: false };
  }, [endTime, minPrice, priceDecayRate, startPrice, startTime]);

  const [state, setState] = useState<DutchPriceResult>(() => compute());

  useEffect(() => {
    setState(compute());
    const interval = setInterval(() => setState(compute()), 1000);
    return () => clearInterval(interval);
  }, [compute]);

  return state;
}
