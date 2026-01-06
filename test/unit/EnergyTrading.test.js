/**
 * EnergyTrading Unit Tests
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("EnergyTrading", function () {
    const MIN_RESPONSES = 2;
    const OUTLIER_THRESHOLD = 10;
    const REQUEST_DEADLINE = 30;

    async function deployEnergyTradingFixture() {
        const [owner, oracle1, oracle2, oracle3, seller, buyer] = await ethers.getSigners();

        // Deploy OracleAggregator
        const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
        const oracleAggregator = await OracleAggregator.deploy(
            MIN_RESPONSES,
            OUTLIER_THRESHOLD,
            REQUEST_DEADLINE
        );

        // Deploy GridValidator
        const GridValidator = await ethers.getContractFactory("GridValidator");
        const gridValidator = await GridValidator.deploy();

        // Deploy EnergyTrading
        const EnergyTrading = await ethers.getContractFactory("EnergyTrading");
        const energyTrading = await EnergyTrading.deploy(
            await oracleAggregator.getAddress(),
            await gridValidator.getAddress()
        );

        // Setup oracles
        await oracleAggregator.registerOracle(oracle1.address);
        await oracleAggregator.registerOracle(oracle2.address);
        await oracleAggregator.registerOracle(oracle3.address);

        // Authorize EnergyTrading to request data
        await oracleAggregator.authorizeCaller(await energyTrading.getAddress());

        return { 
            energyTrading, 
            oracleAggregator, 
            gridValidator, 
            owner, 
            oracle1, 
            oracle2, 
            oracle3, 
            seller, 
            buyer 
        };
    }

    describe("Deployment", function () {
        it("Should set the correct oracle aggregator", async function () {
            const { energyTrading, oracleAggregator } = await loadFixture(deployEnergyTradingFixture);
            expect(await energyTrading.oracleAggregator()).to.equal(await oracleAggregator.getAddress());
        });

        it("Should set the correct grid validator", async function () {
            const { energyTrading, gridValidator } = await loadFixture(deployEnergyTradingFixture);
            expect(await energyTrading.gridValidator()).to.equal(await gridValidator.getAddress());
        });
    });

    describe("Offer Creation", function () {
        it("Should create an offer successfully", async function () {
            const { energyTrading, seller } = await loadFixture(deployEnergyTradingFixture);

            await expect(
                energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600)
            ).to.emit(energyTrading, "OfferCreated");

            const offer = await energyTrading.getOffer(1);
            expect(offer.seller).to.equal(seller.address);
            expect(offer.meterId).to.equal("METER001");
            expect(offer.amount).to.equal(1000);
            expect(offer.pricePerWh).to.equal(100);
            expect(offer.status).to.equal(0); // Active
        });

        it("Should revert with invalid meter ID", async function () {
            const { energyTrading, seller } = await loadFixture(deployEnergyTradingFixture);

            await expect(
                energyTrading.connect(seller).createOffer("", 1000, 100, 3600)
            ).to.be.revertedWith("Invalid meter ID");
        });

        it("Should revert with zero amount", async function () {
            const { energyTrading, seller } = await loadFixture(deployEnergyTradingFixture);

            await expect(
                energyTrading.connect(seller).createOffer("METER001", 0, 100, 3600)
            ).to.be.revertedWith("Amount must be > 0");
        });

        it("Should revert with zero price", async function () {
            const { energyTrading, seller } = await loadFixture(deployEnergyTradingFixture);

            await expect(
                energyTrading.connect(seller).createOffer("METER001", 1000, 0, 3600)
            ).to.be.revertedWith("Price must be > 0");
        });

        it("Should emit ValidationRequested event", async function () {
            const { energyTrading, seller } = await loadFixture(deployEnergyTradingFixture);

            await expect(
                energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600)
            ).to.emit(energyTrading, "ValidationRequested");
        });
    });

    describe("Offer Cancellation", function () {
        it("Should allow seller to cancel offer", async function () {
            const { energyTrading, seller } = await loadFixture(deployEnergyTradingFixture);

            await energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600);

            await expect(
                energyTrading.connect(seller).cancelOffer(1)
            ).to.emit(energyTrading, "OfferCancelled").withArgs(1);

            const offer = await energyTrading.getOffer(1);
            expect(offer.status).to.equal(2); // Cancelled
        });

        it("Should not allow non-seller to cancel offer", async function () {
            const { energyTrading, seller, buyer } = await loadFixture(deployEnergyTradingFixture);

            await energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600);

            await expect(
                energyTrading.connect(buyer).cancelOffer(1)
            ).to.be.revertedWith("Not authorized");
        });

        it("Should allow owner to cancel any offer", async function () {
            const { energyTrading, seller, owner } = await loadFixture(deployEnergyTradingFixture);

            await energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600);

            await expect(
                energyTrading.connect(owner).cancelOffer(1)
            ).to.emit(energyTrading, "OfferCancelled");
        });
    });

    describe("Trade Execution", function () {
        async function signResponse(signer, requestId, value) {
            const messageHash = ethers.solidityPackedKeccak256(
                ["uint256", "uint256"],
                [requestId, value]
            );
            return await signer.signMessage(ethers.getBytes(messageHash));
        }

        it("Should execute trade successfully", async function () {
            const { energyTrading, oracleAggregator, oracle1, oracle2, seller, buyer } = 
                await loadFixture(deployEnergyTradingFixture);

            // Create offer
            await energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600);

            // Submit oracle responses to complete validation
            const sig1 = await signResponse(oracle1, 1, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

            const sig2 = await signResponse(oracle2, 1, 5100);
            await oracleAggregator.connect(oracle2).submitResponse(1, 5100, sig2);

            // Accept offer
            const totalPrice = 1000n * 100n;
            const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

            await expect(
                energyTrading.connect(buyer).acceptOffer(1, { value: totalPrice })
            ).to.emit(energyTrading, "TradeExecuted");

            const offer = await energyTrading.getOffer(1);
            expect(offer.status).to.equal(1); // Filled

            const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
            expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(totalPrice);
        });

        it("Should revert with insufficient payment", async function () {
            const { energyTrading, oracleAggregator, oracle1, oracle2, seller, buyer } = 
                await loadFixture(deployEnergyTradingFixture);

            await energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600);

            const sig1 = await signResponse(oracle1, 1, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

            const sig2 = await signResponse(oracle2, 1, 5100);
            await oracleAggregator.connect(oracle2).submitResponse(1, 5100, sig2);

            await expect(
                energyTrading.connect(buyer).acceptOffer(1, { value: 50000 }) // Less than 100000
            ).to.be.revertedWith("Insufficient payment");
        });

        it("Should refund excess payment", async function () {
            const { energyTrading, oracleAggregator, oracle1, oracle2, seller, buyer } = 
                await loadFixture(deployEnergyTradingFixture);

            await energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600);

            const sig1 = await signResponse(oracle1, 1, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

            const sig2 = await signResponse(oracle2, 1, 5100);
            await oracleAggregator.connect(oracle2).submitResponse(1, 5100, sig2);

            const totalPrice = 1000n * 100n;
            const excessAmount = 50000n;

            // This should work and refund the excess
            await energyTrading.connect(buyer).acceptOffer(1, { value: totalPrice + excessAmount });

            const offer = await energyTrading.getOffer(1);
            expect(offer.status).to.equal(1); // Filled
        });

        it("Should not allow seller to buy own offer", async function () {
            const { energyTrading, oracleAggregator, oracle1, oracle2, seller } = 
                await loadFixture(deployEnergyTradingFixture);

            await energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600);

            const sig1 = await signResponse(oracle1, 1, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

            const sig2 = await signResponse(oracle2, 1, 5100);
            await oracleAggregator.connect(oracle2).submitResponse(1, 5100, sig2);

            await expect(
                energyTrading.connect(seller).acceptOffer(1, { value: 100000 })
            ).to.be.revertedWith("Cannot buy own offer");
        });
    });

    describe("View Functions", function () {
        it("Should return seller offers", async function () {
            const { energyTrading, seller } = await loadFixture(deployEnergyTradingFixture);

            await energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600);
            await energyTrading.connect(seller).createOffer("METER002", 2000, 150, 3600);

            const offers = await energyTrading.getSellerOffers(seller.address);
            expect(offers.length).to.equal(2);
        });

        it("Should return active offers", async function () {
            const { energyTrading, seller } = await loadFixture(deployEnergyTradingFixture);

            await energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600);
            await energyTrading.connect(seller).createOffer("METER002", 2000, 150, 3600);
            await energyTrading.connect(seller).cancelOffer(1);

            const activeOffers = await energyTrading.getActiveOffers();
            expect(activeOffers.length).to.equal(1);
            expect(activeOffers[0]).to.equal(2);
        });

        it("Should check if offer can be accepted", async function () {
            const { energyTrading, seller } = await loadFixture(deployEnergyTradingFixture);

            await energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600);

            const [canAccept, reason] = await energyTrading.canAcceptOffer(1);
            expect(canAccept).to.be.true;
        });
    });
});


