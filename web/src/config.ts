// TeleBlock client configuration. Apache-2.0
//
// Reads deployed contract addresses, RPC, and the indexer endpoint from Vite env vars (set in
// web/.env or the host). With nothing configured, the app runs in demo mode (in-browser seed +
// simulated/cross-tab peers). Set the VITE_* values after deploying to a testnet to go live —
// see docs/RUNBOOK.md.
const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;

export interface NetworkInfo {
  key: string;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorer: string;
}

export const NETWORKS: Record<string, NetworkInfo> = {
  'base-sepolia': {
    key: 'base-sepolia',
    name: 'Base Sepolia',
    chainId: 84532,
    rpcUrl: env.VITE_BASE_SEPOLIA_RPC || 'https://sepolia.base.org',
    explorer: 'https://sepolia.basescan.org',
  },
  base: { key: 'base', name: 'Base', chainId: 8453, rpcUrl: env.VITE_BASE_RPC || 'https://mainnet.base.org', explorer: 'https://basescan.org' },
  arbitrum: { key: 'arbitrum', name: 'Arbitrum', chainId: 42161, rpcUrl: env.VITE_ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io' },
};

export const CONTRACTS = {
  identityRegistry: (env.VITE_IDENTITY_REGISTRY || '') as `0x${string}` | '',
  groupManager: (env.VITE_GROUP_MANAGER || '') as `0x${string}` | '',
  forumManager: (env.VITE_FORUM_MANAGER || '') as `0x${string}` | '',
  reputation: (env.VITE_REPUTATION || '') as `0x${string}` | '',
};

/** Indexer read API base URL (e.g. http://localhost:8090). Empty = demo/seed mode. */
export const INDEXER_URL = env.VITE_INDEXER_URL || '';

/** IPFS gateway for fetching public media/profile CIDs. */
export const IPFS_GATEWAY = env.VITE_IPFS_GATEWAY || 'https://ipfs.io/ipfs/';

const isAddress = (a: string): a is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(a);

/** True when a given contract address is configured (i.e. deployed + wired). */
export function isContractConfigured(key: keyof typeof CONTRACTS): boolean {
  return isAddress(CONTRACTS[key] as string);
}

/** True when the app has any live wiring (a deployed IdentityRegistry). */
export const LIVE_MODE = isContractConfigured('identityRegistry');
