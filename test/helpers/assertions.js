/**
 * Custom Assertions
 * Domain-specific assertions for EAON tests
 */

const { expect } = require("chai");
const { ORACLE_CONFIG } = require("./fixtures");

/**
 * Assert that a value is within expected deviation from base
 */
function assertWithinDeviation(actual, expected, deviationPercent, message = "") {
    const maxDeviation = expected * (deviationPercent / 100);
    const diff = Math.abs(actual - expected);
    expect(diff).to.be.lte(
        maxDeviation,
        `${message} Expected ${actual} to be within ${deviationPercent}% of ${expected}`
    );
}

/**
 * Assert that aggregated value is correct (median of valid responses)
 */
function assertCorrectAggregation(aggregatedValue, responses, threshold = ORACLE_CONFIG.OUTLIER_THRESHOLD) {
    // Calculate median
    const sorted = [...responses].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
        ? Math.floor((sorted[mid - 1] + sorted[mid]) / 2)
        : sorted[mid];

    // Filter out outliers
    const validResponses = responses.filter(v => {
        const deviation = Math.abs(v - median) / median * 100;
        return deviation <= threshold;
    });

    // Calculate expected value (mean of valid responses)
    const expectedValue = Math.floor(
        validResponses.reduce((a, b) => a + b, 0) / validResponses.length
    );

    // Allow small rounding difference
    assertWithinDeviation(Number(aggregatedValue), expectedValue, 1, "Aggregated value");
}

/**
 * Assert that reputation was correctly updated
 */
function assertReputationUpdate(oldRep, newRep, wasOutlier) {
    const expectedDelta = wasOutlier ? -ORACLE_CONFIG.PENALTY_AMOUNT : ORACLE_CONFIG.REWARD_AMOUNT;
    let expectedNew = Number(oldRep) + expectedDelta;

    // Clamp to bounds
    expectedNew = Math.max(ORACLE_CONFIG.MIN_REPUTATION, Math.min(ORACLE_CONFIG.MAX_REPUTATION, expectedNew));

    expect(Number(newRep)).to.equal(expectedNew, "Reputation update incorrect");
}

/**
 * Assert that latency is within acceptable range
 */
function assertLatency(latencyMs, maxMs = 5000) {
    expect(latencyMs).to.be.lte(maxMs, `Latency ${latencyMs}ms exceeds maximum ${maxMs}ms`);
}

/**
 * Assert that gas usage is within expected range
 */
function assertGasUsage(gasUsed, maxGas = 500000) {
    expect(Number(gasUsed)).to.be.lte(maxGas, `Gas usage ${gasUsed} exceeds maximum ${maxGas}`);
}

/**
 * Assert that outlier was correctly detected
 */
function assertOutlierDetected(events, expectedOracle, expectedValue) {
    const outlierEvents = events.filter(e => e.fragment?.name === "OutlierDetected");
    expect(outlierEvents.length).to.be.gte(1, "Expected OutlierDetected event");

    const found = outlierEvents.some(e => {
        return e.args[1].toLowerCase() === expectedOracle.toLowerCase() &&
            Number(e.args[2]) === expectedValue;
    });
    expect(found).to.be.true, `Expected outlier event for oracle ${expectedOracle} with value ${expectedValue}`;
}

/**
 * Assert that request was completed successfully
 */
function assertRequestCompleted(request) {
    // Status 2 = Completed
    expect(Number(request.status)).to.equal(2, "Request should be completed");
    expect(Number(request.aggregatedValue)).to.be.gt(0, "Aggregated value should be set");
}

/**
 * Assert that oracle was penalized
 */
function assertOraclePenalized(oracleBefore, oracleAfter) {
    const repBefore = Number(oracleBefore.reputation);
    const repAfter = Number(oracleAfter.reputation);
    expect(repAfter).to.be.lt(repBefore, "Oracle reputation should decrease after penalty");
    expect(repBefore - repAfter).to.equal(
        ORACLE_CONFIG.PENALTY_AMOUNT,
        `Penalty should be ${ORACLE_CONFIG.PENALTY_AMOUNT}`
    );
}

/**
 * Assert that oracle was rewarded
 */
function assertOracleRewarded(oracleBefore, oracleAfter) {
    const repBefore = Number(oracleBefore.reputation);
    const repAfter = Number(oracleAfter.reputation);

    if (repBefore < ORACLE_CONFIG.MAX_REPUTATION) {
        expect(repAfter).to.be.gt(repBefore, "Oracle reputation should increase after reward");
        expect(repAfter - repBefore).to.equal(
            ORACLE_CONFIG.REWARD_AMOUNT,
            `Reward should be ${ORACLE_CONFIG.REWARD_AMOUNT}`
        );
    } else {
        expect(repAfter).to.equal(ORACLE_CONFIG.MAX_REPUTATION, "Reputation should not exceed max");
    }
}

/**
 * Assert success rate meets threshold
 */
function assertSuccessRate(successes, total, minRate = 0.99) {
    const rate = successes / total;
    expect(rate).to.be.gte(minRate, `Success rate ${(rate * 100).toFixed(2)}% is below ${(minRate * 100).toFixed(2)}%`);
}

/**
 * Assert throughput meets minimum
 */
function assertThroughput(requestCount, durationMs, minPerMinute = 10) {
    const perMinute = (requestCount / durationMs) * 60000;
    expect(perMinute).to.be.gte(minPerMinute, `Throughput ${perMinute.toFixed(2)} req/min is below ${minPerMinute} req/min`);
}

module.exports = {
    assertWithinDeviation,
    assertCorrectAggregation,
    assertReputationUpdate,
    assertLatency,
    assertGasUsage,
    assertOutlierDetected,
    assertRequestCompleted,
    assertOraclePenalized,
    assertOracleRewarded,
    assertSuccessRate,
    assertThroughput
};



