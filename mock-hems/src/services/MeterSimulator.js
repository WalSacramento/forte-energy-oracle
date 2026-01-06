/**
 * Meter Simulator Service
 * Generates realistic smart meter readings with configurable behavior
 */

class MeterSimulator {
    constructor() {
        // Base readings for each meter (in Wh)
        this.baseReadings = {
            'METER001': 5000,
            'METER002': 3500,
            'METER003': 7200,
            'METER004': 4800,
            'METER005': 6100
        };

        // Meter states
        this.meterStates = {};

        // Oracle malicious states: { 'oracle-3': { multiplier: 10 } }
        this.maliciousOracles = {};

        // Initialize all meters
        Object.keys(this.baseReadings).forEach(meterId => {
            this.meterStates[meterId] = {
                id: meterId,
                status: 'online',
                baseReading: this.baseReadings[meterId],
                malicious: false,
                maliciousMultiplier: 10,
                delay: 0,
                lastReading: null,
                readCount: 0
            };
        });
    }

    /**
     * Get reading for a meter
     * @param {string} meterId - Meter identifier
     * @param {string} oracleId - Oracle identifier (optional, for malicious oracle simulation)
     * @returns {Promise<object>} Meter reading
     */
    async getReading(meterId, oracleId = null) {
        const state = this.meterStates[meterId];

        if (!state) {
            throw new Error(`Meter ${meterId} not found`);
        }

        if (state.status === 'offline') {
            throw new Error(`Meter ${meterId} is offline`);
        }

        // Apply delay if configured
        if (state.delay > 0) {
            await this._sleep(state.delay);
        }

        // Generate reading with realistic variation
        let reading = this._generateReading(state.baseReading);

        // Apply malicious multiplier based on oracle or meter
        if (oracleId) {
            // Check if this specific oracle is malicious
            const normalizedOracleId = oracleId.toLowerCase();
            if (this.maliciousOracles[normalizedOracleId]) {
                const config = this.maliciousOracles[normalizedOracleId];
                reading = reading * config.multiplier;
            }
        } else if (state.malicious) {
            // Fallback: behavior for meter-level malicious (backward compatibility)
            reading = reading * state.maliciousMultiplier;
        }

        // Update state
        state.lastReading = reading;
        state.readCount++;

        // Determine status
        let status = 'normal';
        if (oracleId && this.maliciousOracles[oracleId.toLowerCase()]) {
            status = 'malicious_oracle';
        } else if (state.malicious) {
            status = 'malicious';
        }

        return {
            meterId: meterId,
            reading: reading,
            timestamp: new Date().toISOString(),
            unit: 'Wh',
            status: status
        };
    }

    /**
     * Generate reading with realistic variation (±2%)
     * @param {number} baseValue - Base reading value
     * @returns {number} Generated reading
     */
    _generateReading(baseValue) {
        const variationPercent = 2;
        const variation = baseValue * (variationPercent / 100);
        const delta = (Math.random() * 2 - 1) * variation;
        return Math.round(baseValue + delta);
    }

    /**
     * Set meter to offline state
     * @param {string} meterId - Meter identifier
     */
    setOffline(meterId) {
        if (!this.meterStates[meterId]) {
            this._initializeMeter(meterId, 5000);
        }
        this.meterStates[meterId].status = 'offline';
    }

    /**
     * Set meter to online state
     * @param {string} meterId - Meter identifier
     */
    setOnline(meterId) {
        if (!this.meterStates[meterId]) {
            this._initializeMeter(meterId, 5000);
        }
        this.meterStates[meterId].status = 'online';
    }

    /**
     * Enable malicious mode for a meter
     * @param {string} meterId - Meter identifier
     * @param {number} multiplier - Value multiplier (default: 10)
     */
    setMalicious(meterId, multiplier = 10) {
        if (!this.meterStates[meterId]) {
            this._initializeMeter(meterId, 5000);
        }
        this.meterStates[meterId].malicious = true;
        this.meterStates[meterId].maliciousMultiplier = multiplier;
    }

    /**
     * Disable malicious mode for a meter
     * @param {string} meterId - Meter identifier
     */
    setHonest(meterId) {
        if (!this.meterStates[meterId]) {
            this._initializeMeter(meterId, 5000);
        }
        this.meterStates[meterId].malicious = false;
    }

    /**
     * Set response delay for a meter
     * @param {string} meterId - Meter identifier
     * @param {number} delayMs - Delay in milliseconds
     */
    setDelay(meterId, delayMs) {
        if (!this.meterStates[meterId]) {
            this._initializeMeter(meterId, 5000);
        }
        this.meterStates[meterId].delay = delayMs;
    }

    /**
     * Get status of all meters
     * @returns {object} Status of all meters
     */
    getStatus() {
        return {
            meters: Object.values(this.meterStates).map(state => ({
                id: state.id,
                status: state.status,
                baseReading: state.baseReading,
                malicious: state.malicious,
                delay: state.delay,
                lastReading: state.lastReading,
                readCount: state.readCount
            }))
        };
    }

    /**
     * Get status of a specific meter
     * @param {string} meterId - Meter identifier
     * @returns {object} Meter status
     */
    getMeterStatus(meterId) {
        const state = this.meterStates[meterId];
        if (!state) {
            return null;
        }
        return {
            id: state.id,
            status: state.status,
            baseReading: state.baseReading,
            malicious: state.malicious,
            delay: state.delay,
            lastReading: state.lastReading,
            readCount: state.readCount
        };
    }

    /**
     * Reset all meters to default state
     */
    reset() {
        Object.keys(this.meterStates).forEach(meterId => {
            this.meterStates[meterId] = {
                id: meterId,
                status: 'online',
                baseReading: this.baseReadings[meterId] || 5000,
                malicious: false,
                maliciousMultiplier: 10,
                delay: 0,
                lastReading: null,
                readCount: 0
            };
        });
    }

    /**
     * Initialize a new meter
     * @param {string} meterId - Meter identifier
     * @param {number} baseReading - Base reading value
     */
    _initializeMeter(meterId, baseReading) {
        this.meterStates[meterId] = {
            id: meterId,
            status: 'online',
            baseReading: baseReading,
            malicious: false,
            maliciousMultiplier: 10,
            delay: 0,
            lastReading: null,
            readCount: 0
        };
        this.baseReadings[meterId] = baseReading;
    }

    /**
     * Set oracle to malicious mode
     * @param {string} oracleId - Oracle identifier
     * @param {number} multiplier - Value multiplier (default: 10)
     */
    setOracleMalicious(oracleId, multiplier = 10) {
        const normalizedOracleId = oracleId.toLowerCase();
        this.maliciousOracles[normalizedOracleId] = { multiplier };
    }

    /**
     * Set oracle to honest mode
     * @param {string} oracleId - Oracle identifier
     */
    setOracleHonest(oracleId) {
        const normalizedOracleId = oracleId.toLowerCase();
        delete this.maliciousOracles[normalizedOracleId];
    }

    /**
     * Get status of all oracles
     * @returns {object} Status of all oracles
     */
    getOracleStatus() {
        return {
            oracles: Object.keys(this.maliciousOracles).map(oracleId => ({
                oracleId: oracleId,
                malicious: true,
                multiplier: this.maliciousOracles[oracleId].multiplier
            }))
        };
    }

    /**
     * Sleep helper
     * @param {number} ms - Milliseconds to sleep
     */
    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = MeterSimulator;


