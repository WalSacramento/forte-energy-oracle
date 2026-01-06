const logger = require('../utils/logger');
const ContractService = require('../services/contractService');

class OracleController {
  constructor(contractService) {
    this.contractService = contractService;
    logger.info('OracleController initialized');
  }

  /**
   * Executa um ciclo completo de requisição de oracle
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   */
  async executeRequestCycle(req, res) {
    const { meterId, expectedValue, expectOutlier } = req.body;
    const startTime = Date.now();

    if (!meterId) {
      return res.status(400).json({ error: 'meterId is required' });
    }

    logger.info('Starting oracle request cycle', {
      meterId,
      expectedValue,
      expectOutlier
    });

    try {
      // 1. Solicitar dados
      const requestStartTime = Date.now();
      const requestId = await this.contractService.requestData(meterId);
      const requestEndTime = Date.now();
      const ttfb = requestEndTime - requestStartTime;

      logger.info('Request submitted', {
        requestId: requestId.toString(),
        ttfb
      });

      // 2. Aguardar agregação
      const consensusStartTime = Date.now();
      const request = await this.contractService.waitForAggregation(requestId, 60000); // Increased timeout to 60s
      const consensusEndTime = Date.now();
      const consensusTime = consensusEndTime - consensusStartTime;

      // 3. Obter respostas dos oracles
      const responses = await this.contractService.getResponses(requestId);

      // 4. Detectar outliers (verificar se houve evento OutlierDetected)
      const outlierDetected = this._checkOutlierDetection(request, responses, expectedValue);

      // 5. Calcular métricas
      const endTime = Date.now();
      const totalLatency = endTime - startTime;

      // 6. Calcular gas total (estimativa baseada no número de transações)
      // Request + N respostas de oracles
      const estimatedGas = this._estimateGas(responses.length);

      const result = {
        requestId: requestId.toString(),
        meterId,
        aggregatedValue: Number(request.aggregatedValue),
        oracleResponses: responses.length,
        outlierDetected,
        timings: {
          total: totalLatency,
          consensus: consensusTime,
          ttfb
        },
        gasUsed: estimatedGas,
        responses: responses.map(r => ({
          oracle: r.oracle,
          value: Number(r.value),
          timestamp: Number(r.timestamp)
        }))
      };

      logger.info('Oracle request cycle completed', {
        requestId: result.requestId,
        totalLatency,
        aggregatedValue: result.aggregatedValue
      });

      res.json(result);
    } catch (error) {
      logger.error('Error in oracle request cycle', {
        error: error.message,
        stack: error.stack,
        meterId
      });

      res.status(500).json({
        error: 'Oracle request cycle failed',
        message: error.message
      });
    }
  }

  /**
   * Verifica se houve detecção de outlier
   * @param {Object} request - Objeto de requisição
   * @param {Array} responses - Respostas dos oracles
   * @param {number} expectedValue - Valor esperado (opcional, para verificação absoluta)
   * @returns {boolean} True se houve detecção de outlier
   */
  _checkOutlierDetection(request, responses, expectedValue = null) {
    if (responses.length === 0) {
      return false;
    }

    const aggregatedValue = Number(request.aggregatedValue);
    const values = responses.map(r => Number(r.value));

    // Verificação 1: Se expectedValue fornecido, verificar se valor agregado está muito acima
    // (indica que outlier foi excluído corretamente, mas ainda detectamos anomalia)
    if (expectedValue && aggregatedValue > expectedValue * 3) {
      return true; // Valor agregado muito acima do esperado
    }

    // Verificação 2: Calcular mediana e verificar se algum valor desvia muito
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];

    // Verificação 3: Verificar se algum response desvia mais de 10% da mediana
    // (isso indica que o contrato detectou e excluiu um outlier)
    const hasOutlier = values.some(value => {
      const deviation = Math.abs(value - median) / median;
      return deviation > 0.1; // 10% threshold (mesmo do contrato)
    });

    // Verificação 4: Verificar se há grande diferença entre valores (indica outlier)
    // Se a diferença entre max e min é muito grande comparada à mediana
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const range = maxValue - minValue;
    const rangeToMedianRatio = range / median;

    // Se a diferença é mais de 5x a mediana, provavelmente há outlier
    if (rangeToMedianRatio > 5) {
      return true;
    }

    return hasOutlier;
  }

  /**
   * Estima o gas usado baseado no número de oracles
   * @param {number} oracleCount - Número de oracles que responderam
   * @returns {number} Gas estimado
   */
  _estimateGas(oracleCount) {
    // Valores baseados nos testes reais:
    // - requestData: ~100k gas
    // - submitResponse: ~150k gas por oracle
    // - agregação: ~75k gas
    const baseGas = 100000; // requestData
    const perOracleGas = 150000; // submitResponse
    const aggregationGas = 75000;

    return baseGas + (perOracleGas * oracleCount) + aggregationGas;
  }
}

module.exports = OracleController;
