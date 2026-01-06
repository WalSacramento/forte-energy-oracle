#!/bin/bash

# Script to start an oracle node with correct configuration
# Usage: ./scripts/start-oracle.sh [1|2|3]

ORACLE_NUM=${1:-1}

# Load deployment info
DEPLOYMENT_FILE="./deployments/localhost.json"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "❌ Error: Deployment file not found at $DEPLOYMENT_FILE"
    echo "   Please run 'npm run deploy:local' first"
    exit 1
fi

# Extract contract address using node
CONTRACT_ADDRESS=$(node -pe "JSON.parse(require('fs').readFileSync('$DEPLOYMENT_FILE')).contracts.OracleAggregator")

# Get oracle config from .env or use defaults
source .env 2>/dev/null || true

case $ORACLE_NUM in
    1)
        NODE_ID="oracle-1"
        NODE_TYPE="prosumer"
        PORT=${ORACLE_1_PORT:-4001}
        PRIVATE_KEY=${ORACLE_1_PRIVATE_KEY:-"0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"}
        ;;
    2)
        NODE_ID="oracle-2"
        NODE_TYPE="consumer"
        PORT=${ORACLE_2_PORT:-4002}
        PRIVATE_KEY=${ORACLE_2_PRIVATE_KEY:-"0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"}
        ;;
    3)
        NODE_ID="oracle-3"
        NODE_TYPE="dso"
        PORT=${ORACLE_3_PORT:-4003}
        PRIVATE_KEY=${ORACLE_3_PRIVATE_KEY:-"0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"}
        ;;
    *)
        echo "❌ Invalid oracle number. Use 1, 2, or 3"
        exit 1
        ;;
esac

RPC_URL=${HARDHAT_RPC_URL:-"http://localhost:8545"}
HEMS_API_URL=${HEMS_API_URL:-"http://localhost:3000"}

echo "═══════════════════════════════════════════"
echo "  Starting Oracle Node $ORACLE_NUM"
echo "═══════════════════════════════════════════"
echo "Node ID:        $NODE_ID"
echo "Node Type:      $NODE_TYPE"
echo "Port:           $PORT"
echo "RPC URL:        $RPC_URL"
echo "HEMS API:       $HEMS_API_URL"
echo "Contract:       $CONTRACT_ADDRESS"
echo "═══════════════════════════════════════════"
echo ""

cd oracle-nodes

NODE_ID=$NODE_ID \
NODE_TYPE=$NODE_TYPE \
PORT=$PORT \
RPC_URL=$RPC_URL \
HEMS_API_URL=$HEMS_API_URL \
PRIVATE_KEY=$PRIVATE_KEY \
CONTRACT_ADDRESS=$CONTRACT_ADDRESS \
npm start
