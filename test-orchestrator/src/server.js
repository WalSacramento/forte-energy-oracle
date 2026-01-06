require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const ContractService = require('./services/contractService');
const MetricsService = require('./services/metricsService');
const OracleController = require('./controllers/oracleController');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuração
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';
let CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
const PRIVATE_KEY = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

// Try to load contract address from deployment file if not in env
if (!CONTRACT_ADDRESS) {
  try {
    // Try multiple paths: Docker volume mount, relative from project root
    const possiblePaths = [
      path.join('/app', 'deployments', 'localhost.json'), // Docker volume mount
      path.join(__dirname, '..', '..', '..', 'deployments', 'localhost.json'), // Relative from project root
    ];
    
    for (const deploymentPath of possiblePaths) {
      if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        CONTRACT_ADDRESS = deployment.contracts?.OracleAggregator;
        if (CONTRACT_ADDRESS) {
          logger.info('Loaded contract address from deployment file', { path: deploymentPath, address: CONTRACT_ADDRESS });
          break;
        }
      }
    }
  } catch (error) {
    logger.warn('Could not load deployment file', { error: error.message });
  }
}

if (!CONTRACT_ADDRESS) {
  logger.error('CONTRACT_ADDRESS environment variable is required');
  process.exit(1);
}

// Serviços
const contractService = new ContractService(RPC_URL, CONTRACT_ADDRESS, PRIVATE_KEY);
const metricsService = new MetricsService();
const oracleController = new OracleController(contractService);

// Middleware de logging
app.use((req, res, next) => {
  logger.info('HTTP Request', {
    method: req.method,
    path: req.path,
    ip: req.ip
  });
  next();
});

// Rotas
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'eaon-test-orchestrator'
  });
});

app.post('/oracle/request-cycle', async (req, res) => {
  const startTime = Date.now();

  try {
    await oracleController.executeRequestCycle(req, res);

    // Registrar métricas apenas se a resposta foi bem-sucedida
    if (res.statusCode === 200) {
      const responseBody = res.locals.responseData || {};
      metricsService.recordRequest({
        success: true,
        timings: responseBody.timings || { total: Date.now() - startTime, consensus: 0, ttfb: 0 },
        gasUsed: responseBody.gasUsed || 0,
        outlierDetected: responseBody.outlierDetected || false
      });
    } else {
      metricsService.recordRequest({
        success: false
      });
    }
  } catch (error) {
    logger.error('Error in request-cycle endpoint', { error: error.message });

    metricsService.recordRequest({
      success: false
    });

    if (!res.headersSent) {
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

app.get('/metrics', (req, res) => {
  const stats = metricsService.getStats();
  res.json(stats);
});

app.get('/metrics/taxonomy', (req, res) => {
  const taxonomyMetrics = metricsService.getTaxonomyFormat();
  res.json(taxonomyMetrics);
});

app.post('/metrics/reset', (req, res) => {
  metricsService.reset();
  res.json({ message: 'Metrics reset successfully' });
});

// Tratamento de erros global
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack
  });

  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
  logger.info(`Test Orchestrator API running on port ${PORT}`, {
    rpcUrl: RPC_URL,
    contractAddress: CONTRACT_ADDRESS
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    contractService.removeAllListeners();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server');
  server.close(() => {
    logger.info('HTTP server closed');
    contractService.removeAllListeners();
    process.exit(0);
  });
});

module.exports = app;
