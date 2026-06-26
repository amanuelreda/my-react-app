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

/** Connect a wallet and return a signer. Prefers a test account, then an injected provider. */
export async function connectWallet(): Promise<Connector> {
  // Test hook: a deterministic viem account, so the full SIWE + provisioning path runs in CI/E2E
  // with a real signature but no browser extension.
  if (typeof window !== 'undefined' && window.__TB_TEST_PK__) {
    const account = privateKeyToAccount(window.__TB_TEST_PK__);
    return {
      address: account.address,
      kind: 'test',
      signMessage: (message) => account.signMessage({ message }),
    };
  }

  // Real injected wallet (MetaMask / Coinbase / WalletConnect-injected).
  if (typeof window !== 'undefined' && window.ethereum) {
    const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    const address = accounts[0] as `0x${string}`;
    return {
      address,
      kind: 'injected',
      signMessage: async (message) =>
        (await window.ethereum!.request({
          method: 'personal_sign',
          params: [toHex(message), address],
        })) as `0x${string}`,
    };
  }

  throw new Error('No wallet found. Install a wallet or use “Create an identity”.');
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
