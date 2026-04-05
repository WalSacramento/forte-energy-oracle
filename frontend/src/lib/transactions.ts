"use client";

import { waitForTransactionReceipt } from "@wagmi/core";
import type { Hash } from "viem";
import { wagmiConfig, hardhatLocal } from "@/lib/wagmi-config";

export async function waitForLocalTransaction(hash: Hash) {
  return waitForTransactionReceipt(wagmiConfig, {
    chainId: hardhatLocal.id,
    hash,
  });
}
