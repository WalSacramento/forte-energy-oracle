/**
 * Sepolia Testnet Deployment Script
 * Deploys all EAON contracts to Sepolia testnet
 *
 * Prerequisites:
 * - Configure .env.testnet with Sepolia RPC URL and private keys
 * - Ensure deployer account has sufficient Sepolia ETH (>0.5 ETH recommended)
 * - Get testnet ETH from https://sepoliafaucet.com/
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("═".repeat(70));
  console.log("       EAON Contract Deployment - Sepolia Testnet");
  console.log("═".repeat(70));
  console.log();

  // Get network info
  const network = await hre.ethers.provider.getNetwork();
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);

  if (network.chainId !== 11155111n) {
    throw new Error("This script is for Sepolia testnet only (Chain ID: 11155111)");
  }

  // Get signers
  const [deployer, oracle1, oracle2, oracle3] = await hre.ethers.getSigners();

  console.log("\nDeployer:", deployer.address);
  const deployerBalance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("  Balance:", hre.ethers.formatEther(deployerBalance), "ETH");

  if (deployerBalance < hre.ethers.parseEther("0.5")) {
    console.warn("\n⚠️  WARNING: Deployer balance is low (<0.5 ETH)");
    console.warn("   Deployment may fail. Get more testnet ETH from:");
    console.warn("   - https://sepoliafaucet.com/");
    console.warn("   - https://faucet.quicknode.com/ethereum/sepolia\n");
  }

  console.log("\nOracle Addresses:");
  console.log("  Oracle 1:", oracle1.address);
  console.log("  Oracle 2:", oracle2.address);
  console.log("  Oracle 3:", oracle3.address);
  console.log();

  // Configuration
  const MIN_RESPONSES = 2;
  const OUTLIER_THRESHOLD = 10; // 10%
  // Deadline maior para testnet: block time ~12s (vs ~1s local)
  // 120s permite tempo suficiente para processamento e confirmação
  const REQUEST_DEADLINE = 120; // 120 seconds (testnet requires longer deadline)

  console.log("Contract Configuration:");
  console.log(`  Min Responses: ${MIN_RESPONSES}`);
  console.log(`  Outlier Threshold: ${OUTLIER_THRESHOLD}%`);
  console.log(`  Request Deadline: ${REQUEST_DEADLINE}s`);
  console.log();

  console.log("─".repeat(70));
  console.log("DEPLOYING CONTRACTS");
  console.log("─".repeat(70));

  // Deploy OracleAggregator
  console.log("\n1️⃣  Deploying OracleAggregator...");
  const OracleAggregator = await hre.ethers.getContractFactory("OracleAggregator");
  const oracleAggregator = await OracleAggregator.deploy(
    MIN_RESPONSES,
    OUTLIER_THRESHOLD,
    REQUEST_DEADLINE
  );
  await oracleAggregator.waitForDeployment();
  const oracleAggregatorAddress = await oracleAggregator.getAddress();
  console.log("   ✓ Deployed to:", oracleAggregatorAddress);
  console.log("   View on Etherscan:", `https://sepolia.etherscan.io/address/${oracleAggregatorAddress}`);

  // Deploy GridValidator
  console.log("\n2️⃣  Deploying GridValidator...");
  const GridValidator = await hre.ethers.getContractFactory("GridValidator");
  const gridValidator = await GridValidator.deploy();
  await gridValidator.waitForDeployment();
  const gridValidatorAddress = await gridValidator.getAddress();
  console.log("   ✓ Deployed to:", gridValidatorAddress);
  console.log("   View on Etherscan:", `https://sepolia.etherscan.io/address/${gridValidatorAddress}`);

  // Deploy EnergyTrading
  console.log("\n3️⃣  Deploying EnergyTrading...");
  const EnergyTrading = await hre.ethers.getContractFactory("EnergyTrading");
  const energyTrading = await EnergyTrading.deploy(
    oracleAggregatorAddress,
    gridValidatorAddress
  );
  await energyTrading.waitForDeployment();
  const energyTradingAddress = await energyTrading.getAddress();
  console.log("   ✓ Deployed to:", energyTradingAddress);
  console.log("   View on Etherscan:", `https://sepolia.etherscan.io/address/${energyTradingAddress}`);

  // Deploy EnergyAuction
  console.log("\n4️⃣  Deploying EnergyAuction...");
  const EnergyAuction = await hre.ethers.getContractFactory("EnergyAuction");
  const energyAuction = await EnergyAuction.deploy(
    oracleAggregatorAddress,
    gridValidatorAddress
  );
  await energyAuction.waitForDeployment();
  const energyAuctionAddress = await energyAuction.getAddress();
  console.log("   ✓ Deployed to:", energyAuctionAddress);
  console.log("   View on Etherscan:", `https://sepolia.etherscan.io/address/${energyAuctionAddress}`);

  // Setup: Register Oracles
  console.log("\n" + "─".repeat(70));
  console.log("REGISTERING ORACLES");
  console.log("─".repeat(70));

  console.log("\nRegistering 3 oracles...");
  await oracleAggregator.registerOracle(oracle1.address);
  console.log("  ✓ Registered Oracle 1:", oracle1.address);

  await oracleAggregator.registerOracle(oracle2.address);
  console.log("  ✓ Registered Oracle 2:", oracle2.address);

  await oracleAggregator.registerOracle(oracle3.address);
  console.log("  ✓ Registered Oracle 3:", oracle3.address);

  // Authorize EnergyTrading
  console.log("\nAuthorizing EnergyTrading contract...");
  await oracleAggregator.authorizeCaller(energyTradingAddress);
  console.log("  ✓ EnergyTrading authorized");

  // Authorize EnergyAuction
  console.log("Authorizing EnergyAuction contract...");
  await oracleAggregator.authorizeCaller(energyAuctionAddress);
  console.log("  ✓ EnergyAuction authorized");

  // Verify deployment
  console.log("\n" + "─".repeat(70));
  console.log("VERIFYING DEPLOYMENT");
  console.log("─".repeat(70));

  const activeOracles = await oracleAggregator.getActiveOracleCount();
  console.log("\nActive oracles:", activeOracles.toString(), "/ 3");

  const oracle1Info = await oracleAggregator.getOracleInfo(oracle1.address);
  console.log("Oracle 1 reputation:", oracle1Info.reputation.toString());

  // Save deployment info
  const deploymentInfo = {
    network: "sepolia",
    chainId: Number(network.chainId),
    timestamp: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      OracleAggregator: oracleAggregatorAddress,
      GridValidator: gridValidatorAddress,
      EnergyTrading: energyTradingAddress,
      EnergyAuction: energyAuctionAddress
    },
    oracles: [
      oracle1.address,
      oracle2.address,
      oracle3.address
    ],
    configuration: {
      minResponses: MIN_RESPONSES,
      outlierThreshold: OUTLIER_THRESHOLD,
      requestDeadline: REQUEST_DEADLINE
    },
    explorerLinks: {
      OracleAggregator: `https://sepolia.etherscan.io/address/${oracleAggregatorAddress}`,
      GridValidator: `https://sepolia.etherscan.io/address/${gridValidatorAddress}`,
      EnergyTrading: `https://sepolia.etherscan.io/address/${energyTradingAddress}`,
      EnergyAuction: `https://sepolia.etherscan.io/address/${energyAuctionAddress}`
    }
  };

  // Ensure deployments directory exists
  const deploymentsDir = path.join(__dirname, "../../deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentPath = path.join(deploymentsDir, "sepolia-deployment.json");
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\nDeployment info saved to:", deploymentPath);

  // Print summary
  console.log("\n" + "═".repeat(70));
  console.log("DEPLOYMENT SUCCESSFUL!");
  console.log("═".repeat(70));
  console.log("\n📋 Contract Addresses:");
  console.log("   OracleAggregator:", oracleAggregatorAddress);
  console.log("   GridValidator:   ", gridValidatorAddress);
  console.log("   EnergyTrading:   ", energyTradingAddress);

  console.log("\n🔗 Etherscan Links:");
  console.log("   OracleAggregator:", deploymentInfo.explorerLinks.OracleAggregator);
  console.log("   GridValidator:   ", deploymentInfo.explorerLinks.GridValidator);
  console.log("   EnergyTrading:   ", deploymentInfo.explorerLinks.EnergyTrading);

  console.log("\n📝 Next Steps:");
  console.log("   1. Verify contracts on Etherscan:");
  console.log("      npx hardhat run scripts/testnet/verify-contracts.js --network sepolia");
  console.log();
  console.log("   2. Update .env.testnet with CONTRACT_ADDRESS:");
  console.log(`      CONTRACT_ADDRESS=${oracleAggregatorAddress}`);
  console.log();
  console.log("   3. Run performance tests:");
  console.log("      NUM_TRANSACTIONS=100 node scripts/testnet/performance-test.js");
  console.log();
  console.log("═".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });
