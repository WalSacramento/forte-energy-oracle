/**
 * Setup Oracles Script
 * Registers oracles in an already deployed contract
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("═══════════════════════════════════════════");
    console.log("       Oracle Registration                 ");
    console.log("═══════════════════════════════════════════\n");

    // Load deployment info
    const deploymentPath = path.join(__dirname, "..", "deployments", "localhost.json");
    
    if (!fs.existsSync(deploymentPath)) {
        console.error("Deployment file not found. Run deploy.js first.");
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
    const contractAddress = deployment.contracts.OracleAggregator;

    console.log(`OracleAggregator address: ${contractAddress}`);

    const [owner, oracle1, oracle2, oracle3] = await hre.ethers.getSigners();

    console.log(`\nOracle addresses:`);
    console.log(`  Oracle 1: ${oracle1.address}`);
    console.log(`  Oracle 2: ${oracle2.address}`);
    console.log(`  Oracle 3: ${oracle3.address}`);

    // Get contract instance
    const oracleAggregator = await hre.ethers.getContractAt(
        "OracleAggregator",
        contractAddress
    );

    // Check current state
    const activeCount = await oracleAggregator.getActiveOracleCount();
    console.log(`\nCurrent active oracles: ${activeCount}`);

    if (activeCount >= 3) {
        console.log("Oracles already registered!");
        
        // Show oracle info
        for (const oracle of [oracle1, oracle2, oracle3]) {
            const info = await oracleAggregator.getOracleInfo(oracle.address);
            console.log(`  ${oracle.address}: reputation=${info.reputation}, active=${info.isActive}`);
        }
        return;
    }

    // Register oracles
    console.log("\nRegistering oracles...");

    const oracles = [oracle1, oracle2, oracle3];
    for (let i = 0; i < oracles.length; i++) {
        const oracle = oracles[i];
        const info = await oracleAggregator.getOracleInfo(oracle.address);
        
        if (!info.isActive) {
            const tx = await oracleAggregator.registerOracle(oracle.address);
            await tx.wait();
            console.log(`  Registered Oracle ${i + 1}: ${oracle.address}`);
        } else {
            console.log(`  Oracle ${i + 1} already registered: ${oracle.address}`);
        }
    }

    // Verify
    const finalCount = await oracleAggregator.getActiveOracleCount();
    console.log(`\nFinal active oracle count: ${finalCount}`);

    console.log("\n═══════════════════════════════════════════");
    console.log("       Setup Complete!                     ");
    console.log("═══════════════════════════════════════════\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });



