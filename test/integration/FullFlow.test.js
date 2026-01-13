/**
 * Full Flow Integration Test
 * Tests the complete flow from offer creation to trade execution
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Integration: Full Trading Flow", function () {
    const MIN_RESPONSES = 2;
    const OUTLIER_THRESHOLD = 10;
    const REQUEST_DEADLINE = 30;

    async function deployAllContractsFixture() {
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

        // Authorize EnergyTrading
        await oracleAggregator.authorizeCaller(await energyTrading.getAddress());

        return { 
            oracleAggregator, 
            gridValidator, 
            energyTrading, 
            owner, 
            oracle1, 
            oracle2, 
            oracle3, 
            seller, 
            buyer 
        };
    }

    async function signResponse(signer, requestId, value) {
        const messageHash = ethers.solidityPackedKeccak256(
            ["uint256", "uint256"],
            [requestId, value]
        );
        return await signer.signMessage(ethers.getBytes(messageHash));
    }

    it("Should complete full trading flow with oracle validation", async function () {
        const { 
            oracleAggregator, 
            gridValidator, 
            energyTrading, 
            oracle1, 
            oracle2, 
            oracle3, 
            seller, 
            buyer 
        } = await loadFixture(deployAllContractsFixture);

        console.log("\n=== Full Trading Flow Test ===\n");

        // Step 1: Seller creates an offer
        console.log("Step 1: Creating energy offer...");
        const meterId = "METER001";
        const amount = 1000; // Wh
        const pricePerWh = 100; // wei per Wh
        const totalPrice = BigInt(amount) * BigInt(pricePerWh);

        const createTx = await energyTrading.connect(seller).createOffer(
            meterId,
            amount,
            pricePerWh,
            3600 // 1 hour duration
        );
        await createTx.wait();

        const offer = await energyTrading.getOffer(1);
        expect(offer.id).to.equal(1);
        expect(offer.seller).to.equal(seller.address);
        console.log(`   Offer created: ID=${offer.id}, Amount=${amount}Wh, Price=${pricePerWh}wei/Wh`);

        // Step 2: Oracles respond to validation request
        console.log("\nStep 2: Oracles submitting responses...");
        const requestId = offer.requestId;

        const sig1 = await signResponse(oracle1, requestId, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);
        console.log("   Oracle 1 submitted: 5000 Wh");

        const sig2 = await signResponse(oracle2, requestId, 5100);
        await oracleAggregator.connect(oracle2).submitResponse(requestId, 5100, sig2);
        console.log("   Oracle 2 submitted: 5100 Wh");

        const sig3 = await signResponse(oracle3, requestId, 5050);
        await oracleAggregator.connect(oracle3).submitResponse(requestId, 5050, sig3);
        console.log("   Oracle 3 submitted: 5050 Wh");

        // Verify aggregation
        const request = await oracleAggregator.getRequest(requestId);
        expect(request.status).to.equal(2); // Completed
        console.log(`   Aggregated value: ${request.aggregatedValue} Wh`);

        // Step 3: Update offer with validated reading
        console.log("\nStep 3: Updating offer with validation...");
        await energyTrading.updateOfferValidation(1);
        
        const validatedOffer = await energyTrading.getOffer(1);
        expect(validatedOffer.validatedReading).to.equal(request.aggregatedValue);
        console.log(`   Offer validated with reading: ${validatedOffer.validatedReading} Wh`);

        // Step 4: Buyer accepts the offer
        console.log("\nStep 4: Buyer accepting offer...");
        const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

        const acceptTx = await energyTrading.connect(buyer).acceptOffer(1, { value: totalPrice });
        const receipt = await acceptTx.wait();

        const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);
        const received = sellerBalanceAfter - sellerBalanceBefore;

        expect(received).to.equal(totalPrice);
        console.log(`   Trade executed! Seller received: ${received} wei`);

        // Step 5: Verify final state
        console.log("\nStep 5: Verifying final state...");
        const finalOffer = await energyTrading.getOffer(1);
        expect(finalOffer.status).to.equal(1); // Filled
        console.log(`   Offer status: FILLED`);

        const trade = await energyTrading.getTrade(1);
        expect(trade.buyer).to.equal(buyer.address);
        expect(trade.amount).to.equal(amount);
        console.log(`   Trade ID: ${trade.id}, Buyer: ${trade.buyer.slice(0, 10)}...`);

        console.log("\n✅ Full trading flow completed successfully!\n");
    });

    it("Should reject trade with Byzantine oracle", async function () {
        const { 
            oracleAggregator, 
            energyTrading, 
            oracle1, 
            oracle2, 
            oracle3, 
            seller, 
            buyer 
        } = await loadFixture(deployAllContractsFixture);

        console.log("\n=== Byzantine Oracle Trade Test ===\n");

        // Create offer
        await energyTrading.connect(seller).createOffer("METER001", 1000, 100, 3600);
        const offer = await energyTrading.getOffer(1);

        // Oracle 3 is malicious (10x value)
        const sig1 = await signResponse(oracle1, offer.requestId, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(offer.requestId, 5000, sig1);

        const sig2 = await signResponse(oracle2, offer.requestId, 5100);
        await oracleAggregator.connect(oracle2).submitResponse(offer.requestId, 5100, sig2);

        const sig3 = await signResponse(oracle3, offer.requestId, 50000); // Malicious
        await oracleAggregator.connect(oracle3).submitResponse(offer.requestId, 50000, sig3);

        // Check outlier was detected
        const oracleInfo = await oracleAggregator.getOracleInfo(oracle3.address);
        expect(oracleInfo.reputation).to.be.lt(70n); // Penalized from 70

        // Check aggregation excluded outlier
        const request = await oracleAggregator.getRequest(offer.requestId);
        expect(request.aggregatedValue).to.equal(5050); // Average of honest values only

        console.log("✅ Byzantine oracle detected, trade proceeds with honest values\n");
    });

    it("Should handle multiple concurrent offers", async function () {
        const { 
            oracleAggregator, 
            energyTrading, 
            oracle1, 
            oracle2, 
            seller, 
            buyer 
        } = await loadFixture(deployAllContractsFixture);

        console.log("\n=== Multiple Offers Test ===\n");

        // Create 3 offers
        for (let i = 1; i <= 3; i++) {
            await energyTrading.connect(seller).createOffer(`METER00${i}`, 1000 * i, 100, 3600);
            console.log(`Created offer ${i}`);
        }

        // Verify all offers created
        const sellerOffers = await energyTrading.getSellerOffers(seller.address);
        expect(sellerOffers.length).to.equal(3);

        // Submit oracle responses for all
        for (let i = 1; i <= 3; i++) {
            const offer = await energyTrading.getOffer(i);
            
            const sig1 = await signResponse(oracle1, offer.requestId, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(offer.requestId, 5000, sig1);

            const sig2 = await signResponse(oracle2, offer.requestId, 5050);
            await oracleAggregator.connect(oracle2).submitResponse(offer.requestId, 5050, sig2);
        }

        // Verify all requests completed
        for (let i = 1; i <= 3; i++) {
            const offer = await energyTrading.getOffer(i);
            const request = await oracleAggregator.getRequest(offer.requestId);
            expect(request.status).to.equal(2);
        }

        // Accept first offer
        const offer1 = await energyTrading.getOffer(1);
        await energyTrading.connect(buyer).acceptOffer(1, { value: BigInt(1000 * 100) });

        // Verify only first is filled
        const activeOffers = await energyTrading.getActiveOffers();
        expect(activeOffers.length).to.equal(2);

        console.log("✅ Multiple offers handled correctly\n");
    });
});



