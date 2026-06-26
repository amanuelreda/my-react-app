// On-chain identity registration. Apache-2.0
//
// After login, a user publishes their identity to IdentityRegistry: pin the pre-key bundle to IPFS,
// then call register(signingPubKey, preKeyBundleCID, profileCID). Encoding is shared
// (@teleblock/shared); this module builds the transaction and submits it via the connected wallet.
// Requires a deployed IdentityRegistry address (set per network) — wired but not exercised here
// since this environment has no chain.
import { buildRegistrationPayload, encodeRegisterCall } from '@teleblock/shared';
import type { Identity } from './identity';

export interface RegisterTx {
  to: `0x${string}`;
  data: `0x${string}`;
  from: `0x${string}`;
}

/** Build the register() transaction. `preKeyBundleCID` is the IPFS CID of the pinned bundle. */
export function buildRegisterTx(
  identity: Identity,
  opts: { contractAddress: `0x${string}`; preKeyBundleCID: string; profileCID?: string },
): RegisterTx {
  const payload = buildRegistrationPayload({
    signingPubKey: identity.signing.publicKey,
    preKeyBundleCID: opts.preKeyBundleCID,
    profileCID: opts.profileCID ?? '',
  });
  return {
    to: opts.contractAddress,
    data: encodeRegisterCall(payload),
    from: identity.address,
  };
}

/** Submit the registration via an injected EIP-1193 provider. Returns the tx hash. */
export async function sendRegister(tx: RegisterTx): Promise<`0x${string}`> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('No wallet provider to send the registration transaction.');
  }
  return (await window.ethereum.request({
    method: 'eth_sendTransaction',
    params: [{ to: tx.to, from: tx.from, data: tx.data }],
  })) as `0x${string}`;
}
