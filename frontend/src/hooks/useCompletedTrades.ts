"use client";

import { useQuery } from "@tanstack/react-query";
import type { CompletedTradeView } from "@/lib/completed-trades";

async function fetchCompletedTrades(): Promise<CompletedTradeView[]> {
  const response = await fetch("/api/completed-trades", {
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error("failed-to-load-completed-trades");
  }

  return response.json();
}

export function useCompletedTrades() {
  return useQuery({
    queryKey: ["completed-trades"],
    queryFn: fetchCompletedTrades,
    refetchInterval: 5000,
    retry: false,
  });
}
