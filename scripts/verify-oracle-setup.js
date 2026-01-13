#!/usr/bin/env node

/**
 * Script para verificar se os oracles estão configurados corretamente
 * Verifica: contrato deployado, oracles registrados, endereços corretos
 */

const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

const RPC_URL = process.env.RPC_URL || "http://localhost:8545";
const DEPLOYMENT_FILE = path.join(__dirname, "..", "deployments", "localhost.json");

// Oracle addresses e private keys (Hardhat defaults)
const ORACLES = [
    {
        name: "Oracle 1",
        address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
    },
    {
        name: "Oracle 2",
        address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
    },
    {
        name: "Oracle 3",
        address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        privateKey: "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
    }
];

async function main() {
    console.log("═══════════════════════════════════════════");
    console.log("  Verificação de Setup dos Oracles");
    console.log("═══════════════════════════════════════════\n");

    // 1. Verificar arquivo de deployment
    console.log("1️⃣ Verificando arquivo de deployment...");
    if (!fs.existsSync(DEPLOYMENT_FILE)) {
        console.error("❌ Arquivo de deployment não encontrado:", DEPLOYMENT_FILE);
        console.error("   Execute 'npm run deploy:local' primeiro");
        process.exit(1);
    }

    const deployment = JSON.parse(fs.readFileSync(DEPLOYMENT_FILE, "utf8"));
    const contractAddress = deployment.contracts?.OracleAggregator;

    if (!contractAddress) {
        console.error("❌ CONTRACT_ADDRESS não encontrado no arquivo de deployment");
        process.exit(1);
    }

    console.log("✅ Deployment file encontrado");
    console.log("   Contract Address:", contractAddress);
    console.log("");

    // 2. Conectar ao provider
    console.log("2️⃣ Conectando ao blockchain...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    try {
        const network = await provider.getNetwork();
        console.log("✅ Conectado à rede:", network.name, "(Chain ID:", network.chainId.toString() + ")");
    } catch (error) {
        console.error("❌ Erro ao conectar ao blockchain:", error.message);
        console.error("   Verifique se o Hardhat node está rodando em", RPC_URL);
        process.exit(1);
    }
    console.log("");

    // 3. Verificar se o contrato existe
    console.log("3️⃣ Verificando se o contrato existe...");
    const code = await provider.getCode(contractAddress);
    if (code === "0x" || code === "0x0") {
        console.error("❌ Nenhum contrato encontrado no endereço:", contractAddress);
        console.error("   Execute 'npm run deploy:local' para fazer o deploy");
        process.exit(1);
    }
    console.log("✅ Contrato encontrado no endereço");
    console.log("");

    // 4. Carregar ABI e conectar ao contrato
    console.log("4️⃣ Verificando registro dos oracles...");
    const OracleAggregatorABI = [
        "function getOracleInfo(address oracle) view returns (tuple(address nodeAddress, uint256 reputation, bool isActive, uint256 totalResponses, uint256 validResponses))",
        "function getActiveOracleCount() view returns (uint256)"
    ];

    const contract = new ethers.Contract(contractAddress, OracleAggregatorABI, provider);

    // Verificar contagem de oracles ativos
    try {
        const activeCount = await contract.getActiveOracleCount();
        console.log("✅ Contagem de oracles ativos:", activeCount.toString());
    } catch (error) {
        console.error("❌ Erro ao verificar contagem de oracles:", error.message);
        process.exit(1);
    }
    console.log("");

    // 5. Verificar cada oracle
    console.log("5️⃣ Verificando registro individual dos oracles...\n");
    let allRegistered = true;

    for (const oracle of ORACLES) {
        try {
            const oracleInfo = await contract.getOracleInfo(oracle.address);
            const nodeAddress = oracleInfo.nodeAddress || oracleInfo[0];
            const reputation = oracleInfo.reputation !== undefined ? oracleInfo.reputation : oracleInfo[1];
            const isActive = oracleInfo.isActive !== undefined ? oracleInfo.isActive : oracleInfo[2];

            if (nodeAddress && nodeAddress !== ethers.ZeroAddress && nodeAddress.toLowerCase() === oracle.address.toLowerCase()) {
                if (isActive) {
                    console.log(`✅ ${oracle.name}:`);
                    console.log(`   Endereço: ${oracle.address}`);
                    console.log(`   Registrado: Sim`);
                    console.log(`   Ativo: Sim`);
                    console.log(`   Reputação: ${reputation.toString()}`);
                } else {
                    console.log(`⚠️  ${oracle.name}:`);
                    console.log(`   Endereço: ${oracle.address}`);
                    console.log(`   Registrado: Sim`);
                    console.log(`   Ativo: Não (reputação: ${reputation.toString()})`);
                    allRegistered = false;
                }
            } else {
                console.log(`❌ ${oracle.name}:`);
                console.log(`   Endereço: ${oracle.address}`);
                console.log(`   Registrado: Não`);
                allRegistered = false;
            }
        } catch (error) {
            if (error.code === 'BAD_DATA' || error.value === '0x') {
                console.log(`❌ ${oracle.name}:`);
                console.log(`   Endereço: ${oracle.address}`);
                console.log(`   Registrado: Não (erro ao decodificar resposta)`);
                allRegistered = false;
            } else {
                console.error(`❌ Erro ao verificar ${oracle.name}:`, error.message);
                allRegistered = false;
            }
        }
        console.log("");
    }

    // 6. Resumo
    console.log("═══════════════════════════════════════════");
    if (allRegistered) {
        console.log("✅ Todos os oracles estão registrados e ativos!");
        console.log("\n💡 Próximos passos:");
        console.log("   1. Reinicie os containers dos oracles:");
        console.log("      npm run docker:restart-oracles");
        console.log("   2. Verifique os logs:");
        console.log("      docker-compose logs oracle-node-1");
    } else {
        console.log("❌ Alguns oracles não estão registrados!");
        console.log("\n💡 Solução:");
        console.log("   1. Execute o deploy novamente:");
        console.log("      npm run deploy:local");
        console.log("   2. Reinicie os containers dos oracles:");
        console.log("      npm run docker:restart-oracles");
    }
    console.log("═══════════════════════════════════════════\n");
}

main().catch((error) => {
    console.error("Erro fatal:", error);
    process.exit(1);
});


