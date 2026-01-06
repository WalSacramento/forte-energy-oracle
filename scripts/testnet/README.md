# EAON Testnet Performance Testing - Sepolia

Guia completo para deployment e testes de performance na Sepolia testnet.

## 📋 Pré-requisitos

### 1. Obter ETH de Teste (Sepolia)

Você precisará de aproximadamente **0.5 ETH** no total para:
- Deployment dos 3 contratos: ~0.3 ETH
- Testes de performance: ~0.2 ETH (100 transações)

**Faucets Recomendados:**
- [Sepolia Faucet](https://sepoliafaucet.com/) - 0.5 ETH/dia
- [QuickNode Faucet](https://faucet.quicknode.com/ethereum/sepolia) - 0.05 ETH
- [Alchemy Faucet](https://www.alchemy.com/faucets/ethereum-sepolia) - 0.1 ETH

**Dica:** Use múltiplos faucets para obter o valor necessário mais rapidamente.

### 2. Configurar RPC Provider

Escolha um provider para acessar a Sepolia testnet:

**Opção A: Infura (Recomendado)**
1. Crie conta em [infura.io](https://infura.io)
2. Crie novo projeto
3. Copie o endpoint Sepolia: `https://sepolia.infura.io/v3/YOUR_PROJECT_ID`

**Opção B: Alchemy**
1. Crie conta em [alchemy.com](https://alchemy.com)
2. Crie novo app (escolha Sepolia)
3. Copie o HTTPS URL

### 3. Obter API Keys

**Etherscan API** (para verificação de contratos):
1. Acesse [etherscan.io/apis](https://etherscan.io/apis)
2. Registre-se e crie API key gratuita
3. Copie o API key

**CoinMarketCap API** (opcional, para gas reporter):
1. Acesse [coinmarketcap.com/api](https://coinmarketcap.com/api/)
2. Registre-se no plano gratuito
3. Copie o API key

## 🚀 Setup

### 1. Configurar Variáveis de Ambiente

Copie o template e edite com suas chaves:

```bash
cp .env.example .env.testnet
```

Edite `.env.testnet`:

```bash
# Sepolia RPC (substitua YOUR_PROJECT_ID)
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# Private Keys (⚠️ USE APENAS CONTAS DE TESTE!)
# Crie 4 novas carteiras para testnet
DEPLOYER_PRIVATE_KEY=0x...
ORACLE_1_PRIVATE_KEY=0x...
ORACLE_2_PRIVATE_KEY=0x...
ORACLE_3_PRIVATE_KEY=0x...

# Etherscan API Key
ETHERSCAN_API_KEY=YOUR_ETHERSCAN_KEY

# Optional: CoinMarketCap API
COINMARKETCAP_API_KEY=YOUR_CMC_KEY
REPORT_GAS=true

# Test Configuration
NUM_TRANSACTIONS=100
DELAY_BETWEEN_TX_MS=5000
```

**⚠️ IMPORTANTE:**
- **NUNCA** use carteiras com fundos reais!
- **NUNCA** faça commit do arquivo `.env.testnet`!
- Crie carteiras novas exclusivamente para teste

### 2. Carregar Variáveis

```bash
source .env.testnet

# Ou no Windows (PowerShell):
Get-Content .env.testnet | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]*)\s*=\s*(.*)\s*$') {
    [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
  }
}
```

### 3. Verificar Balance

```bash
# Usando cast (foundry)
cast balance YOUR_DEPLOYER_ADDRESS --rpc-url $SEPOLIA_RPC

# Ou verifique manualmente em:
# https://sepolia.etherscan.io/address/YOUR_ADDRESS
```

## 📦 Deployment

### 1. Deploy Contratos

```bash
npx hardhat run scripts/testnet/deploy-sepolia.js --network sepolia
```

**Saída Esperada:**
```
═══════════════════════════════════════════════════════════════════
       EAON Contract Deployment - Sepolia Testnet
═══════════════════════════════════════════════════════════════════

Network: sepolia (Chain ID: 11155111)

Deployer: 0x...
  Balance: 0.789 ETH

Oracle Addresses:
  Oracle 1: 0x...
  Oracle 2: 0x...
  Oracle 3: 0x...

Contract Configuration:
  Min Responses: 2
  Outlier Threshold: 10%
  Request Deadline: 30s

──────────────────────────────────────────────────────────────────
DEPLOYING CONTRACTS
──────────────────────────────────────────────────────────────────

1️⃣  Deploying OracleAggregator...
   ✓ Deployed to: 0x5FbDB...
   View on Etherscan: https://sepolia.etherscan.io/address/0x5FbDB...

2️⃣  Deploying GridValidator...
   ✓ Deployed to: 0x9fE46...
   View on Etherscan: https://sepolia.etherscan.io/address/0x9fE46...

3️⃣  Deploying EnergyTrading...
   ✓ Deployed to: 0xe7f1a...
   View on Etherscan: https://sepolia.etherscan.io/address/0xe7f1a...

──────────────────────────────────────────────────────────────────
REGISTERING ORACLES
──────────────────────────────────────────────────────────────────

  ✓ Registered Oracle 1: 0x...
  ✓ Registered Oracle 2: 0x...
  ✓ Registered Oracle 3: 0x...
  ✓ EnergyTrading authorized

═══════════════════════════════════════════════════════════════════
DEPLOYMENT SUCCESSFUL!
═══════════════════════════════════════════════════════════════════
```

**Importante:** Salve o `CONTRACT_ADDRESS` (OracleAggregator) retornado!

### 2. Atualizar .env.testnet

```bash
# Adicione o endereço do OracleAggregator em .env.testnet
CONTRACT_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### 3. Verificar Contratos no Etherscan

```bash
npx hardhat run scripts/testnet/verify-contracts.js --network sepolia
```

**Saída Esperada:**
```
═══════════════════════════════════════════════════════════════════
       Contract Verification - Sepolia Testnet
═══════════════════════════════════════════════════════════════════

Loaded deployment from: deployments/sepolia-deployment.json

──────────────────────────────────────────────────────────────────
VERIFYING CONTRACTS
──────────────────────────────────────────────────────────────────

Verifying OracleAggregator at 0x5FbDB...
  ✓ OracleAggregator verified successfully
    View at: https://sepolia.etherscan.io/address/0x5FbDB...#code

Verifying GridValidator at 0x9fE46...
  ✓ GridValidator verified successfully
    View at: https://sepolia.etherscan.io/address/0x9fE46...#code

Verifying EnergyTrading at 0xe7f1a...
  ✓ EnergyTrading verified successfully
    View at: https://sepolia.etherscan.io/address/0xe7f1a...#code

═══════════════════════════════════════════════════════════════════
VERIFICATION SUMMARY
═══════════════════════════════════════════════════════════════════

Verified 3/3 contracts:
  ✓ OracleAggregator: Verified
  ✓ GridValidator: Verified
  ✓ EnergyTrading: Verified

🎉 All contracts verified successfully!
```

Agora os contratos estarão visíveis com código-fonte no Etherscan!

## 🧪 Testes de Performance

### Teste Rápido (100 transações)

Recomendado para validação inicial:

```bash
NUM_TRANSACTIONS=100 DELAY_BETWEEN_TX_MS=3000 \
  node scripts/testnet/performance-test.js
```

**Tempo estimado:** ~5-8 minutos
**Custo estimado:** ~0.15 ETH

### Teste Completo (10,000 transações)

Seguindo a metodologia do paper:

```bash
NUM_TRANSACTIONS=10000 DELAY_BETWEEN_TX_MS=5000 \
  node scripts/testnet/performance-test.js
```

**⚠️ ATENÇÃO:**
- **Tempo estimado:** ~14 horas
- **Custo estimado:** ~15 ETH
- Execute apenas se tiver fundos suficientes!

**Recomendação:** Execute o teste rápido primeiro para validar que tudo funciona.

## 📊 Análise de Resultados

Os resultados são salvos em `results/testnet/sepolia/performance-results.json`:

```json
{
  "metadata": {
    "network": "sepolia",
    "chainId": 11155111,
    "timestamp": "2026-01-03T10:30:45.123Z"
  },
  "metrics": {
    "applicationLevel": {
      "errorRate": 0,
      "accuracy": 100,
      "availability": 100
    },
    "networkLevel": {
      "latency": { "avg": 1245.5, "p95": 2100 },
      "throughput": 0.2,
      "responseTime": { "avg": 15230, "p95": 18500 },
      "consensusTime": { "avg": 8500 }
    },
    "computingLevel": {
      "gasConsumption": { "avg": 675000, "total": 67500000 }
    }
  },
  "rawData": {
    "transactions": [...],
    "errors": [...]
  }
}
```

### Gerar Tabela LaTeX para Paper

```bash
python3 scripts/analysis/generate-latex-table.py \
  results/testnet/sepolia/performance-results.json \
  results/local/k6/baseline-results.json
```

Isso irá gerar `results/paper-table.tex` com tabelas comparando testnet vs local.

## 🔍 Monitoramento

### Durante os Testes

O script imprime progresso em tempo real:

```
[5.0%] TX 5/100 - Latency: 12450ms, Gas: 675000
[10.0%] TX 10/100 - Latency: 15230ms, Gas: 680000
...
```

### Etherscan

Acompanhe suas transações em:
- https://sepolia.etherscan.io/address/YOUR_DEPLOYER_ADDRESS

### Gas Price

Monitore gas price atual:
- https://sepolia.etherscan.io/gastracker

## 🛠️ Troubleshooting

### "Insufficient funds for gas"

**Causa:** Conta sem ETH suficiente

**Solução:**
```bash
# Verifique balance
cast balance YOUR_ADDRESS --rpc-url $SEPOLIA_RPC

# Obtenha mais ETH dos faucets
```

### "Nonce too low" ou "Replacement transaction underpriced"

**Causa:** Transação pendente com mesmo nonce

**Solução:**
```bash
# Aguarde a transação pendente confirmar (veja no Etherscan)
# Ou aumente o gas price no hardhat.config.js:
#   gasPrice: 25000000000, // 25 gwei
```

### "Contract already verified"

**Causa:** Contrato já foi verificado anteriormente

**Solução:** Isso é normal! Ignore a mensagem.

### Timeout nas requisições

**Causa:** Rede congestionada ou oracles não respondendo

**Solução:**
1. Aguarde alguns minutos
2. Verifique se CONTRACT_ADDRESS está correto
3. Aumente DELAY_BETWEEN_TX_MS para 10000 (10s)

### Gas usage muito alto

**Esperado:** ~675k gas por ciclo completo (request + 3 oracle responses + aggregation)

**Breakdown:**
- `requestData()`: ~100k gas
- `submitResponse()` x3: ~450k gas
- Aggregation: ~75k gas
- Storage: ~50k gas

## 📚 Referências

- [Sepolia Testnet Info](https://sepolia.dev/)
- [Etherscan Sepolia](https://sepolia.etherscan.io/)
- [Hardhat Documentation](https://hardhat.org/hardhat-runner/docs/guides/deploying)
- [EAON Architecture](/docs/architecture.md)

## 🎯 Próximos Passos

1. ✅ Deploy e verificação dos contratos
2. ✅ Teste rápido (100 transações)
3. 📊 Analisar resultados
4. 📝 Gerar tabelas para paper
5. 🎓 (Opcional) Teste completo (10,000 transações)

## ⚠️ Notas Importantes

- Sepolia é uma testnet **permanente**, diferente de Goerli/Rinkeby (deprecated)
- ETH de teste **não tem valor real**
- Block time: ~12 segundos (vs 1s no Hardhat local)
- Gas price típico: 10-30 gwei
- Transações confirmam em 1-3 blocos (~12-36 segundos)

---

**Dúvidas?** Consulte a [documentação principal](/README.md) ou abra uma issue.
