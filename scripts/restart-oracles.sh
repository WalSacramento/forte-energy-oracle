#!/bin/bash

# Script para reiniciar os oracles com CONTRACT_ADDRESS correto
# Uso: ./scripts/restart-oracles.sh

set -e

DEPLOYMENT_FILE="./deployments/localhost.json"

if [ ! -f "$DEPLOYMENT_FILE" ]; then
    echo "❌ Erro: Arquivo de deployment não encontrado em $DEPLOYMENT_FILE"
    echo "   Execute 'npm run deploy:local' primeiro"
    exit 1
fi

# Extrair CONTRACT_ADDRESS do arquivo de deployment
CONTRACT_ADDRESS=$(node -pe "JSON.parse(require('fs').readFileSync('$DEPLOYMENT_FILE')).contracts.OracleAggregator")

if [ -z "$CONTRACT_ADDRESS" ]; then
    echo "❌ Erro: Não foi possível extrair CONTRACT_ADDRESS do arquivo de deployment"
    exit 1
fi

echo "═══════════════════════════════════════════"
echo "  Reiniciando Oracles com CONTRACT_ADDRESS"
echo "═══════════════════════════════════════════"
echo "Contract Address: $CONTRACT_ADDRESS"
echo ""

# Exportar variável e reiniciar containers
export CONTRACT_ADDRESS

echo "🔄 Parando containers dos oracles..."
docker-compose stop oracle-node-1 oracle-node-2 oracle-node-3

echo "🚀 Iniciando containers com CONTRACT_ADDRESS..."
docker-compose up -d oracle-node-1 oracle-node-2 oracle-node-3

echo ""
echo "✅ Oracles reiniciados!"
echo ""
echo "📊 Verificando logs (aguarde 3 segundos)..."
sleep 3

echo ""
echo "Oracle 1:"
docker-compose logs --tail=5 oracle-node-1 | grep -E "(Loaded contract address|started successfully|Contract address not configured|error)" || true

echo ""
echo "Oracle 2:"
docker-compose logs --tail=5 oracle-node-2 | grep -E "(Loaded contract address|started successfully|Contract address not configured|error)" || true

echo ""
echo "Oracle 3:"
docker-compose logs --tail=5 oracle-node-3 | grep -E "(Loaded contract address|started successfully|Contract address not configured|error)" || true

echo ""
echo "💡 Para ver logs completos: docker-compose logs -f oracle-node-1"

