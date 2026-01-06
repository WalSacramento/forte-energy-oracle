/**
 * OracleAggregator Unit Tests
 * Comprehensive tests for the OracleAggregator contract
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("OracleAggregator", function () {
    // Configuration constants
    const MIN_RESPONSES = 2;
    const OUTLIER_THRESHOLD = 10;
    const REQUEST_DEADLINE = 30;
    const INITIAL_REPUTATION = 70;

    async function deployOracleAggregatorFixture() {
        const [owner, oracle1, oracle2, oracle3, user] = await ethers.getSigners();

        const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
        const oracleAggregator = await OracleAggregator.deploy(
            MIN_RESPONSES,
            OUTLIER_THRESHOLD,
            REQUEST_DEADLINE
        );

        return { oracleAggregator, owner, oracle1, oracle2, oracle3, user };
    }

    async function deployWithOraclesFixture() {
        const { oracleAggregator, owner, oracle1, oracle2, oracle3, user } = 
            await loadFixture(deployOracleAggregatorFixture);

        // Register oracles
        await oracleAggregator.registerOracle(oracle1.address);
        await oracleAggregator.registerOracle(oracle2.address);
        await oracleAggregator.registerOracle(oracle3.address);

        // Authorize owner to request data
        await oracleAggregator.authorizeCaller(owner.address);

        return { oracleAggregator, owner, oracle1, oracle2, oracle3, user };
    }

    // Helper function to sign response
    async function signResponse(signer, requestId, value) {
        const messageHash = ethers.solidityPackedKeccak256(
            ["uint256", "uint256"],
            [requestId, value]
        );
        return await signer.signMessage(ethers.getBytes(messageHash));
    }

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            const { oracleAggregator, owner } = await loadFixture(deployOracleAggregatorFixture);
            expect(await oracleAggregator.owner()).to.equal(owner.address);
        });

        it("Should set configuration correctly", async function () {
            const { oracleAggregator } = await loadFixture(deployOracleAggregatorFixture);
            expect(await oracleAggregator.minResponses()).to.equal(MIN_RESPONSES);
            expect(await oracleAggregator.outlierThreshold()).to.equal(OUTLIER_THRESHOLD);
            expect(await oracleAggregator.requestDeadline()).to.equal(REQUEST_DEADLINE);
        });

        it("Should revert with invalid minResponses", async function () {
            const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
            await expect(
                OracleAggregator.deploy(1, OUTLIER_THRESHOLD, REQUEST_DEADLINE)
            ).to.be.revertedWith("Min responses must be >= 2");
        });

        it("Should revert with invalid outlierThreshold", async function () {
            const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
            await expect(
                OracleAggregator.deploy(MIN_RESPONSES, 0, REQUEST_DEADLINE)
            ).to.be.revertedWith("Invalid threshold");
        });
    });

    describe("Oracle Registration", function () {
        it("Should register an oracle successfully", async function () {
            const { oracleAggregator, oracle1 } = await loadFixture(deployOracleAggregatorFixture);

            await expect(oracleAggregator.registerOracle(oracle1.address))
                .to.emit(oracleAggregator, "OracleRegistered")
                .withArgs(oracle1.address);

            const oracleInfo = await oracleAggregator.getOracleInfo(oracle1.address);
            expect(oracleInfo.isActive).to.be.true;
            expect(oracleInfo.reputation).to.equal(INITIAL_REPUTATION);
        });

        it("Should revert when registering zero address", async function () {
            const { oracleAggregator } = await loadFixture(deployOracleAggregatorFixture);
            await expect(
                oracleAggregator.registerOracle(ethers.ZeroAddress)
            ).to.be.revertedWith("Invalid address");
        });

        it("Should revert when registering duplicate oracle", async function () {
            const { oracleAggregator, oracle1 } = await loadFixture(deployOracleAggregatorFixture);
            await oracleAggregator.registerOracle(oracle1.address);

            await expect(
                oracleAggregator.registerOracle(oracle1.address)
            ).to.be.revertedWith("Already registered");
        });

        it("Should only allow owner to register oracles", async function () {
            const { oracleAggregator, oracle1, user } = await loadFixture(deployOracleAggregatorFixture);

            await expect(
                oracleAggregator.connect(user).registerOracle(oracle1.address)
            ).to.be.reverted;
        });

        it("Should correctly count active oracles", async function () {
            const { oracleAggregator, oracle1, oracle2, oracle3 } = 
                await loadFixture(deployOracleAggregatorFixture);

            expect(await oracleAggregator.getActiveOracleCount()).to.equal(0);

            await oracleAggregator.registerOracle(oracle1.address);
            expect(await oracleAggregator.getActiveOracleCount()).to.equal(1);

            await oracleAggregator.registerOracle(oracle2.address);
            await oracleAggregator.registerOracle(oracle3.address);
            expect(await oracleAggregator.getActiveOracleCount()).to.equal(3);
        });
    });

    describe("Oracle Removal", function () {
        it("Should remove an oracle successfully", async function () {
            const { oracleAggregator, oracle1 } = await loadFixture(deployWithOraclesFixture);

            await expect(oracleAggregator.removeOracle(oracle1.address))
                .to.emit(oracleAggregator, "OracleRemoved")
                .withArgs(oracle1.address);

            const oracleInfo = await oracleAggregator.getOracleInfo(oracle1.address);
            expect(oracleInfo.isActive).to.be.false;
        });

        it("Should revert when removing non-existent oracle", async function () {
            const { oracleAggregator, user } = await loadFixture(deployOracleAggregatorFixture);
            await expect(
                oracleAggregator.removeOracle(user.address)
            ).to.be.revertedWith("Oracle not active");
        });
    });

    describe("Data Request", function () {
        it("Should create a data request successfully", async function () {
            const { oracleAggregator, owner } = await loadFixture(deployWithOraclesFixture);

            const tx = await oracleAggregator.requestData("METER001");
            const receipt = await tx.wait();

            // Check event
            const event = receipt.logs.find(log => {
                try {
                    return oracleAggregator.interface.parseLog(log)?.name === "DataRequested";
                } catch {
                    return false;
                }
            });
            expect(event).to.not.be.undefined;

            const request = await oracleAggregator.getRequest(1);
            expect(request.id).to.equal(1);
            expect(request.meterId).to.equal("METER001");
            expect(request.status).to.equal(0); // Pending
        });

        it("Should increment request counter", async function () {
            const { oracleAggregator } = await loadFixture(deployWithOraclesFixture);

            await oracleAggregator.requestData("METER001");
            await oracleAggregator.requestData("METER002");
            await oracleAggregator.requestData("METER003");

            expect(await oracleAggregator.requestCounter()).to.equal(3);
        });

        it("Should revert when not enough oracles", async function () {
            const { oracleAggregator, owner } = await loadFixture(deployOracleAggregatorFixture);
            await oracleAggregator.authorizeCaller(owner.address);

            await expect(
                oracleAggregator.requestData("METER001")
            ).to.be.revertedWith("Not enough oracles");
        });

        it("Should only allow authorized callers", async function () {
            const { oracleAggregator, user } = await loadFixture(deployWithOraclesFixture);

            await expect(
                oracleAggregator.connect(user).requestData("METER001")
            ).to.be.revertedWith("Not authorized");
        });
    });

    describe("Response Submission", function () {
        it("Should submit response successfully", async function () {
            const { oracleAggregator, oracle1 } = await loadFixture(deployWithOraclesFixture);

            await oracleAggregator.requestData("METER001");
            const signature = await signResponse(oracle1, 1, 5000);

            await expect(
                oracleAggregator.connect(oracle1).submitResponse(1, 5000, signature)
            ).to.emit(oracleAggregator, "ResponseSubmitted")
                .withArgs(1, oracle1.address, 5000);
        });

        it("Should revert with invalid signature", async function () {
            const { oracleAggregator, oracle1, oracle2 } = await loadFixture(deployWithOraclesFixture);

            await oracleAggregator.requestData("METER001");
            // Sign with oracle2 but submit as oracle1
            const signature = await signResponse(oracle2, 1, 5000);

            await expect(
                oracleAggregator.connect(oracle1).submitResponse(1, 5000, signature)
            ).to.be.revertedWith("Invalid signature");
        });

        it("Should revert on duplicate response", async function () {
            const { oracleAggregator, oracle1 } = await loadFixture(deployWithOraclesFixture);

            await oracleAggregator.requestData("METER001");
            const signature = await signResponse(oracle1, 1, 5000);

            await oracleAggregator.connect(oracle1).submitResponse(1, 5000, signature);

            await expect(
                oracleAggregator.connect(oracle1).submitResponse(1, 5000, signature)
            ).to.be.revertedWith("Already responded");
        });

        it("Should revert when oracle is not active", async function () {
            const { oracleAggregator, user } = await loadFixture(deployWithOraclesFixture);

            await oracleAggregator.requestData("METER001");
            const signature = await signResponse(user, 1, 5000);

            await expect(
                oracleAggregator.connect(user).submitResponse(1, 5000, signature)
            ).to.be.revertedWith("Not an active oracle");
        });

        it("Should revert when request does not exist", async function () {
            const { oracleAggregator, oracle1 } = await loadFixture(deployWithOraclesFixture);

            const signature = await signResponse(oracle1, 999, 5000);

            await expect(
                oracleAggregator.connect(oracle1).submitResponse(999, 5000, signature)
            ).to.be.revertedWith("Request does not exist");
        });
    });

    describe("Aggregation", function () {
        it("Should aggregate when all active oracles have responded", async function () {
            const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployWithOraclesFixture);

            await oracleAggregator.requestData("METER001");

            const sig1 = await signResponse(oracle1, 1, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

            const sig2 = await signResponse(oracle2, 1, 5100);
            await oracleAggregator.connect(oracle2).submitResponse(1, 5100, sig2);

            // Should aggregate only when the 3rd oracle responds
            const sig3 = await signResponse(oracle3, 1, 5050);
            await expect(
                oracleAggregator.connect(oracle3).submitResponse(1, 5050, sig3)
            ).to.emit(oracleAggregator, "DataAggregated");

            const request = await oracleAggregator.getRequest(1);
            expect(request.status).to.equal(2); // Completed
            expect(request.aggregatedValue).to.be.gt(0);
        });

        it("Should calculate median correctly with 3 responses", async function () {
            const { oracleAggregator, oracle1, oracle2, oracle3 } = 
                await loadFixture(deployWithOraclesFixture);

            await oracleAggregator.requestData("METER001");

            const sig1 = await signResponse(oracle1, 1, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

            const sig2 = await signResponse(oracle2, 1, 5100);
            await oracleAggregator.connect(oracle2).submitResponse(1, 5100, sig2);

            const sig3 = await signResponse(oracle3, 1, 5050);
            await oracleAggregator.connect(oracle3).submitResponse(1, 5050, sig3);

            const request = await oracleAggregator.getRequest(1);
            // Median of [5000, 5050, 5100] = 5050
            // All values are within 10% of median, so average = (5000+5050+5100)/3 = 5050
            expect(request.aggregatedValue).to.equal(5050);
        });

        it("Should detect outliers correctly", async function () {
            const { oracleAggregator, oracle1, oracle2, oracle3 } = 
                await loadFixture(deployWithOraclesFixture);

            await oracleAggregator.requestData("METER001");

            const sig1 = await signResponse(oracle1, 1, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

            const sig2 = await signResponse(oracle2, 1, 5100);
            await oracleAggregator.connect(oracle2).submitResponse(1, 5100, sig2);

            // 50000 is 10x the median, clearly an outlier
            const sig3 = await signResponse(oracle3, 1, 50000);
            await expect(
                oracleAggregator.connect(oracle3).submitResponse(1, 50000, sig3)
            ).to.emit(oracleAggregator, "OutlierDetected")
                .withArgs(1, oracle3.address, 50000);

            const request = await oracleAggregator.getRequest(1);
            // Outlier should be excluded, average of valid = (5000+5100)/2 = 5050
            expect(request.aggregatedValue).to.equal(5050);
        });
    });

    describe("Reputation System", function () {
        it("Should reward oracle for valid response", async function () {
            const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployWithOraclesFixture);

            const infoBefore = await oracleAggregator.getOracleInfo(oracle1.address);

            await oracleAggregator.requestData("METER001");

            const sig1 = await signResponse(oracle1, 1, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

            const sig2 = await signResponse(oracle2, 1, 5050);
            await oracleAggregator.connect(oracle2).submitResponse(1, 5050, sig2);

            const sig3 = await signResponse(oracle3, 1, 5025);
            await oracleAggregator.connect(oracle3).submitResponse(1, 5025, sig3);

            const infoAfter = await oracleAggregator.getOracleInfo(oracle1.address);
            expect(infoAfter.reputation).to.equal(infoBefore.reputation + 1n);
            expect(infoAfter.validResponses).to.equal(1n);
        });

        it("Should penalize oracle for outlier", async function () {
            const { oracleAggregator, oracle1, oracle2, oracle3 } = 
                await loadFixture(deployWithOraclesFixture);

            const infoBefore = await oracleAggregator.getOracleInfo(oracle3.address);

            await oracleAggregator.requestData("METER001");

            const sig1 = await signResponse(oracle1, 1, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

            const sig2 = await signResponse(oracle2, 1, 5100);
            await oracleAggregator.connect(oracle2).submitResponse(1, 5100, sig2);

            const sig3 = await signResponse(oracle3, 1, 50000);
            await oracleAggregator.connect(oracle3).submitResponse(1, 50000, sig3);

            const infoAfter = await oracleAggregator.getOracleInfo(oracle3.address);
            expect(infoAfter.reputation).to.equal(infoBefore.reputation - 5n);
        });

        it("Should not exceed max reputation", async function () {
            const { oracleAggregator, oracle1, oracle2, oracle3 } = await loadFixture(deployWithOraclesFixture);

            // Run many requests to try to exceed max
            for (let i = 0; i < 40; i++) {
                await oracleAggregator.requestData(`METER${i}`);
                const requestId = i + 1;

                const sig1 = await signResponse(oracle1, requestId, 5000);
                await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);

                const sig2 = await signResponse(oracle2, requestId, 5000);
                await oracleAggregator.connect(oracle2).submitResponse(requestId, 5000, sig2);

                const sig3 = await signResponse(oracle3, requestId, 5000);
                await oracleAggregator.connect(oracle3).submitResponse(requestId, 5000, sig3);
            }

            const info = await oracleAggregator.getOracleInfo(oracle1.address);
            expect(info.reputation).to.equal(100n);
        });

        it("Should deactivate oracle when reputation reaches 0", async function () {
            const { oracleAggregator, oracle1, oracle2, oracle3 } = 
                await loadFixture(deployWithOraclesFixture);

            // Set up scenario where oracle3 gets penalized repeatedly
            // Initial rep = 70, penalty = 5, so 14 outliers = 0
            for (let i = 0; i < 14; i++) {
                await oracleAggregator.requestData(`METER${i}`);
                const requestId = i + 1;

                const sig1 = await signResponse(oracle1, requestId, 5000);
                await oracleAggregator.connect(oracle1).submitResponse(requestId, 5000, sig1);

                const sig2 = await signResponse(oracle2, requestId, 5000);
                await oracleAggregator.connect(oracle2).submitResponse(requestId, 5000, sig2);

                const sig3 = await signResponse(oracle3, requestId, 50000);
                await oracleAggregator.connect(oracle3).submitResponse(requestId, 50000, sig3);
            }

            const info = await oracleAggregator.getOracleInfo(oracle3.address);
            expect(info.reputation).to.equal(0n);
            expect(info.isActive).to.be.false;
        });
    });

    describe("View Functions", function () {
        it("Should return all oracle addresses", async function () {
            const { oracleAggregator, oracle1, oracle2, oracle3 } = 
                await loadFixture(deployWithOraclesFixture);

            const oracles = await oracleAggregator.getAllOracles();
            expect(oracles.length).to.equal(3);
            expect(oracles).to.include(oracle1.address);
            expect(oracles).to.include(oracle2.address);
            expect(oracles).to.include(oracle3.address);
        });

        it("Should return responses for a request", async function () {
            const { oracleAggregator, oracle1, oracle2 } = await loadFixture(deployWithOraclesFixture);

            await oracleAggregator.requestData("METER001");

            const sig1 = await signResponse(oracle1, 1, 5000);
            await oracleAggregator.connect(oracle1).submitResponse(1, 5000, sig1);

            const sig2 = await signResponse(oracle2, 1, 5100);
            await oracleAggregator.connect(oracle2).submitResponse(1, 5100, sig2);

            const responses = await oracleAggregator.getResponses(1);
            expect(responses.length).to.equal(2);
        });
    });

    describe("Configuration Update", function () {
        it("Should update configuration", async function () {
            const { oracleAggregator, owner } = await loadFixture(deployOracleAggregatorFixture);

            await oracleAggregator.updateConfig(3, 15, 60);

            expect(await oracleAggregator.minResponses()).to.equal(3);
            expect(await oracleAggregator.outlierThreshold()).to.equal(15);
            expect(await oracleAggregator.requestDeadline()).to.equal(60);
        });

        it("Should only allow owner to update config", async function () {
            const { oracleAggregator, user } = await loadFixture(deployOracleAggregatorFixture);

            await expect(
                oracleAggregator.connect(user).updateConfig(3, 15, 60)
            ).to.be.reverted;
        });
    });
});


