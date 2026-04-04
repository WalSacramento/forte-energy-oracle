"use client";

import { useReadContract, useWriteContract, useWatchContractEvent } from "wagmi";
import { useCallback, useRef } from "react";
import type { Abi } from "viem";
import { EnergyTradingABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { hardhatLocal } from "@/lib/wagmi-config";

export const ENERGY_TRADING_CONTRACT = {
  address: CONTRACT_ADDRESSES.energyTrading,
  abi: EnergyTradingABI,
  chainId: hardhatLocal.id,
} as const;

const ACCEPT_OFFER_ABI = [
  {
    type: "function",
    name: "acceptOffer",
    stateMutability: "payable",
    inputs: [{ name: "offerId", type: "uint256" }],
    outputs: [],
  },
] as const satisfies Abi;

export function useEnergyTrading() {
  const { data: activeOffers, refetch: refetchOffers } = useReadContract({
    ...ENERGY_TRADING_CONTRACT,
    functionName: "getActiveOffers",
  });

  const { writeContract: writeCreateOffer, isPending: isCreatingOffer } = useWriteContract();
  const { writeContract: writeAcceptOffer, isPending: isAcceptingOffer } = useWriteContract();
  const { writeContract: writeCancelOffer, isPending: isCancellingOffer } = useWriteContract();

  const createOffer = useCallback(
    (meterId: string, amount: bigint, pricePerWh: bigint, duration: bigint) =>
      writeCreateOffer({
        ...ENERGY_TRADING_CONTRACT,
        functionName: "createOffer",
        args: [meterId, amount, pricePerWh, duration],
      }),
    [writeCreateOffer]
  );

  const acceptOffer = useCallback(
    (offerId: bigint, value: bigint) =>
      writeAcceptOffer({
        address: CONTRACT_ADDRESSES.energyTrading,
        abi: ACCEPT_OFFER_ABI,
        chainId: hardhatLocal.id,
        functionName: "acceptOffer",
        args: [offerId],
        value,
      }),
    [writeAcceptOffer]
  );

  const cancelOffer = useCallback(
    (offerId: bigint) =>
      writeCancelOffer({
        ...ENERGY_TRADING_CONTRACT,
        functionName: "cancelOffer",
        args: [offerId],
      }),
    [writeCancelOffer]
  );

  const eventsRef = useRef<unknown[]>([]);

  useWatchContractEvent({
    ...ENERGY_TRADING_CONTRACT,
    eventName: "OfferCreated",
    onLogs: (logs) => {
      eventsRef.current = [...eventsRef.current, ...logs];
      refetchOffers();
    },
  });

  useWatchContractEvent({
    ...ENERGY_TRADING_CONTRACT,
    eventName: "TradeExecuted",
    onLogs: (logs) => {
      eventsRef.current = [...eventsRef.current, ...logs];
      refetchOffers();
    },
  });

  return {
    activeOffers: activeOffers as bigint[] | undefined,
    createOffer,
    acceptOffer,
    cancelOffer,
    isCreatingOffer,
    isAcceptingOffer,
    isCancellingOffer,
    events: eventsRef.current,
  };
}
