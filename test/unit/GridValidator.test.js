/**
 * GridValidator Unit Tests
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

describe("GridValidator", function () {
    async function deployGridValidatorFixture() {
        const [owner, prosumer1, prosumer2, user] = await ethers.getSigners();

        const GridValidator = await ethers.getContractFactory("GridValidator");
        const gridValidator = await GridValidator.deploy();

        return { gridValidator, owner, prosumer1, prosumer2, user };
    }

    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            const { gridValidator, owner } = await loadFixture(deployGridValidatorFixture);
            expect(await gridValidator.owner()).to.equal(owner.address);
        });

        it("Should create default grid line", async function () {
            const { gridValidator } = await loadFixture(deployGridValidatorFixture);
            
            const defaultLine = await gridValidator.defaultLineId();
            expect(defaultLine).to.equal("LINE001");

            const lineInfo = await gridValidator.getGridLine("LINE001");
            expect(lineInfo.isActive).to.be.true;
            expect(lineInfo.maxCapacity).to.equal(1000000);
        });
    });

    describe("Grid Line Management", function () {
        it("Should add a new grid line", async function () {
            const { gridValidator, owner } = await loadFixture(deployGridValidatorFixture);

            await expect(gridValidator.addGridLine("LINE002", 500000))
                .to.emit(gridValidator, "GridLineAdded")
                .withArgs("LINE002", 500000);

            const lineInfo = await gridValidator.getGridLine("LINE002");
            expect(lineInfo.isActive).to.be.true;
            expect(lineInfo.maxCapacity).to.equal(500000);
        });

        it("Should revert when adding duplicate line", async function () {
            const { gridValidator } = await loadFixture(deployGridValidatorFixture);

            await expect(
                gridValidator.addGridLine("LINE001", 500000)
            ).to.be.revertedWith("Line already exists");
        });

        it("Should update grid load", async function () {
            const { gridValidator } = await loadFixture(deployGridValidatorFixture);

            await gridValidator.updateGridLoad("LINE001", 250000);

            const lineInfo = await gridValidator.getGridLine("LINE001");
            expect(lineInfo.currentLoad).to.equal(250000);
        });

        it("Should get available capacity", async function () {
            const { gridValidator } = await loadFixture(deployGridValidatorFixture);

            await gridValidator.updateGridLoad("LINE001", 300000);

            const available = await gridValidator.getAvailableCapacity("LINE001");
            expect(available).to.equal(700000); // 1000000 - 300000
        });
    });

    describe("Prosumer Management", function () {
        it("Should register a prosumer", async function () {
            const { gridValidator, prosumer1 } = await loadFixture(deployGridValidatorFixture);

            await expect(gridValidator.registerProsumer(prosumer1.address, 10000))
                .to.emit(gridValidator, "ProsumerRegistered")
                .withArgs(prosumer1.address, 10000);

            const capacity = await gridValidator.getProsumerCapacity(prosumer1.address);
            expect(capacity.maxGeneration).to.equal(10000);
        });

        it("Should update prosumer generation", async function () {
            const { gridValidator, prosumer1 } = await loadFixture(deployGridValidatorFixture);

            await gridValidator.registerProsumer(prosumer1.address, 10000);
            await gridValidator.updateProsumerGeneration(prosumer1.address, 5000);

            const capacity = await gridValidator.getProsumerCapacity(prosumer1.address);
            expect(capacity.currentGeneration).to.equal(5000);
        });
    });

    describe("Trade Validation", function () {
        it("Should validate trade within grid capacity", async function () {
            const { gridValidator, prosumer1 } = await loadFixture(deployGridValidatorFixture);

            const [isValid, reason] = await gridValidator.validateTrade(
                prosumer1.address,
                5000,
                ""
            );

            expect(isValid).to.be.true;
            expect(reason).to.equal("");
        });

        it("Should reject trade exceeding grid capacity", async function () {
            const { gridValidator, prosumer1 } = await loadFixture(deployGridValidatorFixture);

            // Set current load close to max
            await gridValidator.updateGridLoad("LINE001", 990000);

            const [isValid, reason] = await gridValidator.validateTrade(
                prosumer1.address,
                50000, // This would exceed capacity
                ""
            );

            expect(isValid).to.be.false;
            expect(reason).to.equal("Exceeds grid capacity");
        });

        it("Should validate registered prosumer's generation", async function () {
            const { gridValidator, prosumer1 } = await loadFixture(deployGridValidatorFixture);

            await gridValidator.registerProsumer(prosumer1.address, 10000);
            await gridValidator.updateProsumerGeneration(prosumer1.address, 5000);

            // Trade within generation
            const [isValid1, reason1] = await gridValidator.validateTrade(
                prosumer1.address,
                4000,
                ""
            );
            expect(isValid1).to.be.true;

            // Trade exceeding generation
            const [isValid2, reason2] = await gridValidator.validateTrade(
                prosumer1.address,
                6000,
                ""
            );
            expect(isValid2).to.be.false;
            expect(reason2).to.equal("Exceeds generation capacity");
        });

        it("Should validate and record trade", async function () {
            const { gridValidator, prosumer1 } = await loadFixture(deployGridValidatorFixture);

            await expect(
                gridValidator.validateAndRecordTrade(prosumer1.address, 5000, "")
            ).to.emit(gridValidator, "ValidationPassed");

            const lineInfo = await gridValidator.getGridLine("LINE001");
            expect(lineInfo.currentLoad).to.equal(5000);
        });

        it("Should validate and record trade with specific line ID", async function () {
            const { gridValidator, prosumer1 } = await loadFixture(deployGridValidatorFixture);

            await gridValidator.addGridLine("LINE002", 100000);

            await expect(
                gridValidator.validateAndRecordTrade(
                    prosumer1.address,
                    5000,
                    "LINE002"
                )
            ).to.emit(gridValidator, "ValidationPassed");

            const lineInfo = await gridValidator.getGridLine("LINE002");
            expect(lineInfo.currentLoad).to.equal(5000);
        });

        it("Should use specified grid line", async function () {
            const { gridValidator, prosumer1 } = await loadFixture(deployGridValidatorFixture);

            await gridValidator.addGridLine("LINE002", 100000);

            const [isValid, reason] = await gridValidator.validateTrade(
                prosumer1.address,
                50000,
                "LINE002"
            );

            expect(isValid).to.be.true;
        });

        it("Should reject trade on inactive line", async function () {
            const { gridValidator, prosumer1 } = await loadFixture(deployGridValidatorFixture);

            const [isValid, reason] = await gridValidator.validateTrade(
                prosumer1.address,
                5000,
                "NONEXISTENT"
            );

            expect(isValid).to.be.false;
            expect(reason).to.equal("Grid line not active");
        });
    });

    describe("Grid Line Configuration", function () {
        it("Should set default grid line", async function () {
            const { gridValidator, owner } = await loadFixture(deployGridValidatorFixture);

            await gridValidator.addGridLine("LINE002", 500000);

            await gridValidator.setDefaultLine("LINE002");
            expect(await gridValidator.defaultLineId()).to.equal("LINE002");
        });

        it("Should revert when setting inactive line as default", async function () {
            const { gridValidator, owner } = await loadFixture(deployGridValidatorFixture);

            await expect(
                gridValidator.setDefaultLine("NONEXISTENT")
            ).to.be.revertedWith("Line not active");
        });

        it("Should only allow owner to set default line", async function () {
            const { gridValidator, user } = await loadFixture(deployGridValidatorFixture);

            await expect(
                gridValidator.connect(user).setDefaultLine("LINE001")
            ).to.be.reverted;
        });
    });

    describe("Trade Validation Edge Cases", function () {
        it("Should return 0 available capacity when line is inactive", async function () {
            const { gridValidator } = await loadFixture(deployGridValidatorFixture);

            const available = await gridValidator.getAvailableCapacity("NONEXISTENT");
            expect(available).to.equal(0);
        });

        it("Should return 0 available capacity when line is at max capacity", async function () {
            const { gridValidator } = await loadFixture(deployGridValidatorFixture);

            await gridValidator.updateGridLoad("LINE001", 1000000);

            const available = await gridValidator.getAvailableCapacity("LINE001");
            expect(available).to.equal(0);
        });

        it("Should reject trade exceeding max generation capacity", async function () {
            const { gridValidator, prosumer1 } = await loadFixture(deployGridValidatorFixture);

            await gridValidator.registerProsumer(prosumer1.address, 10000);
            // Set currentGeneration higher than amount, but amount > maxGeneration
            // This way we test the maxGeneration check (line 197) before currentGeneration check (line 192)
            // Actually, currentGeneration is checked first, so we need currentGeneration > amount > maxGeneration
            await gridValidator.updateProsumerGeneration(prosumer1.address, 15000);

            const [isValid, reason] = await gridValidator.validateTrade(
                prosumer1.address,
                12000, // Exceeds maxGeneration (10000) but within currentGeneration (15000)
                ""
            );

            expect(isValid).to.be.false;
            expect(reason).to.equal("Exceeds maximum generation");
        });

        it("Should fail validation and record trade when validation fails", async function () {
            const { gridValidator, prosumer1 } = await loadFixture(deployGridValidatorFixture);

            await gridValidator.updateGridLoad("LINE001", 990000);

            await expect(
                gridValidator.validateAndRecordTrade(
                    prosumer1.address,
                    50000, // Would exceed capacity
                    ""
                )
            ).to.emit(gridValidator, "ValidationFailed");

            // Check that load didn't change (validation failed, so load wasn't updated)
            const lineInfo = await gridValidator.getGridLine("LINE001");
            expect(lineInfo.currentLoad).to.equal(990000); // Should not change
        });
    });

    describe("View Functions", function () {
        it("Should return all line IDs", async function () {
            const { gridValidator } = await loadFixture(deployGridValidatorFixture);

            await gridValidator.addGridLine("LINE002", 500000);
            await gridValidator.addGridLine("LINE003", 300000);

            const lines = await gridValidator.getAllLines();
            expect(lines.length).to.equal(3);
            expect(lines).to.include("LINE001");
            expect(lines).to.include("LINE002");
            expect(lines).to.include("LINE003");
        });
    });
});



