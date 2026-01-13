/**
 * Test Fixtures
 * Common test data and configurations
 */

const { ethers } = require("hardhat");

// Default meter readings (in Wh)
const METER_READINGS = {
    METER001: 5000,
    METER002: 3500,
    METER003: 7200
};

// Oracle configurations
const ORACLE_CONFIG = {
    INITIAL_REPUTATION: 70,
    MAX_REPUTATION: 100,
    MIN_REPUTATION: 0,
    REWARD_AMOUNT: 1,
    PENALTY_AMOUNT: 5,
    OUTLIER_THRESHOLD: 10, // 10%
    REQUEST_DEADLINE: 30,  // 30 seconds
    MIN_RESPONSES: 2
};

// Test accounts (Hardhat default)
const TEST_ACCOUNTS = {
    ORACLE_1: {
        privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
        address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    },
    ORACLE_2: {
        privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
        address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
    },
    ORACLE_3: {
        privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
        address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
    }
};

/**
 * Deploy all contracts for testing
 */
async function deployContracts() {
    const [owner, oracle1, oracle2, oracle3, user] = await ethers.getSigners();

    // Deploy OracleAggregator
    const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
    const oracleAggregator = await OracleAggregator.deploy(
        ORACLE_CONFIG.MIN_RESPONSES,
        ORACLE_CONFIG.OUTLIER_THRESHOLD,
        ORACLE_CONFIG.REQUEST_DEADLINE
    );
    await oracleAggregator.waitForDeployment();

    // Deploy GridValidator
    const GridValidator = await ethers.getContractFactory("GridValidator");
    const gridValidator = await GridValidator.deploy();
    await gridValidator.waitForDeployment();

    // Deploy EnergyTrading
    const EnergyTrading = await ethers.getContractFactory("EnergyTrading");
    const energyTrading = await EnergyTrading.deploy(
        await oracleAggregator.getAddress(),
        await gridValidator.getAddress()
    );
    await energyTrading.waitForDeployment();

    return {
        oracleAggregator,
        gridValidator,
        energyTrading,
        owner,
        oracle1,
        oracle2,
        oracle3,
        user
    };
}

/**
 * Register oracles in the contract
 */
async function registerOracles(oracleAggregator, oracles) {
    for (const oracle of oracles) {
        await oracleAggregator.registerOracle(oracle.address);
    }
}

/**
 * Generate a signed response for oracle submission
 */
async function signResponse(signer, requestId, value) {
    const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "uint256"],
        [requestId, value]
    );
    const signature = await signer.signMessage(ethers.getBytes(messageHash));
    return signature;
}

/**
 * Generate meter reading with realistic variation
 */
function generateReading(baseValue, variationPercent = 2) {
    const variation = baseValue * (variationPercent / 100);
    const delta = (Math.random() * 2 - 1) * variation;
    return Math.round(baseValue + delta);
}

/**
 * Generate malicious reading (10x value)
 */
function generateMaliciousReading(baseValue) {
    return baseValue * 10;
}

/**
 * Generate subtle manipulation reading (+15%)
 */
function generateSubtleManipulationReading(baseValue) {
    return Math.round(baseValue * 1.15);
}

/**
 * Calculate expected median from values
 */
function calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2 === 0) {
        return Math.floor((sorted[mid - 1] + sorted[mid]) / 2);
    }
    return sorted[mid];
}

/**
 * Check if value is an outlier relative to median
 */
function isOutlier(value, median, threshold = 10) {
    const deviation = Math.abs(value - median) / median * 100;
    return deviation > threshold;
}

module.exports = {
    METER_READINGS,
    ORACLE_CONFIG,
    TEST_ACCOUNTS,
    deployContracts,
    registerOracles,
    signResponse,
    generateReading,
    generateMaliciousReading,
    generateSubtleManipulationReading,
    calculateMedian,
    isOutlier
};



