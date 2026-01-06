#!/bin/bash

set -e  # Exit on any error

echo "=========================================="
echo "🔧 EAON Rebuild & Test Pipeline"
echo "=========================================="
echo ""

# Step 1: Stop all containers
echo "📦 Step 1/6: Stopping all containers..."
docker-compose -f docker-compose.k6.yml down
echo "✅ Containers stopped"
echo ""

# Step 2: Rebuild oracle containers
echo "🏗️  Step 2/6: Rebuilding oracle containers (no cache)..."
docker-compose -f docker-compose.k6.yml build oracle-1 oracle-2 oracle-3 --no-cache
echo "✅ Oracles rebuilt"
echo ""

# Step 3: Rebuild orchestrator container
echo "🏗️  Step 3/6: Rebuilding test-orchestrator (no cache)..."
docker-compose -f docker-compose.k6.yml build test-orchestrator --no-cache
echo "✅ Orchestrator rebuilt"
echo ""

# Step 4: Start all containers
echo "🚀 Step 4/6: Starting all containers..."
docker-compose -f docker-compose.k6.yml up -d
echo "⏳ Waiting 30 seconds for containers to be ready..."
sleep 30
echo "✅ Containers started"
echo ""

# Step 5: Deploy contracts
echo "📜 Step 5/6: Deploying smart contracts..."
npm run deploy:local
echo "✅ Contracts deployed"
echo ""

# Step 6: Restart oracles (to pick up new contract addresses)
echo "🔄 Step 6/6: Restarting oracle nodes..."
docker-compose -f docker-compose.k6.yml restart oracle-1 oracle-2 oracle-3
echo "⏳ Waiting 5 seconds for oracles to reconnect..."
sleep 5
echo "✅ Oracles restarted"
echo ""

echo "=========================================="
echo "✅ Rebuild Complete!"
echo "=========================================="
echo ""
echo "📊 Next Steps:"
echo "  1. Run quick test:  ./test-nonce-robust.sh"
echo "  2. Run full k6:     npm run k6:baseline"
echo ""
echo "📋 Useful Commands:"
echo "  - Check oracle logs:        docker logs eaon-k6-oracle-1 --tail 50"
echo "  - Check orchestrator logs:  docker logs eaon-k6-orchestrator --tail 50"
echo "  - Check all containers:     docker-compose -f docker-compose.k6.yml ps"
echo ""
