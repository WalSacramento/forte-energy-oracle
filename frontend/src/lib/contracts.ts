/**
 * Loads contract ABIs from Hardhat artifacts and addresses from deployments/localhost.json.
 * Paths are relative to the project root (two levels up from frontend/src/lib/).
 */

// ABIs — imported directly from Hardhat artifacts
// eslint-disable-next-line @typescript-eslint/no-require-imports
const OracleAggregatorArtifact = require("../../../artifacts/contracts/OracleAggregator.sol/OracleAggregator.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EnergyTradingArtifact = require("../../../artifacts/contracts/EnergyTrading.sol/EnergyTrading.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const EnergyAuctionArtifact = require("../../../artifacts/contracts/EnergyAuction.sol/EnergyAuction.json");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const GridValidatorArtifact = require("../../../artifacts/contracts/GridValidator.sol/GridValidator.json");

export const OracleAggregatorABI = OracleAggregatorArtifact.abi as readonly unknown[];
export const EnergyTradingABI = EnergyTradingArtifact.abi as readonly unknown[];
export const EnergyAuctionABI = EnergyAuctionArtifact.abi as readonly unknown[];
export const GridValidatorABI = GridValidatorArtifact.abi as readonly unknown[];

// Addresses — loaded from deployments file written by deploy.js
function loadAddresses() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const deployment = require("../../../deployments/localhost.json");
    return {
      oracleAggregator: deployment.contracts.OracleAggregator as `0x${string}`,
      energyTrading:    deployment.contracts.EnergyTrading    as `0x${string}`,
      energyAuction:    deployment.contracts.EnergyAuction    as `0x${string}`,
      gridValidator:    deployment.contracts.GridValidator     as `0x${string}`,
    };
  } catch {
    // Return empty addresses before first deploy
    const zero = "0x0000000000000000000000000000000000000000" as `0x${string}`;
    return {
      oracleAggregator: zero,
      energyTrading:    zero,
      energyAuction:    zero,
      gridValidator:    zero,
    };
  }
}

export const CONTRACT_ADDRESSES = loadAddresses();
