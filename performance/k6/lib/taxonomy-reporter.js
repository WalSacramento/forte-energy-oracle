/**
 * Generates a taxonomy-formatted table from k6 summary data
 * @param {Object} data - k6 summary data
 * @returns {string} Formatted ASCII table
 */
export function generateTaxonomyTable(data) {
  const metrics = data.metrics || {};

  // Extract values
  const errorRate = (metrics.app_error_rate?.values?.rate || 0) * 100;
  const accuracy = (metrics.app_accuracy?.values?.rate || 0) * 100;
  const availability = (metrics.app_availability?.values?.rate || 0) * 100;
  const outlierRate = (metrics.app_outlier_detection_rate?.values?.rate || 0) * 100;

  const latencyAvg = metrics.net_latency_ttfb?.values?.avg || 0;
  const latencyP95 = metrics.net_latency_ttfb?.values?.['p(95)'] || 0;

  const throughput = metrics.http_reqs?.values?.rate || 0;

  const responseAvg = metrics.net_response_time?.values?.avg || 0;
  const responseP95 = metrics.net_response_time?.values?.['p(95)'] || 0;

  const consensusAvg = metrics.net_consensus_time?.values?.avg || 0;
  const consensusP95 = metrics.net_consensus_time?.values?.['p(95)'] || 0;

  const gasAvg = metrics.comp_gas_used?.values?.avg || 0;
  const gasP95 = metrics.comp_gas_used?.values?.['p(95)'] || 0;

  const vusMax = metrics.vus_max?.values?.max || 0;
  const iterations = metrics.iterations?.values?.count || 0;
  const duration = data.state?.testRunDurationMs || 0;

  // Build table
  const table = `
┌─────────────────────────────────────────────────────────────────────────────┐
│          EAON Performance Test Results (Taxonomy Format)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Category          │ Metric                     │ Value                     │
├────────────────────┼────────────────────────────┼───────────────────────────┤
│  Application       │ Error Rate                 │ ${errorRate.toFixed(2).padStart(10)}%            │
│  Level             │ Accuracy                   │ ${accuracy.toFixed(2).padStart(10)}%            │
│                    │ Availability               │ ${availability.toFixed(2).padStart(10)}%            │
│                    │ Outlier Detection Rate     │ ${outlierRate.toFixed(2).padStart(10)}%            │
├────────────────────┼────────────────────────────┼───────────────────────────┤
│  Network           │ Latency (TTFB)             │ Avg: ${latencyAvg.toFixed(2).padStart(6)} ms       │
│  Level             │                            │ p95: ${latencyP95.toFixed(2).padStart(6)} ms       │
│                    │ Throughput                 │ ${throughput.toFixed(2).padStart(10)} reqs/s       │
│                    │ Response Time              │ Avg: ${responseAvg.toFixed(2).padStart(6)} ms       │
│                    │                            │ p95: ${responseP95.toFixed(2).padStart(6)} ms       │
│                    │ Consensus Time             │ Avg: ${consensusAvg.toFixed(2).padStart(6)} ms       │
│                    │                            │ p95: ${consensusP95.toFixed(2).padStart(6)} ms       │
├────────────────────┼────────────────────────────┼───────────────────────────┤
│  Computing         │ Gas Consumption            │ Avg: ${formatNumber(gasAvg).padStart(8)}         │
│  Level             │                            │ p95: ${formatNumber(gasP95).padStart(8)}         │
│                    │ Scalability                │ Tested up to ${vusMax} VUs     │
│                    │ Concurrency                │ ${vusMax} Virtual Users        │
├────────────────────┼────────────────────────────┼───────────────────────────┤
│  Summary           │ Total Iterations           │ ${iterations.toString().padStart(10)}              │
│                    │ Test Duration              │ ${formatDuration(duration).padStart(10)}              │
│                    │ Pass Rate                  │ ${availability.toFixed(2).padStart(10)}%            │
└────────────────────┴────────────────────────────┴───────────────────────────┘
`;

  return table;
}

/**
 * Formats a number with K/M suffixes
 * @param {number} num - Number to format
 * @returns {string} Formatted number
 */
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toFixed(0);
}

/**
 * Formats duration from milliseconds to human-readable string
 * @param {number} ms - Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

export default generateTaxonomyTable;
