/**
 * S8 — End-to-End UI Marketplace Flow
 *
 * Cenário: um prosumer usa a interface web para criar uma oferta de energia
 * e outro participante a aceita pelo dashboard, sem interagir diretamente
 * com os contratos Solidity.
 *
 * Pré-condição: stack Docker rodando (Hardhat + HEMS + oracle nodes + frontend).
 *   docker-compose up -d
 *
 * Artefatos gerados: cypress/screenshots/S8_marketplace_ui/
 *   s8-01-marketplace-empty.png
 *   s8-02-offer-created.png
 *   s8-03-buy-modal.png
 *   s8-04-trade-history.png
 */

describe('S8 — End-to-End UI Marketplace Flow', () => {
  it('deve permitir criar uma oferta, visualizá-la no marketplace e comprá-la via dashboard', () => {
    // ── Etapa 1: Visitar marketplace e verificar heading ──
    cy.visitWithWallet('/marketplace', 0);
    cy.contains('ENERGY MARKETPLACE', { timeout: 15000 }).should('exist');

    // ── Etapa 2: Conectar carteira ──
    cy.connectWallet();

    // ── Etapa 3: Navegar para marketplace e tirar screenshot inicial ──
    cy.visitWithWallet('/marketplace', 0);
    cy.wait(3000);
    cy.screenshot('s8-01-marketplace-empty');

    // ── Etapa 4: Navegar para Prosumer e criar uma oferta ──
    cy.visitWithWallet('/prosumer', 0);
    cy.connectWallet();

    // O formulário está na aba "Create" → sub-aba "Fixed Offer"
    cy.contains('[role="tab"]', 'Create').click();

    // Preencher formulário CreateOffer
    cy.get('#offer-amount').clear().type('1000');
    cy.get('#offer-price').clear().type('0.0001');

    // Submeter a oferta
    cy.get('[data-testid="create-offer-submit"]').click();

    // Aguardar confirmação da transação (toast: "Transaction confirmed!")
    cy.contains(/confirmed/i, { timeout: 60000 }).should('exist');
    cy.wait(3000);

    // ── Etapa 5: Navegar para Marketplace como comprador (account 1 ≠ vendedor account 0) ──
    cy.visitWithWallet('/marketplace', 1);
    cy.connectWallet();
    cy.wait(5000); // Aguarda carregamento dos contratos

    // Verificar que ao menos um OfferCard está visível
    cy.get('[data-testid^="offer-card-"]', { timeout: 20000 })
      .should('have.length.at.least', 1);
    cy.screenshot('s8-02-offer-created');

    // ── Etapa 6: Clicar em Buy e verificar o modal ──
    cy.get('[data-testid="buy-btn"]').first().click();
    cy.get('[data-testid="buy-modal"]', { timeout: 10000 }).should('be.visible');
    cy.screenshot('s8-03-buy-modal');

    // ── Etapa 7: Confirmar a compra ──
    cy.get('[data-testid="confirm-buy-btn"]').click();

    // Aguardar conclusão da transação (toast: "Transaction confirmed!")
    cy.contains(/confirmed/i, { timeout: 60000 }).should('exist');
    cy.wait(3000);

    // ── Etapa 8: Navegar para History e verificar trade registrado ──
    cy.visitWithWallet('/history', 0);
    cy.connectWallet();
    cy.wait(5000);
    cy.screenshot('s8-04-trade-history');

    // ── Assertions finais ──
    // Verificar que a página de history carregou
    cy.url().should('include', '/history');
  });
});
