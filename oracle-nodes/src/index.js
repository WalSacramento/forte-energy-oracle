/**
 * Oracle Node Entry Point
 * Starts the oracle node with configuration from environment
 */

require('dotenv').config();
const OracleNode = require('./OracleNode');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Load configuration
const config = {
    nodeId: process.env.NODE_ID || 'oracle-1',
    nodeType: process.env.NODE_TYPE || 'prosumer',
    port: parseInt(process.env.PORT) || 4001,
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    hemsApiUrl: process.env.HEMS_API_URL || 'http://localhost:3000',
    privateKey: process.env.PRIVATE_KEY,
    contractAddress: process.env.CONTRACT_ADDRESS
};

// Try to load contract address from deployment file if not in env
if (!config.contractAddress) {
    try {
        // Try multiple paths: Docker volume mount, relative from src, and absolute
        const possiblePaths = [
            path.join('/app', 'deployments', 'localhost.json'), // Docker volume mount
            path.join(__dirname, '..', '..', 'deployments', 'localhost.json'), // Relative from project root
            path.join(__dirname, '..', 'deployments', 'localhost.json') // Relative from src
        ];
        
        let deploymentPath = null;
        for (const possiblePath of possiblePaths) {
            if (fs.existsSync(possiblePath)) {
                deploymentPath = possiblePath;
                break;
            }
        }
        
        if (deploymentPath) {
            const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
            config.contractAddress = deployment.contracts.OracleAggregator;
            console.log('Loaded contract address from deployment file:', deploymentPath);
        }
    } catch (error) {
        console.warn('Could not load deployment file:', error.message);
    }
}

// Validate required config
if (!config.privateKey) {
    console.error('ERROR: PRIVATE_KEY environment variable is required');
    process.exit(1);
}

// Create and start oracle node
const oracleNode = new OracleNode(config);

// Express server for metrics and health
const app = express();

app.get('/health', (req, res) => {
    res.json({
        status: oracleNode.isRunning ? 'healthy' : 'stopped',
        nodeId: config.nodeId,
        nodeType: config.nodeType,
        connected: oracleNode.isConnected,
        contractAddress: config.contractAddress
    });
});

app.get('/metrics', (req, res) => {
    const metrics = oracleNode.getMetrics();
    res.json(metrics);
});

// Start server
app.listen(config.port, () => {
    console.log(`Oracle node ${config.nodeId} metrics server on port ${config.port}`);
});

// Start oracle node
async function main() {
    try {
        await oracleNode.start();
    } catch (error) {
        console.error('Failed to start oracle node:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\nShutting down oracle node...');
    await oracleNode.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\nShutting down oracle node...');
    await oracleNode.stop();
    process.exit(0);
});

main();


