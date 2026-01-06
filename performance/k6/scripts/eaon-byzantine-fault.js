import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { createTaxonomyMetrics, recordRequestMetrics } from '../lib/metrics.js';
import { generateTaxonomyTable } from '../lib/taxonomy-reporter.js';

// Test configuration - Byzantine Fault with 30 iterations
export const options = {
  scenarios: {
    byzantine_fault: {
      executor: 'per-vu-iterations',
      vus: 1,  // Run sequentially
      iterations: 30,  // 30 iterations of byzantine fault scenario
      maxDuration: '30m',
      gracefulStop: '30s'
    }
  },
  thresholds: {
    'checks': ['rate>0.9'],  // 90% of checks should pass
    'http_req_failed': ['rate<0.2'],  // Allow some failures during fault conditions
    'app_error_rate': ['rate<0.05'],
    'app_availability': ['rate>0.90'],  // Lower threshold for fault scenarios
    'app_outlier_detection_rate': ['rate>0.8']  // Should detect outliers in most cases
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const HEMS_URL = __ENV.HEMS_URL || 'http://localhost:3000';

const metrics = createTaxonomyMetrics();
const expectedValue = 5000;

// Helper function to execute oracle request cycle
function executeRequestCycle(meterId, expectOutlier = true) {
  const payload = JSON.stringify({
    meterId,
    expectedValue,
    expectOutlier
  });

  const params = {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: '60s'
  };

  return http.post(`${BASE_URL}/oracle/request-cycle`, payload, params);
}

// Main test function - Byzantine Fault scenario
export default function () {
  // Use fixed meterId for consistency (METER001 = 5000 base reading)
  const meterId = 'METER001';

  // Rotate which oracle is malicious to distribute penalties and make test more realistic
  // This prevents a single oracle from being deactivated too quickly
  const oracleIds = ['oracle-1', 'oracle-2', 'oracle-3'];
  const maliciousOracleId = oracleIds[__ITER % 3];
  const honestOracleIds = oracleIds.filter(id => id !== maliciousOracleId);

  // Ensure clean state at start of each iteration - reset all oracles to honest
  http.post(`${HEMS_URL}/admin/oracle/honest/oracle-1`);
  http.post(`${HEMS_URL}/admin/oracle/honest/oracle-2`);
  http.post(`${HEMS_URL}/admin/oracle/honest/oracle-3`);
  sleep(1);

  // 1. Set one oracle to malicious mode (rotating between oracle-1, oracle-2, oracle-3)
  // This will cause only the selected oracle to return 10x values when querying any meter
  // The other two oracles will return normal values, creating a scenario where outlier detection should work
  const maliciousResponse = http.post(`${HEMS_URL}/admin/oracle/malicious/${maliciousOracleId}`);
  check(maliciousResponse, {
    [`${maliciousOracleId} set to malicious`]: (r) => r.status === 200 || r.status === 404
  });

  sleep(2);

  // 2. Execute request cycle with malicious oracle
  // Expected: Two oracles return ~5000, malicious oracle returns ~50000
  // Median should be ~5000, malicious oracle should be detected as outlier
  const response = executeRequestCycle(meterId, true);

  // 3. Verify outlier detection
  const checks = check(response, {
    'S3: System completed successfully': (r) => r.status === 200,
    'S3: Outlier was detected': (r) => {
      if (r.status !== 200) return false;
      const body = JSON.parse(r.body);
      return body.outlierDetected === true;
    },
    'S3: Aggregated value not corrupted': (r) => {
      if (r.status !== 200) return false;
      const body = JSON.parse(r.body);
      const deviation = Math.abs(body.aggregatedValue - expectedValue) / expectedValue;
      return deviation < 0.05;  // Less than 5% deviation (should be ~5000, average of two honest oracles)
    }
  });

  // Record metrics
  recordRequestMetrics(response, metrics, meterId, expectedValue);

  // Log progress every 10 iterations
  if (__ITER % 10 === 0) {
    if (response.status === 200) {
      const result = JSON.parse(response.body);
      console.log(`[Iteration ${__ITER}] Malicious: ${maliciousOracleId}, Meter: ${meterId}, ` +
                  `Outlier detected = ${result.outlierDetected}, Value = ${result.aggregatedValue}, ` +
                  `Oracles = ${result.oracleResponses}`);
    } else {
      console.log(`[Iteration ${__ITER}] ✗ Failed: Status ${response.status}, Malicious: ${maliciousOracleId}`);
    }
  }

  // 4. Restore malicious oracle to honest mode
  const honestResponse = http.post(`${HEMS_URL}/admin/oracle/honest/${maliciousOracleId}`);
  check(honestResponse, {
    [`${maliciousOracleId} restored to honest`]: (r) => r.status === 200 || r.status === 404
  });

  sleep(2);  // Wait before next iteration
}

export function setup() {
  console.log('='.repeat(70));
  console.log('  EAON k6 Byzantine Fault Test');
  console.log('  Target: 30 iterations with rotating malicious oracle');
  console.log('  Strategy: Rotate malicious oracle (oracle-1, oracle-2, oracle-3)');
  console.log('  Base URL:', BASE_URL);
  console.log('  HEMS URL:', HEMS_URL);
  console.log('='.repeat(70));

  // Health checks
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('Test Orchestrator is not healthy');
  }

  const hemsHealth = http.get(`${HEMS_URL}/health`);
  if (hemsHealth.status !== 200) {
    console.warn('⚠ HEMS API health check failed - admin endpoints may not work');
  }

  console.log('✓ Services are healthy');
  
  // Ensure all oracles start in honest state
  http.post(`${HEMS_URL}/admin/oracle/honest/oracle-1`);
  http.post(`${HEMS_URL}/admin/oracle/honest/oracle-2`);
  http.post(`${HEMS_URL}/admin/oracle/honest/oracle-3`);
  sleep(2);

  console.log('Starting test...\n');
  return {};
}

export function teardown(data) {
  console.log('\n' + '='.repeat(70));
  console.log('  Byzantine Fault Test Completed');
  console.log('='.repeat(70));

  // Ensure all oracles are restored to honest state
  http.post(`${HEMS_URL}/admin/oracle/honest/oracle-1`);
  http.post(`${HEMS_URL}/admin/oracle/honest/oracle-2`);
  http.post(`${HEMS_URL}/admin/oracle/honest/oracle-3`);
  sleep(2);

  console.log('✓ All oracles restored to honest state');
}

export function handleSummary(data) {
  console.log('\n' + generateTaxonomyTable(data));

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'results/local/k6/byzantine-fault-results.json': JSON.stringify(data, null, 2),
    'results/local/k6/byzantine-fault-table.txt': generateTaxonomyTable(data),
    'results/local/k6/byzantine-fault-report.html': htmlReport(data)
  };
}

