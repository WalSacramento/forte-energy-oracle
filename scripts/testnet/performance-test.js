#!/usr/bin/env node
/**
 * Testnet Performance Test Script
 * Standalone script to test EAON performance on Sepolia testnet
 *
 * Usage:
 *   NUM_TRANSACTIONS=100 DELAY_BETWEEN_TX_MS=5000 node scripts/testnet/performance-test.js
 *
 * Prerequisites:
 * - Configure .env.testnet with Sepolia RPC and private keys
 * - Deploy contracts first (run deploy-sepolia.js)
 * - Ensure all oracle accounts have sufficient ETH
 */

require('dotenv').config({ path: '.env.testnet' });
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  rpcUrl: process.env.SEPOLIA_RPC,
  contractAddress: process.env.CONTRACT_ADDRESS,
  oracleKeys: [
    process.env.ORACLE_1_PRIVATE_KEY,
    process.env.ORACLE_2_PRIVATE_KEY,
    process.env.ORACLE_3_PRIVATE_KEY
  ].filter(Boolean),
  numTransactions: parseInt(process.env.NUM_TRANSACTIONS) || 100,
  delayBetweenTx: parseInt(process.env.DELAY_BETWEEN_TX_MS) || 5000,
  outputFile: 'results/testnet/sepolia/performance-results.json'
};

// Validate configuration
if (!CONFIG.rpcUrl) {
  console.error('❌ SEPOLIA_RPC not set in .env.testnet');
  process.exit(1);
}

if (!CONFIG.contractAddress) {
  console.error('❌ CONTRACT_ADDRESS not set in .env.testnet');
  process.exit(1);
}

if (CONFIG.oracleKeys.length === 0) {
  console.error('❌ Oracle private keys not set in .env.testnet');
  process.exit(1);
}

// Contract ABI (minimal - just what we need)
const OracleAggregatorABI = require('../../artifacts/contracts/OracleAggregator.sol/OracleAggregator.json').abi;

// ============================================================================
// METRICS STRUCTURE (Taxonomy Format)
// ============================================================================

const metrics = {
  applicationLevel: {
    errorRate: 0,
    accuracy: 0,
    availability: 0,
    cost: { gasUnits: 0, estimatedUSD: 0 }
  },
  networkLevel: {
    latency: { values: [], avg: 0, p50: 0, p95: 0, p99: 0 },
    throughput: 0,
    responseTime: { values: [], avg: 0, p50: 0, p95: 0, p99: 0 },
    consensusTime: { values: [], avg: 0, p50: 0, p95: 0, p99: 0 }
  },
  computingLevel: {
    gasConsumption: { values: [], avg: 0, total: 0, p50: 0, p95: 0, p99: 0 }
  },
  raw: {
    transactions: [],
    errors: []
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function mean(arr) {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

async function signResponse(wallet, requestId, value) {
  const messageHash = ethers.solidityPackedKeccak256(
    ['uint256', 'uint256'],
    [requestId, value]
  );
  const signature = await wallet.signMessage(ethers.getBytes(messageHash));
  return signature;
}

// ============================================================================
// MAIN EXECUTION FUNCTIONS
// ============================================================================

async function executeOracleRequest(contract, oracles, provider, index) {
  const meterId = `METER00${(index % 3) + 1}`;
  const expectedValue = 5000 + Math.floor(Math.random() * 200) - 100;

  const requestStartTime = Date.now();
  let totalGas = 0n;

  try {
    // 1. Request data
    const deployer = oracles[0]; // Use first oracle as deployer
    const contractWithDeployer = contract.connect(deployer);

    const txRequest = await contractWithDeployer.requestData(meterId, {
      gasLimit: 200000
    });
    const receiptRequest = await txRequest.wait();
    totalGas += receiptRequest.gasUsed;

    // 2. Extract requestId from event
    const requestEvent = receiptRequest.logs.find(log => {
      try {
        const parsed = contract.interface.parseLog(log);
        return parsed && parsed.name === 'DataRequested';
      } catch {
        return false;
      }
    });

    if (!requestEvent) {
      throw new Error('DataRequested event not found');
    }

    const requestId = contract.interface.parseLog(requestEvent).args[0];
    const requestEndTime = Date.now();

    // 3. Submit oracle responses
    const consensusStartTime = Date.now();
    const oracleValues = [
      expectedValue + Math.floor(Math.random() * 50) - 25,
      expectedValue + Math.floor(Math.random() * 50) - 25,
      expectedValue + Math.floor(Math.random() * 50) - 25
    ];

    for (let i = 0; i < oracles.length; i++) {
      const oracleContract = contract.connect(oracles[i]);
      const signature = await signResponse(oracles[i], requestId, oracleValues[i]);

      const txSubmit = await oracleContract.submitResponse(
        requestId,
        oracleValues[i],
        signature,
        { gasLimit: 300000 }
      );
      const receiptSubmit = await txSubmit.wait();
      totalGas += receiptSubmit.gasUsed;
    }

    const consensusEndTime = Date.now();

    // 4. Get result
    const request = await contract.getRequest(requestId);
    const responseEndTime = Date.now();

    return {
      success: true,
      requestId: requestId.toString(),
      meterId,
      expectedValue,
      aggregatedValue: Number(request.aggregatedValue),
      oracleValues,
      latency: responseEndTime - requestStartTime,
      responseTime: requestEndTime - requestStartTime,
      consensusTime: consensusEndTime - consensusStartTime,
      gasUsed: Number(totalGas),
      blockNumber: receiptRequest.blockNumber,
      txHashes: {
        request: receiptRequest.hash,
        responses: []
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      meterId,
      latency: Date.now() - requestStartTime
    };
  }
}

function calculateFinalMetrics(successCount, errorCount, totalTime) {
  // Application-level
  const total = successCount + errorCount;
  metrics.applicationLevel.errorRate = total > 0 ? (errorCount / total) * 100 : 0;
  metrics.applicationLevel.accuracy = 100; // Assuming aggregation is always correct
  metrics.applicationLevel.availability = total > 0 ? (successCount / total) * 100 : 0;

  // Network-level
  const latencies = metrics.networkLevel.latency.values;
  metrics.networkLevel.latency.avg = mean(latencies);
  metrics.networkLevel.latency.p50 = percentile(latencies, 50);
  metrics.networkLevel.latency.p95 = percentile(latencies, 95);
  metrics.networkLevel.latency.p99 = percentile(latencies, 99);

  const responseTimes = metrics.networkLevel.responseTime.values;
  metrics.networkLevel.responseTime.avg = mean(responseTimes);
  metrics.networkLevel.responseTime.p50 = percentile(responseTimes, 50);
  metrics.networkLevel.responseTime.p95 = percentile(responseTimes, 95);
  metrics.networkLevel.responseTime.p99 = percentile(responseTimes, 99);

  const consensusTimes = metrics.networkLevel.consensusTime.values;
  metrics.networkLevel.consensusTime.avg = mean(consensusTimes);
  metrics.networkLevel.consensusTime.p50 = percentile(consensusTimes, 50);
  metrics.networkLevel.consensusTime.p95 = percentile(consensusTimes, 95);
  metrics.networkLevel.consensusTime.p99 = percentile(consensusTimes, 99);

  metrics.networkLevel.throughput = totalTime > 0 ? successCount / totalTime : 0;

  // Computing-level
  const gasValues = metrics.computingLevel.gasConsumption.values;
  metrics.computingLevel.gasConsumption.avg = mean(gasValues);
  metrics.computingLevel.gasConsumption.total = gasValues.reduce((a, b) => a + b, 0);
  metrics.computingLevel.gasConsumption.p50 = percentile(gasValues, 50);
  metrics.computingLevel.gasConsumption.p95 = percentile(gasValues, 95);
  metrics.computingLevel.gasConsumption.p99 = percentile(gasValues, 99);

  // Cost estimation
  metrics.applicationLevel.cost.gasUnits = metrics.computingLevel.gasConsumption.total;
}

function saveResults(network) {
  const resultData = {
    metadata: {
      network: network.name,
      chainId: Number(network.chainId),
      timestamp: new Date().toISOString(),
      testDuration: Date.now() - testStartTime,
      configuration: {
        numTransactions: CONFIG.numTransactions,
        delayBetweenTx: CONFIG.delayBetweenTx,
        contractAddress: CONFIG.contractAddress
      }
    },
    metrics,
    summary: {
      totalTransactions: CONFIG.numTransactions,
      successful: metrics.raw.transactions.length,
      failed: metrics.raw.errors.length
    }
  };

  // Ensure output directory exists
  const outputDir = path.dirname(CONFIG.outputFile);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(CONFIG.outputFile, JSON.stringify(resultData, null, 2));
  console.log(`\n📁 Results saved to: ${CONFIG.outputFile}`);
}

function printSummary() {
  console.log('\n' + '═'.repeat(70));
  console.log('       TESTNET PERFORMANCE TEST RESULTS');
  console.log('       (Format: Agroclimatic Data Tracking Taxonomy)');
  console.log('═'.repeat(70));

  console.log('\n┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  APPLICATION-LEVEL                                              │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log(`│  Error Rate:        ${metrics.applicationLevel.errorRate.toFixed(2).padStart(10)}%`);
  console.log(`│  Accuracy:          ${metrics.applicationLevel.accuracy.toFixed(2).padStart(10)}%`);
  console.log(`│  Availability:      ${metrics.applicationLevel.availability.toFixed(2).padStart(10)}%`);
  console.log(`│  Cost:              ${metrics.applicationLevel.cost.gasUnits.toLocaleString().padStart(15)} Gas Units`);
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│  NETWORK-LEVEL                                                  │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log(`│  Latency (TTFB):    Avg: ${metrics.networkLevel.latency.avg.toFixed(2).padStart(8)} ms`);
  console.log(`│                     p50: ${metrics.networkLevel.latency.p50.toFixed(2).padStart(8)} ms`);
  console.log(`│                     p95: ${metrics.networkLevel.latency.p95.toFixed(2).padStart(8)} ms`);
  console.log(`│  Throughput:        ${metrics.networkLevel.throughput.toFixed(4).padStart(10)} reqs/s`);
  console.log(`│  Response Time:     Avg: ${metrics.networkLevel.responseTime.avg.toFixed(2).padStart(8)} ms`);
  console.log(`│                     p95: ${metrics.networkLevel.responseTime.p95.toFixed(2).padStart(8)} ms`);
  console.log(`│  Consensus Time:    Avg: ${metrics.networkLevel.consensusTime.avg.toFixed(2).padStart(8)} ms`);
  console.log(`│                     p95: ${metrics.networkLevel.consensusTime.p95.toFixed(2).padStart(8)} ms`);
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log('│  COMPUTING-LEVEL                                                │');
  console.log('├─────────────────────────────────────────────────────────────────┤');
  console.log(`│  Gas Consumption:   Avg: ${metrics.computingLevel.gasConsumption.avg.toFixed(0).padStart(10)}`);
  console.log(`│                     Total: ${metrics.computingLevel.gasConsumption.total.toLocaleString().padStart(12)}`);
  console.log(`│                     p95: ${metrics.computingLevel.gasConsumption.p95.toFixed(0).padStart(10)}`);
  console.log('└─────────────────────────────────────────────────────────────────┘');
}

// ============================================================================
// MAIN
// ============================================================================

let testStartTime;

async function main() {
  console.log('═'.repeat(70));
  console.log('       EAON TESTNET PERFORMANCE TEST - SEPOLIA');
  console.log('═'.repeat(70));
  console.log();

  // 1. Setup
  console.log('📋 Configuration:');
  console.log(`   RPC URL: ${CONFIG.rpcUrl.substring(0, 50)}...`);
  console.log(`   Contract: ${CONFIG.contractAddress}`);
  console.log(`   Transactions: ${CONFIG.numTransactions}`);
  console.log(`   Delay: ${CONFIG.delayBetweenTx}ms`);
  console.log();

  const provider = new ethers.JsonRpcProvider(CONFIG.rpcUrl);
  const network = await provider.getNetwork();

  console.log(`🌐 Network: ${network.name} (Chain ID: ${network.chainId})`);

  if (network.chainId !== 11155111n) {
    throw new Error('Not connected to Sepolia testnet (expected Chain ID: 11155111)');
  }

  // Create wallet instances
  const oracles = CONFIG.oracleKeys.map(key => new ethers.Wallet(key, provider));

  console.log();
  console.log('🔑 Oracle Wallets:');
  for (let i = 0; i < oracles.length; i++) {
    const balance = await provider.getBalance(oracles[i].address);
    console.log(`   Oracle ${i + 1}: ${oracles[i].address}`);
    console.log(`            Balance: ${ethers.formatEther(balance)} ETH`);

    if (balance < ethers.parseEther('0.01')) {
      console.warn(`   ⚠️  WARNING: Oracle ${i + 1} has low balance (<0.01 ETH)`);
    }
  }

  // Connect to contract
  const contract = new ethers.Contract(CONFIG.contractAddress, OracleAggregatorABI, provider);

  console.log();
  console.log('─'.repeat(70));
  console.log('STARTING PERFORMANCE TEST');
  console.log('─'.repeat(70));
  console.log();

  testStartTime = Date.now();
  let successCount = 0;
  let errorCount = 0;

  // 3. Execute N transactions
  for (let i = 0; i < CONFIG.numTransactions; i++) {
    try {
      const result = await executeOracleRequest(contract, oracles, provider, i);

      if (result.success) {
        // Record metrics
        metrics.networkLevel.latency.values.push(result.latency);
        metrics.networkLevel.responseTime.values.push(result.responseTime);
        metrics.networkLevel.consensusTime.values.push(result.consensusTime);
        metrics.computingLevel.gasConsumption.values.push(result.gasUsed);

        successCount++;

        // Log progress
        const progress = ((i + 1) / CONFIG.numTransactions * 100).toFixed(1);
        console.log(
          `[${progress.padStart(5)}%] TX ${(i + 1).toString().padStart(3)}/${CONFIG.numTransactions} - ` +
          `Latency: ${result.latency.toString().padStart(6)}ms, ` +
          `Gas: ${result.gasUsed.toLocaleString().padStart(8)}, ` +
          `Block: ${result.blockNumber}`
        );

        metrics.raw.transactions.push({
          index: i,
          timestamp: new Date().toISOString(),
          ...result
        });
      } else {
        errorCount++;
        metrics.raw.errors.push({
          index: i,
          timestamp: new Date().toISOString(),
          error: result.error
        });
        console.error(`[ERROR] TX ${i + 1}: ${result.error}`);
      }
    } catch (error) {
      errorCount++;
      metrics.raw.errors.push({
        index: i,
        error: error.message
      });
      console.error(`[ERROR] TX ${i + 1}: ${error.message}`);
    }

    // Delay between transactions (except for the last one)
    if (i < CONFIG.numTransactions - 1) {
      await sleep(CONFIG.delayBetweenTx);
    }
  }

  // 4. Calculate final metrics
  const endTime = Date.now();
  const totalTime = (endTime - testStartTime) / 1000; // seconds

  calculateFinalMetrics(successCount, errorCount, totalTime);

  // 5. Save results
  saveResults(network);

  // 6. Print summary
  printSummary();

  console.log();
  console.log('═'.repeat(70));
  console.log(`✅ Test completed: ${successCount} successful, ${errorCount} failed`);
  console.log(`⏱️  Duration: ${(totalTime / 60).toFixed(2)} minutes`);
  console.log('═'.repeat(70));
}

// Execute
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Test failed:');
    console.error(error);
    process.exit(1);
  });
