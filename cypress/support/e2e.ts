import 'cypress-mochawesome-reporter/register';
// Importa os comandos customizados
import './commands';

// Suprime erros de uncaught exception dos wagmi / Web3 que não afetam os testes
Cypress.on('uncaught:exception', (err) => {
  // Ignora erros de conexão RPC durante inicialização do wagmi
  if (
    err.message.includes('provider') ||
    err.message.includes('ethereum') ||
    err.message.includes('chain') ||
    err.message.includes('ECONNREFUSED')
  ) {
    return false;
  }
  return true;
});
