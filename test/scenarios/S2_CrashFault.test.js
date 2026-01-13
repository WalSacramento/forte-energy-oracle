/**
 * Scenario S2: Crash Fault
 * 1 oracle offline, system continues with 2 oracles
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { MetricsCollector } = require("../helpers/setup");

describe("Scenario S2: Crash Fault (1 of 3 offline)", function () {
    const MIN_RESPONSES = 2;
    const OUTLIER_THRESHOLD = 10;
    const REQUEST_DEADLINE = 30;
    const NUM_REQUESTS = 10;

    async function deployFixture() {
        const [owner, oracle1, oracle2, oracle3, user] = await ethers.getSigners();

        const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
        const oracleAggregator = await OracleAggregator.deploy(
            MIN_RESPONSES,
            OUTLIER_THRESHOLD,
            REQUEST_DEADLINE
        );

        await oracleAggregator.registerOracle(oracle1.address);
        await oracleAggregator.registerOracle(oracle2.address);
        await oracleAggregator.registerOracle(oracle3.address);
        await oracleAggregator.authorizeCaller(owner.address);

        return { oracleAggregator, owner, oracle1, oracle2, oracle3, user };
    }

    async function signResponse(signer, requestId, value) {
        const messageHash = ethers.solidityPackedKeccak256(
            ["uint256", "uint256"],
            [requestId, value]
        );
        return await signer.signMessage(ethers.getBytes(messageHash));
    }

    it("Should continue operation with 2 oracles when 1 is offline", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);
        const metrics = new MetricsCollector();

        // Baseline: 3 requests with all oracles
        console.log("\n--- Baseline: 3 oracles active ---");
        for (let i = 0; i < 3; i++) {
            await oracleAggregator.requestData(`METER00${i + 1}`);
            const requestId = i + 1;

            const sig1 = await signResponse(oracle1, requestId, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);

            const sig2 = await signResponse(oracle2, requestId, 5050);
            await oracleAggregator.connect(oracle2).submitResponse(requestId, 5050, sig2);

            const sig3 = await signResponse(oracle3, requestId, 5025);
            await oracleAggregator.connect(oracle3).submitResponse(requestId, 5025, sig3);

            const request = await oracleAggregator.getRequest(requestId);
            expect(request.status).to.equal(2);
            expect(request.responseCount).to.equal(3);
        }

        // Simulate oracle3 going offline (just don't submit responses)
        console.log("\n--- Oracle 3 is now OFFLINE ---");

        for (let i = 0; i < NUM_REQUESTS; i++) {
            const startTime = Date.now();
            
            await oracleAggregator.requestData(`METER_FAULT_${i}`);
            const requestId = 4 + i; // Continue from request 4

            // Only oracle1 and oracle2 respond
            const sig1 = await signResponse(oracle1, requestId, 5000);
            const tx1 = await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);
            const receipt1 = await tx1.wait();

            const sig2 = await signResponse(oracle2, requestId, 5050);
            const tx2 = await oracleAggregator.connect(oracle2).submitResponse(requestId, 5050, sig2);
            const receipt2 = await tx2.wait();

            // Oracle3 does NOT respond (simulating offline)

            const latency = Date.now() - startTime;
            metrics.recordLatency(latency);
            metrics.recordGas(receipt1.gasUsed + receipt2.gasUsed);

            // Verify request still completed
            const request = await oracleAggregator.getRequest(requestId);
            expect(request.status).to.equal(2, "Request should complete with 2 responses");
            expect(request.responseCount).to.equal(2);

            metrics.recordSuccess();
        }

        metrics.printReport();

        const stats = metrics.getStats();
        expect(stats.requests.successRate).to.be.gte(0.99, "Success rate should be >= 99%");

        console.log("\n✅ S2 Crash Fault: PASSED");
        console.log(`   - System continued with 2 oracles`);
        console.log(`   - ${NUM_REQUESTS} requests completed`);
        console.log(`   - Success rate: ${(stats.requests.successRate * 100).toFixed(2)}%`);
    });

    it("Should handle oracle recovery", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);

        // Request 1: All 3 oracles respond
        await oracleAggregator.requestData("METER001");
        let sig1 = await signResponse(oracle1, 1, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);
        let sig2 = await signResponse(oracle2, 1, 5050);
        await oracleAggregator.connect(oracle2).submitResponse(1, 5050, sig2);
        let sig3 = await signResponse(oracle3, 1, 5025);
        await oracleAggregator.connect(oracle3).submitResponse(1, 5025, sig3);

        let request = await oracleAggregator.getRequest(1);
        expect(request.responseCount).to.equal(3);

        // Request 2: Oracle 3 offline
        await oracleAggregator.requestData("METER002");
        sig1 = await signResponse(oracle1, 2, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(2, 5000, sig1);
        sig2 = await signResponse(oracle2, 2, 5050);
        await oracleAggregator.connect(oracle2).submitResponse(2, 5050, sig2);

        request = await oracleAggregator.getRequest(2);
        expect(request.status).to.equal(2);
        expect(request.responseCount).to.equal(2);

        // Request 3: Oracle 3 back online
        await oracleAggregator.requestData("METER003");
        sig1 = await signResponse(oracle1, 3, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(3, 5000, sig1);
        sig2 = await signResponse(oracle2, 3, 5050);
        await oracleAggregator.connect(oracle2).submitResponse(3, 5050, sig2);
        sig3 = await signResponse(oracle3, 3, 5025);
        await oracleAggregator.connect(oracle3).submitResponse(3, 5025, sig3);

        request = await oracleAggregator.getRequest(3);
        expect(request.responseCount).to.equal(3);

        console.log("\n✅ Oracle recovery verified");
        console.log("   - Request 1: 3 responses");
        console.log("   - Request 2: 2 responses (oracle3 offline)");
        console.log("   - Request 3: 3 responses (oracle3 recovered)");
    });

    it("Should fail gracefully if less than minimum oracles respond", async function () {
        const { oracleAggregator, oracle1 } = await loadFixture(deployFixture);

        // Update config to require 2 minimum
        await oracleAggregator.updateConfig(2, OUTLIER_THRESHOLD, REQUEST_DEADLINE);

        await oracleAggregator.requestData("METER001");

        // Only 1 oracle responds
        const sig1 = await signResponse(oracle1, 1, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

        // Request should still be in aggregating state (not completed)
        const request = await oracleAggregator.getRequest(1);
        expect(request.status).to.equal(1); // Aggregating, waiting for more responses
        expect(request.responseCount).to.equal(1);

        console.log("\n✅ Graceful handling when insufficient responses");
    });
});



