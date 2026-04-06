# Testing Guide — EAON Fullstack

This guide explains when to use each testing tool (k6 vs Hardhat), how to run the full test suite, and what success criteria to expect.

---

## k6 vs Hardhat: When to Use Each

### Use k6 for:

1. **Concurrent load tests** — simulate multiple simultaneous users (Virtual Users), measure throughput and scalability
2. **Stress and spike tests** — identify system limits under increasing load
3. **Real-time performance metrics** — latency (p50/p95/p99), throughput (req/s), consensus time
4. **End-to-end realistic tests** — full integration flow: IoT → Oracles → Blockchain

### Use Hardhat for:

1. **Unit and integration tests** — validate smart contract logic, test edge cases, assert `require()` and `revert()` behavior
2. **Precise gas measurement** — gas consumption per function, optimization comparisons
3. **Fault scenario validation** — Byzantine faults, crash faults, reputation system, outlier detection
4. **Development and debugging** — fast iteration, stack traces, console output from contracts

---

## Metrics Comparison

| Metric | k6 | Hardhat | Notes |
|--------|:--:|:-------:|-------|
| **Application-Level** | | |
| Error Rate | Y | Y | k6: under load; Hardhat: specific scenarios |
| Accuracy | Y | Y | k6: response validation; Hardhat: assertions |
| Availability | Y | Y | k6: uptime under load; Hardhat: unit tests |
| Outlier Detection | Y | Y | k6: real rate; Hardhat: specific cases |
| **Network-Level** | | |
| Latency (p95, p99) | Y | partial | k6: real under load; Hardhat: local timestamps only |
| Throughput (req/s) | Y | N | k6 with VUs; Hardhat is always sequential |
| Consensus Time | Y | partial | k6: real; Hardhat: very fast (local EVM) |
| **Computing-Level** | | |
| Gas Consumption | Y | best | k6: via Test Orchestrator; Hardhat: most precise |
| Scalability (VUs) | best | N | k6 is the only tool that tests concurrency |

---

## Running Hardhat Tests

### All Tests

```bash
npm test
```

### By Category

```bash
# Smart contract unit tests
npm run test:unit

# Cross-component integration tests
npm run test:integration

# Fault tolerance scenario tests (S1–S7)
npm run test:scenarios

# Coverage report (outputs to coverage/index.html)
npm run test:coverage
```

### Single Test File

```bash
npx hardhat test test/scenarios/S3_ByzantineFault.test.js
npx hardhat test test/unit/EnergyAuction.test.js
```

### Test Suites

| Suite | Files | What It Tests |
|-------|-------|---------------|
| Unit | `OracleAggregator.test.js` | Oracle registration, ECDSA signing, aggregation, reputation |
| Unit | `EnergyAuction.test.js` | Dutch auction creation, price decay, bidding, settlement |
| Unit | `GridValidator.test.js` | Grid stability checks before trade execution |
| Unit | `EnergyTrading.test.js` | P2P trade matching and execution |
| Integration | `FullFlow.test.js` | End-to-end: request → oracle responses → aggregation → trade |
| Integration | `AuctionFlow.test.js` | Full Dutch auction lifecycle with oracle price data |
| S1 | `S1_Normal.test.js` | Normal operation with all 3 oracles healthy |
| S2 | `S2_CrashFault.test.js` | 1 oracle offline — system still reaches consensus |
| S3 | `S3_ByzantineFault.test.js` | Malicious oracle sending 10x values — outlier detected |
| S4 | `S4_SubtleManipulation.test.js` | <10% deviation — below detection threshold |
| S5 | `S5_NetworkLatency.test.js` | High-latency oracle — meets deadline or timeout |
| S6 | `S6_StressTest.test.js` | Many concurrent requests |
| S7 | `S7_ReputationRecovery.test.js` | Oracle recovers reputation after penalties |

### Gas Report

```bash
npm run gas-report
```

Outputs gas usage per function for `EnergyAuction` (primary contract for auction operations).

---

## Running k6 Performance Tests

### Prerequisites

**Install k6:**
```bash
# macOS
brew install k6

# Debian/Ubuntu
sudo gpg --no-default-keyring \
  --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 \
  --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Windows
choco install k6
```

**Docker and Docker Compose** must be installed.

### Step-by-Step Workflow

```bash
# 1. Start Docker stack (Hardhat + HEMS + Oracles + Test Orchestrator)
npm run k6:setup

# 2. Deploy contracts
npm run deploy:local

# 3. Restart oracles to pick up deployed contract addresses
docker-compose -f docker-compose.k6.yml restart oracle-1 oracle-2 oracle-3

# 4. Run tests
npm run k6:baseline         # 20 VUs, 10 minutes — normal operation
npm run k6:stress           # Ramp 1 → 50 VUs — find the breaking point
npm run k6:crash-fault      # Simulate 1 oracle offline
npm run k6:byzantine-fault  # Simulate malicious oracle (10x values)
npm run k6:scalability-5vus
npm run k6:scalability-10vus
npm run k6:scalability-20vus

# Run all sequentially
npm run k6:all

# 5. Tear down
npm run k6:teardown
```

### What the Baseline Test Measures

The `k6:baseline` test runs 20 concurrent VUs through the full oracle cycle:

1. VU calls `POST /oracle/request-cycle` on the Test Orchestrator
2. Orchestrator calls `requestData()` on `OracleAggregator`
3. Oracle nodes receive `DataRequested` event
4. Each oracle fetches from Mock HEMS API
5. Oracles submit ECDSA-signed responses
6. Contract aggregates using median, detects outliers (>10% deviation)
7. Response and metrics returned to k6

**Output files** (saved to `results/local/k6/`, gitignored — generated locally):
- `baseline-results.json` — full metrics
- `baseline-summary.txt` — taxonomy summary
- `baseline-report.html` — visual report

### Expected Output

```
APPLICATION-LEVEL METRICS
  Error Rate:              0.00%
  Accuracy:                100.00%
  Availability:            100.00%
  Outlier Detection Rate:  100.00%

NETWORK-LEVEL METRICS
  Response Time:           Avg: ~1200ms, p95: <5000ms
  Throughput:              > 10 req/min
  Consensus Time:          Avg: ~900ms, p95: <2000ms

COMPUTING-LEVEL METRICS
  Gas Consumption:         Avg: < 700k, p95: < 750k
```

---

## Performance SLAs (ICBC 2026 Paper Targets)

| Metric | Target | Test |
|--------|--------|------|
| Error Rate | < 1% | `k6:baseline` |
| Availability (1 fault) | > 99% | `k6:crash-fault` |
| Outlier detection (> 10%) | 100% | `k6:byzantine-fault` + `S3` |
| Response time p95 | < 5s | `k6:baseline` |
| Throughput | > 10 req/min | `k6:baseline` |
| Consensus time p95 | < 2s | `k6:baseline` |
| Gas per oracle cycle | < 700k | `k6:baseline` or Hardhat |
| Scalability | Support 20+ VUs | `k6:stress` |

---

## Testnet (Sepolia)

```bash
# Deploy to Sepolia (configure .env with SEPOLIA_RPC and DEPLOYER_PRIVATE_KEY first)
npm run testnet:deploy

# Verify contracts on Etherscan
npm run testnet:verify

# Run performance test against testnet
npm run testnet:test

# Consolidate local + testnet results
npm run analysis:consolidate
```

See [DOCKER-SEPOLIA-SETUP.md](DOCKER-SEPOLIA-SETUP.md) and [GUIA-DEPLOY-SEPOLIA.md](GUIA-DEPLOY-SEPOLIA.md) for full setup instructions.

---

## Debugging

```bash
# Stream logs from all services
docker-compose -f docker-compose.k6.yml logs -f

# Only oracle logs
docker-compose -f docker-compose.k6.yml logs -f oracle-1 oracle-2 oracle-3

# Health check all services
curl http://localhost:3000/health   # HEMS API
curl http://localhost:4000/health   # Test Orchestrator
curl http://localhost:4001/health   # Oracle 1
curl http://localhost:4002/health   # Oracle 2
curl http://localhost:4003/health   # Oracle 3
```
