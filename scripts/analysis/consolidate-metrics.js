/**
 * Consolidate Metrics Script
 * Consolidates metrics from multiple sources (k6, hardhat, testnet)
 * into a single JSON in the Agroclimatic taxonomy format
 *
 * Usage:
 *   node scripts/analysis/consolidate-metrics.js
 *
 * Sources:
 *   - k6: results/local/k6/baseline-results.json
 *   - testnet: results/testnet/sepolia/performance-results.json
 *   - hardhat: results/local/hardhat/S6-taxonomy-metrics.json
 */

const fs = require('fs');
const path = require('path');

/**
 * Load JSON file
 * @param {string} filepath - Path to JSON file
 * @returns {Object} Parsed JSON data
 */
function loadJSON(filepath) {
  try {
    if (!fs.existsSync(filepath)) {
      console.warn(`⚠️  File not found: ${filepath}`);
      return null;
    }
    return JSON.parse(fs.readFileSync(filepath, 'utf8'));
  } catch (error) {
    console.error(`Error loading ${filepath}:`, error.message);
    return null;
  }
}

/**
 * Extract Application-level metrics from k6 data
 */
function extractK6Application(k6Data) {
  const m = k6Data.metrics;

  return {
    errorRate: (m.app_error_rate?.values?.rate || 0) * 100,
    accuracy: (m.app_accuracy?.values?.rate || 0) * 100,
    availability: (m.app_availability?.values?.rate || 0) * 100,
    outlierDetectionRate: (m.app_outlier_detection_rate?.values?.rate || 0) * 100,
    cost: {
      gasUnits: 0 // Not available in k6 summary
    }
  };
}

/**
 * Extract Network-level metrics from k6 data
 */
function extractK6Network(k6Data) {
  const m = k6Data.metrics;

  return {
    latency: {
      avg: m.net_latency_ttfb?.values?.avg || 0,
      p50: m.net_latency_ttfb?.values?.['p(50)'] || 0,
      p95: m.net_latency_ttfb?.values?.['p(95)'] || 0,
      p99: m.net_latency_ttfb?.values?.['p(99)'] || 0
    },
    throughput: m.http_reqs?.values?.rate || 0,
    responseTime: {
      avg: m.net_response_time?.values?.avg || 0,
      p95: m.net_response_time?.values?.['p(95)'] || 0
    },
    consensusTime: {
      avg: m.net_consensus_time?.values?.avg || 0,
      p95: m.net_consensus_time?.values?.['p(95)'] || 0
    }
  };
}

/**
 * Extract Computing-level metrics from k6 data
 */
function extractK6Computing(k6Data) {
  const m = k6Data.metrics;

  return {
    gasConsumption: {
      avg: m.comp_gas_used?.values?.avg || 0,
      p50: m.comp_gas_used?.values?.['p(50)'] || 0,
      p95: m.comp_gas_used?.values?.['p(95)'] || 0,
      p99: m.comp_gas_used?.values?.['p(99)'] || 0,
      total: (m.comp_gas_used?.values?.avg || 0) * (m.http_reqs?.values?.count || 0)
    },
    scalability: {
      maxVUs: m.vus_max?.values?.max || 0,
      testedVUs: m.vus?.values?.value || 0
    }
  };
}

/**
 * Calculate percentage difference between two values
 */
function percentageDiff(value1, value2) {
  if (value1 === 0 && value2 === 0) return 0;
  if (value1 === 0) return 100;
  return ((value2 - value1) / value1) * 100;
}

/**
 * Calculate comparison metrics between local and testnet
 */
function calculateComparisons(local, testnet) {
  if (!local || !testnet) {
    return null;
  }

  return {
    availability: {
      local: local.availability,
      testnet: testnet.availability,
      delta: testnet.availability - local.availability,
      percentChange: percentageDiff(local.availability, testnet.availability)
    },
    responseTime: {
      local: local.responseTime?.avg || 0,
      testnet: testnet.responseTime?.avg || 0,
      delta: (testnet.responseTime?.avg || 0) - (local.responseTime?.avg || 0),
      percentChange: percentageDiff(local.responseTime?.avg || 0, testnet.responseTime?.avg || 0)
    },
    throughput: {
      local: local.throughput || 0,
      testnet: testnet.throughput || 0,
      delta: (testnet.throughput || 0) - (local.throughput || 0),
      percentChange: percentageDiff(local.throughput || 0, testnet.throughput || 0)
    },
    gasConsumption: {
      local: local.gasConsumption?.avg || 0,
      testnet: testnet.gasConsumption?.avg || 0,
      delta: (testnet.gasConsumption?.avg || 0) - (local.gasConsumption?.avg || 0),
      percentChange: percentageDiff(local.gasConsumption?.avg || 0, testnet.gasConsumption?.avg || 0)
    }
  };
}

/**
 * Consolidate metrics from multiple sources
 * @param {Array} sources - Array of {type, filepath} objects
 * @returns {Object} Consolidated metrics
 */
function consolidateMetrics(sources) {
  const consolidated = {
    metadata: {
      timestamp: new Date().toISOString(),
      sources: [],
      generatedBy: 'consolidate-metrics.js'
    },
    applicationLevel: {},
    networkLevel: {},
    computingLevel: {},
    comparison: null
  };

  // Load and process each source
  for (const source of sources) {
    const data = loadJSON(source.filepath);

    if (!data) {
      console.log(`⏭️  Skipping ${source.type} (file not found)`);
      continue;
    }

    consolidated.metadata.sources.push({
      type: source.type,
      filepath: source.filepath,
      loadedAt: new Date().toISOString()
    });

    if (source.type === 'k6') {
      console.log('✓ Processing k6 metrics...');
      consolidated.applicationLevel.k6 = extractK6Application(data);
      consolidated.networkLevel.k6 = extractK6Network(data);
      consolidated.computingLevel.k6 = extractK6Computing(data);
    }

    if (source.type === 'testnet') {
      console.log('✓ Processing testnet metrics...');
      const metrics = data.metrics;
      consolidated.applicationLevel.testnet = metrics.applicationLevel;
      consolidated.networkLevel.testnet = metrics.networkLevel;
      consolidated.computingLevel.testnet = metrics.computingLevel;
    }

    if (source.type === 'hardhat') {
      console.log('✓ Processing hardhat metrics...');
      const metrics = data.metrics;
      consolidated.applicationLevel.hardhat = metrics.applicationLevel;
      consolidated.networkLevel.hardhat = metrics.networkLevel;
      consolidated.computingLevel.hardhat = metrics.computingLevel;
    }
  }

  // Calculate comparisons if both k6 and testnet data are available
  if (consolidated.applicationLevel.k6 && consolidated.applicationLevel.testnet) {
    console.log('✓ Calculating comparisons (local vs testnet)...');
    consolidated.comparison = {
      applicationLevel: calculateComparisons(
        consolidated.applicationLevel.k6,
        consolidated.applicationLevel.testnet
      ),
      networkLevel: calculateComparisons(
        consolidated.networkLevel.k6,
        consolidated.networkLevel.testnet
      ),
      computingLevel: calculateComparisons(
        consolidated.computingLevel.k6,
        consolidated.computingLevel.testnet
      )
    };
  }

  return consolidated;
}

/**
 * Print summary of consolidated metrics
 */
function printSummary(consolidated) {
  console.log('\n' + '═'.repeat(70));
  console.log('                CONSOLIDATED METRICS SUMMARY');
  console.log('═'.repeat(70));

  console.log('\n📊 Data Sources:');
  consolidated.metadata.sources.forEach(source => {
    console.log(`  ✓ ${source.type}: ${source.filepath}`);
  });

  // Application Level Summary
  console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
  console.log('│  APPLICATION-LEVEL METRICS                                          │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');

  if (consolidated.applicationLevel.k6) {
    const k6 = consolidated.applicationLevel.k6;
    console.log('│  Local (k6):                                                        │');
    console.log(`│    Error Rate:        ${k6.errorRate.toFixed(2)}%`);
    console.log(`│    Accuracy:          ${k6.accuracy.toFixed(2)}%`);
    console.log(`│    Availability:      ${k6.availability.toFixed(2)}%`);
    console.log(`│    Outlier Detection: ${k6.outlierDetectionRate.toFixed(2)}%`);
  }

  if (consolidated.applicationLevel.testnet) {
    const testnet = consolidated.applicationLevel.testnet;
    console.log('│                                                                     │');
    console.log('│  Testnet (Sepolia):                                                 │');
    console.log(`│    Error Rate:        ${testnet.errorRate.toFixed(2)}%`);
    console.log(`│    Accuracy:          ${testnet.accuracy.toFixed(2)}%`);
    console.log(`│    Availability:      ${testnet.availability.toFixed(2)}%`);
  }

  // Network Level Summary
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log('│  NETWORK-LEVEL METRICS                                              │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');

  if (consolidated.networkLevel.k6) {
    const k6 = consolidated.networkLevel.k6;
    console.log('│  Local (k6):                                                        │');
    console.log(`│    Latency (avg):     ${k6.latency.avg.toFixed(2)} ms`);
    console.log(`│    Throughput:        ${k6.throughput.toFixed(2)} reqs/s`);
    console.log(`│    Response Time p95: ${k6.responseTime.p95.toFixed(2)} ms`);
    console.log(`│    Consensus Time:    ${k6.consensusTime.avg.toFixed(2)} ms`);
  }

  if (consolidated.networkLevel.testnet) {
    const testnet = consolidated.networkLevel.testnet;
    console.log('│                                                                     │');
    console.log('│  Testnet (Sepolia):                                                 │');
    console.log(`│    Latency (avg):     ${testnet.latency.avg.toFixed(2)} ms`);
    console.log(`│    Throughput:        ${testnet.throughput.toFixed(4)} reqs/s`);
    console.log(`│    Response Time p95: ${testnet.responseTime.p95.toFixed(2)} ms`);
    console.log(`│    Consensus Time:    ${testnet.consensusTime.avg.toFixed(2)} ms`);
  }

  // Computing Level Summary
  console.log('├─────────────────────────────────────────────────────────────────────┤');
  console.log('│  COMPUTING-LEVEL METRICS                                            │');
  console.log('├─────────────────────────────────────────────────────────────────────┤');

  if (consolidated.computingLevel.k6) {
    const k6 = consolidated.computingLevel.k6;
    console.log('│  Local (k6):                                                        │');
    console.log(`│    Gas (avg):         ${k6.gasConsumption.avg.toFixed(0)}`);
    console.log(`│    Gas (total):       ${k6.gasConsumption.total.toFixed(0)}`);
    console.log(`│    Max VUs:           ${k6.scalability.maxVUs}`);
  }

  if (consolidated.computingLevel.testnet) {
    const testnet = consolidated.computingLevel.testnet;
    console.log('│                                                                     │');
    console.log('│  Testnet (Sepolia):                                                 │');
    console.log(`│    Gas (avg):         ${testnet.gasConsumption.avg.toFixed(0)}`);
    console.log(`│    Gas (total):       ${testnet.gasConsumption.total.toFixed(0)}`);
  }

  console.log('└─────────────────────────────────────────────────────────────────────┘');

  // Comparison Summary
  if (consolidated.comparison) {
    console.log('\n┌─────────────────────────────────────────────────────────────────────┐');
    console.log('│  LOCAL vs TESTNET COMPARISON                                        │');
    console.log('├─────────────────────────────────────────────────────────────────────┤');

    const cmp = consolidated.comparison;

    if (cmp.applicationLevel?.availability) {
      const avail = cmp.applicationLevel.availability;
      const sign = avail.delta >= 0 ? '+' : '';
      console.log(`│  Availability Delta:  ${sign}${avail.delta.toFixed(2)}% (${sign}${avail.percentChange.toFixed(1)}%)`);
    }

    if (cmp.networkLevel?.responseTime) {
      const resp = cmp.networkLevel.responseTime;
      const sign = resp.delta >= 0 ? '+' : '';
      console.log(`│  Response Time Delta: ${sign}${resp.delta.toFixed(2)} ms (${sign}${resp.percentChange.toFixed(1)}%)`);
    }

    if (cmp.networkLevel?.throughput) {
      const tput = cmp.networkLevel.throughput;
      const sign = tput.delta >= 0 ? '+' : '';
      console.log(`│  Throughput Delta:    ${sign}${tput.delta.toFixed(2)} reqs/s (${sign}${tput.percentChange.toFixed(1)}%)`);
    }

    if (cmp.computingLevel?.gasConsumption) {
      const gas = cmp.computingLevel.gasConsumption;
      const sign = gas.delta >= 0 ? '+' : '';
      console.log(`│  Gas Delta:           ${sign}${gas.delta.toFixed(0)} (${sign}${gas.percentChange.toFixed(1)}%)`);
    }

    console.log('└─────────────────────────────────────────────────────────────────────┘');
  }

  console.log('');
}

/**
 * Main execution function
 */
function main() {
  console.log('═'.repeat(70));
  console.log('       Metrics Consolidation - EAON Performance Analysis');
  console.log('═'.repeat(70));
  console.log('');

  // Define sources
  const sources = [
    {
      type: 'k6',
      filepath: path.join(__dirname, '../../results/local/k6/baseline-results.json')
    },
    {
      type: 'testnet',
      filepath: path.join(__dirname, '../../results/testnet/sepolia/performance-results.json')
    },
    {
      type: 'hardhat',
      filepath: path.join(__dirname, '../../results/local/hardhat/S6-taxonomy-metrics.json')
    }
  ];

  // Consolidate metrics
  const consolidated = consolidateMetrics(sources);

  // Save consolidated results
  const outputPath = path.join(__dirname, '../../results/consolidated-metrics.json');
  const outputDir = path.dirname(outputPath);

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(consolidated, null, 2));
  console.log(`\n📁 Consolidated metrics saved to: ${outputPath}`);

  // Print summary
  printSummary(consolidated);

  console.log('═'.repeat(70));
  console.log('✅ Consolidation complete!');
  console.log('═'.repeat(70));
  console.log('');
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for use as module
module.exports = {
  consolidateMetrics,
  extractK6Application,
  extractK6Network,
  extractK6Computing,
  calculateComparisons
};
