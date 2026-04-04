import { createConfig, http } from "wagmi";
import { defineChain } from "viem";
import { injected } from "@wagmi/core";

export const hardhatLocal = defineChain({
  id: 31337,
  name: "Hardhat",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://localhost:8545"] },
  },
});

export const wagmiConfig = createConfig({
  chains: [hardhatLocal],
  connectors: [injected()],
  transports: {
    [hardhatLocal.id]: http("http://localhost:8545"),
  },
});
