// Wallet connection + SIWE sign-in. Apache-2.0
//
// Connects a wallet (injected EIP-1193 / WalletConnect in production; a viem-backed test account
// when window.__TB_TEST_PK__ is set), performs SIWE (EIP-4361) login, and provisions the messaging
// identity. The login signature (with a nonce) authenticates the session; a separate fixed
// signature deterministically derives the long-term identity key (see @teleblock/shared).
import { privateKeyToAccount } from 'viem/accounts';
import { toHex, hexToBytes } from 'viem';
import {
  buildLoginMessage,
  verifyLogin,
  identityChallenge,
  provisionIdentity,
} from '@teleblock/shared';
import type { Identity } from './identity';

export interface Connector {
  address: `0x${string}`;
  kind: 'injected' | 'test';
  signMessage(message: string): Promise<`0x${string}`>;
}

declare global {
  interface Window {
    ethereum?: { request(args: { method: string; params?: unknown[] }): Promise<unknown> };
    __TB_TEST_PK__?: `0x${string}`;
  }
}

export type Eip1193 = { request(args: { method: string; params?: unknown[] }): Promise<unknown> };

// A random 32-byte tx hash for the test provider (no chain to mine against in CI).
function fakeTxHash(): `0x${string}` {
  const b = new Uint8Array(32);
  (globalThis.crypto ?? (window as unknown as { crypto: Crypto }).crypto).getRandomValues(b);
  return ('0x' + Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')) as `0x${string}`;
}

/**
 * A faithful in-page EIP-1193 provider backed by a viem account — used in CI/E2E (set via
 * window.__TB_TEST_PK__) so the SAME injected-wallet code path (accounts, chain checks, personal_sign)
 * runs without a browser extension.
 */
function makeTestProvider(pk: `0x${string}`): Eip1193 {
  const account = privateKeyToAccount(pk);
  let chainId = '0x14a34'; // 84532 Base Sepolia
  return {
    async request({ method, params }) {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [account.address];
        case 'eth_chainId':
          return chainId;
        case 'wallet_switchEthereumChain':
          chainId = (params?.[0] as { chainId: string }).chainId;
          return null;
        case 'personal_sign': {
          const data = (params?.[0] as `0x${string}`); // 0x-hex of the message bytes
          return account.signMessage({ message: { raw: data } });
        }
        case 'eth_sendTransaction':
          // No chain to mine against in CI — return a well-formed hash so the UI path is exercised.
          return fakeTxHash();
        default:
          throw Object.assign(new Error(`unsupported method ${method}`), { code: 4200 });
      }
    },
  };
}

export function getProvider(): Eip1193 | null {
  if (typeof window === 'undefined') return null;
  if (window.ethereum) return window.ethereum;
  if (window.__TB_TEST_PK__) return makeTestProvider(window.__TB_TEST_PK__);
  return null;
}

/** Best-effort: ensure the wallet is on the target chain (switch if not). Never blocks login. */
async function ensureChain(provider: Eip1193, chainId: number) {
  try {
    const current = (await provider.request({ method: 'eth_chainId' })) as string;
    if (parseInt(current, 16) === chainId) return;
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x' + chainId.toString(16) }] });
  } catch {
    /* chain not added (4902) or user declined — proceed; login/signing still works */
  }
}

/** Connect a wallet and return a signer. Uses an injected provider, or a viem-backed test provider. */
export async function connectWallet(opts?: { chainId?: number }): Promise<Connector> {
  const provider = getProvider();
  if (!provider) throw new Error('No wallet found. Install a wallet or use “Create an identity”.');

  let accounts: string[];
  try {
    accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[];
  } catch (e) {
    if ((e as { code?: number }).code === 4001) throw new Error('Wallet connection was rejected.');
    throw e;
  }
  const address = accounts[0] as `0x${string}`;
  await ensureChain(provider, opts?.chainId ?? 84532);

  return {
    address,
    kind: typeof window !== 'undefined' && window.ethereum ? 'injected' : 'test',
    signMessage: async (message) => {
      try {
        return (await provider.request({ method: 'personal_sign', params: [toHex(message), address] })) as `0x${string}`;
      } catch (e) {
        if ((e as { code?: number }).code === 4001) throw new Error('Signature request was rejected.');
        throw e;
      }
    },
  };
}

export interface WalletSession {
  identity: Identity;
  loginVerified: boolean;
}

/**
 * Full wallet login: SIWE message → sign → verify → derive identity from the fixed challenge.
 * @param connector a connected wallet
 * @param opts SIWE domain binding (defaults to the current origin)
 */
export async function walletSignIn(
  connector: Connector,
  opts?: { domain?: string; uri?: string; chainId?: number },
): Promise<WalletSession> {
  const domain = opts?.domain ?? (typeof location !== 'undefined' ? location.host : 'localhost');
  const uri = opts?.uri ?? (typeof location !== 'undefined' ? location.origin : 'http://localhost');
  const chainId = opts?.chainId ?? 84532; // Base Sepolia

  // 1) SIWE session auth (nonce-bound).
  const nonce = randomNonce();
  const message = buildLoginMessage({ address: connector.address, domain, uri, chainId, nonce });
  const signature = await connector.signMessage(message);
  const res = await verifyLogin({ message, signature, expectedDomain: domain, expectedNonce: nonce });
  if (!res.valid) throw new Error(`SIWE verification failed: ${res.reason}`);

  // 2) Deterministic identity derivation from the fixed, nonce-free challenge.
  const identitySig = await connector.signMessage(identityChallenge(connector.address));
  const { signing, keyMaterial, bundle } = await provisionIdentity({
    identitySignature: hexToBytes(identitySig),
  });

  return {
    identity: { address: connector.address, signing, keyMaterial, bundle },
    loginVerified: true,
  };
}

// SIWE nonce: 8+ alphanumerics. Uses crypto.getRandomValues in the browser.
function randomNonce(): string {
  const bytes = new Uint8Array(8);
  (globalThis.crypto ?? (window as unknown as { crypto: Crypto }).crypto).getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 16);
}
