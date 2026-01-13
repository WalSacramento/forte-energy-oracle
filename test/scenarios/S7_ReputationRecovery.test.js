/**
 * Scenario S7: Reputation Recovery
 * Oracle penalized then recovers through honest behavior
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("Scenario S7: Reputation Recovery", function () {
    const MIN_RESPONSES = 2;
    const OUTLIER_THRESHOLD = 10;
    const REQUEST_DEADLINE = 30;
    const INITIAL_REPUTATION = 70;
    const PENALTY_AMOUNT = 5;
    const REWARD_AMOUNT = 1;

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

    it("Should recover reputation after penalty through honest responses", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);

        const reputationHistory = [];
        let requestId = 0;

        // Record initial reputation
        let info = await oracleAggregator.getOracleInfo(oracle3.address);
        reputationHistory.push({ request: 0, reputation: Number(info.reputation), action: "initial" });
        console.log(`\nInitial reputation: ${info.reputation}`);

        // Step 1: Oracle 3 submits malicious response
        requestId++;
        await oracleAggregator.requestData("METER001");

        let sig1 = await signResponse(oracle1, requestId, 5000);
        await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);

        let sig2 = await signResponse(oracle2, requestId, 5050);
        await oracleAggregator.connect(oracle2).submitResponse(requestId, 5050, sig2);

        let sig3 = await signResponse(oracle3, requestId, 50000); // Malicious
        await oracleAggregator.connect(oracle3).submitResponse(requestId, 50000, sig3);

        info = await oracleAggregator.getOracleInfo(oracle3.address);
        const repAfterPenalty = Number(info.reputation);
        reputationHistory.push({ request: requestId, reputation: repAfterPenalty, action: "malicious" });
        console.log(`After malicious response: ${repAfterPenalty} (-${PENALTY_AMOUNT})`);

        expect(repAfterPenalty).to.equal(INITIAL_REPUTATION - PENALTY_AMOUNT);

        // Step 2: Oracle 3 submits honest responses to recover
        const honestRequestsNeeded = PENALTY_AMOUNT; // Need 5 honest responses to recover
        console.log(`\nRecovering through ${honestRequestsNeeded} honest responses...`);

        for (let i = 0; i < honestRequestsNeeded; i++) {
            requestId++;
            await oracleAggregator.requestData(`METER_RECOVERY_${i}`);

            sig1 = await signResponse(oracle1, requestId, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);

            sig2 = await signResponse(oracle2, requestId, 5050);
            await oracleAggregator.connect(oracle2).submitResponse(requestId, 5050, sig2);

            sig3 = await signResponse(oracle3, requestId, 5025); // Honest
            await oracleAggregator.connect(oracle3).submitResponse(requestId, 5025, sig3);

            info = await oracleAggregator.getOracleInfo(oracle3.address);
            reputationHistory.push({ 
                request: requestId, 
                reputation: Number(info.reputation), 
                action: "honest" 
            });
        }

        const repAfterRecovery = Number(info.reputation);
        console.log(`After ${honestRequestsNeeded} honest responses: ${repAfterRecovery}`);

        expect(repAfterRecovery).to.equal(INITIAL_REPUTATION);

        // Step 3: Continue with more honest responses to exceed initial
        const additionalRequests = 5;
        for (let i = 0; i < additionalRequests; i++) {
            requestId++;
            await oracleAggregator.requestData(`METER_EXTRA_${i}`);

            sig1 = await signResponse(oracle1, requestId, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);

            sig2 = await signResponse(oracle2, requestId, 5050);
            await oracleAggregator.connect(oracle2).submitResponse(requestId, 5050, sig2);

            sig3 = await signResponse(oracle3, requestId, 5025);
            await oracleAggregator.connect(oracle3).submitResponse(requestId, 5025, sig3);

            info = await oracleAggregator.getOracleInfo(oracle3.address);
            reputationHistory.push({ 
                request: requestId, 
                reputation: Number(info.reputation), 
                action: "honest" 
            });
        }

        const finalRep = Number(info.reputation);
        console.log(`After ${additionalRequests} more honest responses: ${finalRep}`);

        expect(finalRep).to.equal(INITIAL_REPUTATION + additionalRequests);

        // Print reputation evolution
        console.log("\n═══════════════════════════════════════════");
        console.log("        REPUTATION EVOLUTION               ");
        console.log("═══════════════════════════════════════════");
        console.log("Request | Reputation | Action");
        console.log("--------|------------|--------");
        reputationHistory.forEach(h => {
            console.log(`   ${h.request.toString().padStart(2)}   |     ${h.reputation.toString().padStart(2)}     | ${h.action}`);
        });
        console.log("═══════════════════════════════════════════\n");

        console.log("✅ S7 Reputation Recovery: PASSED");
    });

    it("Should track total and valid responses correctly", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);

        // Submit mix of honest and malicious responses
        const responses = [
            { value: 5025, isMalicious: false },
            { value: 5025, isMalicious: false },
            { value: 50000, isMalicious: true },
            { value: 5025, isMalicious: false },
            { value: 50000, isMalicious: true },
            { value: 5025, isMalicious: false },
        ];

        for (let i = 0; i < responses.length; i++) {
            const requestId = i + 1;
            await oracleAggregator.requestData(`METER${requestId}`);

            const sig1 = await signResponse(oracle1, requestId, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);

            const sig2 = await signResponse(oracle2, requestId, 5050);
            await oracleAggregator.connect(oracle2).submitResponse(requestId, 5050, sig2);

            const sig3 = await signResponse(oracle3, requestId, responses[i].value);
            await oracleAggregator.connect(oracle3).submitResponse(requestId, responses[i].value, sig3);
        }

        const info = await oracleAggregator.getOracleInfo(oracle3.address);
        const totalResponses = Number(info.totalResponses);
        const validResponses = Number(info.validResponses);
        const maliciousResponses = totalResponses - validResponses;

        expect(totalResponses).to.equal(responses.length);
        expect(validResponses).to.equal(responses.filter(r => !r.isMalicious).length);
        expect(maliciousResponses).to.equal(responses.filter(r => r.isMalicious).length);

        console.log("\n--- Response Statistics ---");
        console.log(`Total responses:     ${totalResponses}`);
        console.log(`Valid responses:     ${validResponses}`);
        console.log(`Malicious responses: ${maliciousResponses}`);
        console.log(`Validity rate:       ${((validResponses / totalResponses) * 100).toFixed(2)}%`);
    });

    it("Should deactivate oracle when reputation reaches 0", async function () {
        const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployFixture);

        const requestsToDeactivate = Math.ceil(INITIAL_REPUTATION / PENALTY_AMOUNT);
        console.log(`\nSubmitting ${requestsToDeactivate} malicious responses to deactivate oracle...`);

        for (let i = 0; i < requestsToDeactivate; i++) {
            const requestId = i + 1;
            await oracleAggregator.requestData(`METER${requestId}`);

            const sig1 = await signResponse(oracle1, requestId, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);

            const sig2 = await signResponse(oracle2, requestId, 5050);
            await oracleAggregator.connect(oracle2).submitResponse(requestId, 5050, sig2);

            const sig3 = await signResponse(oracle3, requestId, 50000);
            await oracleAggregator.connect(oracle3).submitResponse(requestId, 50000, sig3);

            const info = await oracleAggregator.getOracleInfo(oracle3.address);
            console.log(`Request ${requestId}: reputation = ${info.reputation}, active = ${info.isActive}`);

            if (!info.isActive) {
                console.log(`\n⚠️  Oracle deactivated after ${requestId} malicious responses`);
                break;
            }
        }

        const finalInfo = await oracleAggregator.getOracleInfo(oracle3.address);
        expect(finalInfo.reputation).to.equal(0n);
        expect(finalInfo.isActive).to.be.false;

        // Verify deactivated oracle cannot submit
        const nextRequestId = requestsToDeactivate + 1;
        await oracleAggregator.requestData("METER_AFTER_DEACTIVATION");

        const sig = await signResponse(oracle3, nextRequestId, 5000);
        await expect(
            oracleAggregator.connect(oracle3).submitResponse(nextRequestId, 5000, sig)
        ).to.be.revertedWith("Not an active oracle");

        console.log("✅ Deactivated oracle cannot submit responses");
    });
});



