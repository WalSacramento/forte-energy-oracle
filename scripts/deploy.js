/**
 * Deploy Script
 * Deploys all EAON contracts and sets up initial configuration
 */

const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("═══════════════════════════════════════════");
    console.log("       EAON Contract Deployment            ");
    console.log("═══════════════════════════════════════════\n");

    const [deployer, oracle1, oracle2, oracle3] = await hre.ethers.getSigners();

    // Hardhat default private keys (for reference)
    const hardhatKeys = [
        "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
    ];

    console.log("Deployer:", deployer.address);
    console.log("  Private Key:", hardhatKeys[0]);
    console.log("");
    console.log("Oracle 1:", oracle1.address);
    console.log("  Private Key:", hardhatKeys[1]);
    console.log("Oracle 2:", oracle2.address);
    console.log("  Private Key:", hardhatKeys[2]);
    console.log("Oracle 3:", oracle3.address);
    console.log("  Private Key:", hardhatKeys[3]);
    console.log("");

    // Configuration
    const MIN_RESPONSES = 2;
    const OUTLIER_THRESHOLD = 10; // 10%
    const REQUEST_DEADLINE = 30; // 30 seconds

    // Deploy OracleAggregator
    console.log("Deploying OracleAggregator...");
    const OracleAggregator = await hre.ethers.getContractFactory("OracleAggregator");
    const oracleAggregator = await OracleAggregator.deploy(
        MIN_RESPONSES,
        OUTLIER_THRESHOLD,
        REQUEST_DEADLINE
    );
    await oracleAggregator.waitForDeployment();
    const oracleAggregatorAddress = await oracleAggregator.getAddress();
    console.log("OracleAggregator deployed to:", oracleAggregatorAddress);

    // Deploy GridValidator
    console.log("\nDeploying GridValidator...");
    const GridValidator = await hre.ethers.getContractFactory("GridValidator");
    const gridValidator = await GridValidator.deploy();
    await gridValidator.waitForDeployment();
    const gridValidatorAddress = await gridValidator.getAddress();
    console.log("GridValidator deployed to:", gridValidatorAddress);

    // Deploy EnergyTrading
    console.log("\nDeploying EnergyTrading...");
    const EnergyTrading = await hre.ethers.getContractFactory("EnergyTrading");
    const energyTrading = await EnergyTrading.deploy(
        oracleAggregatorAddress,
        gridValidatorAddress
    );
    await energyTrading.waitForDeployment();
    const energyTradingAddress = await energyTrading.getAddress();
    console.log("EnergyTrading deployed to:", energyTradingAddress);

    // Setup: Register Oracles
    console.log("\n───────────────────────────────────────────");
    console.log("Registering Oracles...");

    await oracleAggregator.registerOracle(oracle1.address);
    console.log("Registered Oracle 1:", oracle1.address);

    await oracleAggregator.registerOracle(oracle2.address);
    console.log("Registered Oracle 2:", oracle2.address);

    await oracleAggregator.registerOracle(oracle3.address);
    console.log("Registered Oracle 3:", oracle3.address);

    // Deploy EnergyAuction
    console.log("\nDeploying EnergyAuction...");
    const EnergyAuction = await hre.ethers.getContractFactory("EnergyAuction");
    const energyAuction = await EnergyAuction.deploy(
        oracleAggregatorAddress,
        gridValidatorAddress
    );
    await energyAuction.waitForDeployment();
    const energyAuctionAddress = await energyAuction.getAddress();
    console.log("EnergyAuction deployed to:", energyAuctionAddress);

    // Authorize EnergyTrading to request data
    console.log("\nAuthorizing EnergyTrading contract...");
    await oracleAggregator.authorizeCaller(energyTradingAddress);
    console.log("EnergyTrading authorized to request oracle data");

    // Authorize EnergyAuction to request data
    console.log("Authorizing EnergyAuction contract...");
    await oracleAggregator.authorizeCaller(energyAuctionAddress);
    console.log("EnergyAuction authorized to request oracle data");

    // Verify deployment
    console.log("\n───────────────────────────────────────────");
    console.log("Verifying deployment...");

    const activeOracles = await oracleAggregator.getActiveOracleCount();
    console.log("Active oracles:", activeOracles.toString());

    const oracle1Info = await oracleAggregator.getOracleInfo(oracle1.address);
    console.log("Oracle 1 reputation:", oracle1Info.reputation.toString());

    // Save deployment addresses
    const deploymentInfo = {
        network: hre.network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            OracleAggregator: oracleAggregatorAddress,
            GridValidator: gridValidatorAddress,
            EnergyTrading: energyTradingAddress,
            EnergyAuction: energyAuctionAddress
        },
        oracles: {
            oracle1: {
                address: oracle1.address,
                privateKey: hardhatKeys[1]
            },
            oracle2: {
                address: oracle2.address,
                privateKey: hardhatKeys[2]
            },
            oracle3: {
                address: oracle3.address,
                privateKey: hardhatKeys[3]
            }
        },
        config: {
            minResponses: MIN_RESPONSES,
            outlierThreshold: OUTLIER_THRESHOLD,
            requestDeadline: REQUEST_DEADLINE
        }
    };

    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `${hre.network.name}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log("\nDeployment info saved to:", deploymentFile);

    console.log("\n═══════════════════════════════════════════");
    console.log("       Deployment Complete!                ");
    console.log("═══════════════════════════════════════════\n");

    return deploymentInfo;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });



