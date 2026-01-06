# EAON k6 Performance Testing

Testes de performance baseados na taxonomia do artigo "Scalable Computational Solution for Agroclimatic Data Tracking", adaptados para sistemas de oráculos blockchain.

## Pré-requisitos

- k6 v0.47 ou superior instalado
- Docker e Docker Compose
- Node.js 18+ (para Test Orchestrator)
- Sistema EAON rodando localmente

## Arquitetura de Testes

```
┌─────────────────┐
│   k6 Test       │
│   Scripts       │
└────────┬────────┘
         │ HTTP
         ↓
┌─────────────────┐
│ Test            │
│ Orchestrator    │
│ API (port 4000) │
└────────┬────────┘
         │
         ↓
┌─────────────────┐     ┌──────────────┐
│ Oracle          │ ←───│ HEMS API     │
│ Aggregator      │     │ (port 3000)  │
│ Smart Contract  │     └──────────────┘
└─────────────────┘
         ↑
         │
    ┌────┴────┬────────┐
    │         │        │
┌───┴───┐ ┌──┴───┐ ┌──┴───┐
│Oracle1│ │Oracle│ │Oracle│
│       │ │  2   │ │  3   │
└───────┘ └──────┘ └──────┘
```

## Instalação

### 1. Instalar k6

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**macOS:**
```bash
brew install k6
```

**Windows:**
```powershell
choco install k6
```

### 2. Setup do Test Orchestrator

```bash
cd test-orchestrator
npm install
```

## Quick Start

### 1. Iniciar Ambiente Local

```bash
# Terminal 1: Hardhat blockchain
npm run node

# Terminal 2: Deploy contracts
npm run deploy:local

# Salvar CONTRACT_ADDRESS retornado
export CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3

# Terminal 3: HEMS API
npm run hems

# Terminais 4-6: Oracle nodes
npm run oracle:1
npm run oracle:2
npm run oracle:3

# Terminal 7: Test Orchestrator
cd test-orchestrator
export CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
npm start
```

### 2. Executar Testes

**Teste Baseline (principal):**
```bash
k6 run --out json=results/local/k6/baseline-results.json \
       --env BASE_URL=http://localhost:4000 \
       --env HEMS_URL=http://localhost:3000 \
       performance/k6/scripts/eaon-baseline.js
```

**Teste de Estresse:**
```bash
k6 run --env BASE_URL=http://localhost:4000 \
       --env HEMS_URL=http://localhost:3000 \
       performance/k6/scripts/eaon-stress.js
```

**Cenários de Falha:**
```bash
k6 run --env BASE_URL=http://localhost:4000 \
       --env HEMS_URL=http://localhost:3000 \
       performance/k6/scripts/eaon-fault-scenarios.js
```

## Scripts Disponíveis

### eaon-baseline.js

Teste principal de carga seguindo a metodologia do artigo Agroclimatic.

**Configuração:**
- 20 VUs constantes
- Duração: 10 minutos
- Target: 10,000 transações

**Métricas Coletadas:**
- Application-level: Error Rate, Accuracy, Availability, Outlier Detection
- Network-level: Latency (TTFB), Throughput, Response Time, Consensus Time
- Computing-level: Gas Consumption

**Thresholds:**
- Error Rate: < 1%
- Availability: > 99%
- Response Time p95: < 5000ms
- Consensus Time p95: < 2000ms
- Gas Usage avg: < 700k

### eaon-stress.js

Teste de estresse com VUs crescentes.

**Configuração:**
- Ramping VUs: 0 → 50
- Estágios de 2-3 minutos
- Duração total: ~16 minutos

**Objetivo:**
Identificar limite de throughput e degradação de latência sob carga crescente.

### eaon-fault-scenarios.js

Testes de tolerância a falhas.

**Cenários:**
- **S2 - Crash Fault**: Oracle 3 offline, sistema completa com 2 oracles
- **S3 - Byzantine Fault**: Oracle 3 malicioso, sistema detecta outlier
- **S5 - Network Latency**: Oracle 3 com delay de 3s, sistema tolera atraso

## Resultados

Os resultados são salvos em `results/local/k6/`:

- `baseline-results.json`: Dados completos do k6
- `baseline-table.txt`: Tabela formatada no padrão taxonomia
- `baseline-report.html`: Relatório HTML visual

### Formato da Tabela Taxonomia

```
┌─────────────────────────────────────────────────────────────────────┐
│  Category          │ Metric                    │ Value              │
├────────────────────┼───────────────────────────┼────────────────────┤
│  Application-level │ Error Rate                │ 0.00%              │
│                    │ Accuracy                  │ 100.00%            │
│                    │ Availability              │ 100.00%            │
│                    │ Outlier Detection Rate    │ 100.00%            │
├────────────────────┼───────────────────────────┼────────────────────┤
│  Network-level     │ Network Latency (TTFB)    │ Avg: 21.5 ms       │
│                    │ Throughput                │ 45.2 reqs/s        │
│                    │ Response Time             │ Avg: 1234ms        │
│                    │ Consensus Time            │ Avg: 890ms         │
├────────────────────┼───────────────────────────┼────────────────────┤
│  Computing-level   │ Gas Consumption           │ Avg: 675k          │
│                    │ Scalability               │ Up to 20VUs        │
└────────────────────┴───────────────────────────┴────────────────────┘
```

## Métricas Customizadas

O framework de testes usa métricas customizadas k6:

```javascript
// Application-level
- app_error_rate: Rate        // Taxa de erro
- app_accuracy: Rate           // Acurácia da agregação
- app_availability: Rate       // Disponibilidade
- app_outlier_detection_rate: Rate  // Taxa de detecção de outliers

// Network-level
- net_latency_ttfb: Trend      // Time to First Byte
- net_throughput: Counter      // Requisições por segundo
- net_response_time: Trend     // Tempo total de resposta
- net_consensus_time: Trend    // Tempo de consenso

// Computing-level
- comp_gas_used: Trend         // Consumo de gas
```

## Troubleshooting

### Test Orchestrator não está saudável

```bash
# Verificar se está rodando
curl http://localhost:4000/health

# Ver logs
cd test-orchestrator
npm start
```

### k6 timeout em todas as requisições

- Verificar se oracles estão respondendo
- Aumentar timeout no script: `timeout: '90s'`
- Verificar CONTRACT_ADDRESS está correto

### Gas usage muito alto

- Normal para operações complexas com 3 oracles
- Esperado: ~675k gas por ciclo completo
- Breakdown: requestData (100k) + 3x submitResponse (450k) + agregação (75k)

### Baixo throughput

- k6 roda localmente e depende da blockchain
- Hardhat mining interval: 1s (configurável)
- Throughput esperado: 10-50 reqs/s dependendo do hardware

## Próximos Passos

1. Executar baseline test e analisar resultados
2. Ajustar thresholds baseado nos resultados
3. Executar stress test para encontrar limites
4. Testar fault scenarios para validar resiliência
5. Gerar tabelas LaTeX para paper:
   ```bash
   python3 scripts/analysis/generate-latex-table.py \
     results/local/k6/baseline-results.json
   ```

## Referências

- [k6 Documentation](https://k6.io/docs/)
- [Artigo Agroclimatic](link-to-paper)
- [EAON Architecture](/docs/architecture.md)
