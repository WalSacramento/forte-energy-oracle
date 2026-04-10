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
 * Inclui asserções on-chain explícitas via getOracleReputation() para
 * evidência verificável na publicação acadêmica.
 *
 * Pré-condição: docker-compose up -d (Hardhat + HEMS + 3 oracles + frontend)
 *
 * Artefatos gerados: cypress/screenshots/S10_oracle_fault_monitoring/
 *   s10-01-all-online.png
 *   s10-02-oracle-penalized.png
 *   s10-03-reputation-recovering.png
 */

describe('S10 — Oracle Fault Monitoring via UI', () => {
  // Endereços determinísticos do deployment Hardhat local
  const ORACLE_AGGREGATOR = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const ORACLE_3_ADDRESS   = '0x90F79bf6EB2c4f870365E785982E1f101E93b906';
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

    // Leitura on-chain da reputação inicial do Oracle 3 (evidência para o paper)
    cy.task('getOracleReputation', {
      contractAddress: ORACLE_AGGREGATOR,
      oracleAddress: ORACLE_3_ADDRESS,
    }).then((rep) => {
      cy.wrap(rep).as('reputationBefore');
      cy.log(`[on-chain] Reputação inicial Oracle 3: ${rep}`);
    });

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

    // Asserção on-chain: reputação deve ter diminuído (penalidade -5)
    cy.task('getOracleReputation', {
      contractAddress: ORACLE_AGGREGATOR,
      oracleAddress: ORACLE_3_ADDRESS,
    }).then((reputationAfter) => {
      cy.get('@reputationBefore').then((reputationBefore) => {
        const before = (reputationBefore as unknown) as number;
        const after  = (reputationAfter  as unknown) as number;
        cy.log(`[on-chain] Reputação após falha Bizantina: ${before} → ${after} (delta: ${before - after})`);
        expect(after).to.be.lessThan(
          before,
          `Oracle 3 deveria ser penalizado: reputação ${before} → ${after}`,
        );
        cy.wrap(after).as('reputationAfterPenalty');
      });
    });

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

    // Asserção on-chain: reputação deve ter aumentado após comportamento honesto
    cy.task('getOracleReputation', {
      contractAddress: ORACLE_AGGREGATOR,
      oracleAddress: ORACLE_3_ADDRESS,
    }).then((reputationFinal) => {
      cy.get('@reputationAfterPenalty').then((reputationAfterPenalty) => {
        cy.get('@reputationBefore').then((reputationBefore) => {
          const initial = (reputationBefore as unknown) as number;
          const penalty = (reputationAfterPenalty as unknown) as number;
          const final   = (reputationFinal as unknown) as number;
          cy.log(`[on-chain] Recuperação: inicial=${initial} → penalizado=${penalty} → recuperado=${final}`);
          expect(final).to.be.greaterThan(
            penalty,
            `Oracle 3 deveria estar se recuperando: ${penalty} → ${final}`,
          );
          expect(final).to.be.greaterThan(
            0,
            'Oracle 3 não deve ser desativado após recuperação',
          );
        });
      });
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
