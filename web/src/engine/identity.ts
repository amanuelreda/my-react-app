// In-browser identity provisioning. Apache-2.0
//
// Demonstrates the real login/key flow from @teleblock/shared without a wallet extension by using a
// burner account (an embedded-wallet style onboarding for newcomers). The same code path applies to
// a real wallet: sign the fixed identity challenge, then deterministically derive the messaging key.
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { hexToBytes } from 'viem';
import { identityChallenge, provisionIdentity } from '@teleblock/shared';

export interface Identity {
  address: `0x${string}`;
  signing: { publicKey: Uint8Array; privateKey: Uint8Array };
  keyMaterial: unknown;
  bundle: unknown;
}

/** Create a fresh burner identity: generate a key, sign the identity challenge, derive E2EE keys. */
export async function createBurnerIdentity(): Promise<Identity> {
  const pk = generatePrivateKey();
  const account = privateKeyToAccount(pk);
  const signature = await account.signMessage({ message: identityChallenge(account.address) });
  const { signing, keyMaterial, bundle } = await provisionIdentity({
    identitySignature: hexToBytes(signature),
  });
  return { address: account.address, signing, keyMaterial, bundle };
}

/** Short hex fingerprint of a public key, for display (e.g. a safety-number-ish chip). */
export function fingerprint(pub: Uint8Array): string {
  const hex = Array.from(pub.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hex.toUpperCase();
}
