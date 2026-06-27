// In-chat crypto payments (Mixin-style). Apache-2.0
//
// Sends an asset to a contact. Native ETH goes out as a value transfer; ERC-20s (USDC/DAI) as a
// standard transfer(to, amount) call to the token contract. Submission goes through the connected
// wallet's EIP-1193 provider (injected, or the viem-backed test provider in CI). When no provider /
// configured token / real recipient address is available, the caller keeps the payment local (demo).
import { encodeFunctionData, parseAbi, parseUnits } from 'viem';
import { getProvider } from './wallet';
import { NETWORKS, type NetworkInfo } from '../config';

const ERC20_ABI = parseAbi(['function transfer(address to, uint256 amount) returns (bool)']);

export interface TokenInfo {
  decimals: number;
  /** Token contract address per network key; absent ⇒ native coin (ETH). */
  addresses?: Record<string, `0x${string}`>;
}

// Known assets. ETH is native; stablecoins carry per-network contract addresses (testnet defaults
// shown; override via deployment config as networks are added).
export const TOKENS: Record<string, TokenInfo> = {
  ETH: { decimals: 18 },
  USDC: {
    decimals: 6,
    addresses: {
      'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Circle USDC (Base Sepolia)
    },
  },
  DAI: { decimals: 18, addresses: {} },
};

const isAddress = (a: string): a is `0x${string}` => /^0x[0-9a-fA-F]{40}$/.test(a);

export interface PreparedPayment {
  to: `0x${string}`;
  from: `0x${string}`;
  value?: `0x${string}`;
  data?: `0x${string}`;
  network: NetworkInfo;
}

/**
 * Whether an on-chain transfer is possible for this asset → recipient. Native ETH needs only a real
 * recipient address; ERC-20s additionally need a configured token contract on the active network.
 */
export function canSendOnChain(asset: string, recipient: string, networkKey: string): boolean {
  if (typeof window === 'undefined') return false;
  if (!getProvider()) return false;
  if (!isAddress(recipient)) return false;
  const token = TOKENS[asset];
  if (!token) return false;
  if (!token.addresses) return true; // native coin
  return isAddress(token.addresses[networkKey] ?? '');
}

/** Build the transfer transaction (native value transfer or ERC-20 transfer call). */
export function buildPaymentTx(args: {
  asset: string;
  amount: string;
  from: `0x${string}`;
  recipient: `0x${string}`;
  networkKey: string;
}): PreparedPayment {
  const { asset, amount, from, recipient, networkKey } = args;
  const network = NETWORKS[networkKey] ?? NETWORKS['base-sepolia'];
  const token = TOKENS[asset];
  if (!token) throw new Error(`Unsupported asset ${asset}`);
  const units = parseUnits(amount, token.decimals);

  if (!token.addresses) {
    // Native ETH: value transfer to the recipient.
    return { to: recipient, from, value: ('0x' + units.toString(16)) as `0x${string}`, network };
  }
  const tokenAddr = token.addresses[networkKey];
  if (!tokenAddr || !isAddress(tokenAddr)) throw new Error(`${asset} not configured on ${network.name}`);
  return {
    to: tokenAddr,
    from,
    data: encodeFunctionData({ abi: ERC20_ABI, functionName: 'transfer', args: [recipient, units] }),
    network,
  };
}

/** Submit a prepared payment and return the transaction hash. */
export async function sendPaymentTx(tx: PreparedPayment): Promise<`0x${string}`> {
  const provider = getProvider();
  if (!provider) throw new Error('No wallet provider to send the payment.');
  const params: Record<string, string> = { to: tx.to, from: tx.from };
  if (tx.value) params.value = tx.value;
  if (tx.data) params.data = tx.data;
  return (await provider.request({ method: 'eth_sendTransaction', params: [params] })) as `0x${string}`;
}
