/**
 * Metrics Collection Script
 * Collects metrics from blockchain events and oracle node logs
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// OracleAggregator event signatures
const EVENTS = {
    DataRequested: "event DataRequested(uint256 indexed requestId, string meterId, uint256 deadline)",
    ResponseSubmitted: "event ResponseSubmitted(uint256 indexed requestId, address indexed oracle, uint256 value)",
    DataAggregated: "event DataAggregated(uint256 indexed requestId, uint256 aggregatedValue, uint256 responseCount)",
    OutlierDetected: "event OutlierDetected(uint256 indexed requestId, address indexed oracle, uint256 value)",
    ReputationUpdated: "event ReputationUpdated(address indexed oracle, uint256 newReputation)"
};

class MetricsCollector {
    constructor(rpcUrl, contractAddress) {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.contractAddress = contractAddress;
        this.contract = new ethers.Contract(
            contractAddress,
            Object.values(EVENTS),
            this.provider
        );
        this.metrics = {
            requests: [],
            responses: [],
            aggregations: [],
            outliers: [],
            reputations: {}
        };
    }

    /**
     * Collect events from blockchain logs
     */
    async collectFromLogs(fromBlock = 0, toBlock = "latest") {
        console.log(`Collecting events from block ${fromBlock} to ${toBlock}...`);

        // Collect DataRequested events
        const requestEvents = await this.contract.queryFilter(
            this.contract.filters.DataRequested(),
            fromBlock,
            toBlock
        );

        for (const event of requestEvents) {
            const block = await event.getBlock();
            this.metrics.requests.push({
                requestId: event.args[0].toString(),
                meterId: event.args[1],
                deadline: event.args[2].toString(),
                timestamp: block.timestamp,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash
            });
        }
        console.log(`Found ${requestEvents.length} DataRequested events`);

        // Collect ResponseSubmitted events
        const responseEvents = await this.contract.queryFilter(
            this.contract.filters.ResponseSubmitted(),
            fromBlock,
            toBlock
        );

        for (const event of responseEvents) {
            const block = await event.getBlock();
            this.metrics.responses.push({
                requestId: event.args[0].toString(),
                oracle: event.args[1],
                value: event.args[2].toString(),
                timestamp: block.timestamp,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash
            });
        }
        console.log(`Found ${responseEvents.length} ResponseSubmitted events`);

        // Collect DataAggregated events
        const aggregatedEvents = await this.contract.queryFilter(
            this.contract.filters.DataAggregated(),
            fromBlock,
            toBlock
        );

        for (const event of aggregatedEvents) {
            const block = await event.getBlock();
            this.metrics.aggregations.push({
                requestId: event.args[0].toString(),
                aggregatedValue: event.args[1].toString(),
                responseCount: event.args[2].toString(),
                timestamp: block.timestamp,
                blockNumber: event.blockNumber,
                txHash: event.transactionHash
            });
        }
        console.log(`Found ${aggregatedEvents.length} DataAggregated events`);

        // Collect OutlierDetected events
        const outlierEvents = await this.contract.queryFilter(
            this.contract.filters.OutlierDetected(),
            fromBlock,
            toBlock
        );

        for (const event of outlierEvents) {
            this.metrics.outliers.push({
                requestId: event.args[0].toString(),
                oracle: event.args[1],
                value: event.args[2].toString(),
                blockNumber: event.blockNumber,
                txHash: event.transactionHash
            });
        }
        console.log(`Found ${outlierEvents.length} OutlierDetected events`);

        return this.metrics;
    }

    /**
     * Calculate latency statistics
     */
    calculateLatencies() {
        const latencies = [];

        for (const aggregation of this.metrics.aggregations) {
            const request = this.metrics.requests.find(
                r => r.requestId === aggregation.requestId
            );
            if (request) {
                const latency = aggregation.timestamp - request.timestamp;
                latencies.push({
                    requestId: aggregation.requestId,
                    latencySeconds: latency,
                    latencyMs: latency * 1000
                });
            }
        }

        if (latencies.length === 0) {
            return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0 };
        }

        const sorted = [...latencies].sort((a, b) => a.latencyMs - b.latencyMs);
        const values = sorted.map(l => l.latencyMs);

        const percentile = (arr, p) => {
            const index = Math.ceil(arr.length * p / 100) - 1;
            return arr[Math.max(0, index)];
        };

        return {
            count: values.length,
            min: values[0],
            max: values[values.length - 1],
            avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
            p50: percentile(values, 50),
            p90: percentile(values, 90),
            p95: percentile(values, 95),
            p99: percentile(values, 99)
        };
    }

    /**
     * Calculate success rates
     */
    calculateSuccessRates() {
        const totalRequests = this.metrics.requests.length;
        const completedRequests = this.metrics.aggregations.length;
        const outlierCount = this.metrics.outliers.length;

        return {
            totalRequests,
            completedRequests,
            successRate: totalRequests > 0 ? completedRequests / totalRequests : 0,
            outlierCount,
            outlierDetectionRate: totalRequests > 0 ? outlierCount / totalRequests : 0
        };
    }

    /**
     * Calculate oracle statistics
     */
    calculateOracleStats() {
        const oracleStats = {};

        for (const response of this.metrics.responses) {
            if (!oracleStats[response.oracle]) {
                oracleStats[response.oracle] = {
                    totalResponses: 0,
                    outlierResponses: 0,
                    values: []
                };
            }
            oracleStats[response.oracle].totalResponses++;
            oracleStats[response.oracle].values.push(parseInt(response.value));
        }

        for (const outlier of this.metrics.outliers) {
            if (oracleStats[outlier.oracle]) {
                oracleStats[outlier.oracle].outlierResponses++;
            }
        }

        // Calculate validity rate for each oracle
        for (const oracle of Object.keys(oracleStats)) {
            const stats = oracleStats[oracle];
            stats.validResponses = stats.totalResponses - stats.outlierResponses;
            stats.validityRate = stats.totalResponses > 0 
                ? stats.validResponses / stats.totalResponses 
                : 0;
        }

        return oracleStats;
    }

    /**
     * Generate comprehensive statistics
     */
    generateStats() {
        return {
            timestamp: new Date().toISOString(),
            contractAddress: this.contractAddress,
            latency: this.calculateLatencies(),
            successRates: this.calculateSuccessRates(),
            oracleStats: this.calculateOracleStats(),
            rawMetrics: {
                requestCount: this.metrics.requests.length,
                responseCount: this.metrics.responses.length,
                aggregationCount: this.metrics.aggregations.length,
                outlierCount: this.metrics.outliers.length
            }
        };
    }

    /**
     * Export metrics to JSON file
     */
    exportToJson(outputPath) {
        const stats = this.generateStats();
        fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2));
        console.log(`Metrics exported to ${outputPath}`);
        return stats;
    }

    /**
     * Print summary to console
     */
    printSummary() {
        const stats = this.generateStats();

        console.log("\n═══════════════════════════════════════════");
        console.log("           METRICS SUMMARY                 ");
        console.log("═══════════════════════════════════════════");

        console.log("\nLatency (ms):");
        console.log(`  Requests: ${stats.latency.count}`);
        console.log(`  Min:      ${stats.latency.min}`);
        console.log(`  Max:      ${stats.latency.max}`);
        console.log(`  Avg:      ${stats.latency.avg}`);
        console.log(`  P50:      ${stats.latency.p50}`);
        console.log(`  P95:      ${stats.latency.p95}`);
        console.log(`  P99:      ${stats.latency.p99}`);

        console.log("\nSuccess Rates:");
        console.log(`  Total Requests:    ${stats.successRates.totalRequests}`);
        console.log(`  Completed:         ${stats.successRates.completedRequests}`);
        console.log(`  Success Rate:      ${(stats.successRates.successRate * 100).toFixed(2)}%`);
        console.log(`  Outliers Detected: ${stats.successRates.outlierCount}`);

        console.log("\nOracle Statistics:");
        for (const [oracle, oStats] of Object.entries(stats.oracleStats)) {
            console.log(`  ${oracle.slice(0, 10)}...:`);
            console.log(`    Responses: ${oStats.totalResponses}, Valid: ${oStats.validResponses}, Outliers: ${oStats.outlierResponses}`);
            console.log(`    Validity Rate: ${(oStats.validityRate * 100).toFixed(2)}%`);
        }

        console.log("═══════════════════════════════════════════\n");

        return stats;
    }
}

// CLI execution
async function main() {
    const rpcUrl = process.env.RPC_URL || "http://localhost:8545";
    let contractAddress = process.env.CONTRACT_ADDRESS;

    // Try to load from deployment file
    if (!contractAddress) {
        try {
            const deploymentPath = path.join(__dirname, "..", "deployments", "localhost.json");
            if (fs.existsSync(deploymentPath)) {
                const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
                contractAddress = deployment.contracts.OracleAggregator;
            }
        } catch (error) {
            console.error("Could not load contract address:", error.message);
            process.exit(1);
        }
    }

    if (!contractAddress) {
        console.error("Contract address not found. Set CONTRACT_ADDRESS env or run deploy first.");
        process.exit(1);
    }

    console.log(`Collecting metrics from ${rpcUrl}`);
    console.log(`Contract: ${contractAddress}\n`);

    const collector = new MetricsCollector(rpcUrl, contractAddress);
    await collector.collectFromLogs();
    collector.printSummary();

    // Export to file
    const outputPath = path.join(__dirname, "..", "performance", "results", `metrics-${Date.now()}.json`);
    collector.exportToJson(outputPath);
}

if (require.main === module) {
    main().catch(console.error);
}

module.exports = MetricsCollector;



