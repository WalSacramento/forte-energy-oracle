# Energy-Aware Oracle Network (EAON)

Multi-Oracle Proof of Concept for P2P Energy Trading in Microgrids — Fullstack

## Overview

EAON is a fault-tolerant multi-oracle architecture specifically designed for P2P energy trading in microgrids. This PoC demonstrates:

- Tolerance to crash faults (1 of 3 oracles offline)
- Detection of Byzantine faults (malicious oracle)
- Low latency suitable for real-time trading (<5s)
- Functional reputation system with automatic deactivation
- Dutch-auction based energy price discovery (`EnergyAuction`)
- Web dashboard for real-time monitoring and trade management

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Presentation Layer                         │
│   Next.js Dashboard (Port 3001)                             │
│   Dashboard │ Auctions │ Oracle Health │ Marketplace        │
├─────────────────────────────────────────────────────────────┤
│                      IoT Layer                               │
│   Smart Meters → HEMS API (Port 3000)                       │
├─────────────────────────────────────────────────────────────┤
│                    Oracle Layer                              │
│   Oracle 1 (4001) │ Oracle 2 (4002) │ Oracle 3 (4003)       │
├─────────────────────────────────────────────────────────────┤
│                  Blockchain Layer                            │
│   Hardhat Node (8545)                                        │
│   ├── OracleAggregator.sol  (oracle management + ECDSA)     │
│   ├── EnergyTrading.sol     (P2P trade matching)            │
│   ├── GridValidator.sol     (grid stability validation)     │
│   └── EnergyAuction.sol    (Dutch auction price discovery)  │
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
# 1. Install all dependencies
npm run setup

# 2. Copy environment file
cp env.example .env

# 3. Compile contracts
npm run compile

# 4. Start local blockchain (leave running)
npm run node

# 5. Deploy contracts (in another terminal)
npm run deploy:local

# 6. Run tests
npm test
```

## Docker Setup (Full Stack)

The recommended way to run everything together:

```bash
# Start all services (hardhat node, oracles, HEMS, frontend)
npm run docker:up

# View logs
npm run docker:logs

# Stop services
npm run docker:down

# Restart oracle nodes only
npm run docker:restart-oracles
```

After `docker:up`, the dashboard is available at **http://localhost:3001**.

## Frontend Dashboard

The Next.js dashboard (`frontend/`) provides a real-time interface for:

| Page | URL | Description |
|------|-----|-------------|
| Dashboard | `/dashboard` | Overview: oracle health, active trades, system stats |
| Auctions | `/auctions` | Dutch-auction list with price decay charts |
| Auction Detail | `/auctions/:id` | Individual auction status and bidding |
| Marketplace | `/marketplace` | Open energy offers |
| Oracle Health | `/oracle-health` | Per-oracle reputation and response metrics |
| Prosumer | `/prosumer` | Prosumer account view |
| History | `/history` | Completed trade history |

The UI is available in **English** and **Portuguese (PT-BR)** (toggled via the language selector).

To run the frontend in development mode:

```bash
npm run frontend:dev
# Available at http://localhost:3001
```

## Testing

```bash
# All Hardhat tests
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

Run a single test file:

```bash
npx hardhat test test/scenarios/S3_ByzantineFault.test.js
```

## Performance Tests (k6)

Requires Docker stack running (`npm run k6:setup`).

```bash
# Start Docker stack and wait for readiness
npm run k6:setup

# Individual tests
npm run k6:baseline
npm run k6:stress
npm run k6:crash-fault
npm run k6:byzantine-fault

# Scalability
npm run k6:scalability-5vus
npm run k6:scalability-10vus
npm run k6:scalability-20vus

# Run all k6 tests sequentially
npm run k6:all

# Tear down
npm run k6:teardown
```

## Sepolia Testnet

```bash
# Deploy contracts to Sepolia
npm run testnet:deploy

# Verify contracts on Etherscan
npm run testnet:verify

# Run performance tests against testnet
npm run testnet:test
```

See [DOCKER-SEPOLIA-SETUP.md](DOCKER-SEPOLIA-SETUP.md) and [GUIA-DEPLOY-SEPOLIA.md](GUIA-DEPLOY-SEPOLIA.md) for full testnet configuration.

## Project Structure

```
energy-oracle-network/
├── contracts/              # Solidity smart contracts
│   ├── OracleAggregator.sol
│   ├── EnergyTrading.sol
│   ├── GridValidator.sol
│   ├── EnergyAuction.sol
│   └── interfaces/
├── frontend/               # Next.js dashboard (port 3001)
├── oracle-nodes/           # Off-chain oracle node implementation
├── mock-hems/              # Mock HEMS API (port 3000)
├── test/                   # Test suites
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── scenarios/         # Scenario tests (S1-S7)
├── performance/k6/         # k6 performance test scripts
├── test-orchestrator/      # HTTP orchestrator for k6 test coordination
├── scripts/                # Deploy and utility scripts
└── docker/                 # Dockerfile for Hardhat node
```

## Key Ports

| Service | Port |
|---------|------|
| Hardhat node | 8545 |
| Mock HEMS API | 3000 |
| Oracle Node 1 | 4001 |
| Oracle Node 2 | 4002 |
| Oracle Node 3 | 4003 |
| k6 metrics aggregator | 4000 |
| Frontend dashboard | 3001 |

## Documentation

- [Manual Testing Guide](MANUAL-TESTING.md) — Step-by-step manual testing with curl/Postman and the web UI
- [Testing Guide](TESTING-GUIDE.md) — When to use k6 vs Hardhat, test scenarios, SLAs
- [Sepolia Setup](DOCKER-SEPOLIA-SETUP.md) — Docker + Sepolia testnet configuration
- [Sepolia Deploy Guide](GUIA-DEPLOY-SEPOLIA.md) — Step-by-step deployment to Sepolia testnet

## Success Criteria

| Metric | Target |
|--------|--------|
| End-to-end latency | < 5 seconds |
| Availability (1 fault) | > 99% |
| Outlier detection (> 10% deviation) | 100% |
| Gas per oracle cycle | < 500,000 |
| Throughput | > 10 req/min |
