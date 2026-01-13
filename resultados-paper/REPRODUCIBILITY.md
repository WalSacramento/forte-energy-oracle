# Experimental Reproducibility Guide

This document provides step-by-step instructions to reproduce the performance evaluation results presented in Section IV of the paper **"Energy-Aware Oracle Network for P2P Energy Trading in Microgrids"**.

---

## 1. System Requirements

### Hardware Requirements (Minimum)
- **CPU:** 4 cores (Intel i5/AMD Ryzen 5 or equivalent)
- **RAM:** 8 GB
- **Storage:** 10 GB free space
- **Network:** Broadband internet connection (for testnet experiments)

### Software Requirements
- **Operating System:** Linux (Ubuntu 20.04+), macOS 11+, or Windows 10/11 with WSL2
- **Node.js:** v18.x or v20.x ([https://nodejs.org](https://nodejs.org))
- **Docker:** v24.0+ with Docker Compose v2.0+ ([https://docs.docker.com/get-docker/](https://docs.docker.com/get-docker/))
- **k6:** v0.47.0+ ([https://k6.io/docs/get-started/installation/](https://k6.io/docs/get-started/installation/))
- **Git:** v2.30+ ([https://git-scm.com/downloads](https://git-scm.com/downloads))

### Installation Verification
```bash
# Verify installations
node --version    # Expected: v18.x or v20.x
docker --version  # Expected: Docker version 24.0+
k6 version        # Expected: k6 v0.47.0+
git --version     # Expected: git version 2.30+
```

---

## 2. Repository Setup

### Step 1: Clone Repository
```bash
git clone https://github.com/your-repo/energy-oracle-network.git
cd energy-oracle-network
```

### Step 2: Install Dependencies
```bash
# Install all project dependencies (root + oracle-nodes + mock-hems)
npm run setup

# Expected output: "Setup complete! All dependencies installed."
```

### Step 3: Verify Setup
```bash
npm run check-setup

# Expected output: All checks should pass (✓)
```

---

## 3. Local Performance Tests (Hardhat Network)

These tests reproduce the results in **Table I** (Scenario Test Results) and **Figure 3** (Response Time Distribution).

### Step 1: Start Docker Environment
```bash
# Start all services (Hardhat blockchain + 3 oracle nodes + Mock HEMS)
npm run k6:setup

# Wait for services to initialize (~30 seconds)
# Expected output: "✓ Network started successfully"
```

### Step 2: Deploy Smart Contracts
```bash
# Deploy OracleAggregator, EnergyTrading, and GridValidator contracts
npm run k6:deploy

# Expected output: Contract addresses and successful deployment confirmation
```

### Step 3: Run Performance Tests

#### Test 1: Baseline (Normal Operation)
```bash
npm run k6:baseline

# Duration: ~2 minutes
# Metrics collected: Error Rate, Accuracy, Response Time, Gas Consumption, Throughput
```

**Expected Output:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│          EAON Performance Test Results (Taxonomy Format)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Application Level  │ Error Rate: 0.00%, Accuracy: 100.00%                 │
│  Network Level      │ Response Time avg: 10095ms, p95: 12070ms             │
│  Computing Level    │ Gas Consumption avg: 496K, p95: 625K                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Test 2: Crash Fault (1 Oracle Offline)
```bash
npm run k6:crash-fault

# Duration: ~7 minutes
# Simulates: Oracle 3 fails after 10 successful iterations
```

#### Test 3: Byzantine Fault (Malicious Oracle)
```bash
npm run k6:byzantine-fault

# Duration: ~7 minutes
# Simulates: Oracle 3 submits +50% values (malicious behavior)
```

#### Test 4: Scalability - 5 Virtual Users
```bash
npm run k6:scalability-5vus

# Duration: ~3 minutes
# Tests: Concurrent load with 5 parallel requests
```

#### Test 5: Scalability - 10 Virtual Users
```bash
npm run k6:scalability-10vus

# Duration: ~3 minutes
# Tests: Concurrent load with 10 parallel requests
```

#### Test 6: Scalability - 20 Virtual Users
```bash
npm run k6:scalability-20vus

# Duration: ~4 minutes
# Tests: Concurrent load with 20 parallel requests
```

#### Test 7: Stress Test (100 Requests)
```bash
npm run k6:stress

# Duration: ~3 minutes
# Tests: High-load scenario with 100 parallel iterations
```

### Step 4: Run All Tests Sequentially
```bash
# Execute all 7 scenario tests in one command
npm run k6:all

# Total duration: ~30 minutes
# Generates complete dataset for Table I
```

### Step 5: Teardown Environment
```bash
npm run k6:teardown

# Stops all Docker containers and cleans up resources
```

---

## 4. Testnet Performance Tests (Sepolia Network)

These tests reproduce the results in **Table II** (Local vs Testnet Comparison).

### Prerequisites
1. **Sepolia ETH:** Obtain test ETH from [Sepolia Faucet](https://sepoliafaucet.com/)
2. **Private Key:** Configure deployer private key in `.env` file
3. **RPC Provider:** Use Alchemy or Infura for Sepolia access

### Step 1: Configure Environment
```bash
# Copy environment template
cp env.example .env

# Edit .env and set:
# SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
# DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
# ORACLE_1/2/3_PRIVATE_KEY (use separate funded accounts)
```

### Step 2: Deploy to Sepolia
```bash
npm run testnet:deploy

# Duration: ~5 minutes (includes 6 block confirmations)
# Saves deployment addresses to deployments/sepolia.json
```

### Step 3: Run Testnet Performance Tests
```bash
# Baseline test on Sepolia (100 requests)
npm run k6:baseline:testnet

# Duration: ~48 minutes (expected due to 12s block time)
# Metrics collected: Same as local tests
```

**Expected Output:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Network Level      │ Response Time avg: 48272ms, p95: 52100ms             │
│  Computing Level    │ Gas Consumption avg: 554K, p95: 590K                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Step 4: Additional Testnet Tests (Optional)
```bash
# Crash fault on Sepolia
npm run k6:crash-fault:testnet

# Byzantine fault on Sepolia
npm run k6:byzantine-fault:testnet

# Scalability tests on Sepolia
npm run k6:scalability-5vus:testnet
npm run k6:scalability-10vus:testnet
npm run k6:scalability-20vus:testnet

# Stress test on Sepolia
npm run k6:stress:testnet
```

**Warning:** Testnet tests consume real Sepolia ETH. Each test costs ~0.5-1 SepoliaETH in gas fees.

---

## 5. Results Interpretation

### Metrics Taxonomy (Donta et al. 2025)

Results are categorized into three levels:

#### Application-Level Metrics
- **Error Rate:** Percentage of failed requests (target: 0%)
- **Accuracy:** Percentage of correct aggregated values (target: 100%)
- **Availability:** System uptime during tests (target: >99%)
- **Outlier Detection Rate:** Percentage of Byzantine values detected (target: >60%)

#### Network-Level Metrics
- **Response Time:** End-to-end latency from request to aggregated result
  - `avg`: Mean response time
  - `p95`: 95th percentile (SLA threshold)
  - `p99`: 99th percentile
- **Throughput:** Requests completed per second
- **Consensus Time:** Time from minResponses to aggregation
- **TTFB (Time to First Byte):** Time to first oracle response

#### Computing-Level Metrics
- **Gas Consumption:** Ethereum gas used per oracle cycle
  - `avg`: Mean gas consumption
  - `p95`: 95th percentile (worst-case)
- **Scalability:** System behavior under increasing load (5/10/20 VUs)
- **Concurrency:** Maximum supported parallel requests

### Output Files

Test results are automatically saved to:
```
performance/k6/results/
├── baseline-results.json          # Baseline test metrics
├── crash-fault-results.json       # Crash fault test metrics
├── byzantine-fault-results.json   # Byzantine fault test metrics
├── scalability-5vus-results.json  # 5 VUs scalability metrics
├── scalability-10vus-results.json # 10 VUs scalability metrics
├── scalability-20vus-results.json # 20 VUs scalability metrics
└── stress-results.json            # Stress test metrics
```

Each JSON file contains:
- Raw k6 metrics (http_req_duration, iterations, etc.)
- Custom EAON metrics (app_accuracy, net_response_time, comp_gas_used)
- Statistical summaries (min, max, avg, median, p90, p95, p99)

### Data Extraction

Use the provided analysis script to generate LaTeX tables:
```bash
# Generate Table I (Scenario Test Results)
python3 scripts/analysis/generate-latex-table.py \
  performance/k6/results/baseline-results.json

# Consolidate all metrics into single JSON
npm run analysis:consolidate

# Output: results/consolidated-metrics.json
```

---

## 6. Validation and Troubleshooting

### Validation Checklist

Before considering results valid, verify:

- [ ] All k6 tests show `Pass Rate: 100%` (no HTTP errors)
- [ ] Baseline test: Response Time avg ≈ 10s (±15%)
- [ ] Baseline test: Gas Consumption avg ≈ 496K (±10%)
- [ ] Crash Fault test: Availability = 100% despite 1 oracle offline
- [ ] Byzantine Fault test: Outlier Detection Rate ≈ 66.67%
- [ ] Stress test: Throughput > 1500 req/min
- [ ] Testnet test: Response Time avg ≈ 48s (±20%)

### Common Issues

#### Issue 1: "Docker containers fail to start"
```bash
# Solution: Check Docker daemon is running
sudo systemctl start docker

# Check disk space
df -h

# Rebuild containers
npm run k6:teardown
npm run k6:setup
```

#### Issue 2: "k6 tests fail with HTTP 500 errors"
```bash
# Solution: Oracle nodes may not be registered
npm run verify:oracles

# Re-deploy contracts
npm run k6:deploy
```

#### Issue 3: "Gas consumption much higher than expected"
```bash
# Likely cause: First request initializes storage
# Solution: Ignore first iteration, calculate metrics from iterations 2-100

# Verify with:
cat performance/k6/results/baseline-results.json | jq '.comp_gas_used'
```

#### Issue 4: "Testnet tests timeout"
```bash
# Cause: Sepolia network congestion or insufficient gas price
# Solution: Increase maxFeePerGas in hardhat.config.js:

sepolia: {
  gasPrice: 50000000000,  // 50 gwei (increase if needed)
}
```

---

## 7. Hardware Performance Impact

Performance metrics are sensitive to hardware configuration. Expected variations:

| Hardware Tier | Response Time (Local) | Throughput (Stress) |
|--------------|----------------------|---------------------|
| **High-end** (8 cores, 16GB RAM) | 8-10s | 2000-2200 req/min |
| **Mid-range** (4 cores, 8GB RAM) | 10-12s | 1700-1900 req/min |
| **Low-end** (2 cores, 4GB RAM) | 15-20s | 1200-1500 req/min |

**Note:** Testnet performance is independent of local hardware (limited by Sepolia block time).

---

## 8. Dataset Availability

Complete raw data from our experiments is available at:
- **Repository:** [https://github.com/your-repo/energy-oracle-network](https://github.com/your-repo/energy-oracle-network)
- **Branch:** `results/icbc2026`
- **Directory:** `performance/k6/results/`

This includes:
- 7 local test scenarios (100 iterations each)
- 1 testnet scenario (100 iterations on Sepolia)
- Blockchain transaction logs (Etherscan links)
- Analysis scripts and LaTeX table generators

---

## 9. Citation

If you use this experimental setup in your research, please cite:

```bibtex
@inproceedings{eaon2026,
  title={Energy-Aware Oracle Network for P2P Energy Trading in Microgrids},
  author={Your Name et al.},
  booktitle={IEEE International Conference on Blockchain and Cryptocurrency (ICBC)},
  year={2026},
  organization={IEEE}
}
```

---

## 10. Contact and Support

For questions or issues reproducing these experiments:
- **GitHub Issues:** [https://github.com/your-repo/energy-oracle-network/issues](https://github.com/your-repo/energy-oracle-network/issues)
- **Email:** your.email@institution.edu
- **Documentation:** See `README.md` and `TESTING-GUIDE.md` in repository root

---

**Document Version:** 1.0
**Last Updated:** 2026-01-12
**Tested Environments:** Ubuntu 22.04, macOS 14.0, Windows 11 WSL2
**Estimated Total Time:** 1-2 hours (local) + 2-3 hours (testnet)
