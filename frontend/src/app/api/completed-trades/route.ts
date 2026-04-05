import { NextResponse } from "next/server";
import { ethers } from "ethers";
import type { CompletedTradeView } from "@/lib/completed-trades";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type DeploymentInfo = {
  contracts: {
    EnergyTrading: string;
    EnergyAuction: string;
  };
};

function loadDeployment(): DeploymentInfo | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../../../../../deployments/localhost.json");
  } catch {
    return null;
  }
}

function getRpcUrl() {
  return process.env.NEXT_PUBLIC_RPC_URL ?? "http://localhost:8545";
}

async function loadCompletedTrades(): Promise<CompletedTradeView[]> {
  const deployment = loadDeployment();
  if (!deployment) {
    return [];
  }

  const provider = new ethers.JsonRpcProvider(getRpcUrl());

  const tradingAbi = [
    "event TradeExecuted(uint256 indexed tradeId, uint256 indexed offerId, address indexed buyer, uint256 amount, uint256 totalPrice)",
    "function getOffer(uint256 offerId) view returns (tuple(uint256 id,address seller,string meterId,uint256 amount,uint256 pricePerWh,uint256 createdAt,uint256 expiresAt,uint8 status,uint256 validatedReading,uint256 requestId))",
  ];

  const auctionAbi = [
    "event AuctionFinalized(uint256 indexed auctionId, address indexed seller, address indexed winner, uint256 amount)",
    "function getAuction(uint256 auctionId) view returns (tuple(uint256 id,address seller,string meterId,uint256 energyAmount,uint256 startPrice,uint256 minPrice,uint256 priceDecayRate,uint256 startTime,uint256 endTime,uint256 oracleRequestId,address winner,uint256 finalPrice,uint8 status))",
  ];

  const tradingContract = new ethers.Contract(deployment.contracts.EnergyTrading, tradingAbi, provider);
  const auctionContract = new ethers.Contract(deployment.contracts.EnergyAuction, auctionAbi, provider);

  const [tradeEvents, auctionEvents] = await Promise.all([
    tradingContract.queryFilter(tradingContract.filters.TradeExecuted(), 0, "latest"),
    auctionContract.queryFilter(auctionContract.filters.AuctionFinalized(), 0, "latest"),
  ]);

  const fixedTrades = await Promise.all(
    tradeEvents.map(async (rawEvent) => {
      const event = rawEvent as ethers.EventLog & {
        args: {
          tradeId: bigint;
          offerId: bigint;
          buyer: string;
          amount: bigint;
          totalPrice: bigint;
        };
      };
      const [offer, block] = await Promise.all([
        tradingContract.getOffer(event.args.offerId),
        provider.getBlock(event.blockNumber),
      ]);

      return {
        id: `offer-${event.args.tradeId.toString()}`,
        source: "offer",
        referenceId: event.args.offerId.toString(),
        buyer: event.args.buyer,
        seller: offer.seller,
        meterId: offer.meterId,
        energyAmount: event.args.amount.toString(),
        totalPriceWei: event.args.totalPrice.toString(),
        txHash: event.transactionHash,
        timestamp: block?.timestamp ?? 0,
        blockNumber: event.blockNumber,
        status: "completed",
      } satisfies CompletedTradeView;
    })
  );

  const auctionTrades = await Promise.all(
    auctionEvents.map(async (rawEvent) => {
      const event = rawEvent as ethers.EventLog & {
        args: {
          auctionId: bigint;
          seller: string;
          winner: string;
          amount: bigint;
        };
      };
      const [auction, block] = await Promise.all([
        auctionContract.getAuction(event.args.auctionId),
        provider.getBlock(event.blockNumber),
      ]);

      return {
        id: `auction-${event.args.auctionId.toString()}`,
        source: "auction",
        referenceId: event.args.auctionId.toString(),
        buyer: event.args.winner,
        seller: event.args.seller,
        meterId: auction.meterId,
        energyAmount: auction.energyAmount.toString(),
        totalPriceWei: event.args.amount.toString(),
        txHash: event.transactionHash,
        timestamp: block?.timestamp ?? 0,
        blockNumber: event.blockNumber,
        status: "completed",
      } satisfies CompletedTradeView;
    })
  );

  return [...fixedTrades, ...auctionTrades].sort((a, b) => {
    if (b.blockNumber !== a.blockNumber) {
      return b.blockNumber - a.blockNumber;
    }

    return b.timestamp - a.timestamp;
  });
}

export async function GET() {
  try {
    const trades = await loadCompletedTrades();
    return NextResponse.json(trades);
  } catch {
    return NextResponse.json([]);
  }
}
