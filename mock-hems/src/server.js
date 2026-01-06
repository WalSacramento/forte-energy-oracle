/**
 * Mock HEMS API Server
 * Simulates a Home Energy Management System API for testing
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const smartmeterRoutes = require('./routes/smartmeter');
const adminRoutes = require('./routes/admin');
const MeterSimulator = require('./services/MeterSimulator');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize meter simulator
const meterSimulator = new MeterSimulator();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Make simulator available to routes
app.set('meterSimulator', meterSimulator);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Routes
app.use('/smartmeter', smartmeterRoutes);
app.use('/admin', adminRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.path
    });
});

// Start server
app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════');
    console.log('       Mock HEMS API Server                ');
    console.log('═══════════════════════════════════════════');
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log('');
    console.log('Available endpoints:');
    console.log('  GET  /smartmeter/:id/reading');
    console.log('  POST /admin/fail/:id');
    console.log('  POST /admin/recover/:id');
    console.log('  POST /admin/malicious/:id');
    console.log('  POST /admin/honest/:id');
    console.log('  POST /admin/delay/:id/:ms');
    console.log('  GET  /admin/status');
    console.log('  POST /admin/reset');
    console.log('  POST /admin/oracle/malicious/:oracleId');
    console.log('  POST /admin/oracle/honest/:oracleId');
    console.log('  GET  /admin/oracle/status');
    console.log('═══════════════════════════════════════════');
});

module.exports = app;


