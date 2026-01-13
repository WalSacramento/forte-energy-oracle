# Guia Completo: Deploy e Testes na Sepolia Testnet

Este guia explica como fazer deploy dos contratos EAON na Sepolia testnet e executar os testes k6 apontando para a testnet.

## 📋 Pré-requisitos

### 1. Obter ETH de Teste (Sepolia)

Você precisará de aproximadamente **0.5-1 ETH** de teste para:
- Deployment dos 3 contratos: ~0.3 ETH
- Testes de performance: ~0.2-0.5 ETH

**Faucets Recomendados:**
- [Sepolia Faucet](https://sepoliafaucet.com/) - 0.5 ETH/dia
- [QuickNode Faucet](https://faucet.quicknode.com/ethereum/sepolia) - 0.05 ETH
- [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia) - 0.1 ETH

### 2. Configurar RPC Provider

**Opção A: Infura (Recomendado)**
1. Crie conta em [infura.io](https://infura.io)
2. Crie novo projeto
3. Copie o endpoint Sepolia: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`

**Opção B: Alchemy**
1. Crie conta em [alchemy.com](https://alchemy.com)
2. Crie novo app (escolha Sepolia)
3. Copie o HTTPS URL

### 3. Obter Etherscan API Key

1. Acesse [etherscan.io/apis](https://etherscan.io/apis)
2. Registre-se e crie API key gratuita
3. Copie o API key

## 🚀 Configuração Inicial

### 1. Criar Arquivo de Ambiente

Crie um arquivo `.env.testnet` na raiz do projeto:

```bash
# Sepolia RPC (substitua YOUR_PROJECT_ID pelo seu ID do Infura/Alchemy)
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# Private Keys (⚠️ USE APENAS CONTAS DE TESTE!)
# Crie 4 novas carteiras exclusivamente para testnet
# NUNCA use carteiras com fundos reais!
DEPLOYER_PRIVATE_KEY=0x...
ORACLE_1_PRIVATE_KEY=0x...
ORACLE_2_PRIVATE_KEY=0x...
ORACLE_3_PRIVATE_KEY=0x...

# Etherscan API Key (para verificação de contratos)
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY

# Contract Address (será preenchido após deploy)
CONTRACT_ADDRESS=
```

**⚠️ IMPORTANTE:**
- **NUNCA** use carteiras com fundos reais!
- **NUNCA** faça commit do arquivo `.env.testnet`!
- Crie carteiras novas exclusivamente para teste
- Adicione `.env.testnet` ao `.gitignore`

### 2. Carregar Variáveis de Ambiente

```bash
# Linux/Mac
export $(cat .env.testnet | grep -v '^#' | xargs)

# Ou carregue manualmente antes de cada comando:
source .env.testnet
```

### 3. Verificar Balance

```bash
# Verificar se o deployer tem ETH suficiente
npx hardhat run scripts/check-balance.js --network sepolia
```

Ou verifique manualmente em: https://sepolia.etherscan.io/address/YOUR_DEPLOYER_ADDRESS

## 📦 Deploy dos Contratos

### 1. Executar Deploy

```bash
npm run testnet:deploy
# ou
npx hardhat run scripts/testnet/deploy-sepolia.js --network sepolia
```

**Saída Esperada:**
```
═══════════════════════════════════════════
       EAON Contract Deployment - Sepolia Testnet
═══════════════════════════════════════════

Network: sepolia (Chain ID: 11155111)

Deployer: 0x...
  Balance: 0.789 ETH

Oracle Addresses:
  Oracle 1: 0x...
  Oracle 2: 0x...
  Oracle 3: 0x...

───────────────────────────────────────────
DEPLOYING CONTRACTS
───────────────────────────────────────────

1️⃣  Deploying OracleAggregator...
   ✓ Deployed to: 0x5FbDB...
   View on Etherscan: https://sepolia.etherscan.io/address/0x5FbDB...

2️⃣  Deploying GridValidator...
   ✓ Deployed to: 0x9fE46...

3️⃣  Deploying EnergyTrading...
   ✓ Deployed to: 0xe7f1a...

───────────────────────────────────────────
REGISTERING ORACLES
───────────────────────────────────────────

  ✓ Registered Oracle 1: 0x...
  ✓ Registered Oracle 2: 0x...
  ✓ Registered Oracle 3: 0x...
  ✓ EnergyTrading authorized

═══════════════════════════════════════════
DEPLOYMENT SUCCESSFUL!
═══════════════════════════════════════════
```

### 2. Atualizar .env.testnet

Após o deploy, copie o endereço do `OracleAggregator` e adicione ao `.env.testnet`:

```bash
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### 3. Verificar Contratos no Etherscan (Opcional)

```bash
npm run testnet:verify
# ou
npx hardhat run scripts/testnet/verify-contracts.js --network sepolia
```

## 🧪 Configurar Testes k6 para Testnet

### 1. Configurar Oracles para Testnet

Os oracles precisam ser configurados para apontar para a Sepolia. Você tem três opções:

#### Opção A: Usar Docker com Sepolia (Recomendado)

Esta é a forma mais simples e recomendada se você já está usando Docker:

**1. Criar arquivo `.env.testnet.docker`:**

```bash
# Sepolia RPC Provider
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# Contract Address (do deploy na Sepolia)
CONTRACT_ADDRESS=0xB48f83eecb7Fa564A408555B30c43a167beeD232

# Private Keys (do seu .env.testnet - as mesmas usadas no deploy!)
ORACLE_1_PRIVATE_KEY=0x...
ORACLE_2_PRIVATE_KEY=0x...
ORACLE_3_PRIVATE_KEY=0x...
DEPLOYER_PRIVATE_KEY=0x...
```

**2. Parar containers locais (se estiverem rodando):**

```bash
docker-compose -f docker-compose.k6.yml down
```

**3. Carregar variáveis e iniciar containers para Sepolia:**

```bash
# Carregar variáveis de ambiente
export $(cat .env.testnet.docker | grep -v '^#' | xargs)

# Iniciar containers (sem Hardhat, usando Sepolia)
docker-compose -f docker-compose.k6.testnet.yml up -d
```

**4. Verificar se está funcionando:**

```bash
# Verificar logs dos oracles
docker logs eaon-k6-oracle-1 --tail 20
docker logs eaon-k6-orchestrator --tail 20

# Verificar health
curl http://localhost:4000/health
```

**5. Executar testes k6:**

```bash
k6 run \
  --env BASE_URL=http://localhost:4000 \
  --env HEMS_URL=http://localhost:3000 \
  --env NETWORK=sepolia \
  performance/k6/scripts/eaon-baseline.js
```

**⚠️ IMPORTANTE:**
- Certifique-se de que as carteiras dos oracles têm ETH na Sepolia para pagar gas
- Use as **mesmas chaves privadas** que foram usadas no deploy (elas já estão registradas como oracles)
- O arquivo `docker-compose.k6.testnet.yml` já está configurado com timeouts maiores para testnet

#### Opção B: Executar Oracles Localmente Apontando para Sepolia

Crie um arquivo `.env.testnet.oracles`:

```bash
# Oracle 1
NODE_ID=oracle-1
NODE_TYPE=prosumer
PRIVATE_KEY=0x...  # ORACLE_1_PRIVATE_KEY do .env.testnet
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
HEMS_API_URL=http://localhost:3000
CONTRACT_ADDRESS=0x...  # Endereço do OracleAggregator após deploy
PORT=4001

# Oracle 2
NODE_ID=oracle-2
NODE_TYPE=consumer
PRIVATE_KEY=0x...  # ORACLE_2_PRIVATE_KEY
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
HEMS_API_URL=http://localhost:3000
CONTRACT_ADDRESS=0x...
PORT=4002

# Oracle 3
NODE_ID=oracle-3
NODE_TYPE=dso
PRIVATE_KEY=0x...  # ORACLE_3_PRIVATE_KEY
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
HEMS_API_URL=http://localhost:3000
CONTRACT_ADDRESS=0x...
PORT=4003
```

#### Opção C: Usar Test Orchestrator Apontando para Sepolia

Configure o test-orchestrator para usar a Sepolia:

```bash
# .env.testnet.orchestrator
PORT=4000
DEPLOYER_PRIVATE_KEY=0x...  # DEPLOYER_PRIVATE_KEY do .env.testnet
RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
HEMS_API_URL=http://localhost:3000
CONTRACT_ADDRESS=0x...  # Endereço do OracleAggregator
LOG_LEVEL=info
WAIT_FOR_AGGREGATION_TIMEOUT=60000  # 60s para testnet (mais lento)
POLL_INTERVAL=2000  # 2s entre polls
```

### 2. Iniciar Serviços Locais (apenas para Opções B e C)

Se você escolheu a Opção A (Docker), pode pular esta seção. O Docker já gerencia tudo.

Para as Opções B e C, você precisa do HEMS API rodando localmente:

```bash
# Terminal 1: HEMS API
cd mock-hems
npm start
# ou
npm run hems
```

### 3. Iniciar Oracles (apenas para Opção B)

```bash
# Terminal 2: Oracle 1
cd oracle-nodes
source ../.env.testnet.oracles
NODE_ID=oracle-1 PRIVATE_KEY=$ORACLE_1_PRIVATE_KEY \
  RPC_URL=$SEPOLIA_RPC CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
  npm start

# Terminal 3: Oracle 2
NODE_ID=oracle-2 PRIVATE_KEY=$ORACLE_2_PRIVATE_KEY \
  RPC_URL=$SEPOLIA_RPC CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
  npm start

# Terminal 4: Oracle 3
NODE_ID=oracle-3 PRIVATE_KEY=$ORACLE_3_PRIVATE_KEY \
  RPC_URL=$SEPOLIA_RPC CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
  npm start
```

### 4. Iniciar Test Orchestrator (apenas para Opção C)

```bash
# Terminal 5: Test Orchestrator
cd test-orchestrator
source ../.env.testnet.orchestrator
DEPLOYER_PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY \
  RPC_URL=$SEPOLIA_RPC CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
  npm start
```

## 🎯 Executar Testes k6

### 1. Teste Baseline para Testnet (Recomendado)

**⚠️ IMPORTANTE:** Para testnet, use o teste específico `eaon-baseline-testnet.js` que está otimizado para evitar rate limiting:

```bash
k6 run \
  --env BASE_URL=http://localhost:4000 \
  --env HEMS_URL=http://localhost:3000 \
  --env NETWORK=sepolia \
  performance/k6/scripts/eaon-baseline-testnet.js
```

**Características do teste testnet:**
- ✅ **1 VU** (ao invés de 10) - evita rate limiting do RPC provider
- ✅ **100 iterações** - mesmo volume de testes
- ✅ **Delays maiores** (5-10s entre requisições) - respeita limites do Infura
- ✅ **Timeouts maiores** (120s) - adequado para testnet mais lenta
- ✅ **Thresholds mais tolerantes** - considera latência da testnet

### 2. Teste Baseline Padrão (Não recomendado para testnet)

Se você quiser usar o teste padrão (não recomendado devido ao rate limiting):

```bash
k6 run \
  --env BASE_URL=http://localhost:4000 \
  --env HEMS_URL=http://localhost:3000 \
  --env NETWORK=sepolia \
  performance/k6/scripts/eaon-baseline.js
```

**⚠️ AVISO:** Este teste pode falhar com "Too Many Requests" do Infura devido ao uso de 10 VUs simultâneas.

### 3. Outros Testes (Atenção ao Rate Limiting)

**⚠️ AVISO:** Os testes abaixo usam múltiplos VUs e podem exceder o rate limit do Infura. Considere aguardar alguns minutos entre testes ou usar um provider alternativo (Alchemy, QuickNode).

#### Teste Byzantine Fault

```bash
k6 run \
  --env BASE_URL=http://localhost:4000 \
  --env HEMS_URL=http://localhost:3000 \
  --env NETWORK=sepolia \
  performance/k6/scripts/eaon-byzantine-fault.js
```

#### Teste Crash Fault

```bash
k6 run \
  --env BASE_URL=http://localhost:4000 \
  --env HEMS_URL=http://localhost:3000 \
  --env NETWORK=sepolia \
  performance/k6/scripts/eaon-crash-fault.js
```

### 4. Executar Teste Testnet (Recomendado)

Para testnet, execute apenas o teste otimizado:

```bash
k6 run \
  --env BASE_URL=http://localhost:4000 \
  --env HEMS_URL=http://localhost:3000 \
  --env NETWORK=sepolia \
  performance/k6/scripts/eaon-baseline-testnet.js
```

Este teste é suficiente para validar o funcionamento na testnet e evitar problemas de rate limiting.

### 5. Executar Todos os Testes (Apenas para Local)

**⚠️ NÃO RECOMENDADO para testnet** devido ao rate limiting. Use apenas no ambiente local (Hardhat).

```bash
# Criar script helper (apenas para local)
cat > scripts/k6-local.sh << 'EOF'
#!/bin/bash
export BASE_URL=http://localhost:4000
export HEMS_URL=http://localhost:3000
export NETWORK=local

k6 run --env BASE_URL=$BASE_URL --env HEMS_URL=$HEMS_URL --env NETWORK=$NETWORK \
  performance/k6/scripts/eaon-baseline.js

k6 run --env BASE_URL=$BASE_URL --env HEMS_URL=$HEMS_URL --env NETWORK=$NETWORK \
  performance/k6/scripts/eaon-crash-fault.js

k6 run --env BASE_URL=$BASE_URL --env HEMS_URL=$HEMS_URL --env NETWORK=$NETWORK \
  performance/k6/scripts/eaon-byzantine-fault.js

k6 run --env BASE_URL=$BASE_URL --env HEMS_URL=$HEMS_URL --env NETWORK=$NETWORK \
  performance/k6/scripts/eaon-scalability-5vus.js

k6 run --env BASE_URL=$BASE_URL --env HEMS_URL=$HEMS_URL --env NETWORK=$NETWORK \
  performance/k6/scripts/eaon-scalability-10vus.js

k6 run --env BASE_URL=$BASE_URL --env HEMS_URL=$HEMS_URL --env NETWORK=$NETWORK \
  performance/k6/scripts/eaon-scalability-20vus.js

k6 run --env BASE_URL=$BASE_URL --env HEMS_URL=$HEMS_URL --env NETWORK=$NETWORK \
  performance/k6/scripts/eaon-stress.js
EOF

chmod +x scripts/k6-local.sh
./scripts/k6-local.sh
```

## 📊 Diferenças: Local vs Testnet

| Aspecto | Local (Hardhat) | Sepolia Testnet |
|---------|----------------|-----------------|
| Block Time | ~1 segundo | ~12 segundos |
| Gas Price | Fixo | Variável (10-30 gwei) |
| Confirmação | Imediata | 1-3 blocos (~12-36s) |
| Custo | Gratuito | Requer ETH de teste |
| Latência | Baixa | Maior (RPC remoto) |
| Timeout | 30s | 60s+ recomendado |

## ⚠️ Ajustes Necessários para Testnet

### 1. Aumentar Timeouts

Os testes k6 podem precisar de timeouts maiores para testnet:

```javascript
// Nos scripts k6, ajuste timeouts:
const params = {
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: '120s'  // Aumentado de 60s para 120s
};
```

### 2. Aumentar Delays entre Iterações

```javascript
sleep(5);  // Aumentar de 2s para 5s entre iterações
```

### 3. Reduzir Número de Iterações

Para testnet, considere reduzir ainda mais as iterações:

- Baseline: 50 iterações (ao invés de 100)
- Outros testes: 20 iterações (ao invés de 30)

## 🔍 Monitoramento

### Durante os Testes

1. **Etherscan**: Acompanhe transações em tempo real
   - https://sepolia.etherscan.io/address/YOUR_DEPLOYER_ADDRESS

2. **Gas Tracker**: Monitore gas price
   - https://sepolia.etherscan.io/gastracker

3. **Logs dos Oracles**: Verifique se estão respondendo

### Verificar Status dos Contratos

```bash
# Usando cast (foundry)
cast call CONTRACT_ADDRESS "getActiveOracleCount()" --rpc-url $SEPOLIA_RPC
```

## 🛠️ Troubleshooting

### "Insufficient funds for gas"

**Solução:** Obtenha mais ETH dos faucets

### "Nonce too low"

**Solução:** Aguarde transações pendentes confirmarem ou aumente gas price

### Timeout nas requisições

**Solução:**
1. Aumente timeout para 120s
2. Aumente `WAIT_FOR_AGGREGATION_TIMEOUT` para 90000 (90s)
3. Verifique se RPC está respondendo

### Oracles não respondem

**Solução:**
1. Verifique se oracles estão rodando
2. Verifique se `CONTRACT_ADDRESS` está correto
3. Verifique se oracles têm ETH para gas
4. Verifique logs dos oracles

## 📝 Checklist Completo

- [ ] Obter ETH de teste (0.5-1 ETH)
- [ ] Configurar RPC provider (Infura/Alchemy)
- [ ] Obter Etherscan API key
- [ ] Criar `.env.testnet` com todas as chaves
- [ ] Verificar balance do deployer
- [ ] Executar deploy: `npm run testnet:deploy`
- [ ] Atualizar `CONTRACT_ADDRESS` no `.env.testnet`
- [ ] (Opcional) Verificar contratos: `npm run testnet:verify`
- [ ] Iniciar HEMS API localmente
- [ ] Iniciar oracles apontando para Sepolia
- [ ] Iniciar test-orchestrator apontando para Sepolia
- [ ] Executar testes k6
- [ ] Analisar resultados

## 📁 Organização dos Resultados dos Testes

### Estrutura de Diretórios

Os resultados dos testes são organizados de forma separada para facilitar a comparação entre ambientes:

```
results/
├── local/
│   ├── k6/                    # Resultados k6 (Hardhat local)
│   │   ├── baseline-results.json
│   │   ├── baseline-report.html
│   │   ├── baseline-table.txt
│   │   ├── crash-fault-results.json
│   │   ├── byzantine-fault-results.json
│   │   └── ...
│   └── hardhat/               # Resultados Hardhat gas reporter
│       └── gas-report.txt
└── testnet/
    └── sepolia/
        ├── k6/                # Resultados k6 (Sepolia testnet)
        │   ├── baseline-results.json
        │   ├── baseline-report.html
        │   └── baseline-table.txt
        └── performance-results.json  # Resultados do script standalone
```

### Como os Dados São Separados

#### 1. Testes Locais (Hardhat)

**Onde são salvos:** `results/local/k6/`

**Testes que salvam aqui:**
- `eaon-baseline.js`
- `eaon-crash-fault.js`
- `eaon-byzantine-fault.js`
- `eaon-scalability-*.js`
- `eaon-stress.js`

**Como identificar:** Todos os testes k6 padrão (exceto `-testnet.js`) salvam em `local/k6/`

#### 2. Testes Testnet (Sepolia) - k6

**Onde são salvos:** `results/testnet/sepolia/k6/`

**Testes que salvam aqui:**
- `eaon-baseline-testnet.js` (único teste k6 específico para testnet)

**Como identificar:** Teste com sufixo `-testnet.js` detecta `NETWORK=sepolia` e salva em `testnet/sepolia/k6/`

#### 3. Testes Testnet (Sepolia) - Standalone

**Onde são salvos:** `results/testnet/sepolia/performance-results.json`

**Script que salva aqui:**
- `scripts/testnet/performance-test.js`

**Como usar:**
```bash
NUM_TRANSACTIONS=100 DELAY_BETWEEN_TX_MS=10000 \
  node scripts/testnet/performance-test.js
```

### Consolidação de Métricas

Para comparar resultados de diferentes fontes, use o script de consolidação:

```bash
node scripts/analysis/consolidate-metrics.js
```

**O que ele faz:**
1. Lê `results/local/k6/baseline-results.json` (k6 local)
2. Lê `results/testnet/sepolia/performance-results.json` (testnet standalone)
3. Lê `results/local/hardhat/S6-taxonomy-metrics.json` (gas reporter)
4. Gera `results/consolidated-metrics.json` com comparação

### Identificando Resultados

Cada arquivo JSON contém metadados que identificam a origem:

```json
{
  "metadata": {
    "timestamp": "2026-01-05T18:30:00.000Z",
    "network": "sepolia",  // ou "localhost"
    "chainId": 11155111,   // ou 31337 (Hardhat)
    "testType": "baseline"
  },
  "metrics": { ... }
}
```

### Boas Práticas

1. **Sempre especifique NETWORK:** Use `--env NETWORK=sepolia` para testnet
2. **Mantenha estrutura:** Não modifique a estrutura de diretórios
3. **Versionamento:** Considere adicionar timestamps ou tags nos nomes de arquivos para múltiplas execuções
4. **Backup:** Antes de novas execuções, faça backup dos resultados anteriores se necessário

## 🎯 Próximos Passos

1. ✅ Deploy na Sepolia
2. ✅ Executar testes k6
3. 📊 Comparar resultados local vs testnet
4. 📝 Gerar tabelas para o paper
5. 🎓 Documentar diferenças encontradas

---

**Dúvidas?** Consulte a documentação em `scripts/testnet/README.md` ou abra uma issue.

