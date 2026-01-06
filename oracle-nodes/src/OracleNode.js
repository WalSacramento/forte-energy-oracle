/**
 * Oracle Node Class
 * Main oracle node implementation that listens for requests and submits responses
 */

const { ethers } = require('ethers');
const DataFetcher = require('./DataFetcher');
const ResponseSigner = require('./ResponseSigner');
const MetricsCollector = require('./MetricsCollector');
const logger = require('./utils/logger');

// OracleAggregator ABI (only what we need)
const ORACLE_AGGREGATOR_ABI = [
    "event DataRequested(uint256 indexed requestId, string meterId, uint256 deadline)",
    "event DataAggregated(uint256 indexed requestId, uint256 aggregatedValue, uint256 responseCount)",
    "event ResponseSubmitted(uint256 indexed requestId, address indexed oracle, uint256 value)",
    "function submitResponse(uint256 requestId, uint256 value, bytes signature) external",
    "function getRequest(uint256 requestId) view returns (tuple(uint256 id, string meterId, uint256 createdAt, uint256 deadline, uint8 status, uint256 responseCount, uint256 aggregatedValue))",
    "function getOracleInfo(address oracle) view returns (tuple(address nodeAddress, uint256 reputation, bool isActive, uint256 totalResponses, uint256 validResponses))",
    "function hasResponded(uint256, address) view returns (bool)"
];

class OracleNode {
    constructor(config) {
        this.nodeId = config.nodeId;
        this.nodeType = config.nodeType;
        this.rpcUrl = config.rpcUrl;
        this.hemsApiUrl = config.hemsApiUrl;
        this.privateKey = config.privateKey;
        this.contractAddress = config.contractAddress;

        this.provider = null;
        this.wallet = null;
        this.contract = null;
        this.dataFetcher = new DataFetcher(config.hemsApiUrl, { nodeId: config.nodeId });
        this.responseSigner = null;
        this.metricsCollector = new MetricsCollector(config.nodeId);

        this.isRunning = false;
        this.isConnected = false;
        this.processedRequests = new Set();

        // Transaction queue for sequential processing (nonce management)
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.transactionRetries = new Map(); // Track retries per requestId
    }

    /**
     * Start the oracle node
     */
    async start() {
        logger.info(`Starting oracle node: ${this.nodeId}`);

        try {
            // Connect to blockchain
            this.provider = new ethers.JsonRpcProvider(this.rpcUrl);
            this.wallet = new ethers.Wallet(this.privateKey, this.provider);
            this.responseSigner = new ResponseSigner(this.wallet);

            logger.info(`Wallet address: ${this.wallet.address}`);

            // Connect to contract
            if (!this.contractAddress) {
                throw new Error('Contract address not configured');
            }

            // Verify contract exists at address
            const code = await this.provider.getCode(this.contractAddress);
            if (code === '0x' || code === '0x0') {
                throw new Error(`No contract found at address ${this.contractAddress}. Please run 'npm run deploy:local' first.`);
            }

            this.contract = new ethers.Contract(
                this.contractAddress,
                ORACLE_AGGREGATOR_ABI,
                this.wallet
            );

            // Verify oracle is registered
            let oracleInfo;
            try {
                oracleInfo = await this.contract.getOracleInfo(this.wallet.address);
            } catch (error) {
                // If decoding fails, oracle is likely not registered
                if (error.code === 'BAD_DATA' || error.shortMessage?.includes('decode') || error.value === '0x') {
                    throw new Error(`Oracle ${this.wallet.address} is not registered in contract ${this.contractAddress}. Please run 'npm run deploy:local' to register oracles.`);
                }
                throw error;
            }

            // Check if oracle is registered (nodeAddress should match if registered)
            // When oracle is not registered, Solidity returns a struct with default values (zeros)
            // We check if nodeAddress is zero or doesn't match
            const nodeAddress = oracleInfo.nodeAddress || oracleInfo[0];
            const isActive = oracleInfo.isActive !== undefined ? oracleInfo.isActive : oracleInfo[2];
            
            if (!nodeAddress || nodeAddress === ethers.ZeroAddress || nodeAddress.toLowerCase() !== this.wallet.address.toLowerCase()) {
                throw new Error(`Oracle ${this.wallet.address} is not registered in contract ${this.contractAddress}. Please run 'npm run deploy:local' to register oracles.`);
            }

            if (!isActive) {
                const reputation = oracleInfo.reputation !== undefined ? oracleInfo.reputation : oracleInfo[1];
                throw new Error(`Oracle ${this.wallet.address} is registered but not active. Reputation: ${reputation}`);
            }

            const reputation = oracleInfo.reputation !== undefined ? oracleInfo.reputation : oracleInfo[1];
            logger.info(`Oracle registered with reputation: ${reputation}`);

            // Setup event listener
            this._setupEventListener();

            this.isRunning = true;
            this.isConnected = true;

            logger.info(`Oracle node ${this.nodeId} started successfully`);
            logger.info(`Listening for DataRequested events...`);

        } catch (error) {
            logger.error(`Failed to start oracle node: ${error.message}`);
            throw error;
        }
    }

    /**
     * Stop the oracle node
     */
    async stop() {
        logger.info(`Stopping oracle node: ${this.nodeId}`);

        if (this.contract) {
            this.contract.removeAllListeners();
        }

        this.isRunning = false;
        this.isConnected = false;

        logger.info(`Oracle node ${this.nodeId} stopped`);
    }

    /**
     * Setup event listener for DataRequested events
     */
    _setupEventListener() {
        this.contract.on('DataRequested', async (requestId, meterId, deadline, event) => {
            logger.info(`Received DataRequested event: requestId=${requestId}, meterId=${meterId}`);

            // Add to queue instead of processing immediately
            // This prevents nonce collisions when multiple events arrive simultaneously
            this.requestQueue.push({ requestId, meterId, deadline });
            logger.debug(`Added request ${requestId} to queue (queue size: ${this.requestQueue.length})`);

            // Start processing queue if not already running
            this._processQueue();
        });

        // Also listen for aggregation events for logging
        this.contract.on('DataAggregated', (requestId, aggregatedValue, responseCount) => {
            logger.info(`Request ${requestId} aggregated: value=${aggregatedValue}, responses=${responseCount}`);
        });
    }

    /**
     * Process the request queue sequentially to prevent nonce collisions
     * Gets FRESH nonce before EACH transaction
     */
    async _processQueue() {
        // Prevent multiple instances
        if (this.isProcessingQueue) {
            return;
        }

        if (this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            // Process ONE request at a time with fresh nonce
            while (this.requestQueue.length > 0) {
                const request = this.requestQueue.shift();
                const { requestId, meterId, deadline } = request;

                // Obtain FRESH nonce BEFORE EACH transaction
                let nonce;
                try {
                    nonce = await this.provider.getTransactionCount(
                        this.wallet.address,
                        'pending'
                    );
                    logger.debug(`[Queue] Fresh nonce for request ${requestId}: ${nonce}`);
                } catch (error) {
                    logger.error(`Failed to get nonce for request ${requestId}: ${error.message}`);
                    this.metricsCollector.recordFailure();
                    continue; // Skip this request
                }

                // Process request with FRESH nonce
                try {
                    await this._processRequestWithRetry(requestId, meterId, deadline, nonce);
                } catch (error) {
                    // Error already logged in _processRequestWithRetry
                    this.metricsCollector.recordFailure();
                }

                // Small delay between transactions to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * Process a single request with retry logic
     * @param {BigInt} requestId
     * @param {string} meterId
     * @param {BigInt} deadline
     * @param {number} initialNonce - Fresh nonce from provider
     */
    async _processRequestWithRetry(requestId, meterId, deadline, initialNonce, retryCount = 0) {
        const MAX_RETRIES = 3;
        const BACKOFF_MS = 1000; // 1 second base
        const requestIdStr = requestId.toString();

        try {
            // Get FRESH nonce if retrying (in case blockchain state changed)
            let nonce = initialNonce;
            if (retryCount > 0) {
                nonce = await this.provider.getTransactionCount(this.wallet.address, 'pending');
                logger.debug(`[Retry ${retryCount}] Fresh nonce for request ${requestIdStr}: ${nonce}`);
            }

            // Process with validation
            await this.processRequest(requestId, meterId, deadline, nonce);

            // SUCCESS: Clear retry tracking
            this.transactionRetries.delete(requestIdStr);

        } catch (error) {
            const isNonceError =
                error.code === 'NONCE_EXPIRED' ||
                error.message.includes('nonce') ||
                error.message.includes('Nonce');

            logger.error(`Error processing request ${requestIdStr}: ${error.message}`, {
                retryCount,
                isNonceError,
                errorCode: error.code
            });

            // Retry logic for nonce errors
            if (isNonceError && retryCount < MAX_RETRIES) {
                const backoff = BACKOFF_MS * Math.pow(2, retryCount);
                logger.warn(`[Retry ${retryCount + 1}/${MAX_RETRIES}] Waiting ${backoff}ms before retry...`);

                await new Promise(resolve => setTimeout(resolve, backoff));

                // Retry with FRESH nonce
                const freshNonce = await this.provider.getTransactionCount(
                    this.wallet.address,
                    'pending'
                );
                return this._processRequestWithRetry(
                    requestId,
                    meterId,
                    deadline,
                    freshNonce,
                    retryCount + 1
                );
            }

            // Max retries reached or non-nonce error
            this.transactionRetries.set(requestIdStr, retryCount);
            throw error;
        }
    }

    /**
     * Process a data request
     * @param {BigInt} requestId - Request ID
     * @param {string} meterId - Meter identifier
     * @param {BigInt} deadline - Request deadline
     * @param {number} nonce - Optional explicit nonce for transaction (for manual nonce management)
     */
    async processRequest(requestId, meterId, deadline, nonce = null) {
        const requestIdStr = requestId.toString();
        const startTime = Date.now();

        // Check if already processed
        if (this.processedRequests.has(requestIdStr)) {
            logger.warn(`Request ${requestIdStr} already processed, skipping`);
            return;
        }

        // Check if already responded on-chain
        const hasResponded = await this.contract.hasResponded(requestId, this.wallet.address);
        if (hasResponded) {
            logger.warn(`Already responded to request ${requestIdStr} on-chain, skipping`);
            this.processedRequests.add(requestIdStr);
            return;
        }

        // Check deadline
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime > Number(deadline)) {
            logger.warn(`Request ${requestIdStr} deadline passed, skipping`);
            return;
        }

        logger.info(`Processing request ${requestIdStr} for meter ${meterId}`);

        try {
            // Fetch data from HEMS API
            const fetchStart = Date.now();
            const reading = await this.dataFetcher.fetchReading(meterId);
            const fetchLatency = Date.now() - fetchStart;
            this.metricsCollector.recordFetchLatency(fetchLatency);

            logger.info(`Fetched reading for ${meterId}: ${reading.reading} Wh`);

            // Sign response
            const value = reading.reading;
            const signature = await this.responseSigner.signResponse(requestId, value);

            logger.info(`Signed response for request ${requestIdStr}`);

            // Submit to contract with explicit nonce if provided
            const submitStart = Date.now();
            const txOptions = {
                gasLimit: 500000, // Increased gas limit to handle larger values and prevent "out of gas" errors
                ...(nonce !== null ? { nonce } : {})
            };

            if (nonce !== null) {
                logger.debug(`Submitting transaction with explicit nonce: ${nonce}, gasLimit: ${txOptions.gasLimit}`);
            }

            const tx = await this.contract.submitResponse(requestId, value, signature, txOptions);
            const receipt = await tx.wait();

            // VALIDATE transaction status
            if (receipt.status !== 1) {
                throw new Error(`Transaction failed: receipt.status = ${receipt.status}`);
            }

            const submitLatency = Date.now() - submitStart;
            this.metricsCollector.recordSubmitLatency(submitLatency);

            const totalLatency = Date.now() - startTime;
            this.metricsCollector.recordLatency(totalLatency);
            this.metricsCollector.recordSuccess();
            this.metricsCollector.recordGas(receipt.gasUsed);

            this.processedRequests.add(requestIdStr);

            // Transaction confirmed successfully
            logger.info(`Submitted response for request ${requestIdStr}: value=${value}, gas=${receipt.gasUsed}, status=SUCCESS, latency=${totalLatency}ms`);

        } catch (error) {
            this.metricsCollector.recordFailure();

            if (error.message.includes('Already responded')) {
                logger.warn(`Already responded to request ${requestIdStr}`);
                this.processedRequests.add(requestIdStr);
            } else if (error.message.includes('Deadline passed')) {
                logger.warn(`Deadline passed for request ${requestIdStr}`);
            } else {
                throw error;
            }
        }
    }

    /**
     * Get current metrics
     * @returns {object} Metrics object
     */
    getMetrics() {
        return {
            nodeId: this.nodeId,
            nodeType: this.nodeType,
            isRunning: this.isRunning,
            isConnected: this.isConnected,
            walletAddress: this.wallet?.address,
            ...this.metricsCollector.getStats()
        };
    }
}

module.exports = OracleNode;


