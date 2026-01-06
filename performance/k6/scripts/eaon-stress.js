import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { createTaxonomyMetrics, recordRequestMetrics } from '../lib/metrics.js';
import { generateTaxonomyTable } from '../lib/taxonomy-reporter.js';

// Stress test configuration - 30 iterations with higher load
export const options = {
  scenarios: {
    stress: {
      executor: 'shared-iterations',
      vus: 10,  // 10 VUs for stress testing
      iterations: 30,  // Total de 30 iterações distribuídas entre 10 VUs
      maxDuration: '30m',  // Timeout máximo de segurança
      gracefulStop: '30s'
    }
  },
  thresholds: {
    'http_req_duration': ['p(95)<10000'],  // More relaxed threshold for stress test
    'app_error_rate': ['rate<0.05'],        // Allow up to 5% error under stress
    'app_availability': ['rate>0.95'],      // 95% availability under stress
    'http_req_failed': ['rate<0.10']        // Max 10% failed requests
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const HEMS_URL = __ENV.HEMS_URL || 'http://localhost:3000';

const metrics = createTaxonomyMetrics();

export default function () {
  const meterId = `METER00${Math.floor(Math.random() * 3) + 1}`;
  const expectedValue = 5000;

  const payload = JSON.stringify({
    meterId,
    expectedValue
  });

  const params = {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: '90s'  // Longer timeout for stress conditions
  };

  const response = http.post(`${BASE_URL}/oracle/request-cycle`, payload, params);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 10s': (r) => r.timings.duration < 10000
  });

  recordRequestMetrics(response, metrics, meterId, expectedValue);

  // Log progress every 10 iterations (30 iterations total)
  if (__ITER % 10 === 0) {
    console.log(`[VU:${__VU}] Iteration ${__ITER}: ` +
                `Status ${response.status}, Duration: ${response.timings.duration.toFixed(2)}ms`);
  }

  sleep(Math.random() * 2 + 1);
}

export function setup() {
  console.log('='.repeat(70));
  console.log('  EAON k6 Stress Test');
  console.log('  Target: 30 iterations with 10 VUs');
  console.log('  Base URL:', BASE_URL);
  console.log('  HEMS URL:', HEMS_URL);
  console.log('='.repeat(70));

  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('Test Orchestrator is not healthy');
  }

  console.log('✓ Test Orchestrator is healthy\n');
  return {};
}

export function teardown(data) {
  console.log('\n' + '='.repeat(70));
  console.log('  Stress test completed successfully');
  console.log('='.repeat(70));
}

export function handleSummary(data) {
  console.log('\n' + generateTaxonomyTable(data));

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'results/local/k6/stress-results.json': JSON.stringify(data, null, 2),
    'results/local/k6/stress-table.txt': generateTaxonomyTable(data),
    'results/local/k6/stress-report.html': htmlReport(data)
  };
}
