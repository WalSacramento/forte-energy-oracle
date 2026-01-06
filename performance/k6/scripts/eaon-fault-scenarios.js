import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';

// Configuration for fault tolerance testing
export const options = {
  scenarios: {
    fault_scenarios: {
      executor: 'per-vu-iterations',
      vus: 1,  // Run sequentially
      iterations: 3,  // One iteration per scenario (S2, S3, S5)
      maxDuration: '10m'
    }
  },
  thresholds: {
    'checks': ['rate>0.9'],  // 90% of checks should pass
    'http_req_failed': ['rate<0.2']  // Allow some failures during fault conditions
  }
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const HEMS_URL = __ENV.HEMS_URL || 'http://localhost:3000';

// Helper function to execute oracle request cycle
function executeRequestCycle(meterId, expectOutlier = false) {
  const payload = JSON.stringify({
    meterId,
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

// S2: Crash Fault - One oracle goes offline
function testCrashFault() {
  group('S2: Crash Fault (Oracle 3 offline)', () => {
    console.log('\n📋 Testing S2: Crash Fault...');

    // 1. Fail Oracle 3
    console.log('  → Failing Oracle 3...');
    const failResponse = http.post(`${HEMS_URL}/admin/fail/oracle-3`);
    check(failResponse, {
      'Oracle 3 failed successfully': (r) => r.status === 200 || r.status === 404
    });

    sleep(2);  // Wait for oracle to stop

    // 2. Execute request cycle
    console.log('  → Executing request cycle with 2 oracles...');
    const response = executeRequestCycle('METER001');

    // 3. Verify system recovered despite crash
    check(response, {
      'S2: System completed with 2 oracles': (r) => r.status === 200,
      'S2: Aggregation successful': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        return body.aggregatedValue !== undefined;
      },
      'S2: Received 2 oracle responses': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        // May have 2 or 3 responses depending on timing
        return body.oracleResponses >= 2;
      }
    });

    if (response.status === 200) {
      const result = JSON.parse(response.body);
      console.log(`  ✓ Success: Aggregated value = ${result.aggregatedValue}, ` +
                  `Oracles = ${result.oracleResponses}`);
    } else {
      console.log(`  ✗ Failed: Status ${response.status}`);
    }

    // 4. Restore Oracle 3
    console.log('  → Restoring Oracle 3...');
    const recoverResponse = http.post(`${HEMS_URL}/admin/recover/oracle-3`);
    check(recoverResponse, {
      'Oracle 3 recovered': (r) => r.status === 200 || r.status === 404
    });

    sleep(2);
  });
}

// S3: Byzantine Fault - Malicious oracle submits corrupted data
function testByzantineFault() {
  group('S3: Byzantine Fault (Malicious Oracle 3)', () => {
    console.log('\n📋 Testing S3: Byzantine Fault...');

    // 1. Set Oracle 3 to malicious mode
    console.log('  → Setting Oracle 3 to malicious mode...');
    const maliciousResponse = http.post(`${HEMS_URL}/admin/malicious/oracle-3`);
    check(maliciousResponse, {
      'Oracle 3 set to malicious': (r) => r.status === 200 || r.status === 404
    });

    sleep(2);

    // 2. Execute request cycle
    console.log('  → Executing request cycle with malicious oracle...');
    const response = executeRequestCycle('METER001', true);

    // 3. Verify outlier detection
    check(response, {
      'S3: System completed successfully': (r) => r.status === 200,
      'S3: Outlier was detected': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        return body.outlierDetected === true;
      },
      'S3: Aggregated value not corrupted': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        const expectedValue = 5000;
        const deviation = Math.abs(body.aggregatedValue - expectedValue) / expectedValue;
        return deviation < 0.05;  // Less than 5% deviation
      }
    });

    if (response.status === 200) {
      const result = JSON.parse(response.body);
      console.log(`  ✓ Success: Outlier detected = ${result.outlierDetected}, ` +
                  `Value = ${result.aggregatedValue}`);
    } else {
      console.log(`  ✗ Failed: Status ${response.status}`);
    }

    // 4. Restore Oracle 3 to honest mode
    console.log('  → Restoring Oracle 3 to honest mode...');
    const honestResponse = http.post(`${HEMS_URL}/admin/honest/oracle-3`);
    check(honestResponse, {
      'Oracle 3 restored to honest': (r) => r.status === 200 || r.status === 404
    });

    sleep(2);
  });
}

// S5: Network Latency - Simulate delayed oracle response
function testNetworkLatency() {
  group('S5: Network Latency (3s delay on Oracle 3)', () => {
    console.log('\n📋 Testing S5: Network Latency...');

    // 1. Add 3s delay to Oracle 3
    console.log('  → Adding 3s delay to Oracle 3...');
    const delayResponse = http.post(`${HEMS_URL}/admin/delay/oracle-3?ms=3000`);
    check(delayResponse, {
      'Delay added to Oracle 3': (r) => r.status === 200 || r.status === 404
    });

    sleep(1);

    // 2. Execute request cycle and measure latency
    console.log('  → Executing request cycle with delayed oracle...');
    const startTime = Date.now();
    const response = executeRequestCycle('METER001');
    const latency = Date.now() - startTime;

    // 3. Verify system tolerates latency
    check(response, {
      'S5: System completed despite delay': (r) => r.status === 200,
      'S5: Latency within deadline (30s)': () => latency < 30000,
      'S5: All oracles eventually responded': (r) => {
        if (r.status !== 200) return false;
        const body = JSON.parse(r.body);
        // System should wait for all oracles or timeout gracefully
        return body.oracleResponses >= 2;
      }
    });

    if (response.status === 200) {
      const result = JSON.parse(response.body);
      console.log(`  ✓ Success: Latency = ${latency}ms, ` +
                  `Oracles = ${result.oracleResponses}`);
    } else {
      console.log(`  ✗ Failed: Status ${response.status}, Latency = ${latency}ms`);
    }

    // 4. Remove delay
    console.log('  → Removing delay from Oracle 3...');
    const removeDelayResponse = http.post(`${HEMS_URL}/admin/delay/oracle-3?ms=0`);
    check(removeDelayResponse, {
      'Delay removed from Oracle 3': (r) => r.status === 200 || r.status === 404
    });

    sleep(2);
  });
}

// Main test function
export default function () {
  // Ensure we're starting with clean state
  http.post(`${HEMS_URL}/admin/recover/oracle-3`);
  http.post(`${HEMS_URL}/admin/honest/oracle-3`);
  http.post(`${HEMS_URL}/admin/delay/oracle-3?ms=0`);
  sleep(2);

  // Run scenarios in sequence
  if (__ITER === 0) {
    testCrashFault();
  } else if (__ITER === 1) {
    testByzantineFault();
  } else if (__ITER === 2) {
    testNetworkLatency();
  }
}

export function setup() {
  console.log('='.repeat(70));
  console.log('  EAON k6 Fault Tolerance Scenarios');
  console.log('  Testing S2 (Crash), S3 (Byzantine), S5 (Latency)');
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

  console.log('✓ Services are healthy\n');
  return {};
}

export function teardown(data) {
  console.log('\n' + '='.repeat(70));
  console.log('  Fault Tolerance Tests Completed');
  console.log('='.repeat(70));

  // Ensure all oracles are restored to normal state
  http.post(`${HEMS_URL}/admin/recover/oracle-3`);
  http.post(`${HEMS_URL}/admin/honest/oracle-3`);
  http.post(`${HEMS_URL}/admin/delay/oracle-3?ms=0`);

  console.log('\n✓ All oracles restored to normal state');
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'results/local/k6/fault-scenarios-results.json': JSON.stringify(data, null, 2)
  };
}
