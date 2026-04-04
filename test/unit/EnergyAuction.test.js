/**
 * EnergyAuction Unit Tests
 * Tests for the Dutch auction contract: creation, price decay, bidding,
 * finalization, and cancellation.
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");

describe("EnergyAuction", function () {
    const MIN_RESPONSES = 2;
    const OUTLIER_THRESHOLD = 10;
    const REQUEST_DEADLINE = 300; // 5 min deadline for tests

    // Auction defaults
    const METER_ID = "METER001";
    const ENERGY_AMOUNT = 1000n; // 1000 Wh
    const START_PRICE = ethers.parseEther("0.01"); // 0.01 ETH per Wh
    const MIN_PRICE = ethers.parseEther("0.005"); // 0.005 ETH per Wh
    const DURATION = 3600n; // 1 hour

    async function deployFullFixture() {
        const [owner, oracle1, oracle2, oracle3, seller, buyer, other] = await ethers.getSigners();

        // OracleAggregator
        const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
        const oracleAggregator = await OracleAggregator.deploy(
            MIN_RESPONSES,
            OUTLIER_THRESHOLD,
            REQUEST_DEADLINE
        );

        // GridValidator
        const GridValidator = await ethers.getContractFactory("GridValidator");
        const gridValidator = await GridValidator.deploy();

        // EnergyAuction
        const EnergyAuction = await ethers.getContractFactory("EnergyAuction");
        const energyAuction = await EnergyAuction.deploy(
            await oracleAggregator.getAddress(),
            await gridValidator.getAddress()
        );

        // Setup oracles
        await oracleAggregator.registerOracle(oracle1.address);
        await oracleAggregator.registerOracle(oracle2.address);
        await oracleAggregator.registerOracle(oracle3.address);

        // Authorize auction contract to request data
        await oracleAggregator.authorizeCaller(await energyAuction.getAddress());

        return { oracleAggregator, gridValidator, energyAuction, owner, oracle1, oracle2, oracle3, seller, buyer, other };
    }

    async function signResponse(signer, requestId, value) {
        const messageHash = ethers.solidityPackedKeccak256(
            ["uint256", "uint256"],
            [requestId, value]
        );
        return await signer.signMessage(ethers.getBytes(messageHash));
    }

    async function submitOracleResponses(oracleAggregator, requestId, value, oracle1, oracle2) {
        const sig1 = await signResponse(oracle1, requestId, value);
        await oracleAggregator.connect(oracle1).submitResponse(requestId, value, sig1);
        const sig2 = await signResponse(oracle2, requestId, value);
        await oracleAggregator.connect(oracle2).submitResponse(requestId, value, sig2);
    }

    // ============ createAuction ============

    describe("createAuction", function () {
        it("Should create an auction and emit AuctionCreated", async function () {
            const { energyAuction, seller } = await loadFixture(deployFullFixture);

            await expect(
                energyAuction.connect(seller).createAuction(
                    METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
                )
            ).to.emit(energyAuction, "AuctionCreated")
                .withArgs(1n, seller.address, METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, (v) => v > 0n);
        });

        it("Should store the auction struct correctly", async function () {
            const { energyAuction, seller } = await loadFixture(deployFullFixture);

            await energyAuction.connect(seller).createAuction(
                METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
            );

            const auction = await energyAuction.getAuction(1);
            expect(auction.id).to.equal(1n);
            expect(auction.seller).to.equal(seller.address);
            expect(auction.energyAmount).to.equal(ENERGY_AMOUNT);
            expect(auction.startPrice).to.equal(START_PRICE);
            expect(auction.minPrice).to.equal(MIN_PRICE);
            expect(auction.status).to.equal(0); // Active
        });

        it("Should compute priceDecayRate correctly", async function () {
            const { energyAuction, seller } = await loadFixture(deployFullFixture);

            await energyAuction.connect(seller).createAuction(
                METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
            );

            const auction = await energyAuction.getAuction(1);
            const expectedRate = (START_PRICE - MIN_PRICE) / DURATION;
            expect(auction.priceDecayRate).to.equal(expectedRate);
        });

        it("Should revert when minPrice >= startPrice", async function () {
            const { energyAuction, seller } = await loadFixture(deployFullFixture);

            await expect(
                energyAuction.connect(seller).createAuction(
                    METER_ID, ENERGY_AMOUNT, MIN_PRICE, START_PRICE, DURATION
                )
            ).to.be.revertedWith("startPrice must be > minPrice");

            await expect(
                energyAuction.connect(seller).createAuction(
                    METER_ID, ENERGY_AMOUNT, START_PRICE, START_PRICE, DURATION
                )
            ).to.be.revertedWith("startPrice must be > minPrice");
        });

        it("Should revert when energyAmount == 0", async function () {
            const { energyAuction, seller } = await loadFixture(deployFullFixture);

            await expect(
                energyAuction.connect(seller).createAuction(
                    METER_ID, 0n, START_PRICE, MIN_PRICE, DURATION
                )
            ).to.be.revertedWith("Energy amount must be > 0");
        });

        it("Should revert with empty meterId", async function () {
            const { energyAuction, seller } = await loadFixture(deployFullFixture);

            await expect(
                energyAuction.connect(seller).createAuction(
                    "", ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
                )
            ).to.be.revertedWith("Invalid meter ID");
        });

        it("Should revert with zero duration", async function () {
            const { energyAuction, seller } = await loadFixture(deployFullFixture);

            await expect(
                energyAuction.connect(seller).createAuction(
                    METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, 0n
                )
            ).to.be.revertedWith("Duration must be > 0");
        });
    });

    // ============ getCurrentPrice ============

    describe("getCurrentPrice", function () {
        it("Should return startPrice at auction creation time", async function () {
            const { energyAuction, seller } = await loadFixture(deployFullFixture);

            await energyAuction.connect(seller).createAuction(
                METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
            );

            // No time has passed (same block)
            expect(await energyAuction.getCurrentPrice(1)).to.equal(START_PRICE);
        });

        it("Should return minPrice at or after endTime", async function () {
            const { energyAuction, seller } = await loadFixture(deployFullFixture);

            await energyAuction.connect(seller).createAuction(
                METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
            );

            await time.increase(DURATION + 1n);

            expect(await energyAuction.getCurrentPrice(1)).to.equal(MIN_PRICE);
        });

        it("Should return ~midpoint at 50% of duration", async function () {
            const { energyAuction, seller } = await loadFixture(deployFullFixture);

            await energyAuction.connect(seller).createAuction(
                METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
            );

            await time.increase(DURATION / 2n);

            const price = await energyAuction.getCurrentPrice(1);
            const expected = (START_PRICE + MIN_PRICE) / 2n;
            // Allow small rounding from integer division of priceDecayRate
            const priceDecayRate = (START_PRICE - MIN_PRICE) / DURATION;
            expect(price).to.be.closeTo(expected, priceDecayRate + 1n);
        });

        it("Should revert for non-existent auction", async function () {
            const { energyAuction } = await loadFixture(deployFullFixture);

            await expect(energyAuction.getCurrentPrice(99)).to.be.revertedWith("Auction does not exist");
        });
    });

    // ============ placeBid ============

    describe("placeBid", function () {
        async function auctionCreatedFixture() {
            const base = await loadFixture(deployFullFixture);
            await base.energyAuction.connect(base.seller).createAuction(
                METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
            );
            return base;
        }

        it("Should accept a bid at exact current price and emit BidAccepted", async function () {
            const { energyAuction, buyer } = await auctionCreatedFixture();

            // Overpay to guarantee acceptance; excess is refunded
            const sent = START_PRICE * ENERGY_AMOUNT;
            await expect(
                energyAuction.connect(buyer).placeBid(1, { value: sent })
            ).to.emit(energyAuction, "BidAccepted");

            const auction = await energyAuction.getAuction(1);
            expect(auction.status).to.equal(1); // PendingValidation
            expect(auction.winner).to.equal(buyer.address);
            expect(auction.finalPrice).to.be.lte(START_PRICE);
            expect(auction.finalPrice).to.be.gte(MIN_PRICE);
        });

        it("Should revert if underpaid", async function () {
            const { energyAuction, buyer } = await auctionCreatedFixture();

            // Price can decay slightly before the bid tx lands; pay 0 to guarantee underpayment
            await expect(
                energyAuction.connect(buyer).placeBid(1, { value: 0n })
            ).to.be.revertedWith("Insufficient payment");
        });

        it("Should refund excess ETH", async function () {
            const { energyAuction, buyer } = await auctionCreatedFixture();

            const currentPrice = await energyAuction.getCurrentPrice(1);
            const totalCost = currentPrice * ENERGY_AMOUNT;
            const excess = ethers.parseEther("1");
            const sent = totalCost + excess;

            const balanceBefore = await ethers.provider.getBalance(buyer.address);
            const tx = await energyAuction.connect(buyer).placeBid(1, { value: sent });
            const receipt = await tx.wait();
            const gasUsed = receipt.gasUsed * receipt.gasPrice;
            const balanceAfter = await ethers.provider.getBalance(buyer.address);

            // buyer should have paid only actualTotalCost + gas; excess must be refunded
            // The actual price at tx time may differ by 1 block from currentPrice read above
            const auction = await energyAuction.getAuction(1);
            const actualPaid = auction.finalPrice * ENERGY_AMOUNT;
            expect(balanceBefore - balanceAfter - gasUsed).to.equal(actualPaid);
        });

        it("Should revert on expired auction", async function () {
            const { energyAuction, buyer } = await auctionCreatedFixture();

            await time.increase(DURATION + 1n);

            const totalCost = MIN_PRICE * ENERGY_AMOUNT;
            await expect(
                energyAuction.connect(buyer).placeBid(1, { value: totalCost })
            ).to.be.revertedWith("Auction expired");
        });

        it("Should revert on non-active auction", async function () {
            const { energyAuction, seller, buyer } = await auctionCreatedFixture();

            const totalCost = START_PRICE * ENERGY_AMOUNT;
            await energyAuction.connect(buyer).placeBid(1, { value: totalCost });

            await expect(
                energyAuction.connect(buyer).placeBid(1, { value: totalCost })
            ).to.be.revertedWith("Auction not active");
        });
    });

    // ============ finalizeAuction ============

    describe("finalizeAuction", function () {
        async function bidPlacedFixture() {
            const base = await loadFixture(deployFullFixture);
            const { energyAuction, seller, buyer } = base;

            await energyAuction.connect(seller).createAuction(
                METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
            );

            // Use START_PRICE as upper-bound payment; any excess is refunded
            const maxCost = START_PRICE * ENERGY_AMOUNT;
            await energyAuction.connect(buyer).placeBid(1, { value: maxCost });

            const auction = await energyAuction.getAuction(1);
            const totalCost = auction.finalPrice * ENERGY_AMOUNT;
            return { ...base, requestId: auction.oracleRequestId, totalCost, finalPrice: auction.finalPrice };
        }

        it("Should finalize and transfer ETH to seller when oracle reading sufficient", async function () {
            const { energyAuction, oracleAggregator, seller, oracle1, oracle2, requestId, totalCost } =
                await bidPlacedFixture();

            // Provide sufficient oracle reading
            await submitOracleResponses(oracleAggregator, requestId, ENERGY_AMOUNT, oracle1, oracle2);

            const sellerBefore = await ethers.provider.getBalance(seller.address);
            await energyAuction.finalizeAuction(1);
            const sellerAfter = await ethers.provider.getBalance(seller.address);

            expect(sellerAfter - sellerBefore).to.equal(totalCost);
            const auction = await energyAuction.getAuction(1);
            expect(auction.status).to.equal(2); // Finalized
        });

        it("Should emit AuctionFinalized on success", async function () {
            const { energyAuction, oracleAggregator, seller, buyer, oracle1, oracle2, requestId, totalCost } =
                await bidPlacedFixture();

            await submitOracleResponses(oracleAggregator, requestId, ENERGY_AMOUNT, oracle1, oracle2);

            await expect(energyAuction.finalizeAuction(1))
                .to.emit(energyAuction, "AuctionFinalized")
                .withArgs(1n, seller.address, buyer.address, totalCost);
        });

        it("Should refund buyer when oracle reading insufficient", async function () {
            const { energyAuction, oracleAggregator, buyer, oracle1, oracle2, requestId, totalCost } =
                await bidPlacedFixture();

            // Insufficient reading
            const insufficientReading = ENERGY_AMOUNT - 1n;
            await submitOracleResponses(oracleAggregator, requestId, insufficientReading, oracle1, oracle2);

            const buyerBefore = await ethers.provider.getBalance(buyer.address);
            await energyAuction.finalizeAuction(1);
            const buyerAfter = await ethers.provider.getBalance(buyer.address);

            expect(buyerAfter - buyerBefore).to.equal(totalCost);
            const auction = await energyAuction.getAuction(1);
            expect(auction.status).to.equal(3); // Cancelled
        });

        it("Should revert when oracle response is still PENDING", async function () {
            const { energyAuction } = await bidPlacedFixture();

            await expect(energyAuction.finalizeAuction(1)).to.be.revertedWith("Oracle response pending");
        });

        it("Should revert when auction is not PendingValidation", async function () {
            const { energyAuction, seller } = await loadFixture(deployFullFixture);

            await energyAuction.connect(seller).createAuction(
                METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
            );

            await expect(energyAuction.finalizeAuction(1)).to.be.revertedWith("Auction not pending validation");
        });
    });

    // ============ cancelAuction ============

    describe("cancelAuction", function () {
        it("Should allow seller to cancel an active auction", async function () {
            const { energyAuction, seller } = await loadFixture(deployFullFixture);

            await energyAuction.connect(seller).createAuction(
                METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
            );

            await expect(energyAuction.connect(seller).cancelAuction(1))
                .to.emit(energyAuction, "AuctionCancelled")
                .withArgs(1n, "Cancelled by seller");

            const auction = await energyAuction.getAuction(1);
            expect(auction.status).to.equal(3); // Cancelled
        });

        it("Should revert when non-seller tries to cancel", async function () {
            const { energyAuction, seller, other } = await loadFixture(deployFullFixture);

            await energyAuction.connect(seller).createAuction(
                METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
            );

            await expect(energyAuction.connect(other).cancelAuction(1))
                .to.be.revertedWith("Not the seller");
        });

        it("Should revert when auction is PendingValidation", async function () {
            const { energyAuction, seller, buyer } = await loadFixture(deployFullFixture);

            await energyAuction.connect(seller).createAuction(
                METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION
            );

            const totalCost = START_PRICE * ENERGY_AMOUNT;
            await energyAuction.connect(buyer).placeBid(1, { value: totalCost });

            await expect(energyAuction.connect(seller).cancelAuction(1))
                .to.be.revertedWith("Auction not active");
        });
    });

    // ============ View functions ============

    describe("getActiveAuctions", function () {
        it("Should return only active auctions", async function () {
            const { energyAuction, seller, buyer } = await loadFixture(deployFullFixture);

            // Create 2 auctions
            await energyAuction.connect(seller).createAuction(METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION);
            await energyAuction.connect(seller).createAuction(METER_ID, ENERGY_AMOUNT, START_PRICE, MIN_PRICE, DURATION);

            // Cancel the second
            await energyAuction.connect(seller).cancelAuction(2);

            const active = await energyAuction.getActiveAuctions();
            expect(active.length).to.equal(1);
            expect(active[0]).to.equal(1n);
        });
    });
});
