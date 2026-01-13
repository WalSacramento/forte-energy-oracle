/**
 * k6 Thresholds Configuration
 * Defines pass/fail criteria for performance tests
 */

export const thresholds = {
    // Latency thresholds (milliseconds)
    latency: {
        baseline: {
            p50: 1000,   // 1 second
            p90: 3000,   // 3 seconds
            p95: 5000,   // 5 seconds (target)
            p99: 8000,   // 8 seconds
        },
        stress: {
            p50: 2000,
            p90: 5000,
            p95: 10000,
            p99: 15000,
        },
        spike: {
            p50: 3000,
            p90: 8000,
            p95: 15000,
            p99: 20000,
        },
    },

    // Success rate thresholds
    successRate: {
        baseline: 0.99,  // 99%
        stress: 0.95,    // 95%
        spike: 0.90,     // 90%
        faultInjection: 0.90,
    },

    // Throughput thresholds (requests per second)
    throughput: {
        minimum: 10,     // 10 req/s
        target: 20,      // 20 req/s
        optimal: 50,     // 50 req/s
    },

    // Error thresholds
    errorRate: {
        acceptable: 0.01,  // 1%
        concerning: 0.05,  // 5%
        critical: 0.10,    // 10%
    },

    // Gas thresholds (for blockchain tests)
    gas: {
        requestData: 50000,
        submitResponse: 100000,
        fullCycle: 500000,
    },
};

/**
 * Evaluate test results against thresholds
 */
export function evaluateResults(results, testType = 'baseline') {
    const passed = [];
    const failed = [];

    const latencyThreshold = thresholds.latency[testType] || thresholds.latency.baseline;
    const successThreshold = thresholds.successRate[testType] || thresholds.successRate.baseline;

    // Evaluate latency
    if (results.p95_latency !== undefined) {
        if (results.p95_latency <= latencyThreshold.p95) {
            passed.push(`Latency P95: ${results.p95_latency}ms <= ${latencyThreshold.p95}ms`);
        } else {
            failed.push(`Latency P95: ${results.p95_latency}ms > ${latencyThreshold.p95}ms`);
        }
    }

    // Evaluate success rate
    if (results.success_rate !== undefined) {
        if (results.success_rate >= successThreshold) {
            passed.push(`Success Rate: ${(results.success_rate * 100).toFixed(2)}% >= ${(successThreshold * 100).toFixed(2)}%`);
        } else {
            failed.push(`Success Rate: ${(results.success_rate * 100).toFixed(2)}% < ${(successThreshold * 100).toFixed(2)}%`);
        }
    }

    // Evaluate error rate
    if (results.error_rate !== undefined) {
        if (results.error_rate <= thresholds.errorRate.acceptable) {
            passed.push(`Error Rate: ${(results.error_rate * 100).toFixed(2)}% <= ${(thresholds.errorRate.acceptable * 100).toFixed(2)}%`);
        } else if (results.error_rate <= thresholds.errorRate.concerning) {
            passed.push(`Error Rate: ${(results.error_rate * 100).toFixed(2)}% (warning)`);
        } else {
            failed.push(`Error Rate: ${(results.error_rate * 100).toFixed(2)}% > ${(thresholds.errorRate.concerning * 100).toFixed(2)}%`);
        }
    }

    return {
        passed,
        failed,
        overall: failed.length === 0 ? 'PASS' : 'FAIL',
        summary: {
            passedCount: passed.length,
            failedCount: failed.length,
            testType,
        },
    };
}

/**
 * Generate threshold configuration for k6
 */
export function generateK6Thresholds(testType = 'baseline') {
    const latency = thresholds.latency[testType] || thresholds.latency.baseline;
    const success = thresholds.successRate[testType] || thresholds.successRate.baseline;
    const error = testType === 'baseline' ? thresholds.errorRate.acceptable : thresholds.errorRate.concerning;

    return {
        'request_latency': [`p(95)<${latency.p95}`],
        'success_rate': [`rate>${success}`],
        'http_req_failed': [`rate<${error}`],
    };
}



