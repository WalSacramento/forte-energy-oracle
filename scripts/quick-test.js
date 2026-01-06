#!/usr/bin/env node
/**
 * Quick Test Script
 * Testa o sistema EAON via Docker rapidamente
 *
 * Uso:
 *   node scripts/quick-test.js
 *
 * Pré-requisitos:
 *   1. docker-compose up -d
 *   2. npm run deploy:local
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// Configuração
const RPC_URL = "http://localhost:8545";
const DEPLOYER_PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

// Cores para console
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m"
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testHealthEndpoint(url, name) {
  try {
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      log(`✓ ${name} - OK`, "green");
      return true;
    } else {
      log(`✗ ${name} - HTTP ${response.status}`, "red");
      return false;
    }
  } catch (error) {
    log(`✗ ${name} - ${error.message}`, "red");
    return false;
  }
}

async function testSmartMeter(meterId) {
  try {
    const url = `http://localhost:3000/smartmeter/${meterId}/reading`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      log(`✓ ${meterId}: ${data.value} kWh`, "green");
      return true;
    } else {
      log(`✗ ${meterId} - HTTP ${response.status}`, "red");
      return false;
    }
  } catch (error) {
    log(`✗ ${meterId} - ${error.message}`, "red");
    return false;
  }
}

async function testOracleRequest() {
  try {
    // Carregar deployment info
    const deploymentPath = path.join(__dirname, "../deployments/localhost.json");
    if (!fs.existsSync(deploymentPath)) {
      log("✗ Deployment file not found. Run 'npm run deploy:local' first!", "red");
      return false;
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));

    // Conectar ao provider
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Conectar wallet deployer
    const deployer = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

    // Carregar ABI
    const artifactPath = path.join(__dirname, "../artifacts/contracts/OracleAggregator.sol/OracleAggregator.json");
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

    // Conectar ao contrato
    const contract = new ethers.Contract(
      deployment.contracts.OracleAggregator,
      artifact.abi,
      deployer
    );

    // Verificar oracles ativos
    log("\n📊 Checking active oracles...", "cyan");
    const activeCount = await contract.getActiveOracleCount();
    log(`   Active oracles: ${activeCount.toString()}`, "blue");

    if (activeCount < 2n) {
      log("✗ Not enough oracles registered (minimum 2 required)", "red");
      return false;
    }

    // Fazer requisição
    log("\n📤 Sending data request for METER001...", "cyan");
    const tx = await contract.requestData("METER001");
    log(`   Transaction hash: ${tx.hash}`, "blue");

    const receipt = await tx.wait();
    log("✓ Transaction confirmed!", "green");

    // Extrair requestId do evento
    const event = receipt.logs.find(log => {
      try {
        return contract.interface.parseLog(log).name === 'DataRequested';
      } catch {
        return false;
      }
    });

    if (!event) {
      log("✗ DataRequested event not found", "red");
      return false;
    }

    const requestId = contract.interface.parseLog(event).args.requestId;
    log(`   Request ID: ${requestId.toString()}`, "blue");

    // Aguardar oracles responderem
    log("\n⏳ Waiting 5 seconds for oracles to respond...", "yellow");
    await sleep(5000);

    // Verificar resultado
    const request = await contract.getRequest(requestId);

    log("\n📊 Request Result:", "cyan");
    log(`   Meter ID: ${request.meterId}`, "blue");
    log(`   Status: ${request.status} (${getStatusName(request.status)})`, "blue");
    log(`   Response Count: ${request.responseCount.toString()}`, "blue");
    log(`   Aggregated Value: ${request.aggregatedValue.toString()} kWh`, "blue");

    if (request.status === 2n) { // COMPLETED
      log("✓ Request completed successfully!", "green");
      return true;
    } else if (request.status === 1n) { // AGGREGATING
      log("⚠ Request still aggregating (needs more responses)", "yellow");
      return false;
    } else {
      log("✗ Request still pending (no oracle responses)", "red");
      return false;
    }

  } catch (error) {
    log(`✗ Oracle request failed: ${error.message}`, "red");
    console.error(error);
    return false;
  }
}

function getStatusName(status) {
  const statuses = ['PENDING', 'AGGREGATING', 'COMPLETED'];
  return statuses[Number(status)] || 'UNKNOWN';
}

async function main() {
  console.log("═".repeat(70));
  log("       EAON Quick Test - Docker Environment", "cyan");
  console.log("═".repeat(70));
  console.log("");

  let passed = 0;
  let failed = 0;

  // 1. Health Checks
  log("1️⃣  Health Checks", "cyan");
  console.log("─".repeat(70));

  if (await testHealthEndpoint("http://localhost:3000/health", "HEMS API")) passed++; else failed++;
  if (await testHealthEndpoint("http://localhost:4001/health", "Oracle 1")) passed++; else failed++;
  if (await testHealthEndpoint("http://localhost:4002/health", "Oracle 2")) passed++; else failed++;
  if (await testHealthEndpoint("http://localhost:4003/health", "Oracle 3")) passed++; else failed++;

  // 2. Smart Meters
  log("\n2️⃣  Smart Meter Readings", "cyan");
  console.log("─".repeat(70));

  if (await testSmartMeter("METER001")) passed++; else failed++;
  if (await testSmartMeter("METER002")) passed++; else failed++;
  if (await testSmartMeter("METER003")) passed++; else failed++;

  // 3. Oracle Request Flow
  log("\n3️⃣  Oracle Request Flow", "cyan");
  console.log("─".repeat(70));

  if (await testOracleRequest()) {
    passed++;
  } else {
    failed++;
  }

  // Summary
  console.log("\n" + "═".repeat(70));
  log("SUMMARY", "cyan");
  console.log("═".repeat(70));

  const total = passed + failed;
  log(`Passed: ${passed}/${total}`, passed === total ? "green" : "yellow");
  if (failed > 0) {
    log(`Failed: ${failed}/${total}`, "red");
  }

  if (passed === total) {
    log("\n🎉 All tests passed! System is working correctly.", "green");
    process.exit(0);
  } else {
    log("\n⚠️  Some tests failed. Check the errors above.", "yellow");
    log("\nTroubleshooting:", "cyan");
    log("  1. Make sure Docker containers are running: docker-compose ps", "blue");
    log("  2. Deploy contracts: npm run deploy:local", "blue");
    log("  3. Check logs: docker-compose logs", "blue");
    process.exit(1);
  }
}

main().catch(error => {
  log(`\n❌ Test execution failed: ${error.message}`, "red");
  console.error(error);
  process.exit(1);
});
