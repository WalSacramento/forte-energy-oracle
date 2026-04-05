export type CompletedTradeSource = "offer" | "auction";
export type CompletedTradeFilter = "all" | "purchases" | "sales";

export interface CompletedTradeView {
  id: string;
  source: CompletedTradeSource;
  referenceId: string;
  buyer: string;
  seller: string;
  meterId: string;
  energyAmount: string;
  totalPriceWei: string;
  txHash: string;
  timestamp: number;
  blockNumber: number;
  status: "completed";
}
