import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { createTaxonomyMetrics, recordRequestMetrics } from '../lib/metrics.js';
import { generateTaxonomyTable } from '../lib/taxonomy-reporter.js';

// Test configuration
export const options = {
  scenarios: {
    baseline: {
      executor: 'shared-iterations',
      vus: 10,
      iterations: 100,  // Total de 100 iterações distribuídas entre 10 VUs
      maxDuration: '30m',  // Timeout máximo de segurança
      gracefulStop: '30s'
    }
  },
  thresholds: {
    'http_req_duration': ['p(95)<12000'], // 95% das requisições devem completar em < 12s (realista para blockchain)
    'app_error_rate': ['rate<0.05'],      // Taxa de erro < 5% (permite algumas colisões de nonce)
    'app_availability': ['rate>0.95'],    // Disponibilidade > 95% (realista com 3 oracles)
    'net_response_time': ['p(95)<11000'], // Response time p95 < 11s (inclui agregação)
    'net_consensus_time': ['p(95)<5000'], // Consensus time p95 < 5s (3 oracles + queue)
    'comp_gas_used': ['avg<700000']       // Gas usage avg < 700k
  }
};

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const HEMS_URL = __ENV.HEMS_URL || 'http://localhost:3000';

// Create custom metrics
const metrics = createTaxonomyMetrics();

// Main test function
export default function () {
  // Seleciona um meterId aleatório
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
    timeout: '60s'
  };

  // Executar request cycle
  const response = http.post(`${BASE_URL}/oracle/request-cycle`, payload, params);

  // Validações básicas
  const checks = check(response, {
    'status is 200': (r) => r.status === 200,
    'has requestId': (r) => {
      if (r.status !== 200) return false;
      const body = JSON.parse(r.body);
      return body.requestId !== undefined;
    },
    'has aggregatedValue': (r) => {
      if (r.status !== 200) return false;
      const body = JSON.parse(r.body);
      return body.aggregatedValue !== undefined;
    },
    'response time < 5s': (r) => r.timings.duration < 5000,
    'oracle responses >= 2': (r) => {
      if (r.status !== 200) return false;
      const body = JSON.parse(r.body);
      return body.oracleResponses >= 2;
    }
  });

  // Registrar métricas customizadas
  recordRequestMetrics(response, metrics, meterId, expectedValue);

  // Log de progresso a cada 10 iterações (100 iterações totais)
  if (__ITER % 10 === 0) {
    console.log(`[VU:${__VU}] Iteration ${__ITER}: Status ${response.status}, ` +
                `Duration: ${response.timings.duration.toFixed(2)}ms`);
  }

  // Delay entre requests (1-3 segundos)
  sleep(Math.random() * 2 + 1);
}

// Setup function (runs once before test)
export function setup() {
  console.log('='.repeat(70));
  console.log('  EAON k6 Baseline Performance Test');
  console.log('  Target: 100 iterations with 10 VUs (Normal Operation)');
  console.log('  Base URL:', BASE_URL);
  console.log('  HEMS URL:', HEMS_URL);
  console.log('='.repeat(70));

  // Health check do Test Orchestrator
  const healthCheck = http.get(`${BASE_URL}/health`);
  if (healthCheck.status !== 200) {
    throw new Error('Test Orchestrator is not healthy');
  }

  console.log('✓ Test Orchestrator is healthy');

  // Health check do HEMS API
  const hemsHealth = http.get(`${HEMS_URL}/health`);
  if (hemsHealth.status !== 200) {
    console.warn('⚠ HEMS API health check failed, but continuing...');
  } else {
    console.log('✓ HEMS API is healthy');
  }

  console.log('Starting test...\n');
  return {};
}

// Teardown function (runs once after test)
export function teardown(data) {
  console.log('\n' + '='.repeat(70));
  console.log('  Test completed successfully');
  console.log('='.repeat(70));
}

// Handle summary (custom report generation)
export function handleSummary(data) {
  console.log('\n' + generateTaxonomyTable(data));

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'results/local/k6/baseline-results.json': JSON.stringify(data, null, 2),
    'results/local/k6/baseline-table.txt': generateTaxonomyTable(data),
    'results/local/k6/baseline-report.html': htmlReport(data)
  };
}
