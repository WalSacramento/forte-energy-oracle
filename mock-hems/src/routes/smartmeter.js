/**
 * Smart Meter Routes
 * Endpoints for reading smart meter data
 */

const express = require('express');
const router = express.Router();

/**
 * GET /smartmeter/:id/reading
 * Get current reading for a smart meter
 * Supports X-Oracle-ID header to identify which oracle is requesting (for malicious oracle simulation)
 */
router.get('/:id/reading', async (req, res, next) => {
    try {
        const meterId = req.params.id.toUpperCase();
        const oracleId = req.headers['x-oracle-id'] || null; // Extract Oracle ID from header
        const meterSimulator = req.app.get('meterSimulator');

        const reading = await meterSimulator.getReading(meterId, oracleId);

        res.json(reading);
    } catch (error) {
        if (error.message.includes('not found')) {
            return res.status(404).json({
                error: 'Meter not found',
                meterId: req.params.id
            });
        }
        if (error.message.includes('offline')) {
            return res.status(503).json({
                error: 'Meter offline',
                meterId: req.params.id
            });
        }
        next(error);
    }
});

/**
 * GET /smartmeter/:id/status
 * Get status of a smart meter
 */
router.get('/:id/status', (req, res) => {
    const meterId = req.params.id.toUpperCase();
    const meterSimulator = req.app.get('meterSimulator');

    const status = meterSimulator.getMeterStatus(meterId);

    if (!status) {
        return res.status(404).json({
            error: 'Meter not found',
            meterId: req.params.id
        });
    }

    res.json(status);
});

/**
 * GET /smartmeter/list
 * List all available meters
 */
router.get('/', (req, res) => {
    const meterSimulator = req.app.get('meterSimulator');
    const status = meterSimulator.getStatus();

    res.json({
        count: status.meters.length,
        meters: status.meters.map(m => m.id)
    });
});

module.exports = router;


