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
├── resultados-paper/       # Consolidated test results and analysis
└── docker/                 # Docker configurations
```

## Documentation

### 📚 Setup & Deployment Guides

- **[Docker + Postman Guide](DOCKER-POSTMAN-GUIDE.md)** - Complete workflow for testing with Docker and Postman
- **[Sepolia Setup](DOCKER-SEPOLIA-SETUP.md)** - Sepolia testnet environment configuration
- **[Sepolia Deployment Guide](GUIA-DEPLOY-SEPOLIA.md)** - Step-by-step deployment to Sepolia testnet

### 🧪 Testing Documentation

- **[Manual Testing Guide](MANUAL-TESTING.md)** - Manual testing procedures with Postman
- **[Testing Guide](TESTING-GUIDE.md)** - Comprehensive testing documentation
- **[Test Methodology](metodologia-de-testes.md)** - Complete testing methodology
- **[Test Plan: Local + Testnet](plano-testes-local+testnet.md)** - Local and testnet testing plan

### 📊 Experimental Results (ICBC Paper)

- **[resultados-paper/](resultados-paper/)** - Complete consolidated test results
  - **[REPRODUCIBILITY.md](resultados-paper/REPRODUCIBILITY.md)** - Experimental reproduction guide for reviewers
  - **[consolidados.json](resultados-paper/consolidados.json)** - Structured test data (7 local + 1 testnet scenarios)
  - **[tabelas-paper.md](resultados-paper/tabelas-paper.md)** - Formatted tables for paper
  - **[etherscan-guide.md](resultados-paper/etherscan-guide.md)** - Gas data collection from Etherscan
  - **[comparacoes/](resultados-paper/comparacoes/)** - Comparative analyses
    - [Local vs Testnet](resultados-paper/comparacoes/local-vs-testnet.md)
    - [Scalability Analysis](resultados-paper/comparacoes/escalabilidade.md)

### 🔧 Tools & Collections

- **[Postman Collection](eaon-postman-collection.json)** - API testing collection
- **[Commit Guide](COMMIT_GUIDE.md)** - Git commit standards

---

## Documentação

### 📚 Guias de Configuração e Deploy

- **[Guia Docker + Postman](DOCKER-POSTMAN-GUIDE.md)** - Workflow completo para testes com Docker e Postman
- **[Configuração Sepolia](DOCKER-SEPOLIA-SETUP.md)** - Configuração do ambiente testnet Sepolia
- **[Guia de Deploy Sepolia](GUIA-DEPLOY-SEPOLIA.md)** - Deploy passo a passo na testnet Sepolia

### 🧪 Documentação de Testes

- **[Guia de Testes Manuais](MANUAL-TESTING.md)** - Procedimentos de teste manual com Postman
- **[Guia de Testes](TESTING-GUIDE.md)** - Documentação completa de testes
- **[Metodologia de Testes](metodologia-de-testes.md)** - Metodologia completa de testes
- **[Plano de Testes: Local + Testnet](plano-testes-local+testnet.md)** - Plano de testes local e testnet

### 📊 Resultados Experimentais (Paper ICBC)

- **[resultados-paper/](resultados-paper/)** - Resultados consolidados completos
  - **[REPRODUCIBILITY.md](resultados-paper/REPRODUCIBILITY.md)** - Guia de reprodução experimental para revisores
  - **[consolidados.json](resultados-paper/consolidados.json)** - Dados estruturados (7 cenários locais + 1 testnet)
  - **[tabelas-paper.md](resultados-paper/tabelas-paper.md)** - Tabelas formatadas para o paper
  - **[etherscan-guide.md](resultados-paper/etherscan-guide.md)** - Coleta de dados de gas via Etherscan
  - **[comparacoes/](resultados-paper/comparacoes/)** - Análises comparativas
    - [Local vs Testnet](resultados-paper/comparacoes/local-vs-testnet.md)
    - [Análise de Escalabilidade](resultados-paper/comparacoes/escalabilidade.md)

### 🔧 Ferramentas e Collections

- **[Postman Collection](eaon-postman-collection.json)** - Collection para testes de API
- **[Guia de Commits](COMMIT_GUIDE.md)** - Padrões de commits do projeto

---

## Success Criteria

| Metric | Target |
|--------|--------|
| End-to-end latency | < 5 seconds |
| Availability (1 fault) | > 99% |
| Outlier detection (>10%) | 100% |
| Gas per cycle | < 500,000 |
| Throughput | > 10 req/min |



