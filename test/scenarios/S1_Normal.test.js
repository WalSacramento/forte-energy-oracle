/**
 * Scenario S1: Normal Operation
 * All 3 oracles functioning normally, returning values within ±2% variation
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { MetricsCollector } = require("../helpers/setup");

describe("Scenario S1: Normal Operation", function () {
    const MIN_RESPONSES = 2;
    const OUTLIER_THRESHOLD = 10;
    const REQUEST_DEADLINE = 30;
    const BASE_READING = 5000;
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

    function generateReading(baseValue, variationPercent = 2) {
        const variation = baseValue * (variationPercent / 100);
        const delta = (Math.random() * 2 - 1) * variation;
        return Math.round(baseValue + delta);
    }

    it("Should complete multiple requests with 3 oracles responding", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);
        const metrics = new MetricsCollector();

        for (let i = 0; i < NUM_REQUESTS; i++) {
            const startTime = Date.now();

            // Create request
            const tx = await oracleAggregator.requestData(`METER00${i % 3 + 1}`);
            await tx.wait();
            const requestId = i + 1;

            // Generate readings with realistic variation
            const value1 = generateReading(BASE_READING);
            const value2 = generateReading(BASE_READING);
            const value3 = generateReading(BASE_READING);

            // Submit responses
            const sig1 = await signResponse(oracle1, requestId, value1);
            const tx1 = await oracleAggregator.connect(oracle1).submitResponse(requestId, value1, sig1);
            const receipt1 = await tx1.wait();

            const sig2 = await signResponse(oracle2, requestId, value2);
            const tx2 = await oracleAggregator.connect(oracle2).submitResponse(requestId, value2, sig2);
            const receipt2 = await tx2.wait();

            const sig3 = await signResponse(oracle3, requestId, value3);
            const tx3 = await oracleAggregator.connect(oracle3).submitResponse(requestId, value3, sig3);
            const receipt3 = await tx3.wait();

            const latency = Date.now() - startTime;

            // Record metrics
            metrics.recordLatency(latency);
            metrics.recordSuccess();
            metrics.recordGas(receipt1.gasUsed + receipt2.gasUsed + receipt3.gasUsed);

            // Verify request completed
            const request = await oracleAggregator.getRequest(requestId);
            expect(request.status).to.equal(2, `Request ${requestId} should be completed`);
            expect(request.responseCount).to.equal(3);
        }

        // Print metrics report
        metrics.printReport();

        // Assertions
        const stats = metrics.getStats();
        expect(stats.requests.successRate).to.equal(1, "All requests should succeed");
        expect(stats.latency.p95).to.be.lt(5000, "P95 latency should be < 5s");

        console.log("\n✅ S1 Normal Operation: PASSED");
        console.log(`   - ${NUM_REQUESTS} requests completed`);
        console.log(`   - 100% success rate`);
        console.log(`   - Average latency: ${stats.latency.avg}ms`);
        console.log(`   - Average gas per cycle: ${stats.gas.avg}`);
    });

    it("Should calculate correct aggregated values", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);

        await oracleAggregator.requestData("METER001");

        // Submit specific values to verify median calculation
        const values = [5000, 5050, 5100];

        const sig1 = await signResponse(oracle1, 1, values[0]);
        await oracleAggregator.connect(oracle1).submitResponse(1, values[0], sig1);

        const sig2 = await signResponse(oracle2, 1, values[1]);
        await oracleAggregator.connect(oracle2).submitResponse(1, values[1], sig2);

        const sig3 = await signResponse(oracle3, 1, values[2]);
        await oracleAggregator.connect(oracle3).submitResponse(1, values[2], sig3);

        const request = await oracleAggregator.getRequest(1);

        // All values are within 10% of median, so average = (5000+5050+5100)/3 = 5050
        expect(request.aggregatedValue).to.equal(5050);
    });

    it("Should increase reputation for all oracles", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);

        // Get initial reputations
        const rep1Before = (await oracleAggregator.getOracleInfo(oracle1.address)).reputation;
        const rep2Before = (await oracleAggregator.getOracleInfo(oracle2.address)).reputation;
        const rep3Before = (await oracleAggregator.getOracleInfo(oracle3.address)).reputation;

        // Process 5 requests
        for (let i = 0; i < 5; i++) {
            await oracleAggregator.requestData(`METER00${i + 1}`);
            const requestId = i + 1;

            const sig1 = await signResponse(oracle1, requestId, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);

            const sig2 = await signResponse(oracle2, requestId, 5050);
            await oracleAggregator.connect(oracle2).submitResponse(requestId, 5050, sig2);

            const sig3 = await signResponse(oracle3, requestId, 5025);
            await oracleAggregator.connect(oracle3).submitResponse(requestId, 5025, sig3);
        }

        // Check reputations increased
        const rep1After = (await oracleAggregator.getOracleInfo(oracle1.address)).reputation;
        const rep2After = (await oracleAggregator.getOracleInfo(oracle2.address)).reputation;
        const rep3After = (await oracleAggregator.getOracleInfo(oracle3.address)).reputation;

        expect(rep1After).to.equal(rep1Before + 5n);
        expect(rep2After).to.equal(rep2Before + 5n);
        expect(rep3After).to.equal(rep3Before + 5n);

        console.log("\n✅ Reputation increased for all oracles");
        console.log(`   - Oracle 1: ${rep1Before} → ${rep1After}`);
        console.log(`   - Oracle 2: ${rep2Before} → ${rep2After}`);
        console.log(`   - Oracle 3: ${rep3Before} → ${rep3After}`);
    });
});



