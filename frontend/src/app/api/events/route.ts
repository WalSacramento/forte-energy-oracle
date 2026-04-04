/**
 * API Route: GET /api/events
 *
 * Maintains an in-memory buffer of trade and auction events from the blockchain.
 * On first request, subscribes to EnergyTrading and EnergyAuction contract events
 * via ethers.js. Returns the accumulated buffer as JSON.
 *
 * Design decision (from design.md D2): no external indexer — buffer is per-process.
 * History resets on server restart (acceptable for demo/paper).
 */

import { NextResponse } from "next/server";
import { ethers } from "ethers";

interface TradeEvent {
  type: "trade" | "auction";
  timestamp: number;
  amount: string;
  price: string;
  gasUsed?: number;
  txHash?: string;
}

const eventBuffer: TradeEvent[] = [];
let initialized = false;

function loadDeployment() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("../../../../../deployments/localhost.json");
  } catch {
    return null;
  }
}

function initializeListener() {
  if (initialized) return;
  initialized = true;

  const deployment = loadDeployment();
  if (!deployment) return;

  try {
    const provider = new ethers.JsonRpcProvider("http://localhost:8545");

    // EnergyTrading — TradeExecuted(tradeId, offerId, buyer, amount, totalPrice)
    const tradingAbi = [
      "event TradeExecuted(uint256 indexed tradeId, uint256 indexed offerId, address indexed buyer, uint256 amount, uint256 totalPrice)",
    ];
    const tradingContract = new ethers.Contract(
      deployment.contracts.EnergyTrading,
      tradingAbi,
      provider
    );

    tradingContract.on("TradeExecuted", async (tradeId, offerId, buyer, amount, totalPrice, eventObj) => {
      const receipt = await provider.getTransactionReceipt(eventObj.log.transactionHash);
      eventBuffer.unshift({
        type: "trade",
        timestamp: Math.floor(Date.now() / 1000),
        amount: amount.toString(),
        price: ethers.formatEther(totalPrice),
        gasUsed: receipt ? Number(receipt.gasUsed) : undefined,
        txHash: eventObj.log.transactionHash,
      });
      if (eventBuffer.length > 500) eventBuffer.pop();
    });

    // EnergyAuction — AuctionFinalized(auctionId, seller, winner, amount)
    const auctionAbi = [
      "event AuctionFinalized(uint256 indexed auctionId, address indexed seller, address indexed winner, uint256 amount)",
    ];
    const auctionContract = new ethers.Contract(
      deployment.contracts.EnergyAuction,
      auctionAbi,
      provider
    );

    auctionContract.on("AuctionFinalized", async (auctionId, seller, winner, amount, eventObj) => {
      const receipt = await provider.getTransactionReceipt(eventObj.log.transactionHash);
      eventBuffer.unshift({
        type: "auction",
        timestamp: Math.floor(Date.now() / 1000),
        amount: "0", // energyAmount not in this event; could be fetched separately
        price: ethers.formatEther(amount),
        gasUsed: receipt ? Number(receipt.gasUsed) : undefined,
        txHash: eventObj.log.transactionHash,
      });
      if (eventBuffer.length > 500) eventBuffer.pop();
    });
  } catch {
    // Non-fatal: listener fails gracefully if node is not running
  }
}

export async function GET() {
  initializeListener();
  return NextResponse.json(eventBuffer);
}
