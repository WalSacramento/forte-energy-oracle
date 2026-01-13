/**
 * Test Setup Helpers
 * Common setup and teardown functions for tests
 */

const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

/**
 * Advance time by specified seconds
 */
async function advanceTime(seconds) {
    await time.increase(seconds);
}

/**
 * Advance to next block
 */
async function advanceBlock() {
    await ethers.provider.send("evm_mine", []);
}

/**
 * Get current block timestamp
 */
async function currentTimestamp() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
}

/**
 * Wait for transaction and return receipt
 */
async function waitForTx(txPromise) {
    const tx = await txPromise;
    return await tx.wait();
}

/**
 * Get gas used from transaction receipt
 */
function getGasUsed(receipt) {
    return receipt.gasUsed;
}

/**
 * Extract events from transaction receipt
 */
function getEvents(receipt, eventName) {
    return receipt.logs.filter(log => {
        try {
            return log.fragment && log.fragment.name === eventName;
        } catch {
            return false;
        }
    });
}

/**
 * Format value for display (from wei to readable)
 */
function formatValue(value, decimals = 0) {
    return Number(value) / Math.pow(10, decimals);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Metrics collector for tests
 */
class MetricsCollector {
    constructor() {
        this.latencies = [];
        this.gasUsages = [];
        this.successes = 0;
        this.failures = 0;
        this.outlierDetections = 0;
        this.reputationChanges = [];
        this.startTime = Date.now();
    }

    recordLatency(ms) {
        this.latencies.push(ms);
    }

    recordGas(gas) {
        this.gasUsages.push(Number(gas));
    }

    recordSuccess() {
        this.successes++;
    }

    recordFailure() {
        this.failures++;
    }

    recordOutlierDetection() {
        this.outlierDetections++;
    }

    recordReputationChange(oracle, oldRep, newRep) {
        this.reputationChanges.push({ oracle, oldRep, newRep, delta: newRep - oldRep });
    }

    getStats() {
        const sortedLatencies = [...this.latencies].sort((a, b) => a - b);
        const sortedGas = [...this.gasUsages].sort((a, b) => a - b);

        const percentile = (arr, p) => {
            if (arr.length === 0) return 0;
            const index = Math.ceil(arr.length * p / 100) - 1;
            return arr[Math.max(0, index)];
        };

        const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

        return {
            latency: {
                min: sortedLatencies[0] || 0,
                max: sortedLatencies[sortedLatencies.length - 1] || 0,
                avg: Math.round(avg(this.latencies)),
                p50: percentile(sortedLatencies, 50),
                p90: percentile(sortedLatencies, 90),
                p95: percentile(sortedLatencies, 95),
                p99: percentile(sortedLatencies, 99)
            },
            gas: {
                min: sortedGas[0] || 0,
                max: sortedGas[sortedGas.length - 1] || 0,
                avg: Math.round(avg(this.gasUsages)),
                total: this.gasUsages.reduce((a, b) => a + b, 0)
            },
            requests: {
                total: this.successes + this.failures,
                successful: this.successes,
                failed: this.failures,
                successRate: this.successes / (this.successes + this.failures) || 0
            },
            outliers: {
                detected: this.outlierDetections
            },
            reputation: this.reputationChanges
        };
    }

    printReport() {
        const stats = this.getStats();
        console.log("\n═══════════════════════════════════════════");
        console.log("              METRICS REPORT                ");
        console.log("═══════════════════════════════════════════");
        console.log("\nLatency (ms):");
        console.log(`  Min: ${stats.latency.min}`);
        console.log(`  Max: ${stats.latency.max}`);
        console.log(`  Avg: ${stats.latency.avg}`);
        console.log(`  P50: ${stats.latency.p50}`);
        console.log(`  P90: ${stats.latency.p90}`);
        console.log(`  P95: ${stats.latency.p95}`);
        console.log(`  P99: ${stats.latency.p99}`);
        console.log("\nGas Usage:");
        console.log(`  Min: ${stats.gas.min}`);
        console.log(`  Max: ${stats.gas.max}`);
        console.log(`  Avg: ${stats.gas.avg}`);
        console.log(`  Total: ${stats.gas.total}`);
        console.log("\nRequests:");
        console.log(`  Total: ${stats.requests.total}`);
        console.log(`  Successful: ${stats.requests.successful}`);
        console.log(`  Failed: ${stats.requests.failed}`);
        console.log(`  Success Rate: ${(stats.requests.successRate * 100).toFixed(2)}%`);
        console.log("\nOutliers Detected:", stats.outliers.detected);
        console.log("═══════════════════════════════════════════\n");
    }

    /**
     * Convert metrics to Agroclimatic taxonomy format
     * @returns {Object} Metrics in Application/Network/Computing format
     */
    toTaxonomyFormat() {
        const stats = this.getStats();
        const duration = (Date.now() - this.startTime) / 1000; // seconds

        const sortedGas = [...this.gasUsages].sort((a, b) => a - b);
        const percentile = (arr, p) => {
            if (arr.length === 0) return 0;
            const index = Math.ceil(arr.length * p / 100) - 1;
            return arr[Math.max(0, index)];
        };

        return {
            applicationLevel: {
                errorRate: (1 - stats.requests.successRate) * 100,
                accuracy: 100, // Assume 100% if no specific tracking
                availability: stats.requests.successRate * 100,
                outlierDetectionRate: this.outlierDetections > 0
                    ? (this.outlierDetections / this.outlierDetections) * 100
                    : 0,
                cost: {
                    gasUnits: stats.gas.total,
                    estimatedUSD: 0 // Calculate if needed
                }
            },
            networkLevel: {
                latency: {
                    avg: stats.latency.avg,
                    p50: stats.latency.p50,
                    p95: stats.latency.p95,
                    p99: stats.latency.p99
                },
                throughput: duration > 0 ? stats.requests.total / duration : 0,
                responseTime: {
                    avg: stats.latency.avg,
                    p95: stats.latency.p95
                },
                consensusTime: {
                    avg: stats.latency.avg // Approximation
                }
            },
            computingLevel: {
                gasConsumption: {
                    avg: stats.gas.avg,
                    total: stats.gas.total,
                    p50: percentile(sortedGas, 50),
                    p95: percentile(sortedGas, 95),
                    p99: percentile(sortedGas, 99)
                },
                scalability: {
                    maxVUs: 1 // Hardhat test doesn't have VUs
                }
            }
        };
    }

    /**
     * Export metrics in taxonomy format to JSON file
     * @param {string} filepath - Output file path
     */
    exportTaxonomyJSON(filepath) {
        const fs = require('fs');
        const path = require('path');

        const data = {
            metadata: {
                timestamp: new Date().toISOString(),
                testType: 'hardhat',
                network: 'local',
                duration: (Date.now() - this.startTime) / 1000
            },
            metrics: this.toTaxonomyFormat(),
            rawData: {
                latencies: this.latencies,
                gasUsages: this.gasUsages,
                successes: this.successes,
                failures: this.failures,
                outlierDetections: this.outlierDetections,
                reputationChanges: this.reputationChanges
            }
        };

        // Create directory if it doesn't exist
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
        console.log(`\n📁 Taxonomy metrics exported to: ${filepath}`);
    }

    toJSON() {
        return JSON.stringify(this.getStats(), null, 2);
    }
}

module.exports = {
    advanceTime,
    advanceBlock,
    currentTimestamp,
    waitForTx,
    getGasUsed,
    getEvents,
    formatValue,
    sleep,
    MetricsCollector
};



