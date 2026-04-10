/// <reference types="cypress" />

import { injectMockEthereum, MockEthereumProvider, HARDHAT_ACCOUNTS } from './ethereum';

// ─── Extensões de tipo ──────────────────────────────────────────────────────

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Visita uma rota limpando localStorage (evita wagmi auto-reconnect)
       * e injetando o mock EIP-1193 antes do carregamento da página.
       */
      visitWithWallet(url: string, accountIndex?: 0 | 1): Chainable<void>;

      /**
       * Conecta a carteira via TopBar. Resiliente: se já estiver conectada
       * (disconnect-btn visível), pula o clique.
       */
      connectWallet(): Chainable<void>;

      /**
       * Injeta falha num smart meter via HEMS admin API (nível do meter).
       * @param meterId  Ex: 'METER001'
       * @param type     'malicious' | 'honest' | 'crash' | 'recover'
       */
      injectFault(meterId: string, type: 'malicious' | 'honest' | 'crash' | 'recover'): Chainable<void>;

      /**
       * Injeta falha no nível do oracle node via HEMS admin API.
       * Apenas aquele oracle passa a retornar leituras outlier.
       * @param oracleId  '1', '2' ou '3'
       * @param type      'malicious' | 'honest'
       */
      injectOracleFault(oracleId: string, type: 'malicious' | 'honest'): Chainable<void>;

      /** Reseta o estado do Hardhat ao bloco gênese. */
      resetHardhat(): Chainable<void>;

      /** Aguarda confirmação de uma transação on-chain. */
      waitForTx(hash: string): Chainable<Record<string, unknown>>;
    }
  }
}

// ─── Implementações ─────────────────────────────────────────────────────────

let _provider: MockEthereumProvider | null = null;

Cypress.Commands.add('visitWithWallet', (url: string, accountIndex: 0 | 1 = 0) => {
  cy.visit(url, {
    onBeforeLoad(win) {
      // Limpa o estado persistido do wagmi ANTES do JS carregar
      // Isso evita que wagmi auto-reconecte uma sessão anterior
      win.localStorage.clear();
      win.sessionStorage.clear();
      _provider = injectMockEthereum(win as Window & { ethereum?: unknown }, accountIndex);
    },
  });
});

Cypress.Commands.add('connectWallet', () => {
  // Aguarda qualquer um dos dois botões aparecer (resolve race condition de hidratação React)
  cy.get('[data-testid="connect-wallet-btn"],[data-testid="disconnect-btn"]', { timeout: 20000 })
    .should('be.visible')
    .first()
    .then(($el) => {
      // Se já está conectado (disconnect-btn), pula o clique
      if ($el.attr('data-testid') === 'disconnect-btn') return;
      $el.click();
    });
  // Confirma que a conexão foi estabelecida
  cy.get('[data-testid="disconnect-btn"]', { timeout: 20000 }).should('be.visible');
});

Cypress.Commands.add('injectFault', (meterId, type) => {
  cy.task('injectFault', { meterId, type });
});

Cypress.Commands.add('injectOracleFault', (oracleId, type) => {
  cy.task('injectOracleFault', { oracleId, type });
});

Cypress.Commands.add('resetHardhat', () => {
  cy.task('resetHardhat');
  cy.wait(1000);
});

Cypress.Commands.add('waitForTx', (hash: string) => {
  cy.wrap(null, { timeout: 60000 }).should(() => {
    return cy.task('getTransactionReceipt', hash).then((receipt) => {
      expect(receipt).to.not.be.null;
    });
  });
  return cy.task('getTransactionReceipt', hash) as Cypress.Chainable<Record<string, unknown>>;
});

export { HARDHAT_ACCOUNTS };
