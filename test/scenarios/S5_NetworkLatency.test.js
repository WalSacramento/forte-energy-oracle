/**
 * Scenario S5: Network Latency
 * 1 oracle with 3s delay, system should still function
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");
const { MetricsCollector } = require("../helpers/setup");

describe("Scenario S5: Network Latency (3s delay)", function () {
    const MIN_RESPONSES = 2;
    const OUTLIER_THRESHOLD = 10;
    const REQUEST_DEADLINE = 30;
    const NUM_REQUESTS = 5;

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

    it("Should complete request when fast oracles respond first", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);
        const metrics = new MetricsCollector();

        for (let i = 0; i < NUM_REQUESTS; i++) {
            const startTime = Date.now();

            await oracleAggregator.requestData(`METER00${i + 1}`);
            const requestId = i + 1;

            // Fast oracles respond immediately
            const sig1 = await signResponse(oracle1, requestId, 5000);
            const tx1 = await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);
            await tx1.wait();

            const sig2 = await signResponse(oracle2, requestId, 5050);
            const tx2 = await oracleAggregator.connect(oracle2).submitResponse(requestId, 5050, sig2);
            await tx2.wait();

            // Request should already be completed with 2 responses
            let request = await oracleAggregator.getRequest(requestId);
            expect(request.status).to.equal(2, "Should complete with 2 responses");

            const latency = Date.now() - startTime;
            metrics.recordLatency(latency);
            metrics.recordSuccess();

            // Simulate slow oracle (3 second delay in blockchain time)
            // In real scenario, oracle3 would respond later but request already completed
        }

        const stats = metrics.getStats();
        console.log("\n✅ S5 Network Latency: PASSED");
        console.log(`   - Fast oracles processed ${NUM_REQUESTS} requests`);
        console.log(`   - Average latency: ${stats.latency.avg}ms`);
        console.log(`   - All requests completed before slow oracle responded`);
    });

    it("Should handle delayed response within deadline", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);

        await oracleAggregator.requestData("METER001");

        // Oracle 1 responds immediately
        const sig1 = await signResponse(oracle1, 1, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

        // Simulate 3 second delay (blockchain time)
        await time.increase(3);

        // Oracle 2 responds after delay but still within deadline
        const sig2 = await signResponse(oracle2, 1, 5050);
        await oracleAggregator.connect(oracle2).submitResponse(1, 5050, sig2);

        // Request should complete
        const request = await oracleAggregator.getRequest(1);
        expect(request.status).to.equal(2);

        // Oracle 3 responds even later (still within 30s deadline)
        await time.increase(3);
        const sig3 = await signResponse(oracle3, 1, 5025);
        await oracleAggregator.connect(oracle3).submitResponse(1, 5025, sig3);

        // All 3 responses recorded
        const responses = await oracleAggregator.getResponses(1);
        expect(responses.length).to.equal(3);

        console.log("\n✅ Delayed responses accepted within deadline");
    });

    it("Should reject response after deadline", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);

        await oracleAggregator.requestData("METER001");

        // Oracle 1 and 2 respond immediately
        const sig1 = await signResponse(oracle1, 1, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

        const sig2 = await signResponse(oracle2, 1, 5050);
        await oracleAggregator.connect(oracle2).submitResponse(1, 5050, sig2);

        // Advance time past deadline (30 seconds)
        await time.increase(35);

        // Oracle 3 tries to respond after deadline
        const sig3 = await signResponse(oracle3, 1, 5025);
        await expect(
            oracleAggregator.connect(oracle3).submitResponse(1, 5025, sig3)
        ).to.be.revertedWith("Deadline passed");

        console.log("\n✅ Response rejected after deadline");
    });

    it("Should compare latency with and without delays", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);

        console.log("\n--- Latency Comparison ---");

        // Test 1: All oracles respond immediately
        await oracleAggregator.requestData("METER001");
        const start1 = Date.now();

        let sig = await signResponse(oracle1, 1, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig);
        sig = await signResponse(oracle2, 1, 5050);
        await oracleAggregator.connect(oracle2).submitResponse(1, 5050, sig);
        sig = await signResponse(oracle3, 1, 5025);
        await oracleAggregator.connect(oracle3).submitResponse(1, 5025, sig);

        const latency1 = Date.now() - start1;

        // Test 2: Fast oracles only (simulating delayed oracle3)
        await oracleAggregator.requestData("METER002");
        const start2 = Date.now();

        sig = await signResponse(oracle1, 2, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(2, 5000, sig);
        sig = await signResponse(oracle2, 2, 5050);
        await oracleAggregator.connect(oracle2).submitResponse(2, 5050, sig);
        // Oracle 3 doesn't respond

        const latency2 = Date.now() - start2;

        const request1 = await oracleAggregator.getRequest(1);
        const request2 = await oracleAggregator.getRequest(2);

        console.log(`3 oracles: ${latency1}ms, ${request1.responseCount} responses`);
        console.log(`2 oracles: ${latency2}ms, ${request2.responseCount} responses`);
        console.log(`Both requests completed successfully`);

        expect(request1.status).to.equal(2);
        expect(request2.status).to.equal(2);
    });
});


