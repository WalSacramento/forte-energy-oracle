/**
 * Metrics Collector Service
 * Collects performance metrics for the oracle node
 */

class MetricsCollector {
    constructor(nodeId) {
        this.nodeId = nodeId;
        this.startTime = Date.now();

        // Counters
        this.successCount = 0;
        this.failureCount = 0;

        // Latency arrays
        this.latencies = [];
        this.fetchLatencies = [];
        this.submitLatencies = [];

        // Gas usage
        this.gasUsages = [];
    }

    /**
     * Record a successful request
     */
    recordSuccess() {
        this.successCount++;
    }

    /**
     * Record a failed request
     */
    recordFailure() {
        this.failureCount++;
    }

    /**
     * Record total latency
     * @param {number} ms - Latency in milliseconds
     */
    recordLatency(ms) {
        this.latencies.push(ms);
    }

    /**
     * Record fetch latency
     * @param {number} ms - Latency in milliseconds
     */
    recordFetchLatency(ms) {
        this.fetchLatencies.push(ms);
    }

    /**
     * Record submit latency
     * @param {number} ms - Latency in milliseconds
     */
    recordSubmitLatency(ms) {
        this.submitLatencies.push(ms);
    }

    /**
     * Record gas usage
     * @param {BigInt} gas - Gas used
     */
    recordGas(gas) {
        this.gasUsages.push(Number(gas));
    }

    /**
     * Calculate statistics for an array
     * @param {number[]} arr - Array of values
     * @returns {object} Statistics
     */
    _calculateStats(arr) {
        if (arr.length === 0) {
            return { min: 0, max: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0, count: 0 };
        }

        const sorted = [...arr].sort((a, b) => a - b);
        const sum = arr.reduce((a, b) => a + b, 0);

        const percentile = (p) => {
            const index = Math.ceil(sorted.length * p / 100) - 1;
            return sorted[Math.max(0, index)];
        };

        return {
            min: sorted[0],
            max: sorted[sorted.length - 1],
            avg: Math.round(sum / arr.length),
            p50: percentile(50),
            p90: percentile(90),
            p95: percentile(95),
            p99: percentile(99),
            count: arr.length
        };
    }

    /**
     * Get current statistics
     * @returns {object} Current metrics
     */
    getStats() {
        const uptime = Math.floor((Date.now() - this.startTime) / 1000);
        const totalRequests = this.successCount + this.failureCount;
        const successRate = totalRequests > 0 ? this.successCount / totalRequests : 0;

        return {
            uptime: uptime,
            requests: {
                total: totalRequests,
                successful: this.successCount,
                failed: this.failureCount,
                successRate: successRate
            },
            latency: {
                total: this._calculateStats(this.latencies),
                fetch: this._calculateStats(this.fetchLatencies),
                submit: this._calculateStats(this.submitLatencies)
            },
            gas: this._calculateStats(this.gasUsages)
        };
    }

    /**
     * Reset all metrics
     */
    reset() {
        this.startTime = Date.now();
        this.successCount = 0;
        this.failureCount = 0;
        this.latencies = [];
        this.fetchLatencies = [];
        this.submitLatencies = [];
        this.gasUsages = [];
    }

    /**
     * Export metrics to JSON
     * @returns {string} JSON string
     */
    toJSON() {
        return JSON.stringify({
            nodeId: this.nodeId,
            timestamp: new Date().toISOString(),
            ...this.getStats()
        }, null, 2);
    }
}

module.exports = MetricsCollector;


