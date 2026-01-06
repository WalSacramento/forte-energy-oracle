/**
 * Scenario S6: Stress Test
 * 100 consecutive requests to test throughput and stability
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { MetricsCollector } = require("../helpers/setup");

describe("Scenario S6: Stress Test (100 requests)", function () {
    const MIN_RESPONSES = 2;
    const OUTLIER_THRESHOLD = 10;
    const REQUEST_DEADLINE = 30;
    const NUM_REQUESTS = 100;

    // Increase timeout for stress test
    this.timeout(120000);

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

    it("Should handle 100 consecutive requests", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);
        const metrics = new MetricsCollector();
        const testStartTime = Date.now();
        let successCount = 0;
        let failCount = 0;

        console.log(`\n--- Starting Stress Test: ${NUM_REQUESTS} requests ---\n`);

        for (let i = 0; i < NUM_REQUESTS; i++) {
            const startTime = Date.now();

            try {
                // Create request
                const tx = await oracleAggregator.requestData(`METER${(i % 5) + 1}`);
                await tx.wait();
                const requestId = i + 1;

                // Generate readings
                const value1 = generateReading(5000);
                const value2 = generateReading(5000);
                const value3 = generateReading(5000);

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
                const totalGas = receipt1.gasUsed + receipt2.gasUsed + receipt3.gasUsed;

                // Verify completion
                const request = await oracleAggregator.getRequest(requestId);
                if (request.status === 2n) {
                    successCount++;
                    metrics.recordSuccess();
                } else {
                    failCount++;
                    metrics.recordFailure();
                }

                metrics.recordLatency(latency);
                metrics.recordGas(totalGas);

                // Progress indicator every 10 requests
                if ((i + 1) % 10 === 0) {
                    console.log(`   Processed ${i + 1}/${NUM_REQUESTS} requests...`);
                }
            } catch (error) {
                failCount++;
                metrics.recordFailure();
                console.error(`   Request ${i + 1} failed: ${error.message}`);
            }
        }

        const totalDuration = Date.now() - testStartTime;
        const throughput = (successCount / totalDuration) * 60000; // requests per minute

        // Print metrics
        metrics.printReport();

        const stats = metrics.getStats();

        console.log("\n═══════════════════════════════════════════");
        console.log("           STRESS TEST SUMMARY             ");
        console.log("═══════════════════════════════════════════");
        console.log(`Total requests:     ${NUM_REQUESTS}`);
        console.log(`Successful:         ${successCount}`);
        console.log(`Failed:             ${failCount}`);
        console.log(`Success rate:       ${(stats.requests.successRate * 100).toFixed(2)}%`);
        console.log(`Total duration:     ${totalDuration}ms`);
        console.log(`Throughput:         ${throughput.toFixed(2)} req/min`);
        console.log(`Avg latency:        ${stats.latency.avg}ms`);
        console.log(`P95 latency:        ${stats.latency.p95}ms`);
        console.log(`P99 latency:        ${stats.latency.p99}ms`);
        console.log(`Avg gas/cycle:      ${stats.gas.avg}`);
        console.log(`Total gas:          ${stats.gas.total}`);
        console.log("═══════════════════════════════════════════\n");

        // Assertions
        expect(stats.requests.successRate).to.be.gte(0.99, "Success rate should be >= 99%");
        expect(throughput).to.be.gte(10, "Throughput should be >= 10 req/min");

        console.log("✅ S6 Stress Test: PASSED");
    });

    it("Should maintain consistent gas usage under load", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);
        const gasUsages = [];

        // Run 20 requests and measure gas
        for (let i = 0; i < 20; i++) {
            await oracleAggregator.requestData(`METER${i + 1}`);
            const requestId = i + 1;

            const sig1 = await signResponse(oracle1, requestId, 5000);
            const tx1 = await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);
            const receipt1 = await tx1.wait();

            const sig2 = await signResponse(oracle2, requestId, 5050);
            const tx2 = await oracleAggregator.connect(oracle2).submitResponse(requestId, 5050, sig2);
            const receipt2 = await tx2.wait();

            const sig3 = await signResponse(oracle3, requestId, 5025);
            const tx3 = await oracleAggregator.connect(oracle3).submitResponse(requestId, 5025, sig3);
            const receipt3 = await tx3.wait();

            const totalGas = Number(receipt1.gasUsed + receipt2.gasUsed + receipt3.gasUsed);
            gasUsages.push(totalGas);
        }

        // Calculate variance
        const avg = gasUsages.reduce((a, b) => a + b, 0) / gasUsages.length;
        const variance = gasUsages.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / gasUsages.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = (stdDev / avg) * 100;

        console.log(`\n--- Gas Usage Consistency ---`);
        console.log(`Average gas:        ${avg.toFixed(0)}`);
        console.log(`Std deviation:      ${stdDev.toFixed(0)}`);
        console.log(`Coefficient of var: ${coefficientOfVariation.toFixed(2)}%`);

        // Gas usage should be relatively consistent (< 10% variation)
        expect(coefficientOfVariation).to.be.lt(10, "Gas usage variance should be < 10%");
        expect(avg).to.be.lt(500000, "Average gas should be < 500,000");

        console.log("✅ Gas usage consistent under load");
    });
});


