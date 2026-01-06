import { Rate, Trend, Counter } from 'k6/metrics';

/**
 * Base readings for each meter (in Wh)
 * Used for accuracy calculation
 */
const METER_BASE_READINGS = {
  'METER001': 5000,
  'METER002': 3500,
  'METER003': 7200,
  'METER004': 4800,
  'METER005': 6100
};

/**
 * Get base reading for a meter
 * @param {string} meterId - Meter identifier
 * @returns {number} Base reading value
 */
function getBaseReading(meterId) {
  return METER_BASE_READINGS[meterId] || 5000; // Default to 5000 if not found
}

/**
 * Creates all taxonomy metrics for EAON testing
 * @returns {Object} Object containing all custom metrics
 */
export function createTaxonomyMetrics() {
  return {
    // Application-level metrics
    errorRate: new Rate('app_error_rate'),
    accuracy: new Rate('app_accuracy'),
    availability: new Rate('app_availability'),
    outlierDetectionRate: new Rate('app_outlier_detection_rate'),

    // Network-level metrics
    networkLatency: new Trend('net_latency_ttfb', true),
    throughput: new Counter('net_throughput'),
    responseTime: new Trend('net_response_time', true),
    consensusTime: new Trend('net_consensus_time', true),

    // Computing-level metrics
    gasUsed: new Trend('comp_gas_used', true)
  };
}

/**
 * Records metrics from an HTTP response
 * @param {Object} response - k6 HTTP response object
 * @param {Object} metrics - Metrics object from createTaxonomyMetrics()
 * @param {string} meterId - Meter identifier (for base reading lookup)
 * @param {number} expectedValue - Expected aggregated value (optional, for backward compatibility)
 */
export function recordRequestMetrics(response, metrics, meterId, expectedValue = null) {
  if (response.status === 200) {
    const result = JSON.parse(response.body);

    // Application-level
    metrics.errorRate.add(0);
    metrics.availability.add(1);

    // Calculate accuracy using base reading of the meter, not fixed expectedValue
    // This accounts for different meters having different base readings
    const baseReading = getBaseReading(meterId || result.meterId);
    const deviation = Math.abs(result.aggregatedValue - baseReading) / baseReading;
    // Threshold of 5% to accommodate natural variation (±2%) + aggregation variance
    metrics.accuracy.add(deviation < 0.05 ? 1 : 0);

    if (result.outlierDetected !== undefined) {
      metrics.outlierDetectionRate.add(result.outlierDetected ? 1 : 0);
    }

    // Network-level
    if (result.timings) {
      metrics.networkLatency.add(result.timings.ttfb);
      metrics.responseTime.add(result.timings.total);
      metrics.consensusTime.add(result.timings.consensus);
    }
    metrics.throughput.add(1);

    // Computing-level
    if (result.gasUsed) {
      metrics.gasUsed.add(result.gasUsed);
    }
  } else {
    metrics.errorRate.add(1);
    metrics.availability.add(0);
  }
}

/**
 * Calculates mean of an array
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Mean value
 */
export function mean(arr) {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculates percentile of an array
 * @param {Array<number>} arr - Array of numbers
 * @param {number} p - Percentile (0-100)
 * @returns {number} Percentile value
 */
export function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

/**
 * Formats bytes to human-readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
