"use client";

import { useReadContract, useWatchContractEvent } from "wagmi";
import { useRef } from "react";
import { OracleAggregatorABI, CONTRACT_ADDRESSES } from "@/lib/contracts";
import { hardhatLocal } from "@/lib/wagmi-config";

export const ORACLE_AGGREGATOR_CONTRACT = {
  address: CONTRACT_ADDRESSES.oracleAggregator,
  abi: OracleAggregatorABI,
  chainId: hardhatLocal.id,
} as const;

export function useOracleAggregator() {
  const { data: oracleCount } = useReadContract({
    ...ORACLE_AGGREGATOR_CONTRACT,
    functionName: "getActiveOracleCount",
  });

  const requestsRef = useRef<unknown[]>([]);

  useWatchContractEvent({
    ...ORACLE_AGGREGATOR_CONTRACT,
    eventName: "DataRequested",
    onLogs: (logs) => {
      requestsRef.current = [...requestsRef.current, ...logs];
    },
  });

  useWatchContractEvent({
    ...ORACLE_AGGREGATOR_CONTRACT,
    eventName: "DataAggregated",
    onLogs: () => {},
  });

  useWatchContractEvent({
    ...ORACLE_AGGREGATOR_CONTRACT,
    eventName: "ReputationUpdated",
    onLogs: () => {},
  });

  return {
    oracleCount: oracleCount as bigint | undefined,
    oracles: undefined as `0x${string}`[] | undefined,
    recentRequests: requestsRef.current,
  };
}
