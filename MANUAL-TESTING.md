# Guia de Teste Manual - EAON

Este guia mostra como subir a aplicação manualmente e testar com Postman.

## 🚀 Ordem de Startup

### 1️⃣ Terminal 1: Hardhat Node (Blockchain)
```bash
npm run node
```
**Aguarde:** `Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/`

### 2️⃣ Terminal 2: Deploy dos Contratos
```bash
npm run deploy:local
```

**Importante:** O deploy agora mostra as private keys corretas:
```
Oracle 1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
Oracle 2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
  Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
Oracle 3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
  Private Key: 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
```

As private keys também são salvas em `deployments/localhost.json`.

### 3️⃣ Terminal 3: Mock HEMS API
```bash
npm run hems
```
**Aguarde:** `Server running on port 3000`

### 4️⃣ Terminal 4: Oracle Node 1
```bash
npm run oracle:1
```

### 5️⃣ Terminal 5: Oracle Node 2 (opcional)
```bash
npm run oracle:2
```

### 6️⃣ Terminal 6: Oracle Node 3 (opcional)
```bash
npm run oracle:3
```

## 🧪 Coleção Postman - Testes Básicos

### Health Checks

**Mock HEMS**
```
GET http://localhost:3000/health
```

**Oracle 1**
```
GET http://localhost:4001/health
```
Deve retornar `"connected": true`

**Oracle 2**
```
GET http://localhost:4002/health
```

**Oracle 3**
```
GET http://localhost:4003/health
```

### Testar Mock HEMS

**Ler medidor METER001**
```
GET http://localhost:3000/smartmeter/METER001/reading
```

**Status de todos os medidores**
```
GET http://localhost:3000/admin/status
```

### Simular Falhas

**Tornar METER001 malicioso (10x valor)**
```
POST http://localhost:3000/admin/malicious/METER001
```

**Resetar para honesto**
```
POST http://localhost:3000/admin/honest/METER001
```

**Simular falha**
```
POST http://localhost:3000/admin/fail/METER001
```

**Recuperar medidor**
```
POST http://localhost:3000/admin/recover/METER001
```

**Adicionar delay de 3 segundos**
```
POST http://localhost:3000/admin/delay/METER001/3000
```

### Métricas dos Oracles

**Oracle 1 Metrics**
```
GET http://localhost:4001/metrics
```

**Oracle 2 Metrics**
```
GET http://localhost:4002/metrics
```

## 🔧 Testar Fluxo Completo via Hardhat Console

Abra um novo terminal:

```bash
npx hardhat console --network localhost
```

Execute no console:

```javascript
// Carregar deployment info
const deployment = require('./deployments/localhost.json');

// Conectar ao contrato OracleAggregator
const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
const contract = OracleAggregator.attach(deployment.contracts.OracleAggregator);

// Verificar oracles registrados
const activeCount = await contract.getActiveOracleCount();
console.log("Active oracles:", activeCount.toString());

// Verificar info de cada oracle
const oracle1Address = deployment.oracles.oracle1.address;
const oracle1Info = await contract.getOracleInfo(oracle1Address);
console.log("Oracle 1 Info:", {
    address: oracle1Info.nodeAddress,
    reputation: oracle1Info.reputation.toString(),
    isActive: oracle1Info.isActive,
    totalResponses: oracle1Info.totalResponses.toString()
});

// Fazer requisição de dados
console.log("\nSending data request for METER001...");
const tx = await contract.requestData("METER001");
const receipt = await tx.wait();
console.log("✓ Request sent! Transaction:", receipt.hash);

// Pegar o requestId do evento
const requestId = receipt.logs[0].args.requestId;
console.log("Request ID:", requestId.toString());

// Aguardar alguns segundos e verificar o resultado
console.log("\nWait 5 seconds for oracles to respond...");
await new Promise(resolve => setTimeout(resolve, 5000));

// Verificar resultado
const request = await contract.getRequest(requestId);
console.log("\nRequest Status:", {
    id: request.id.toString(),
    meterId: request.meterId,
    status: request.status, // 0=PENDING, 1=AGGREGATING, 2=COMPLETED
    responseCount: request.responseCount.toString(),
    aggregatedValue: request.aggregatedValue.toString()
});
```

## 🐛 Troubleshooting

### Oracles não conectam ao contrato

**Problema:** `"connected": false` no health check

**Solução:**
1. Verifique se o Hardhat node está rodando (Terminal 1)
2. Confirme que o deploy foi executado (Terminal 2)
3. Verifique se `deployments/localhost.json` existe e tem o endereço do contrato

### Oracles não respondem

**Problema:** Requests ficam com `status: 0` (PENDING)

**Possíveis causas:**
1. **Oracles não registrados:** Execute o deploy novamente
2. **Private keys incorretas:** Verifique se está usando as chaves corretas do `.env`
3. **HEMS API offline:** Verifique se `npm run hems` está rodando

**Como verificar:**
```javascript
// No Hardhat console
const oracle1 = await contract.getOracleInfo("ENDEREÇO_DO_ORACLE_1");
console.log("Is Active:", oracle1.isActive);
```

### Erro ao submeter resposta

**Problema:** `Error: Only registered oracles can submit responses`

**Solução:** As private keys no `.env` devem corresponder aos endereços registrados no deploy.

Verifique no output do deploy:
```
Oracle 1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  Private Key: 0x59c6995e...
```

E confirme que `ORACLE_1_PRIVATE_KEY` no `.env` é a mesma.

## 📊 Verificando Logs

### Logs do Hardhat (Terminal 1)
Mostra todas as transações blockchain:
- `registerOracle()`
- `requestData()`
- `submitResponse()`

### Logs dos Oracles (Terminais 4-6)
Mostram:
- Conexão com blockchain
- Eventos `DataRequested` recebidos
- Fetching de dados do HEMS
- Submissão de respostas

### Logs do HEMS (Terminal 3)
Mostram:
- Requests recebidos dos oracles
- Status dos medidores

## ✅ Teste de Sucesso

Um fluxo completo bem-sucedido deve mostrar:

1. **No Hardhat Console:**
   ```
   Request ID: 1
   Request Status: { status: 2, responseCount: 2, aggregatedValue: "5023" }
   ```

2. **Nos Logs dos Oracles:**
   ```
   [oracle-1] Received DataRequested event: requestId=1, meterId=METER001
   [oracle-1] Fetched value: 5023
   [oracle-1] Response submitted successfully
   ```

3. **No Terminal do Hardhat:**
   ```
   eth_sendTransaction
   Contract call: submitResponse
   ```

## 🎯 Próximos Passos

Depois de confirmar que o fluxo manual funciona:

1. Execute os testes automatizados: `npm test`
2. Execute os testes de cenários: `npm run test:scenarios`
3. Execute testes de performance: `npm run perf:baseline`
