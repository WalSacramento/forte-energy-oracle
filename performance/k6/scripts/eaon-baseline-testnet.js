import http from 'k6/http';
import { check, sleep } from 'k6';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { createTaxonomyMetrics, recordRequestMetrics } from '../lib/metrics.js';
import { generateTaxonomyTable } from '../lib/taxonomy-reporter.js';

// Test configuration for Testnet (Sepolia)
// Optimized to avoid rate limiting with RPC providers
export const options = {
  scenarios: {
    baseline_testnet: {
      executor: 'shared-iterations',
      vus: 2,  // 2 VUs to balance load and avoid rate limiting
      iterations: 100,  // Total de 100 iterações distribuídas entre 2 VUs
      maxDuration: '60m',  // Timeout maior para testnet (mais lenta)
      gracefulStop: '30s'
    }
  },
  thresholds: {
    'http_req_duration': ['p(95)<60000'], // 95% das requisições devem completar em < 60s (testnet é mais lenta)
    'app_error_rate': ['rate<0.10'],      // Taxa de erro < 10% (mais tolerante para testnet)
    'app_availability': ['rate>0.90'],    // Disponibilidade > 90% (mais tolerante para testnet)
    'net_response_time': ['p(95)<55000'], // Response time p95 < 55s (inclui agregação na testnet)
    'net_consensus_time': ['p(95)<50000'], // Consensus time p95 < 50s (testnet é mais lenta)
    'comp_gas_used': ['avg<700000']       // Gas usage avg < 700k
  }
};

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const HEMS_URL = __ENV.HEMS_URL || 'http://localhost:3000';
const NETWORK = __ENV.NETWORK || 'local';

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

  // Timeout maior para testnet (120s)
  const timeout = NETWORK === 'sepolia' ? '120s' : '60s';
  
  const params = {
    headers: {
      'Content-Type': 'application/json'
    },
    timeout: timeout
  };

  // Executar request cycle
  const response = http.post(`${BASE_URL}/oracle/request-cycle`, payload, params);

  // Validações básicas
  const checks = check(response, {
    'status is 200': (r) => r.status === 200,
    'has requestId': (r) => {
      if (r.status !== 200) return false;
      try {
        const body = JSON.parse(r.body);
        return body.requestId !== undefined;
      } catch (e) {
        return false;
      }
    },
    'has aggregatedValue': (r) => {
      if (r.status !== 200) return false;
      try {
        const body = JSON.parse(r.body);
        return body.aggregatedValue !== undefined;
      } catch (e) {
        return false;
      }
    },
    'response time < 60s': (r) => r.timings.duration < 60000, // Mais tolerante para testnet
    'oracle responses >= 2': (r) => {
      if (r.status !== 200) return false;
      try {
        const body = JSON.parse(r.body);
        return body.oracleResponses >= 2;
      } catch (e) {
        return false;
      }
    }
  });

  // Registrar métricas customizadas
  recordRequestMetrics(response, metrics, meterId, expectedValue);

  // Log de progresso a cada 10 iterações
  if (__ITER % 10 === 0) {
    console.log(`[VU:${__VU}] Iteration ${__ITER}: Status ${response.status}, ` +
                `Duration: ${(response.timings.duration / 1000).toFixed(2)}s`);
  }

  // Delay maior entre requests para testnet (5-10 segundos)
  // Isso ajuda a evitar rate limiting do RPC provider
  const delay = NETWORK === 'sepolia' ? Math.random() * 5 + 5 : Math.random() * 2 + 1;
  sleep(delay);
}

// Setup function (runs once before test)
export function setup() {
  console.log('='.repeat(70));
  console.log('  EAON k6 Baseline Performance Test - Testnet');
  console.log('  Target: 100 iterations with 2 VUs (Optimized for Testnet)');
  console.log('  Network:', NETWORK);
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

  if (NETWORK === 'sepolia') {
    console.log('⚠ Testnet mode: Using longer delays to avoid rate limiting');
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

  const networkDir = NETWORK === 'sepolia' ? 'testnet/sepolia' : 'local';
  
  // Construir objeto de retorno com chaves dinâmicas
  const result = {
    'stdout': textSummary(data, { indent: ' ', enableColors: true })
  };
  
  result[`results/${networkDir}/k6/baseline-results.json`] = JSON.stringify(data, null, 2);
  result[`results/${networkDir}/k6/baseline-table.txt`] = generateTaxonomyTable(data);
  result[`results/${networkDir}/k6/baseline-report.html`] = htmlReport(data);
  
  return result;
}

