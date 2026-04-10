import { defineConfig } from 'cypress';

export default defineConfig({
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
            : `http://localhost:3000/admin/honest/${oracleId}`;
          const response = await fetch(url, { method: 'POST' });
          return response.json();
        },

        // Consulta reputação de um oracle pelo índice
        async getOracleReputation({ contractAddress, oracleAddress }: { contractAddress: string; oracleAddress: string }) {
          // Chama getOracleInfo(address) — seletor 0x693f2f51
          const data = '0x693f2f51' + oracleAddress.slice(2).padStart(64, '0');
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
          const { result } = await response.json() as { result: string };
          // Extrai o campo reputation (segundo uint256 no retorno)
          const reputation = parseInt(result.slice(66, 130), 16);
          return reputation;
        },
      });
    },
  },
});
