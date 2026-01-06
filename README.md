# Energy-Aware Oracle Network (EAON)

Multi-Oracle Proof of Concept for P2P Energy Trading in Microgrids

## Overview

EAON is a fault-tolerant multi-oracle architecture specifically designed for P2P energy trading in microgrids. This PoC demonstrates:

- Tolerance to crash faults (1 of 3 oracles offline)
- Detection of Byzantine faults (malicious oracle)
- Low latency suitable for real-time trading (<5s)
- Functional reputation system

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      IoT Layer                               │
│   Smart Meters → HEMS API (Port 3000)                       │
├─────────────────────────────────────────────────────────────┤
│                    Oracle Layer                              │
│   Oracle 1 (4001) │ Oracle 2 (4002) │ Oracle 3 (4003)       │
├─────────────────────────────────────────────────────────────┤
│                  Blockchain Layer                            │
│   Hardhat Node (8545)                                        │
│   ├── OracleAggregator.sol                                  │
│   ├── EnergyTrading.sol                                     │
│   └── GridValidator.sol                                     │
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- Node.js 18.x LTS
- npm 9.x
- Docker 24.x
- Docker Compose 2.x
- k6 0.47+ (for performance tests)

## Quick Start

```bash
# 1. Install dependencies
npm run setup

# 2. Copy environment file
cp env.example .env

# 3. Compile contracts
npm run compile

# 4. Start local blockchain
npm run node

# 5. Deploy contracts (in another terminal)
npm run deploy:local

# 6. Run tests
npm test
```

## Docker Setup

```bash
# Start all services
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down
```

## Testing

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Scenario tests (S1-S7)
npm run test:scenarios

# Coverage report
npm run test:coverage
```

## Performance Tests

```bash
# Baseline test
npm run perf:baseline

# Stress test
npm run perf:stress

# All performance tests
npm run perf:all
```

## Project Structure

```
energy-oracle-network/
├── contracts/              # Solidity smart contracts
├── oracle-nodes/           # Oracle node implementation
├── mock-hems/              # Mock HEMS API
├── test/                   # Test suites
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── scenarios/         # Scenario tests (S1-S7)
├── performance/            # Performance tests (k6)
├── scripts/                # Utility scripts
└── docker/                 # Docker configurations
```

## Success Criteria

| Metric | Target |
|--------|--------|
| End-to-end latency | < 5 seconds |
| Availability (1 fault) | > 99% |
| Outlier detection (>10%) | 100% |
| Gas per cycle | < 500,000 |
| Throughput | > 10 req/min |

## License

MIT


