/**
 * Mock EIP-1193 provider para testes Cypress.
 *
 * Usa a conta Hardhat #0 (determinística) como carteira e encaminha
 * todas as chamadas JSON-RPC ao nó Hardhat local (porta 8545).
 * Como o Hardhat mantém as contas de teste desbloqueadas, eth_sendTransaction
 * é executado sem necessidade de assinatura manual.
 */

export const HARDHAT_ACCOUNTS = {
  0: {
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  },
  1: {
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
  },
} as const;

const HARDHAT_CHAIN_ID = '0x7a69'; // 31337 em hex
const HARDHAT_RPC_URL  = 'http://localhost:8545';

type JsonRpcParams = unknown[];
type EventListener = (...args: unknown[]) => void;

async function jsonRpc(method: string, params: JsonRpcParams = []): Promise<unknown> {
  const res = await fetch(HARDHAT_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });
  const body = await res.json() as { result?: unknown; error?: { message: string } };
  if (body.error) throw new Error(body.error.message);
  return body.result;
}

export class MockEthereumProvider {
  isMetaMask = true;

  private _account: string;
  private _listeners = new Map<string, EventListener[]>();

  constructor(accountIndex: 0 | 1 = 0) {
    this._account = HARDHAT_ACCOUNTS[accountIndex].address;
  }

  get selectedAddress(): string { return this._account; }
  get chainId(): string { return HARDHAT_CHAIN_ID; }

  on(event: string, listener: EventListener): this {
    const list = this._listeners.get(event) ?? [];
    list.push(listener);
    this._listeners.set(event, list);
    return this;
  }

  removeListener(event: string, listener: EventListener): this {
    const list = this._listeners.get(event) ?? [];
    this._listeners.set(event, list.filter((l) => l !== listener));
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    (this._listeners.get(event) ?? []).forEach((l) => l(...args));
  }

  async request({ method, params = [] }: { method: string; params?: JsonRpcParams }): Promise<unknown> {
    switch (method) {
      case 'eth_requestAccounts':
        return [this._account];
      case 'eth_accounts':
        // Retorna lista vazia para forçar conexão explícita via botão.
        // Sem isso wagmi auto-conecta ao detectar window.ethereum disponível.
        return [];
      case 'eth_chainId':
        return HARDHAT_CHAIN_ID;
      case 'net_version':
        return '31337';
      case 'wallet_switchEthereumChain':
      case 'wallet_addEthereumChain':
        return null;
      default:
        return jsonRpc(method, params);
    }
  }

  /** Troca a conta ativa e emite o evento accountsChanged */
  switchAccount(accountIndex: 0 | 1): void {
    this._account = HARDHAT_ACCOUNTS[accountIndex].address;
    this.emit('accountsChanged', [this._account]);
  }
}

/** Injeta o mock provider em window.ethereum antes do carregamento da página */
export function injectMockEthereum(win: Window & { ethereum?: unknown }, accountIndex: 0 | 1 = 0): MockEthereumProvider {
  const provider = new MockEthereumProvider(accountIndex);
  Object.defineProperty(win, 'ethereum', {
    value: provider,
    writable: true,
    configurable: true,
  });
  return provider;
}
