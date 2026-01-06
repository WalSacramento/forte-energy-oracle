/**
 * Contract Verification Script
 * Verifies deployed contracts on Etherscan
 *
 * Prerequisites:
 * - Contracts must be deployed (run deploy-sepolia.js first)
 * - ETHERSCAN_API_KEY must be set in .env.testnet
 * - Get free API key at: https://etherscan.io/apis
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Helper function to wait between retries
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Verifies a contract on Etherscan with retry logic
 */
async function verifyContract(address, contractName, constructorArgs, maxRetries = 3) {
  console.log(`\nVerifying ${contractName} at ${address}...`);

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await hre.run("verify:verify", {
        address: address,
        constructorArguments: constructorArgs
      });

      console.log(`  ✓ ${contractName} verified successfully`);
      console.log(`    View at: https://sepolia.etherscan.io/address/${address}#code`);
      return true;
    } catch (error) {
      if (error.message.includes("Already Verified")) {
        console.log(`  ⚠️  ${contractName} is already verified`);
        return true;
      }

      if (attempt < maxRetries) {
        console.log(`  ⚠️  Attempt ${attempt} failed, retrying in 10s...`);
        console.log(`     Error: ${error.message.split('\n')[0]}`);
        await sleep(10000);
      } else {
        console.error(`  ✗ Failed to verify ${contractName} after ${maxRetries} attempts`);
        console.error(`    Error: ${error.message}`);
        return false;
      }
    }
  }

  return false;
}

async function main() {
  console.log("═".repeat(70));
  console.log("       Contract Verification - Sepolia Testnet");
  console.log("═".repeat(70));
  console.log();

  // Check if Etherscan API key is set
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error(
      "ETHERSCAN_API_KEY not set. Get one at https://etherscan.io/apis " +
      "and add it to .env.testnet"
    );
  }

  // Load deployment info
  const deploymentPath = path.join(__dirname, "../../deployments/sepolia-deployment.json");

  if (!fs.existsSync(deploymentPath)) {
    throw new Error(
      "Deployment file not found. Please run deploy-sepolia.js first.\n" +
      `Expected file: ${deploymentPath}`
    );
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  console.log("Loaded deployment from:", deploymentPath);
  console.log("Deployment timestamp:", deployment.timestamp);
  console.log();

  // Verify network
  const network = await hre.ethers.provider.getNetwork();
  if (network.chainId !== 11155111n) {
    throw new Error("Must be connected to Sepolia testnet (Chain ID: 11155111)");
  }

  console.log("Network:", network.name, "(Chain ID:", Number(network.chainId), ")");
  console.log();

  console.log("─".repeat(70));
  console.log("VERIFYING CONTRACTS");
  console.log("─".repeat(70));

  const results = [];

  // 1. Verify OracleAggregator
  const oracleSuccess = await verifyContract(
    deployment.contracts.OracleAggregator,
    "OracleAggregator",
    [
      deployment.configuration.minResponses,
      deployment.configuration.outlierThreshold,
      deployment.configuration.requestDeadline
    ]
  );
  results.push({ contract: "OracleAggregator", success: oracleSuccess });

  await sleep(5000); // Wait 5s between verifications

  // 2. Verify GridValidator
  const gridSuccess = await verifyContract(
    deployment.contracts.GridValidator,
    "GridValidator",
    [] // No constructor args
  );
  results.push({ contract: "GridValidator", success: gridSuccess });

  await sleep(5000);

  // 3. Verify EnergyTrading
  const tradingSuccess = await verifyContract(
    deployment.contracts.EnergyTrading,
    "EnergyTrading",
    [
      deployment.contracts.OracleAggregator,
      deployment.contracts.GridValidator
    ]
  );
  results.push({ contract: "EnergyTrading", success: tradingSuccess });

  // Print summary
  console.log("\n" + "═".repeat(70));
  console.log("VERIFICATION SUMMARY");
  console.log("═".repeat(70));

  const successful = results.filter(r => r.success).length;
  const total = results.length;

  console.log(`\nVerified ${successful}/${total} contracts:`);
  results.forEach(({ contract, success }) => {
    const icon = success ? "✓" : "✗";
    const status = success ? "Verified" : "Failed";
    console.log(`  ${icon} ${contract}: ${status}`);
  });

  if (successful === total) {
    console.log("\n🎉 All contracts verified successfully!");
    console.log("\n🔗 View on Etherscan:");
    console.log("   OracleAggregator:", deployment.explorerLinks.OracleAggregator);
    console.log("   GridValidator:   ", deployment.explorerLinks.GridValidator);
    console.log("   EnergyTrading:   ", deployment.explorerLinks.EnergyTrading);
  } else {
    console.log("\n⚠️  Some contracts failed to verify.");
    console.log("   You can try verifying them manually on Etherscan.");
  }

  console.log("\n═".repeat(70));

  process.exit(successful === total ? 0 : 1);
}

main()
  .then(() => {})
  .catch((error) => {
    console.error("\n❌ Verification failed:");
    console.error(error.message);
    process.exit(1);
  });
