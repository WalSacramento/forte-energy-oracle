# 🧪 Guia Completo de Testes - EAON

Este guia explica como executar testes de performance no EAON e quando usar cada ferramenta.

---

## 📊 k6 vs Hardhat: Quando Usar Cada Um?

### ✅ Use **k6** quando precisar de:

1. **Testes de Carga Concorrente**
   - Simular múltiplos usuários simultâneos (VUs - Virtual Users)
   - Testar throughput real (requisições/segundo)
   - Validar escalabilidade (1 VU → 50 VUs)

2. **Testes de Stress e Spike**
   - Identificar limites do sistema
   - Testar comportamento sob picos de carga
   - Validar degradação gradual

3. **Métricas de Performance em Tempo Real**
   - Latência (p50, p95, p99)
   - Throughput (reqs/s)
   - Taxa de erro sob carga
   - Tempo de consenso dos oracles

4. **Testes End-to-End Realistas**
   - Simula comportamento real de múltiplos clientes
   - Testa integração completa: IoT → Oracles → Blockchain
   - Valida SLAs (Service Level Agreements)

### ✅ Use **Hardhat** quando precisar de:

1. **Testes Unitários e de Integração**
   - Validar lógica dos smart contracts
   - Testar casos de borda
   - Validar require() e revert()

2. **Medição Precisa de Gas**
   - Gas consumption por função
   - Otimização de contratos
   - Comparação antes/depois de mudanças

3. **Testes de Cenários Específicos**
   - Byzantine faults (oracles maliciosos)
   - Crash faults (oracles offline)
   - Sistema de reputação
   - Detecção de outliers

4. **Development e Debugging**
   - Testes rápidos durante desenvolvimento
   - Console.log nos contratos
   - Stack traces detalhadas
   - Breakpoints (com Hardhat Network)

---

## 🎯 Métricas que Cada Ferramenta Fornece

| Métrica | k6 | Hardhat | Notas |
|---------|:--:|:-------:|-------|
| **Application-Level** |
| Error Rate | ✅ | ✅ | k6: sob carga; Hardhat: cenários específicos |
| Accuracy | ✅ | ✅ | k6: validação de responses; Hardhat: assertions |
| Availability | ✅ | ✅ | k6: uptime sob carga; Hardhat: testes unitários |
| Outlier Detection | ✅ | ✅ | k6: taxa real; Hardhat: casos específicos |
| **Network-Level** |
| Latency (TTFB, p95, p99) | ✅ | ⚠️ | k6: real sob carga; Hardhat: timestamps sequenciais |
| Throughput (reqs/s) | ✅ | ❌ | k6: VUs concorrentes; Hardhat: sempre sequencial |
| Response Time | ✅ | ⚠️ | k6: real; Hardhat: timestamps locais |
| Consensus Time | ✅ | ⚠️ | k6: real; Hardhat: muito rápido (local) |
| **Computing-Level** |
| Gas Consumption | ✅ | ✅✅ | k6: via Test Orchestrator; **Hardhat: mais preciso** |
| Gas Optimization | ❌ | ✅ | Hardhat gas-reporter é melhor |
| Scalability (VUs) | ✅✅ | ❌ | **k6 é único que testa** |
| Concurrency | ✅ | ❌ | k6: real; Hardhat: não suporta |

**Legenda:**
- ✅✅ = Ferramenta ideal
- ✅ = Suportado
- ⚠️ = Suportado mas limitado
- ❌ = Não suportado

---

## 🚀 Como Executar os Testes k6 (FLUXO COMPLETO)

### Pré-requisitos

1. **k6 instalado:**
   ```bash
   # macOS
   brew install k6

   # Linux (Debian/Ubuntu)
   sudo gpg -k
   sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
   echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
   sudo apt-get update
   sudo apt-get install k6

   # Windows (Chocolatey)
   choco install k6
   ```

2. **Docker e Docker Compose instalados**

### Passo 1: Subir Infraestrutura

```bash
# Subir containers (Hardhat, HEMS, Oracles, Test Orchestrator)
npm run k6:setup

# Aguardar containers iniciarem (30s)
# O script já faz isso automaticamente
```

### Passo 2: Deploy dos Contratos

```bash
npm run deploy:local
```

**IMPORTANTE:** Após o deploy, reinicie os oracles:

```bash
docker-compose -f docker-compose.k6.yml restart oracle-1 oracle-2 oracle-3
```

### Passo 3: Executar Testes k6

#### A. Teste Baseline (Carga Normal - 20 VUs, 10 min)

```bash
npm run k6:baseline
```

**O que este teste faz:**
- 20 Virtual Users (VUs) simultâneos
- Cada VU executa ciclos de requisição por 10 minutos
- **Fluxo completo testado:**
  1. VU chama `POST /oracle/request-cycle`
  2. Test Orchestrator chama `requestData()` no smart contract
  3. Oracles escutam evento `DataRequested`
  4. Oracles fetcham dados do HEMS API
  5. Oracles submitam respostas assinadas
  6. Smart contract agrega usando mediana
  7. Detecta outliers (se houver)
  8. Retorna resultado + métricas

**Métricas coletadas:**
- Application: Error Rate, Accuracy, Availability, Outlier Detection Rate
- Network: Latency, Throughput, Response Time, Consensus Time
- Computing: Gas Consumption (avg, p95), Scalability

**Saída:**
```
results/local/k6/baseline-results.json    # Métricas completas
results/local/k6/baseline-summary.txt     # Resumo taxonomia
results/local/k6/baseline-report.html     # Relatório visual
```

#### B. Teste de Stress (Ramp 1→50 VUs)

```bash
npm run k6:stress
```

**O que este teste faz:**
- Ramp-up gradual: 1 VU → 10 VUs → 30 VUs → 50 VUs
- Identifica ponto de degradação
- Testa comportamento sob carga crescente

#### C. Teste de Cenários de Falha

```bash
npm run k6:faults
```

**O que este teste faz:**
- **S2 - Crash Fault:** Simula 1 oracle offline
- **S3 - Byzantine Fault:** Simula oracle malicioso (valores 10x)
- **S5 - Network Latency:** Simula delay de 3s no oracle

#### D. Todos os Testes

```bash
npm run k6:all
```

Executa baseline + stress + faults sequencialmente.

### Passo 4: Analisar Resultados

#### Ver Resumo no Terminal

O teste já exibe resumo ao final:

```
┌─────────────────────────────────────────────────────────────────────┐
│  APPLICATION-LEVEL METRICS                                          │
├─────────────────────────────────────────────────────────────────────┤
│  Error Rate:              0.00%
│  Accuracy:                100.00%
│  Availability:            100.00%
│  Outlier Detection Rate:  100.00%
├─────────────────────────────────────────────────────────────────────┤
│  NETWORK-LEVEL METRICS                                              │
├─────────────────────────────────────────────────────────────────────┤
│  Network Latency (TTFB):  Avg: 21.45ms, p95: 45.20ms
│  Throughput:              45.2 reqs/s
│  Response Time:           Avg: 1234.56ms, p95: 2100.00ms
│  Consensus Time:          Avg: 890.12ms, p95: 1500.00ms
├─────────────────────────────────────────────────────────────────────┤
│  COMPUTING-LEVEL METRICS                                            │
├─────────────────────────────────────────────────────────────────────┤
│  Gas Consumption:         Avg: 675000, p95: 720000
│  Gas Total:               67500000
│  Scalability:             Tested up to 20 VUs
│  Concurrency:             20 Virtual Users
└─────────────────────────────────────────────────────────────────────┘
```

#### Ver JSON Completo

```bash
cat results/local/k6/baseline-results.json | jq .metrics
```

#### Gerar Tabela LaTeX para Paper

```bash
npm run analysis:table
```

Gera `results/paper-table.tex` com tabelas acadêmicas formatadas.

---

## 🧪 Como Executar Testes Hardhat (Validação Lógica)

### Todos os Testes

```bash
npm test
```

### Testes por Categoria

```bash
# Unit tests (smart contracts)
npm run test:unit

# Integration tests (cross-component)
npm run test:integration

# Scenario tests (S1-S7: fault tolerance)
npm run test:scenarios
```

### Testes com Coverage

```bash
npm run test:coverage
```

Gera relatório em `coverage/index.html`.

### Teste Individual

```bash
npx hardhat test test/scenarios/S6_StressTest.test.js
```

---

## 📈 Workflow Completo de Testes

### Para Desenvolvimento

```bash
# 1. Testes unitários rápidos
npm run test:unit

# 2. Testes de integração
npm run test:integration

# 3. Verificar coverage
npm run test:coverage
```

### Para Validação de Performance (Local)

```bash
# 1. Subir infra k6
npm run k6:setup

# 2. Deploy
npm run deploy:local

# 3. Reiniciar oracles
docker-compose -f docker-compose.k6.yml restart oracle-1 oracle-2 oracle-3

# 4. Rodar baseline
npm run k6:baseline

# 5. Analisar resultados
cat results/local/k6/baseline-summary.txt

# 6. Gerar tabela LaTeX
npm run analysis:table

# 7. Teardown
npm run k6:teardown
```

**Atalho (tudo de uma vez):**
```bash
npm run perf:local
```

### Para Validação em Testnet (Sepolia)

```bash
# 1. Configurar .env.testnet com suas chaves
source .env.testnet

# 2. Deploy na Sepolia
npm run testnet:deploy

# 3. Executar teste de performance
npm run testnet:test

# 4. Analisar resultados
cat results/testnet/sepolia/performance-results.json

# 5. Comparar local vs testnet
npm run analysis:consolidate
```

---

## 🎯 Targets de Performance (SLAs)

Baseado no paper "Scalable Computational Solution for Agroclimatic Data Tracking":

| Métrica | Target | Como Medir |
|---------|--------|------------|
| **Application** |
| Error Rate | < 1% | k6 baseline |
| Availability | > 99% | k6 baseline |
| Outlier Detection | > 95% | k6 faults (S3) |
| **Network** |
| Response Time p95 | < 5s | k6 baseline |
| Throughput | > 10 req/min | k6 baseline |
| Consensus Time p95 | < 2s | k6 baseline |
| **Computing** |
| Gas avg | < 700k | k6 baseline ou Hardhat |
| Scalability | Suportar 20+ VUs | k6 stress |

---

## 🔍 Debugging

### Ver logs em tempo real

```bash
# Todos os serviços
docker-compose -f docker-compose.k6.yml logs -f

# Apenas oracles
docker-compose -f docker-compose.k6.yml logs -f oracle-1 oracle-2 oracle-3

# Apenas Test Orchestrator
docker-compose -f docker-compose.k6.yml logs -f test-orchestrator

# Apenas Hardhat (blockchain)
docker-compose -f docker-compose.k6.yml logs -f hardhat
```

### Verificar saúde dos serviços

```bash
curl http://localhost:3000/health   # HEMS API
curl http://localhost:4000/health   # Test Orchestrator
curl http://localhost:4001/health   # Oracle 1
curl http://localhost:4002/health   # Oracle 2
curl http://localhost:4003/health   # Oracle 3
```

---

## 📚 Referências

- [k6 Documentation](https://k6.io/docs/)
- [Hardhat Testing](https://hardhat.org/hardhat-runner/docs/guides/test-contracts)
- [Agroclimatic Paper](https://example.com) - Metodologia de taxonomia
- [EAON Architecture](./docs/architecture.md)

---

**Última atualização:** 2026-01-04
