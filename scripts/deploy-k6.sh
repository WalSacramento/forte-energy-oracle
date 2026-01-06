#!/bin/bash

# Script para fazer deploy dos contratos na rede Hardhat do container k6
# Uso: ./scripts/deploy-k6.sh

set -e

echo "═══════════════════════════════════════════"
echo "  Deploy dos Contratos para k6 Network"
echo "═══════════════════════════════════════════"
echo ""

# Verificar se o container hardhat está rodando
if ! docker ps | grep -q eaon-k6-hardhat; then
    echo "❌ Erro: Container eaon-k6-hardhat não está rodando"
    echo "   Execute 'npm run k6:setup' primeiro"
    exit 1
fi

echo "✅ Container hardhat encontrado"
echo ""

# Aguardar Hardhat estar pronto
echo "⏳ Aguardando Hardhat node estar pronto..."
sleep 5

# Executar deploy dentro do container
echo "📦 Executando deploy dos contratos..."
docker exec eaon-k6-hardhat npx hardhat run scripts/deploy.js --network localhost

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "💡 O arquivo deployments/localhost.json foi atualizado"
echo "   Os oracles devem detectar o novo endereço automaticamente"
echo ""
echo "🔄 Reiniciando oracles para carregar o novo endereço..."
docker-compose -f docker-compose.k6.yml restart oracle-1 oracle-2 oracle-3 test-orchestrator

echo ""
echo "✅ Pronto! Aguarde alguns segundos para os serviços iniciarem..."
echo ""

