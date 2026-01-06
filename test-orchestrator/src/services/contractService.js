const { ethers } = require('ethers');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');

// Try multiple paths for artifacts (Docker volume mount, relative from project root)
let OracleAggregatorABI;
const possiblePaths = [
  path.join('/app', 'artifacts', 'contracts', 'OracleAggregator.sol', 'OracleAggregator.json'), // Docker volume mount
  path.join(__dirname, '..', '..', '..', 'artifacts', 'contracts', 'OracleAggregator.sol', 'OracleAggregator.json'), // Relative from project root
];

for (const artifactPath of possiblePaths) {
  if (fs.existsSync(artifactPath)) {
    OracleAggregatorABI = require(artifactPath).abi;
    logger.info('Loaded OracleAggregator ABI from', { path: artifactPath });
    break;
  }
}

if (!OracleAggregatorABI) {
  throw new Error(`OracleAggregator artifact not found. Tried paths: ${possiblePaths.join(', ')}`);
}

class ContractService {
  constructor(rpcUrl, contractAddress, privateKey) {
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, OracleAggregatorABI, this.wallet);

    // Nonce management for concurrent requests
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.transactionRetries = new Map();

    logger.info('ContractService initialized', {
      rpcUrl,
      contractAddress,
      walletAddress: this.wallet.address
    });
  }

  /**
   * Solicita dados do oracle (com nonce management)
   * @param {string} meterId - ID do medidor
   * @returns {Promise<bigint>} requestId
   */
  async requestData(meterId) {
    // Add request to queue and wait for it to be processed
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ meterId, resolve, reject });
      this._processQueue();
    });
  }

  /**
   * Process the request queue sequentially with fresh nonce per transaction
   */
  async _processQueue() {
    if (this.isProcessingQueue) {
      return;
    }

    if (this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    try {
      while (this.requestQueue.length > 0) {
        const { meterId, resolve, reject } = this.requestQueue.shift();

        // Get FRESH nonce before EACH transaction
        let nonce;
        try {
          nonce = await this.provider.getTransactionCount(
            this.wallet.address,
            'pending'
          );
          logger.debug(`[ContractService] Fresh nonce for meterId ${meterId}: ${nonce}`);
        } catch (error) {
          logger.error(`[ContractService] Failed to get nonce: ${error.message}`);
          reject(error);
          continue;
        }

        // Process with retry logic
        try {
          const requestId = await this._requestDataWithRetry(meterId, nonce);
          resolve(requestId);
        } catch (error) {
          reject(error);
        }

        // Small delay between transactions
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Request data with retry logic for nonce errors
   */
  async _requestDataWithRetry(meterId, initialNonce, retryCount = 0) {
    const MAX_RETRIES = 3;
    const BACKOFF_MS = 1000;

    try {
      let nonce = initialNonce;
      if (retryCount > 0) {
        nonce = await this.provider.getTransactionCount(this.wallet.address, 'pending');
        logger.debug(`[ContractService Retry ${retryCount}] Fresh nonce: ${nonce}`);
      }

      return await this._requestDataWithNonce(meterId, nonce);

    } catch (error) {
      const isNonceError =
        error.code === 'NONCE_EXPIRED' ||
        error.message.includes('nonce') ||
        error.message.includes('Nonce');

      logger.error(`[ContractService] Error requesting data: ${error.message}`, {
        meterId,
        retryCount,
        isNonceError
      });

      if (isNonceError && retryCount < MAX_RETRIES) {
        const backoff = BACKOFF_MS * Math.pow(2, retryCount);
        logger.warn(`[ContractService Retry ${retryCount + 1}/${MAX_RETRIES}] Backoff ${backoff}ms`);

        await new Promise(resolve => setTimeout(resolve, backoff));

        const freshNonce = await this.provider.getTransactionCount(
          this.wallet.address,
          'pending'
        );
        return this._requestDataWithRetry(meterId, freshNonce, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Internal method to request data with explicit nonce
   * @param {string} meterId - ID do medidor
   * @param {number} nonce - Explicit nonce for transaction
   * @returns {Promise<bigint>} requestId
   */
  async _requestDataWithNonce(meterId, nonce) {
    logger.info('Requesting data', { meterId, nonce });

    const tx = await this.contract.requestData(meterId, {
      nonce,
      gasLimit: 300000 // Fixed gas limit to prevent "out of gas" errors under load
    });
    const receipt = await tx.wait();

    // VALIDATE transaction status
    if (receipt.status !== 1) {
      throw new Error(`Transaction failed: receipt.status = ${receipt.status}`);
    }

    // Extrair requestId do evento DataRequested
    const event = receipt.logs.find(log => {
      try {
        const parsed = this.contract.interface.parseLog(log);
        return parsed && parsed.name === 'DataRequested';
      } catch {
        return false;
      }
    });

    if (!event) {
      throw new Error('DataRequested event not found in receipt');
    }

    const requestId = this.contract.interface.parseLog(event).args[0];
    logger.info('Data requested successfully', {
      requestId: requestId.toString(),
      txHash: receipt.hash,
      status: 'SUCCESS'
    });

    return requestId;
  }

  /**
   * Aguarda a agregação ser completada
   * @param {bigint} requestId - ID da solicitação
   * @param {number} timeout - Timeout em ms
   * @returns {Promise<Object>} Dados da requisição
   */
  async waitForAggregation(requestId, timeout = 30000) {
    const startTime = Date.now();

    logger.info('Waiting for aggregation', { requestId: requestId.toString(), timeout });

    while (Date.now() - startTime < timeout) {
      const request = await this.contract.getRequest(requestId);

      // Status 2 = COMPLETED
      if (request.status === 2n) {
        logger.info('Aggregation completed', { requestId: requestId.toString() });
        return request;
      }

      // Aguardar 500ms antes de checar novamente
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    throw new Error(`Timeout waiting for aggregation: ${requestId}`);
  }

  /**
   * Obtém os detalhes de uma requisição
   * @param {bigint} requestId - ID da solicitação
   * @returns {Promise<Object>} Dados da requisição
   */
  async getRequest(requestId) {
    const request = await this.contract.getRequest(requestId);
    return request;
  }

  /**
   * Obtém as respostas dos oracles para uma requisição
   * @param {bigint} requestId - ID da solicitação
   * @returns {Promise<Array>} Array de respostas
   */
  async getResponses(requestId) {
    const responses = await this.contract.getResponses(requestId);
    return responses;
  }

  /**
   * Obtém o gas usado em uma transação
   * @param {string} txHash - Hash da transação
   * @returns {Promise<bigint>} Gas usado
   */
  async getGasUsed(txHash) {
    const receipt = await this.provider.getTransactionReceipt(txHash);
    return receipt.gasUsed;
  }

  /**
   * Escuta eventos do contrato
   * @param {string} eventName - Nome do evento
   * @param {function} callback - Callback para processar evento
   */
  listenForEvents(eventName, callback) {
    this.contract.on(eventName, callback);
    logger.info('Listening for events', { eventName });
  }

  /**
   * Remove listeners de eventos
   */
  removeAllListeners() {
    this.contract.removeAllListeners();
    logger.info('All event listeners removed');
  }
}

module.exports = ContractService;
