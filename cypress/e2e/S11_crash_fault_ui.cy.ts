/**
 * S11 — Crash Fault: Tolerância a Oracle Offline via UI
 *
 * Para o container eaon-oracle-1 via Docker para simular uma falha de crash,
 * dispara um oracle request e verifica que o sistema ainda agrega respostas
 * com 2/3 oracles ativos (minResponses=2). Demonstra a tolerância a falhas
 * de crash do protocolo de consenso do EAON.
 *
 * Após a prova de funcionamento, reinicia o oracle e verifica recuperação.
 *
 * Pré-condição: docker-compose up -d (Hardhat + HEMS + 3 oracles + frontend)
 *
 * Artefatos gerados: cypress/screenshots/S11_crash_fault_ui/
 *   s11-01-all-online.png
 *   s11-02-oracle1-offline.png
 *   s11-03-oracle1-recovered.png
 */

describe('S11 — Crash Fault: Tolerância a Oracle Offline via UI', () => {
  // Endereços determinísticos do deployment Hardhat local
  const ORACLE_AGGREGATOR  = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
  const ORACLE_1_ADDRESS   = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
  const ORACLE_1_CONTAINER = 'eaon-oracle-1';
  before(() => {
    // Garante que os oracles 2 e 3 estão honestos antes do teste
    cy.task('injectOracleFault', { oracleId: '2', type: 'honest' });
    cy.task('injectOracleFault', { oracleId: '3', type: 'honest' });
    cy.wait(1000);
  });

  after(() => {
    // Garante reinício do oracle-1 mesmo em caso de falha no teste
    cy.task('startOracleContainer', { containerName: ORACLE_1_CONTAINER });
  });

  it('deve agregar respostas com 2/3 oracles quando oracle-1 está offline', () => {
    // ── Etapa 1: Baseline — todos os oracles online ──
    cy.visitWithWallet('/oracle-health', 0);
    cy.contains('ORACLE HEALTH', { timeout: 15000 }).should('exist');
    cy.connectWallet();
    cy.get('[data-testid^="oracle-card-"]', { timeout: 30000 }).should('have.length', 3);

    // Leitura on-chain da reputação inicial do Oracle 1 (evidência para o paper)
    cy.task('getOracleReputation', {
      contractAddress: ORACLE_AGGREGATOR,
      oracleAddress: ORACLE_1_ADDRESS,
    }).then((rep) => {
      cy.wrap(rep).as('reputationOracle1Before');
      cy.log(`[on-chain] Reputação inicial Oracle 1: ${rep}`);
    });

    cy.screenshot('s11-01-all-online');

    // ── Etapa 2: Derrubar o Oracle 1 via Docker (crash fault) ──
    cy.task('stopOracleContainer', { containerName: ORACLE_1_CONTAINER })
      .then((result) => {
        cy.log(`Container ${ORACLE_1_CONTAINER} parado: ${JSON.stringify(result)}`);
      });
    cy.wait(3000); // Propagação do crash

    // ── Etapa 3: Criar oferta — dispara oracle request com oracle-1 offline ──
    cy.visitWithWallet('/prosumer', 0);
    cy.connectWallet();
    cy.contains('[role="tab"]', 'Create').click();

    cy.get('#offer-amount').clear().type('300');
    cy.get('#offer-price').clear().type('0.0001');
    cy.get('[data-testid="create-offer-submit"]').click();

    // O sistema deve agregar com apenas 2 oracles (minResponses=2 no contrato)
    cy.contains(/success|confirmed/i, { timeout: 60000 }).should('exist',
      'Sistema deve completar agregação com 2/3 oracles ativos (tolerância a crash)',
    );
    cy.wait(15000);

    // ── Etapa 4: Verificar que a oferta foi criada no marketplace ──
    // Prova que o consenso de 2/3 funcionou e o trade foi registrado on-chain
    cy.visitWithWallet('/marketplace', 0);
    cy.connectWallet();
    // Aguarda wagmi conectar ao chain e useReadContract(getActiveOffers) carregar
    cy.wait(8000);
    cy.get('[data-testid^="offer-card-"]', { timeout: 30000 }).should(
      'have.length.at.least', 1,
      'Oferta deve aparecer no marketplace — prova que consenso 2/3 foi alcançado',
    );
    cy.screenshot('s11-02-oracle1-offline');

    // ── Etapa 5: Verificar que reputação do Oracle 1 não foi alterada ──
    // Oracle em crash não responde — não recebe penalidade de outlier,
    // apenas perde a chance de ganhar +1 (timeout silencioso)
    cy.task('getOracleReputation', {
      contractAddress: ORACLE_AGGREGATOR,
      oracleAddress: ORACLE_1_ADDRESS,
    }).then((reputationAfterCrash) => {
      cy.get('@reputationOracle1Before').then((reputationBefore) => {
        const before = (reputationBefore as unknown) as number;
        const after  = (reputationAfterCrash as unknown) as number;
        cy.log(`[on-chain] Reputação Oracle 1 durante crash: ${before} → ${after}`);
        // Oracle em crash não envia resposta → não é detectado como outlier
        // Sua reputação NÃO deve ter sofrido penalidade de -5
        expect(after).to.be.gte(
          before - 1,
          `Oracle em crash não deve ser penalizado como Byzantine (${before} → ${after})`,
        );
      });
    });

    // ── Etapa 6: Dashboard de saúde com oracle-1 offline ──
    cy.visitWithWallet('/oracle-health', 0);
    cy.connectWallet();
    cy.wait(8000);

    // ── Etapa 7: Reiniciar Oracle 1 e verificar recuperação ──
    cy.task('startOracleContainer', { containerName: ORACLE_1_CONTAINER })
      .then((result) => {
        cy.log(`Container ${ORACLE_1_CONTAINER} reiniciado: ${JSON.stringify(result)}`);
      });
    cy.wait(15000); // Tempo de inicialização + reconexão à blockchain

    cy.visitWithWallet('/oracle-health', 0);
    cy.connectWallet();
    cy.wait(8000);
    cy.screenshot('s11-03-oracle1-recovered');

    // ── Assertions finais ──
    cy.get('[data-testid^="oracle-card-"]').should('have.length', 3);
    cy.url().should('include', '/oracle-health');
  });
});
