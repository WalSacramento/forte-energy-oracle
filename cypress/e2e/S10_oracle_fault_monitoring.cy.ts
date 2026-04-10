/**
 * S10 — Oracle Fault Monitoring via UI (novo cenário)
 *
 * Injeta comportamento Bizantino exclusivamente no Oracle Node 3 via
 * HEMS admin API (endpoint /admin/oracle/malicious/:oracleId), dispara
 * um request de dados on-chain e verifica que o dashboard Oracle Health
 * exibe a queda de reputação. Depois restaura o comportamento honesto
 * e observa a recuperação — validando o mesmo trajeto do S7 Hardhat
 * através da camada de apresentação.
 *
 * Pré-condição: docker-compose up -d (Hardhat + HEMS + 3 oracles + frontend)
 *
 * Artefatos gerados: cypress/screenshots/S10_oracle_fault_monitoring/
 *   s10-01-all-online.png
 *   s10-02-oracle-penalized.png
 *   s10-03-reputation-recovering.png
 */

describe('S10 — Oracle Fault Monitoring via UI', () => {
  before(() => {
    // Garante estado honesto inicial em todos os oracles
    cy.task('injectOracleFault', { oracleId: '1', type: 'honest' });
    cy.task('injectOracleFault', { oracleId: '2', type: 'honest' });
    cy.task('injectOracleFault', { oracleId: '3', type: 'honest' });
    cy.wait(1000);
  });

  it('deve exibir penalização de oracle Bizantino e recuperação em tempo real no dashboard', () => {
    // ── Etapa 1: Oracle Health com todos os nós online ──
    cy.visitWithWallet('/oracle-health', 0);
    cy.contains('ORACLE HEALTH', { timeout: 15000 }).should('exist');
    cy.connectWallet();

    // Aguardar os 3 cards carregarem (polling a cada 5s)
    cy.get('[data-testid^="oracle-card-"]', { timeout: 30000 }).should('have.length', 3);

    cy.screenshot('s10-01-all-online');

    // ── Etapa 2: Injetar comportamento Bizantino SOMENTE no Oracle Node 3 ──
    // Usa /admin/oracle/malicious/3 → apenas o nó 3 retorna leituras outlier
    cy.injectOracleFault('3', 'malicious');
    cy.wait(500);

    // ── Etapa 3: Criar uma oferta via /prosumer para disparar um oracle request ──
    cy.visitWithWallet('/prosumer', 0);
    cy.connectWallet();

    // O formulário está na aba "Create" → sub-aba "Fixed Offer"
    cy.contains('[role="tab"]', 'Create').click();

    // METER001 é o default — sem necessidade de interagir com o Select
    cy.get('#offer-amount').clear().type('500');
    cy.get('#offer-price').clear().type('0.0001');
    cy.get('[data-testid="create-offer-submit"]').click();

    // Aguardar confirmação da transação (oracle request disparado)
    cy.contains(/success|confirmed/i, { timeout: 60000 }).should('exist');

    // Aguardar oracles responderem e OutlierDetected ser emitido (~15s)
    cy.wait(15000);

    // ── Etapa 4: Voltar ao Oracle Health e capturar estado pós-penalização ──
    cy.visitWithWallet('/oracle-health', 0);
    cy.connectWallet();

    // Aguardar novo ciclo de polling (5s)
    cy.wait(8000);
    cy.screenshot('s10-02-oracle-penalized');

    // ── Etapa 5: Restaurar Oracle 3 ao comportamento honesto ──
    cy.injectOracleFault('3', 'honest');
    cy.wait(500);

    // ── Etapa 6: Disparar 5 requests honestos para recuperar reputação (+1 cada) ──
    cy.visitWithWallet('/prosumer', 0);
    cy.connectWallet();
    cy.contains('[role="tab"]', 'Create').click();

    // Submeter 5 ofertas com o formulário já preenchido
    cy.wrap([1, 2, 3, 4, 5]).each(() => {
      cy.get('#offer-amount').clear().type('100');
      cy.get('#offer-price').clear().type('0.0001');
      cy.get('[data-testid="create-offer-submit"]').click();
      cy.contains(/success|confirmed/i, { timeout: 60000 }).should('exist');
      cy.wait(12000); // Aguardar ciclo completo do oracle
    });

    // ── Etapa 7: Verificar recuperação da reputação no dashboard ──
    cy.visitWithWallet('/oracle-health', 0);
    cy.connectWallet();
    cy.wait(8000);
    cy.screenshot('s10-03-reputation-recovering');

    // ── Assertions finais ──
    cy.get('[data-testid^="oracle-card-"]').should('have.length', 3);
    cy.url().should('include', '/oracle-health');
  });
});
