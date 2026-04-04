/**
 * AuctionFlow Integration Test
 * Full end-to-end: createAuction → oracle responds → buyer bids → finalizeAuction
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("AuctionFlow Integration", function () {
    const MIN_RESPONSES = 2;
    const OUTLIER_THRESHOLD = 10;
    const REQUEST_DEADLINE = 300;

    const METER_ID = "METER001";
    const ENERGY_AMOUNT = 500n;
    const START_PRICE = ethers.parseEther("0.01");
    const MIN_PRICE = ethers.parseEther("0.004");
    const DURATION = 3600n;

    async function deployAll() {
        const [owner, oracle1, oracle2, oracle3, seller, buyer] = await ethers.getSigners();

        const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
        const oracleAggregator = await OracleAggregator.deploy(MIN_RESPONSES, OUTLIER_THRESHOLD, REQUEST_DEADLINE);

        const GridValidator = await ethers.getContractFactory("GridValidator");
        const gridValidator = await GridValidator.deploy();

        const EnergyAuction = await ethers.getContractFactory("EnergyAuction");
        const energyAuction = await EnergyAuction.deploy(
            await oracleAggregator.getAddress(),
            await gridValidator.getAddress()
        );

        await oracleAggregator.registerOracle(oracle1.address);
        await oracleAggregator.registerOracle(oracle2.address);
        await oracleAggregator.registerOracle(oracle3.address);
        await oracleAggregator.authorizeCaller(await energyAuction.getAddress());

        return { oracleAggregator, gridValidator, energyAuction, owner, oracle1, oracle2, oracle3, seller, buyer };
    }

    async function signResponse(signer, requestId, value) {
        const messageHash = ethers.solidityPackedKeccak256(["uint256", "uint256"], [requestId, value]);
        return await signer.signMessage(ethers.getBytes(messageHash));
    }

    it("Full happy path: create → oracle → bid → finalize → seller paid", async function () {
        const { oracleAggregator, energyAuction, seller, buyer, oracle1, oracle2 } = await deployAll();

        // Step 1: Seller creates auction
        const tx1 = await energyAuction.connect(seller).createAuction(
            METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
        );
        await tx1.wait();

        const auctionId = 1n;
        const auction = await energyAuction.getAuction(auctionId);
        const requestId = auction.oracleRequestId;
        expect(auction.status).to.equal(0); // Active

        // Step 2: Oracles respond with sufficient reading
        const sig1 = await signResponse(oracle1, requestId, ENERGY_AMOUNT);
        await oracleAggregator.connect(oracle1).submitResponse(requestId, ENERGY_AMOUNT, sig1);
        const sig2 = await signResponse(oracle2, requestId, ENERGY_AMOUNT);
        await oracleAggregator.connect(oracle2).submitResponse(requestId, ENERGY_AMOUNT, sig2);

        // Verify oracle completed
        const request = await oracleAggregator.getRequest(requestId);
        expect(request.status).to.equal(2); // COMPLETED

        // Step 3: Advance time so price has decayed
        await time.increase(1800n); // 30 min — price at midpoint

        const currentPrice = await energyAuction.getCurrentPrice(auctionId);
        expect(currentPrice).to.be.lt(START_PRICE);
        expect(currentPrice).to.be.gte(MIN_PRICE);

        // Step 4: Buyer places bid — overpay slightly so price decay doesn't cause revert
        const overpay = currentPrice * ENERGY_AMOUNT * 2n; // 2x is plenty
        const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

        await energyAuction.connect(buyer).placeBid(auctionId, { value: overpay });

        const auctionAfterBid = await energyAuction.getAuction(auctionId);
        expect(auctionAfterBid.status).to.equal(1); // PendingValidation
        expect(auctionAfterBid.winner).to.equal(buyer.address);

        const actualTotalCost = auctionAfterBid.finalPrice * ENERGY_AMOUNT;

        // Step 5: Anyone finalizes (oracle already completed)
        await energyAuction.finalizeAuction(auctionId);

        const auctionFinal = await energyAuction.getAuction(auctionId);
        expect(auctionFinal.status).to.equal(2); // Finalized

        const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
        expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(actualTotalCost);
    });

    it("Buyer refunded when oracle reading is insufficient", async function () {
        const { oracleAggregator, energyAuction, seller, buyer, oracle1, oracle2 } = await deployAll();

        await energyAuction.connect(seller).createAuction(
            METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
        );

        const auction = await energyAuction.getAuction(1n);
        const requestId = auction.oracleRequestId;

        // Oracle reports only 50 Wh (way below 500 Wh)
        const lowReading = 50n;
        const sig1 = await signResponse(oracle1, requestId, lowReading);
        await oracleAggregator.connect(oracle1).submitResponse(requestId, lowReading, sig1);
        const sig2 = await signResponse(oracle2, requestId, lowReading);
        await oracleAggregator.connect(oracle2).submitResponse(requestId, lowReading, sig2);

        const maxCost = START_PRICE * ENERGY_AMOUNT;
        await energyAuction.connect(buyer).placeBid(1n, { value: maxCost });

        const auctionAfterBid = await energyAuction.getAuction(1n);
        const actualTotalCost = auctionAfterBid.finalPrice * ENERGY_AMOUNT;

        const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);
        await energyAuction.finalizeAuction(1n);
        const buyerBalanceAfter = await ethers.provider.getBalance(buyer.address);

        expect(buyerBalanceAfter - buyerBalanceBefore).to.equal(actualTotalCost);

        const auctionFinal = await energyAuction.getAuction(1n);
        expect(auctionFinal.status).to.equal(3); // Cancelled
    });

    it("Seller can cancel before any bid", async function () {
        const { energyAuction, seller } = await deployAll();

        await energyAuction.connect(seller).createAuction(
            METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
        );

        await energyAuction.connect(seller).cancelAuction(1n);

        const auction = await energyAuction.getAuction(1n);
        expect(auction.status).to.equal(3); // Cancelled
    });
});
