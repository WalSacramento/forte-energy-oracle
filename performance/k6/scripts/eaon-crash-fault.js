import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { createTaxonomyMetrics, recordRequestMetrics } from '../lib/metrics.js';
import { generateTaxonomyTable } from '../lib/taxonomy-reporter.js';

// Test configuration - Crash Fault (f=1) with 30 iterations
export const options = {
  scenarios: {
    crash_fault: {
      executor: 'per-vu-iterations',
      vus: 1,  // Run sequentially
      iterations: 30,  // 30 iterations of crash fault scenario
      maxDuration: '30m',
      gracefulStop: '30s'
    }
  },
  thresholds: {
    'checks': ['rate>0.9'],  // 90% of checks should pass
    'http_req_failed': ['rate<0.2'],  // Allow some failures during fault conditions
    'app_error_rate': ['rate<0.05'],
    'app_availability': ['rate>0.90']  // Lower threshold for fault scenarios
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const HEMS_URL = __ENV.HEMS_URL || 'http://localhost:3000';

const metrics = createTaxonomyMetrics();
const expectedValue = 5000;

// Helper function to execute oracle request cycle
function executeRequestCycle(meterId) {
  const payload = JSON.stringify({
    meterId
  });

  const params = {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: '60s'
  };

  return http.post(`${BASE_URL}/oracle/request-cycle`, payload, params);
}

// Main test function - Crash Fault scenario
export default function () {
  // Ensure clean state at start of each iteration
  http.post(`${HEMS_URL}/admin/recover/oracle-3`);
  sleep(1);

  const meterId = `METER00${Math.floor(Math.random() * 3) + 1}`;

  // 1. Fail Oracle 3
  const failResponse = http.post(`${HEMS_URL}/admin/fail/oracle-3`);
  check(failResponse, {
    'Oracle 3 failed successfully': (r) => r.status === 200 || r.status === 404
  });

  sleep(2);  // Wait for oracle to stop

  // 2. Execute request cycle with 2 oracles
  const response = executeRequestCycle(meterId);

  // 3. Verify system recovered despite crash
  const checks = check(response, {
    'S2: System completed with 2 oracles': (r) => r.status === 200,
    'S2: Aggregation successful': (r) => {
      if (r.status !== 200) return false;
      const body = JSON.parse(r.body);
      return body.aggregatedValue !== undefined;
    },
    'S2: Received 2 oracle responses': (r) => {
      if (r.status !== 200) return false;
      const body = JSON.parse(r.body);
      return body.oracleResponses >= 2;
    }
  });

  // Record metrics
  recordRequestMetrics(response, metrics, meterId, expectedValue);

  // Log progress every 10 iterations
  if (__ITER % 10 === 0) {
    if (response.status === 200) {
      const result = JSON.parse(response.body);
      console.log(`[Iteration ${__ITER}] ✓ Success: Aggregated value = ${result.aggregatedValue}, ` +
                  `Oracles = ${result.oracleResponses}`);
    } else {
      console.log(`[Iteration ${__ITER}] ✗ Failed: Status ${response.status}`);
    }
  }

  // 4. Restore Oracle 3
  const recoverResponse = http.post(`${HEMS_URL}/admin/recover/oracle-3`);
  check(recoverResponse, {
    'Oracle 3 recovered': (r) => r.status === 200 || r.status === 404
  });

  sleep(2);  // Wait before next iteration
}

export function setup() {
  console.log('='.repeat(70));
  console.log('  EAON k6 Crash Fault Test (f=1)');
  console.log('  Target: 30 iterations with Oracle 3 failing');
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
  
  // Ensure Oracle 3 starts in healthy state
  http.post(`${HEMS_URL}/admin/recover/oracle-3`);
  sleep(2);

  console.log('Starting test...\n');
  return {};
}

export function teardown(data) {
  console.log('\n' + '='.repeat(70));
  console.log('  Crash Fault Test Completed');
  console.log('='.repeat(70));

  // Ensure Oracle 3 is restored to normal state
  http.post(`${HEMS_URL}/admin/recover/oracle-3`);
  sleep(2);

  console.log('✓ Oracle 3 restored to normal state');
}

export function handleSummary(data) {
  console.log('\n' + generateTaxonomyTable(data));

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'results/local/k6/crash-fault-results.json': JSON.stringify(data, null, 2),
    'results/local/k6/crash-fault-table.txt': generateTaxonomyTable(data),
    'results/local/k6/crash-fault-report.html': htmlReport(data)
  };
}

