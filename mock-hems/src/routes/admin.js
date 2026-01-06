/**
 * Admin Routes
 * Control endpoints for testing scenarios
 */

const express = require('express');
const router = express.Router();

/**
 * POST /admin/fail/:id
 * Simulate meter failure (offline)
 */
router.post('/fail/:id', (req, res) => {
    const meterId = req.params.id.toUpperCase();
    const meterSimulator = req.app.get('meterSimulator');

    meterSimulator.setOffline(meterId);

    res.json({
        meterId: meterId,
        status: 'offline',
        message: `Meter ${meterId} is now offline`
    });
});

/**
 * POST /admin/recover/:id
 * Recover failed meter (back online)
 */
router.post('/recover/:id', (req, res) => {
    const meterId = req.params.id.toUpperCase();
    const meterSimulator = req.app.get('meterSimulator');

    meterSimulator.setOnline(meterId);

    res.json({
        meterId: meterId,
        status: 'online',
        message: `Meter ${meterId} is now online`
    });
});

/**
 * POST /admin/malicious/:id
 * Enable malicious mode (returns 10x value)
 */
router.post('/malicious/:id', (req, res) => {
    const meterId = req.params.id.toUpperCase();
    const multiplier = parseInt(req.body.multiplier) || 10;
    const meterSimulator = req.app.get('meterSimulator');

    meterSimulator.setMalicious(meterId, multiplier);

    res.json({
        meterId: meterId,
        status: 'malicious',
        multiplier: multiplier,
        message: `Meter ${meterId} is now in malicious mode (${multiplier}x)`
    });
});

/**
 * POST /admin/honest/:id
 * Disable malicious mode
 */
router.post('/honest/:id', (req, res) => {
    const meterId = req.params.id.toUpperCase();
    const meterSimulator = req.app.get('meterSimulator');

    meterSimulator.setHonest(meterId);

    res.json({
        meterId: meterId,
        status: 'honest',
        message: `Meter ${meterId} is now in honest mode`
    });
});

/**
 * POST /admin/delay/:id/:ms
 * Add response delay to meter
 */
router.post('/delay/:id/:ms', (req, res) => {
    const meterId = req.params.id.toUpperCase();
    const delayMs = parseInt(req.params.ms) || 0;
    const meterSimulator = req.app.get('meterSimulator');

    meterSimulator.setDelay(meterId, delayMs);

    res.json({
        meterId: meterId,
        status: delayMs > 0 ? 'delayed' : 'normal',
        delay: delayMs,
        message: `Meter ${meterId} delay set to ${delayMs}ms`
    });
});

/**
 * GET /admin/status
 * Get status of all meters
 */
router.get('/status', (req, res) => {
    const meterSimulator = req.app.get('meterSimulator');
    const status = meterSimulator.getStatus();

    res.json(status);
});

/**
 * POST /admin/reset
 * Reset all meters to default state
 */
router.post('/reset', (req, res) => {
    const meterSimulator = req.app.get('meterSimulator');
    meterSimulator.reset();

    res.json({
        status: 'reset',
        message: 'All meters reset to default state'
    });
});

/**
 * POST /admin/subtle/:id
 * Enable subtle manipulation mode (+15%)
 */
router.post('/subtle/:id', (req, res) => {
    const meterId = req.params.id.toUpperCase();
    const percentage = parseFloat(req.body.percentage) || 15;
    const multiplier = 1 + (percentage / 100);
    const meterSimulator = req.app.get('meterSimulator');

    meterSimulator.setMalicious(meterId, multiplier);

    res.json({
        meterId: meterId,
        status: 'subtle_manipulation',
        percentage: percentage,
        multiplier: multiplier,
        message: `Meter ${meterId} is now in subtle manipulation mode (+${percentage}%)`
    });
});

/**
 * POST /admin/oracle/malicious/:oracleId
 * Enable malicious mode for a specific oracle (returns 10x value)
 * This allows testing Byzantine fault scenarios where only one oracle is malicious
 */
router.post('/oracle/malicious/:oracleId', (req, res) => {
    const oracleId = req.params.oracleId.toLowerCase();
    const multiplier = parseInt(req.body.multiplier) || 10;
    const meterSimulator = req.app.get('meterSimulator');

    meterSimulator.setOracleMalicious(oracleId, multiplier);

    res.json({
        oracleId: oracleId,
        status: 'malicious',
        multiplier: multiplier,
        message: `Oracle ${oracleId} is now in malicious mode (${multiplier}x)`
    });
});

/**
 * POST /admin/oracle/honest/:oracleId
 * Disable malicious mode for a specific oracle
 */
router.post('/oracle/honest/:oracleId', (req, res) => {
    const oracleId = req.params.oracleId.toLowerCase();
    const meterSimulator = req.app.get('meterSimulator');

    meterSimulator.setOracleHonest(oracleId);

    res.json({
        oracleId: oracleId,
        status: 'honest',
        message: `Oracle ${oracleId} is now in honest mode`
    });
});

/**
 * GET /admin/oracle/status
 * Get status of all oracles (malicious oracles only)
 */
router.get('/oracle/status', (req, res) => {
    const meterSimulator = req.app.get('meterSimulator');
    const status = meterSimulator.getOracleStatus();

    res.json(status);
});

module.exports = router;


