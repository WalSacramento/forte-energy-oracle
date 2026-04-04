/**
 * Gas Measurement Script
 * Deploys all contracts and measures gas cost for each key operation.
 * Run with: npx hardhat run scripts/measure-gas.js --network localhost
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");

async function measureGas(tx, label) {
    const receipt = await tx.wait();
    const gasUsed = Number(receipt.gasUsed);
    const gasCostEth = ethers.formatEther(receipt.gasUsed * receipt.gasPrice);
    console.log(`  ${label.padEnd(30)} gas: ${gasUsed.toLocaleString().padStart(10)} (${gasCostEth} ETH)`);
    return gasUsed;
}

async function main() {
    console.log("═".repeat(60));
    console.log("  EAON Gas Measurement Report");
    console.log("═".repeat(60));

    const [owner, oracle1, oracle2, oracle3, seller, buyer] = await ethers.getSigners();

    // ── Deploy ──────────────────────────────────────────────────
    const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
    const oracleAggregator = await OracleAggregator.deploy(2, 10, 300);
    await oracleAggregator.waitForDeployment();

    const GridValidator = await ethers.getContractFactory("GridValidator");
    const gridValidator = await GridValidator.deploy();
    await gridValidator.waitForDeployment();

    const EnergyTrading = await ethers.getContractFactory("EnergyTrading");
    const energyTrading = await EnergyTrading.deploy(
        await oracleAggregator.getAddress(),
        await gridValidator.getAddress()
    );
    await energyTrading.waitForDeployment();

    const EnergyAuction = await ethers.getContractFactory("EnergyAuction");
    const energyAuction = await EnergyAuction.deploy(
        await oracleAggregator.getAddress(),
        await gridValidator.getAddress()
    );
    await energyAuction.waitForDeployment();

    // Register oracles and authorize contracts
    await oracleAggregator.registerOracle(oracle1.address);
    await oracleAggregator.registerOracle(oracle2.address);
    await oracleAggregator.registerOracle(oracle3.address);
    await oracleAggregator.authorizeCaller(await energyTrading.getAddress());
    await oracleAggregator.authorizeCaller(await energyAuction.getAddress());

    const sign = async (signer, requestId, value) => {
        const hash = ethers.solidityPackedKeccak256(["uint256", "uint256"], [requestId, value]);
        return signer.signMessage(ethers.getBytes(hash));
    };

    // ── EnergyTrading Operations ────────────────────────────────
    console.log("\n── EnergyTrading ──");

    const offerTx = await energyTrading.connect(seller).createOffer(
        "METER001", 1000n, ethers.parseEther("0.001"), 0n
    );
    const offerGas = await measureGas(offerTx, "createOffer");

    // Fund offer request via oracle
    const offerObj = await energyTrading.getOffer(1);
    const reqId = offerObj.requestId;
    const sig1 = await sign(oracle1, reqId, 1000n);
    await oracleAggregator.connect(oracle1).submitResponse(reqId, 1000n, sig1);
    const sig2 = await sign(oracle2, reqId, 1000n);
    await oracleAggregator.connect(oracle2).submitResponse(reqId, 1000n, sig2);

    const totalPrice = 1000n * ethers.parseEther("0.001");
    const acceptTx = await energyTrading.connect(buyer).acceptOffer(1, { value: totalPrice });
    const acceptGas = await measureGas(acceptTx, "acceptOffer");

    // ── EnergyAuction Operations ────────────────────────────────
    console.log("\n── EnergyAuction ──");

    const createAuctionTx = await energyAuction.connect(seller).createAuction(
        "METER001",
        500n,
        ethers.parseEther("0.01"),
        ethers.parseEther("0.004"),
        3600n
    );
    const createAuctionGas = await measureGas(createAuctionTx, "createAuction");

    const auctionObj = await energyAuction.getAuction(1);
    const aReqId = auctionObj.oracleRequestId;
    const asig1 = await sign(oracle1, aReqId, 500n);
    await oracleAggregator.connect(oracle1).submitResponse(aReqId, 500n, asig1);
    const asig2 = await sign(oracle2, aReqId, 500n);
    await oracleAggregator.connect(oracle2).submitResponse(aReqId, 500n, asig2);

    const bidCost = ethers.parseEther("0.01") * 500n;
    const placeBidTx = await energyAuction.connect(buyer).placeBid(1, { value: bidCost });
    const placeBidGas = await measureGas(placeBidTx, "placeBid");

    const finalizeTx = await energyAuction.finalizeAuction(1);
    const finalizeGas = await measureGas(finalizeTx, "finalizeAuction");

    // ── Summary ─────────────────────────────────────────────────
    console.log("\n" + "═".repeat(60));
    console.log("  Summary (for paper Table)");
    console.log("─".repeat(60));
    console.log(`  createOffer          ${offerGas.toLocaleString()}`);
    console.log(`  acceptOffer          ${acceptGas.toLocaleString()}`);
    console.log(`  createAuction        ${createAuctionGas.toLocaleString()}`);
    console.log(`  placeBid             ${placeBidGas.toLocaleString()}`);
    console.log(`  finalizeAuction      ${finalizeGas.toLocaleString()}`);
    console.log("═".repeat(60));
}

main()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
