/**
 * Data Fetcher Service
 * Fetches data from HEMS API with retry logic
 */

const axios = require('axios');
const logger = require('./utils/logger');

class DataFetcher {
    constructor(baseUrl, options = {}) {
        this.baseUrl = baseUrl;
        this.nodeId = options.nodeId; // Oracle node identifier
        this.timeout = options.timeout || 5000;
        this.retries = options.retries || 3;
        this.retryDelay = options.retryDelay || 1000;

        const headers = {
            'Content-Type': 'application/json'
        };

        // Add X-Oracle-ID header if nodeId is provided
        if (this.nodeId) {
            headers['X-Oracle-ID'] = this.nodeId;
        }

        this.client = axios.create({
            baseURL: baseUrl,
            timeout: this.timeout,
            headers: headers
        });
    }

    /**
     * Fetch reading from a smart meter
     * @param {string} meterId - Meter identifier
     * @returns {Promise<object>} Meter reading
     */
    async fetchReading(meterId) {
        let lastError;

        for (let attempt = 1; attempt <= this.retries; attempt++) {
            try {
                logger.debug(`Fetching reading for ${meterId}, attempt ${attempt}/${this.retries}`);

                const response = await this.client.get(`/smartmeter/${meterId}/reading`);

                if (response.status === 200 && response.data) {
                    return response.data;
                }

                throw new Error(`Unexpected response: ${response.status}`);

            } catch (error) {
                lastError = error;

                if (error.response) {
                    // Server responded with error
                    if (error.response.status === 404) {
                        throw new Error(`Meter ${meterId} not found`);
                    }
                    if (error.response.status === 503) {
                        throw new Error(`Meter ${meterId} is offline`);
                    }
                }

                logger.warn(`Fetch attempt ${attempt} failed for ${meterId}: ${error.message}`);

                if (attempt < this.retries) {
                    await this._sleep(this.retryDelay * attempt);
                }
            }
        }

        throw new Error(`Failed to fetch reading for ${meterId} after ${this.retries} attempts: ${lastError.message}`);
    }

    /**
     * Check if HEMS API is healthy
     * @returns {Promise<boolean>} Health status
     */
    async checkHealth() {
        try {
            const response = await this.client.get('/health');
            return response.status === 200;
        } catch (error) {
            return false;
        }
    }

    /**
     * Sleep helper
     * @param {number} ms - Milliseconds to sleep
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = DataFetcher;


