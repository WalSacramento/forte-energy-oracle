"use client";

import { useReadContract, useWriteContract, useWatchContractEvent } from "wagmi";
import { useCallback, useRef, useState } from "react";
import type { Abi } from "viem";
import { EnergyAuctionABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { hardhatLocal } from "@/lib/wagmi-config";

export const ENERGY_AUCTION_CONTRACT = {
  address: CONTRACT_ADDRESSES.energyAuction,
  abi: EnergyAuctionABI,
  chainId: hardhatLocal.id,
} as const;

const PLACE_BID_ABI = [
  {
    type: "function",
    name: "placeBid",
    stateMutability: "payable",
    inputs: [{ name: "auctionId", type: "uint256" }],
    outputs: [],
  },
] as const satisfies Abi;

export function useEnergyAuction() {
  const { data: activeAuctions, refetch: refetchActive } = useReadContract({
    ...ENERGY_AUCTION_CONTRACT,
    functionName: "getActiveAuctions",
  });

  const { writeContract: writeCreate } = useWriteContract();
  const { writeContract: writeBid } = useWriteContract();
  const { writeContract: writeFinalize } = useWriteContract();
  const { writeContract: writeCancel } = useWriteContract();

  const createAuction = useCallback(
    (meterId: string, energyAmount: bigint, startPrice: bigint, minPrice: bigint, duration: bigint) =>
      writeCreate({
        ...ENERGY_AUCTION_CONTRACT,
        functionName: "createAuction",
        args: [meterId, energyAmount, startPrice, minPrice, duration],
      }),
    [writeCreate]
  );

  const placeBid = useCallback(
    (auctionId: bigint, value: bigint) =>
      writeBid({
        address: CONTRACT_ADDRESSES.energyAuction,
        abi: PLACE_BID_ABI,
        chainId: hardhatLocal.id,
        functionName: "placeBid",
        args: [auctionId],
        value,
      }),
    [writeBid]
  );

  const finalizeAuction = useCallback(
    (auctionId: bigint) =>
      writeFinalize({
        ...ENERGY_AUCTION_CONTRACT,
        functionName: "finalizeAuction",
        args: [auctionId],
      }),
    [writeFinalize]
  );

  const cancelAuction = useCallback(
    (auctionId: bigint) =>
      writeCancel({
        ...ENERGY_AUCTION_CONTRACT,
        functionName: "cancelAuction",
        args: [auctionId],
      }),
    [writeCancel]
  );

  // Latency tracking: time between placeBid confirmation and AuctionFinalized
  const bidConfirmedAt = useRef<Record<string, number>>({});
  const [latencies, setLatencies] = useState<Record<string, number>>({});

  useWatchContractEvent({
    ...ENERGY_AUCTION_CONTRACT,
    eventName: "AuctionCreated",
    onLogs: () => refetchActive(),
  });

  useWatchContractEvent({
    ...ENERGY_AUCTION_CONTRACT,
    eventName: "BidAccepted",
    onLogs: (logs) => {
      logs.forEach((log) => {
        const auctionId = (log as { args?: { auctionId?: bigint } }).args?.auctionId;
        if (auctionId !== undefined) {
          bidConfirmedAt.current[auctionId.toString()] = performance.now();
        }
      });
      refetchActive();
    },
  });

  useWatchContractEvent({
    ...ENERGY_AUCTION_CONTRACT,
    eventName: "AuctionFinalized",
    onLogs: (logs) => {
      logs.forEach((log) => {
        const auctionId = (log as { args?: { auctionId?: bigint } }).args?.auctionId;
        if (auctionId !== undefined) {
          const key = auctionId.toString();
          const start = bidConfirmedAt.current[key];
          if (start) {
            const latencyMs = performance.now() - start;
            setLatencies((prev) => ({ ...prev, [key]: latencyMs }));
            console.log(`[EAON] Auction ${key} latency: ${latencyMs.toFixed(1)}ms`);
          }
        }
      });
      refetchActive();
    },
  });

  useWatchContractEvent({
    ...ENERGY_AUCTION_CONTRACT,
    eventName: "AuctionCancelled",
    onLogs: () => refetchActive(),
  });

  return {
    activeAuctions: activeAuctions as bigint[] | undefined,
    createAuction,
    placeBid,
    finalizeAuction,
    cancelAuction,
    latencies,
  };
}
