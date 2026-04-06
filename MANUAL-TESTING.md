# Manual Testing Guide — EAON Fullstack

This guide covers the manual startup sequence and verification procedures for the full EAON stack, including the blockchain layer, oracle nodes, mock HEMS API, and the Next.js frontend dashboard.

## Startup Sequence

### Option A: Docker (Recommended)

Starts all services in the correct order with one command:

```bash
npm run docker:up
```

Wait ~30 seconds for all services to be ready, then visit **http://localhost:3001**.

To view logs:
```bash
npm run docker:logs
```

To stop:
```bash
npm run docker:down
```

### Option B: Manual (Terminal per Service)

Use this when you need to observe individual service logs or test specific components.

#### Terminal 1 — Hardhat Node (Blockchain)
```bash
npm run node
```
Wait for: `Started HTTP and WebSocket JSON-RPC server at http://127.0.0.1:8545/`

#### Terminal 2 — Deploy Contracts
```bash
npm run deploy:local
```

The deploy script outputs the registered oracle addresses and their private keys:
```
Oracle 1: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
  Private Key: 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
Oracle 2: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
  Private Key: 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
Oracle 3: 0x90F79bf6EB2c4f870365E785982E1f101E93b906
  Private Key: 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
```

These keys are also saved to `deployments/localhost.json`. Copy them into your `.env` file before starting the oracle nodes.

#### Terminal 3 — Mock HEMS API
```bash
npm run hems
```
Wait for: `Server running on port 3000`

#### Terminal 4 — Oracle Node 1
```bash
npm run oracle:1
```

#### Terminal 5 — Oracle Node 2
```bash
npm run oracle:2
```

#### Terminal 6 — Oracle Node 3
```bash
npm run oracle:3
```

#### Terminal 7 — Frontend Dashboard
```bash
npm run frontend:dev
```
Wait for: `Ready in Xms` — then visit **http://localhost:3001**

---

## Frontend Dashboard

After startup, the dashboard is accessible at **http://localhost:3001**. The UI is available in English and Portuguese (use the language selector in the header).

| Page | Path | What to Verify |
|------|------|----------------|
| Dashboard | `/dashboard` | Oracle count, active trades, recent activity feed |
| Auctions | `/auctions` | List of Dutch auctions with price decay status |
| Auction Detail | `/auctions/:id` | Price decay chart, bid functionality |
| Marketplace | `/marketplace` | Open energy buy/sell offers |
| Oracle Health | `/oracle-health` | Per-oracle reputation score and response rate |
| Prosumer | `/prosumer` | Prosumer account balances and open positions |
| Completed Trades | `/completed-trades` | Settled trade history |
| History | `/history` | Full transaction history |

A healthy system should show:
- 3 active oracles on the Oracle Health page
- No error banners in the dashboard
- Auction list populated after a deploy (if test auctions were created)

---

## API Health Checks

Use these endpoints to verify individual services are up.

**Mock HEMS**
```
GET http://localhost:3000/health
```

**Oracle Nodes**
```
GET http://localhost:4001/health
GET http://localhost:4002/health
GET http://localhost:4003/health
```
Expected: `"connected": true`

**Oracle Metrics**
```
GET http://localhost:4001/metrics
GET http://localhost:4002/metrics
GET http://localhost:4003/metrics
```

---

## Mock HEMS — Injecting Fault Behavior

These admin endpoints allow simulating different failure scenarios for testing.

**Read a meter**
```
GET http://localhost:3000/smartmeter/METER001/reading
```

**Status of all meters**
```
GET http://localhost:3000/admin/status
```

**Simulate Byzantine fault (meter returns 10x inflated value)**
```
POST http://localhost:3000/admin/malicious/METER001
```

**Reset meter to honest**
```
POST http://localhost:3000/admin/honest/METER001
```

**Simulate crash fault**
```
POST http://localhost:3000/admin/fail/METER001
```

**Recover meter**
```
POST http://localhost:3000/admin/recover/METER001
```

**Add latency (milliseconds)**
```
POST http://localhost:3000/admin/delay/METER001/3000
```

---

## Full Flow Verification via Hardhat Console

```bash
npx hardhat console --network localhost
```

```javascript
const deployment = require('./deployments/localhost.json');

const OracleAggregator = await ethers.getContractFactory("OracleAggregator");
const contract = OracleAggregator.attach(deployment.contracts.OracleAggregator);

// Verify registered oracles
const activeCount = await contract.getActiveOracleCount();
console.log("Active oracles:", activeCount.toString());

// Inspect oracle 1
const oracle1Address = deployment.oracles.oracle1.address;
const oracle1Info = await contract.getOracleInfo(oracle1Address);
console.log("Oracle 1:", {
    reputation: oracle1Info.reputation.toString(),
    isActive: oracle1Info.isActive,
    totalResponses: oracle1Info.totalResponses.toString()
});

// Send a data request
const tx = await contract.requestData("METER001");
const receipt = await tx.wait();
const requestId = receipt.logs[0].args.requestId;
console.log("Request ID:", requestId.toString());

// Wait for oracle responses
await new Promise(resolve => setTimeout(resolve, 5000));

// Check result
const request = await contract.getRequest(requestId);
console.log("Result:", {
    status: request.status,       // 0=PENDING, 1=AGGREGATING, 2=COMPLETED
    responseCount: request.responseCount.toString(),
    aggregatedValue: request.aggregatedValue.toString()
});
```

---

## Troubleshooting

### Oracles show `"connected": false`

1. Confirm the Hardhat node is running on port 8545
2. Confirm `npm run deploy:local` completed successfully
3. Check that `deployments/localhost.json` exists and contains contract addresses
4. Verify that `ORACLE_N_PRIVATE_KEY` values in `.env` match the keys printed by the deploy script

### Requests stay in PENDING (status: 0)

- **Oracles not registered:** Re-run `npm run deploy:local`
- **Wrong private keys:** Keys in `.env` must match those registered during deploy
- **HEMS offline:** Verify `npm run hems` is running and responding on port 3000

### `Only registered oracles can submit responses` error

The private keys in `.env` do not match the oracle addresses registered on-chain. Re-deploy or update the keys to match the deploy output.

### Frontend shows blank data or connection errors

- Confirm the Hardhat node is running and contracts are deployed
- In Docker mode, check `NEXT_PUBLIC_RPC_URL` points to the correct host (`http://hardhat-node:8545` in Docker, `http://localhost:8545` for local dev)
- Check browser console for RPC connection errors

---

## Success Indicators

A correctly running system shows:

1. **Hardhat console:**
   ```
   Request ID: 1
   Result: { status: 2, responseCount: 2, aggregatedValue: "5023" }
   ```

2. **Oracle logs:**
   ```
   [oracle-1] Received DataRequested event: requestId=1, meterId=METER001
   [oracle-1] Fetched value: 5023
   [oracle-1] Response submitted successfully
   ```

3. **Frontend dashboard:** 3 active oracles, no error banners, activity feed updating

---

## Next Steps

After confirming the manual flow works:

1. Run automated tests: `npm test`
2. Run scenario tests: `npm run test:scenarios`
3. Run performance tests: `npm run k6:setup && npm run k6:all`
