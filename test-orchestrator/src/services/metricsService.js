const logger = require('../utils/logger');

class MetricsService {
  constructor() {
    this.reset();
    logger.info('MetricsService initialized');
  }

  reset() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      latencies: [],
      consensusTimes: [],
      ttfbTimes: [],
      gasUsages: [],
      outlierDetections: 0,
      startTime: Date.now()
    };

    logger.info('Metrics reset');
  }

  /**
   * Registra o resultado de um ciclo de oracle
   * @param {Object} result - Resultado do ciclo
   */
  recordRequest(result) {
    this.metrics.totalRequests++;

    if (result.success) {
      this.metrics.successfulRequests++;
      this.metrics.latencies.push(result.timings.total);
      this.metrics.consensusTimes.push(result.timings.consensus);
      this.metrics.ttfbTimes.push(result.timings.ttfb);
      this.metrics.gasUsages.push(result.gasUsed);

      if (result.outlierDetected) {
        this.metrics.outlierDetections++;
      }
    } else {
      this.metrics.failedRequests++;
    }

    logger.debug('Request recorded', {
      success: result.success,
      totalRequests: this.metrics.totalRequests
    });
  }

  /**
   * Retorna estatísticas agregadas
   * @returns {Object} Estatísticas
   */
  getStats() {
    const duration = Date.now() - this.metrics.startTime;
    const successRate = this.metrics.totalRequests > 0
      ? this.metrics.successfulRequests / this.metrics.totalRequests
      : 0;

    return {
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      successRate,
      latency: this._calculateStats(this.metrics.latencies),
      consensusTime: this._calculateStats(this.metrics.consensusTimes),
      ttfb: this._calculateStats(this.metrics.ttfbTimes),
      gasUsage: this._calculateStats(this.metrics.gasUsages),
      outlierDetections: this.metrics.outlierDetections,
      throughput: this.metrics.successfulRequests / (duration / 1000),
      duration
    };
  }

  /**
   * Converte métricas para formato da taxonomia
   * @returns {Object} Métricas no formato da taxonomia
   */
  getTaxonomyFormat() {
    const stats = this.getStats();

    return {
      applicationLevel: {
        errorRate: (1 - stats.successRate) * 100,
        accuracy: 100, // Assumindo 100% se não houver tracking específico
        availability: stats.successRate * 100,
        outlierDetectionRate: this.metrics.totalRequests > 0
          ? (this.metrics.outlierDetections / this.metrics.totalRequests) * 100
          : 0
      },
      networkLevel: {
        latency: {
          avg: stats.ttfb.avg,
          p50: stats.ttfb.p50,
          p95: stats.ttfb.p95,
          p99: stats.ttfb.p99
        },
        throughput: stats.throughput,
        responseTime: {
          avg: stats.latency.avg,
          p50: stats.latency.p50,
          p95: stats.latency.p95,
          p99: stats.latency.p99
        },
        consensusTime: {
          avg: stats.consensusTime.avg,
          p50: stats.consensusTime.p50,
          p95: stats.consensusTime.p95,
          p99: stats.consensusTime.p99
        }
      },
      computingLevel: {
        gasConsumption: {
          avg: stats.gasUsage.avg,
          total: stats.gasUsage.total,
          p50: stats.gasUsage.p50,
          p95: stats.gasUsage.p95,
          p99: stats.gasUsage.p99
        }
      }
    };
  }

  /**
   * Calcula estatísticas para um array de valores
   * @param {Array<number>} values - Array de valores
   * @returns {Object} Estatísticas (avg, min, max, p50, p95, p99, total)
   */
  _calculateStats(values) {
    if (values.length === 0) {
      return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0, total: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);

    return {
      avg: sum / values.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: this._percentile(sorted, 50),
      p95: this._percentile(sorted, 95),
      p99: this._percentile(sorted, 99),
      total: sum
    };
  }

  /**
   * Calcula percentil
   * @param {Array<number>} sortedValues - Array ordenado de valores
   * @param {number} p - Percentil (0-100)
   * @returns {number} Valor do percentil
   */
  _percentile(sortedValues, p) {
    if (sortedValues.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.max(0, index)];
  }
}

module.exports = MetricsService;
