# 🐳 Docker Setup para Sepolia Testnet

Este guia explica como usar Docker para executar os testes k6 na Sepolia testnet.

## 📋 Pré-requisitos

1. ✅ Contratos deployados na Sepolia (veja `GUIA-DEPLOY-SEPOLIA.md`)
2. ✅ Arquivo `.env.testnet` configurado com as chaves privadas
3. ✅ Docker e Docker Compose instalados

## 🚀 Configuração Rápida

### 1. Criar arquivo `.env.testnet.docker`

Crie um arquivo `.env.testnet.docker` na raiz do projeto:

```bash
# Sepolia RPC Provider
SEPOLIA_RPC=https://sepolia.infura.io/v3/YOUR_PROJECT_ID

# Contract Address (do deploy na Sepolia)
# Este é o endereço do OracleAggregator
CONTRACT_ADDRESS=0xB48f83eecb7Fa564A408555B30c43a167beeD232

# Private Keys (do seu .env.testnet)
# ⚠️ IMPORTANTE: Use as MESMAS chaves que foram usadas no deploy!
# Essas são as chaves das carteiras que foram registradas como oracles
ORACLE_1_PRIVATE_KEY=0x...
ORACLE_2_PRIVATE_KEY=0x...
ORACLE_3_PRIVATE_KEY=0x...

# Deployer Private Key (do seu .env.testnet)
DEPLOYER_PRIVATE_KEY=0x...
```

**⚠️ IMPORTANTE:**
- Use as **mesmas chaves privadas** que foram usadas no deploy
- Essas carteiras já estão registradas como oracles no contrato
- Certifique-se de que as carteiras têm ETH na Sepolia para pagar gas

### 2. Parar containers locais (se estiverem rodando)

```bash
docker-compose -f docker-compose.k6.yml down
```

### 3. Carregar variáveis e iniciar containers

```bash
# Carregar variáveis de ambiente
export $(cat .env.testnet.docker | grep -v '^#' | xargs)

# Iniciar containers para Sepolia
docker-compose -f docker-compose.k6.testnet.yml up -d
```

### 4. Verificar se está funcionando

```bash
# Verificar status dos containers
docker ps

# Verificar logs dos oracles
docker logs eaon-k6-oracle-1 --tail 20
docker logs eaon-k6-oracle-2 --tail 20
docker logs eaon-k6-oracle-3 --tail 20

# Verificar test-orchestrator
docker logs eaon-k6-orchestrator --tail 20

# Verificar health endpoint
curl http://localhost:4000/health
```

Você deve ver algo como:
```json
{"status":"healthy","service":"eaon-test-orchestrator"}
```

## 🧪 Executar Testes k6

**⚠️ IMPORTANTE:** Para testnet, use o teste específico `eaon-baseline-testnet.js` que está otimizado para evitar rate limiting do RPC provider:

```bash
# Teste Baseline para Testnet (Recomendado)
k6 run \
  --env BASE_URL=http://localhost:4000 \
  --env HEMS_URL=http://localhost:3000 \
  --env NETWORK=sepolia \
  performance/k6/scripts/eaon-baseline-testnet.js
```

**Características do teste testnet:**
- ✅ **1 VU** (ao invés de 10) - evita rate limiting
- ✅ **100 iterações** - mesmo volume de testes
- ✅ **Delays maiores** (5-10s) - respeita limites do Infura
- ✅ **Timeouts maiores** (120s) - adequado para testnet

**⚠️ AVISO:** Os outros testes (crash-fault, byzantine-fault, etc.) usam múltiplos VUs e podem exceder o rate limit do Infura. Use apenas no ambiente local (Hardhat).

## 🔍 Diferenças: Local vs Sepolia

| Aspecto | Docker Local | Docker Sepolia |
|---------|--------------|----------------|
| Arquivo | `docker-compose.k6.yml` | `docker-compose.k6.testnet.yml` |
| Blockchain | Hardhat local | Sepolia testnet |
| RPC URL | `http://hardhat:8545` | `${SEPOLIA_RPC}` |
| Block Time | ~1 segundo | ~12 segundos |
| Timeout | 30s | 90s |
| Gas | Gratuito | Requer ETH de teste |
| Contratos | Deploy local | Deploy na Sepolia |

## 🛠️ Troubleshooting

### "Insufficient funds for gas"

**Solução:** As carteiras dos oracles precisam de ETH na Sepolia. Obtenha mais ETH dos faucets:
- https://sepoliafaucet.com/
- https://faucet.quicknode.com/ethereum/sepolia

### "Oracle not registered"

**Solução:** Certifique-se de usar as **mesmas chaves privadas** que foram usadas no deploy. Essas carteiras já estão registradas no contrato.

### Containers não iniciam

**Solução:**
1. Verifique se as variáveis de ambiente estão carregadas:
   ```bash
   echo $SEPOLIA_RPC
   echo $CONTRACT_ADDRESS
   ```

2. Verifique os logs:
   ```bash
   docker-compose -f docker-compose.k6.testnet.yml logs
   ```

### Timeout nas requisições

**Solução:** Sepolia é mais lenta que local. Os timeouts já estão configurados para 90s no `docker-compose.k6.testnet.yml`. Se ainda tiver problemas, você pode aumentar:
- `WAIT_FOR_AGGREGATION_TIMEOUT: 120000` (120s)

## 📝 Voltar para Local

Para voltar a usar o ambiente local:

```bash
# Parar containers da testnet
docker-compose -f docker-compose.k6.testnet.yml down

# Iniciar containers locais
docker-compose -f docker-compose.k6.yml up -d
```

## 🎯 Próximos Passos

1. ✅ Configurar `.env.testnet.docker`
2. ✅ Iniciar containers
3. ✅ Executar testes k6
4. 📊 Analisar resultados
5. 📝 Comparar com resultados locais

---

**Dúvidas?** Consulte `GUIA-DEPLOY-SEPOLIA.md` para mais informações.

