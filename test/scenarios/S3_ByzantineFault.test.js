/**
 * Scenario S3: Byzantine Fault
 * 1 oracle returns malicious value (10x), should be detected as outlier
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");
const { MetricsCollector } = require("../helpers/setup");

describe("Scenario S3: Byzantine Fault (Malicious 10x)", function () {
    const MIN_RESPONSES = 2;
    const OUTLIER_THRESHOLD = 10;
    const REQUEST_DEADLINE = 30;
    const BASE_READING = 5000;
    const MALICIOUS_MULTIPLIER = 10;
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

    it("Should detect 10x outlier and exclude from aggregation", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);

        await oracleAggregator.requestData("METER001");

        // Oracle 1 and 2 respond honestly
        const sig1 = await signResponse(oracle1, 1, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

        const sig2 = await signResponse(oracle2, 1, 5100);
        await oracleAggregator.connect(oracle2).submitResponse(1, 5100, sig2);

        // Oracle 3 responds with malicious 10x value
        const maliciousValue = BASE_READING * MALICIOUS_MULTIPLIER; // 50000
        const sig3 = await signResponse(oracle3, 1, maliciousValue);

        await expect(
            oracleAggregator.connect(oracle3).submitResponse(1, maliciousValue, sig3)
        ).to.emit(oracleAggregator, "OutlierDetected")
            .withArgs(1, oracle3.address, maliciousValue);

        // Check aggregated value excludes outlier
        const request = await oracleAggregator.getRequest(1);
        expect(request.aggregatedValue).to.equal(5050); // (5000 + 5100) / 2

        // NOT the average with outlier: (5000 + 5100 + 50000) / 3 = 20033

        console.log("\n✅ 10x outlier detected and excluded");
        console.log(`   - Honest values: [5000, 5100]`);
        console.log(`   - Malicious value: ${maliciousValue}`);
        console.log(`   - Aggregated result: ${request.aggregatedValue}`);
    });

    it("Should detect 100% of Byzantine faults over multiple requests", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);
        const metrics = new MetricsCollector();
        let outliersDetected = 0;

        for (let i = 0; i < NUM_REQUESTS; i++) {
            const startTime = Date.now();

            await oracleAggregator.requestData(`METER00${i + 1}`);
            const requestId = i + 1;

            // Honest oracles
            const sig1 = await signResponse(oracle1, requestId, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);

            const sig2 = await signResponse(oracle2, requestId, 5100);
            await oracleAggregator.connect(oracle2).submitResponse(requestId, 5100, sig2);

            // Malicious oracle
            const maliciousValue = BASE_READING * MALICIOUS_MULTIPLIER;
            const sig3 = await signResponse(oracle3, requestId, maliciousValue);

            const tx = await oracleAggregator.connect(oracle3).submitResponse(requestId, maliciousValue, sig3);
            const receipt = await tx.wait();

            // Check if OutlierDetected event was emitted
            const outlierEvents = receipt.logs.filter(log => {
                try {
                    const parsed = oracleAggregator.interface.parseLog(log);
                    return parsed?.name === "OutlierDetected";
                } catch {
                    return false;
                }
            });

            if (outlierEvents.length > 0) {
                outliersDetected++;
                metrics.recordOutlierDetection();
            }

            const latency = Date.now() - startTime;
            metrics.recordLatency(latency);
            metrics.recordSuccess();

            // Verify correct aggregation
            const request = await oracleAggregator.getRequest(requestId);
            expect(request.aggregatedValue).to.equal(5050);
        }

        const detectionRate = (outliersDetected / NUM_REQUESTS) * 100;
        expect(detectionRate).to.equal(100, "Should detect 100% of outliers");

        console.log("\n✅ S3 Byzantine Fault: PASSED");
        console.log(`   - Outliers injected: ${NUM_REQUESTS}`);
        console.log(`   - Outliers detected: ${outliersDetected}`);
        console.log(`   - Detection rate: ${detectionRate}%`);
    });

    it("Should penalize malicious oracle's reputation", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);

        const repBefore = (await oracleAggregator.getOracleInfo(oracle3.address)).reputation;
        console.log(`\nOracle 3 initial reputation: ${repBefore}`);

        for (let i = 0; i < NUM_REQUESTS; i++) {
            await oracleAggregator.requestData(`METER00${i + 1}`);
            const requestId = i + 1;

            const sig1 = await signResponse(oracle1, requestId, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);

            const sig2 = await signResponse(oracle2, requestId, 5100);
            await oracleAggregator.connect(oracle2).submitResponse(requestId, 5100, sig2);

            const sig3 = await signResponse(oracle3, requestId, 50000);
            await oracleAggregator.connect(oracle3).submitResponse(requestId, 50000, sig3);
        }

        const repAfter = (await oracleAggregator.getOracleInfo(oracle3.address)).reputation;
        const expectedRep = repBefore - BigInt(5 * NUM_REQUESTS);

        expect(repAfter).to.equal(expectedRep);

        console.log(`Oracle 3 final reputation: ${repAfter}`);
        console.log(`Reputation decreased by: ${repBefore - repAfter}`);
        console.log("\n✅ Malicious oracle reputation correctly penalized");
    });

    it("Should reward honest oracles while penalizing malicious one", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);

        const rep1Before = (await oracleAggregator.getOracleInfo(oracle1.address)).reputation;
        const rep3Before = (await oracleAggregator.getOracleInfo(oracle3.address)).reputation;

        await oracleAggregator.requestData("METER001");

        const sig1 = await signResponse(oracle1, 1, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

        const sig2 = await signResponse(oracle2, 1, 5100);
        await oracleAggregator.connect(oracle2).submitResponse(1, 5100, sig2);

        const sig3 = await signResponse(oracle3, 1, 50000);
        await oracleAggregator.connect(oracle3).submitResponse(1, 50000, sig3);

        const rep1After = (await oracleAggregator.getOracleInfo(oracle1.address)).reputation;
        const rep3After = (await oracleAggregator.getOracleInfo(oracle3.address)).reputation;

        expect(rep1After).to.equal(rep1Before + 1n); // +1 for valid response
        expect(rep3After).to.equal(rep3Before - 5n); // -5 for outlier

        console.log("\n✅ Reputation system working correctly");
        console.log(`   - Honest oracle 1: ${rep1Before} → ${rep1After} (+1)`);
        console.log(`   - Malicious oracle 3: ${rep3Before} → ${rep3After} (-5)`);
    });
});


