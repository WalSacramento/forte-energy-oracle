import { defineConfig } from 'cypress';

export default defineConfig({
  reporter: 'cypress-mochawesome-reporter',
  reporterOptions: {
    charts: true,
    reportPageTitle: 'EAON E2E Test Report',
    embeddedScreenshots: true,
    inlineAssets: true,
    saveAllAttempts: false,
    reportDir: 'results/local/cypress',
    reportFilename: 'e2e-report',
    overwrite: true,
    html: true,
    json: true,
  },
  e2e: {
    baseUrl: 'http://localhost:3001',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    viewportWidth: 1280,
    viewportHeight: 900,
    defaultCommandTimeout: 30000,
    requestTimeout: 30000,
    responseTimeout: 30000,
    screenshotOnRunFailure: true,
    video: false,
    setupNodeEvents(on) {
      // Flags de sandbox só se aplicam a Chrome/Chromium — Electron não suporta `args`
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          launchOptions.args = launchOptions.args ?? [];
          launchOptions.args.push('--no-sandbox', '--disable-setuid-sandbox');
        }
        return launchOptions;
      });

      on('task', {
        // Reseta o estado do Hardhat entre testes
        async resetHardhat() {
          const response = await fetch('http://localhost:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: 1,
              method: 'hardhat_reset',
              params: [],
            }),
          });
          const data = await response.json() as { result: unknown };
          return data.result ?? null;
        },

        // Injeta falha comportamental nos smart meters via HEMS admin API
        async injectFault({ meterId, type }: { meterId: string; type: string }) {
          const endpointMap: Record<string, string> = {
            malicious: `http://localhost:3000/admin/malicious/${meterId}`,
            honest:    `http://localhost:3000/admin/honest/${meterId}`,
            crash:     `http://localhost:3000/admin/fail/${meterId}`,
            recover:   `http://localhost:3000/admin/recover/${meterId}`,
          };
          const url = endpointMap[type];
          if (!url) throw new Error(`Unknown fault type: ${type}`);
          const response = await fetch(url, { method: 'POST' });
          return response.json();
        },

        // Recupera recibo de transação on-chain como evidência
        async getTransactionReceipt(hash: string) {
          const response = await fetch('http://localhost:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'eth_getTransactionReceipt',
              params: [hash],
            }),
          });
          const { result } = await response.json() as { result: unknown };
          return result ?? null;
        },

        // Fault injection no nível do oracle node (apenas aquele oracle fica malicioso)
        async injectOracleFault({ oracleId, type }: { oracleId: string; type: string }) {
          const url = type === 'malicious'
            ? `http://localhost:3000/admin/oracle/malicious/${oracleId}`
            : `http://localhost:3000/admin/oracle/honest/${oracleId}`;
          const response = await fetch(url, { method: 'POST' });
          return response.json();
        },

        // Para um container Docker (crash fault)
        async stopOracleContainer({ containerName }: { containerName: string }) {
          const { execSync } = await import('child_process');
          try {
            execSync(`docker stop ${containerName}`, { timeout: 10000 });
            return { success: true };
          } catch (e) {
            return { success: false, error: String(e) };
          }
        },

        // Reinicia um container Docker (crash recovery)
        async startOracleContainer({ containerName }: { containerName: string }) {
          const { execSync } = await import('child_process');
          try {
            execSync(`docker start ${containerName}`, { timeout: 15000 });
            return { success: true };
          } catch (e) {
            return { success: false, error: String(e) };
          }
        },

        // Lê o arquivo de deployment para obter endereços de contratos e oracles
        async readDeployment() {
          const { readFileSync } = await import('fs');
          const { join } = await import('path');
          const filePath = join(process.cwd(), 'deployments', 'localhost.json');
          return JSON.parse(readFileSync(filePath, 'utf-8'));
        },

        // Consulta reputação de um oracle pelo índice
        async getOracleReputation({ contractAddress, oracleAddress }: { contractAddress: string; oracleAddress: string }) {
          // Chama getOracleInfo(address) — seletor correto: keccak256("getOracleInfo(address)")[0:4]
          const data = '0xbfdb6b04' + oracleAddress.slice(2).padStart(64, '0');
          const response = await fetch('http://localhost:8545', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              jsonrpc: '2.0',
              id: Date.now(),
              method: 'eth_call',
              params: [{ to: contractAddress, data }, 'latest'],
            }),
          });
          const json = await response.json() as { result?: string; error?: { message: string } };
          if (json.error) throw new Error(`getOracleReputation falhou: ${json.error.message}`);
          if (!json.result || json.result === '0x') return 0;
          // OracleNode struct: address (32 bytes) | uint256 reputation (32 bytes) | bool isActive (32 bytes)
          const reputation = parseInt(json.result.slice(66, 130), 16);
          return Number.isNaN(reputation) ? 0 : reputation;
        },
      });
    },
  },
});
