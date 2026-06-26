// TeleBlock SIWE login & identity provisioning — Apache-2.0
//
// Two distinct wallet signatures are used:
//   1. A per-login SIWE (EIP-4361) message with a fresh nonce — proves wallet control for a session.
//      Verified by recovering the signer and validating the message fields (domain/time/nonce).
//   2. A ONE-TIME, fixed, domain-separated "identity derivation" message with NO nonce — its
//      signature is hashed into a stable Ed25519 identity key. Because it is constant per address,
//      the same key is reproducible on any device the user controls; because it is domain-separated,
//      the signature can't be replayed for anything else. It grants no permissions and costs no gas.

import { createSiweMessage, parseSiweMessage, validateSiweMessage } from 'viem/siwe';
import { recoverMessageAddress } from 'viem';
import { deriveIdentityKey } from '../crypto/message.js';
import { generateKeyMaterial, buildPreKeyBundle } from './prekeys.js';

/** Fixed, nonce-free challenge whose signature deterministically seeds the identity key. */
export function identityChallenge(address) {
  return [
    'TeleBlock — encryption key derivation (v1)',
    '',
    `Address: ${address}`,
    '',
    'Sign this message once to create your end-to-end-encryption keys.',
    'This signature grants no permissions, sends no transaction, and costs no gas.',
    'Do not sign this message on any site other than TeleBlock.',
  ].join('\n');
}

/**
 * Build a SIWE (EIP-4361) login message string for the wallet to sign.
 * @param {{address:`0x${string}`, domain:string, uri:string, chainId:number, nonce:string, statement?:string, issuedAt?:Date}} p
 * @returns {string}
 */
export function buildLoginMessage(p) {
  return createSiweMessage({
    address: p.address,
    chainId: p.chainId,
    domain: p.domain,
    nonce: p.nonce,
    uri: p.uri,
    version: '1',
    statement: p.statement ?? 'Sign in to TeleBlock.',
    ...(p.issuedAt ? { issuedAt: p.issuedAt } : {}),
  });
}

/**
 * Verify a signed SIWE login: recover the signer, confirm it matches the message address, and
 * validate message fields (domain/nonce/time). Fully offline for EOAs.
 * @param {{message:string, signature:`0x${string}`, expectedDomain?:string, expectedNonce?:string, now?:Date}} p
 * @returns {Promise<{valid:boolean, address?:`0x${string}`, reason?:string}>}
 */
export async function verifyLogin(p) {
  const fields = parseSiweMessage(p.message);
  if (!fields.address) return { valid: false, reason: 'no address in message' };

  let recovered;
  try {
    recovered = await recoverMessageAddress({ message: p.message, signature: p.signature });
  } catch (e) {
    return { valid: false, reason: `recover failed: ${e.message}` };
  }
  if (recovered.toLowerCase() !== fields.address.toLowerCase()) {
    return { valid: false, reason: 'signer does not match message address' };
  }

  const ok = validateSiweMessage({
    message: fields,
    ...(p.expectedDomain ? { domain: p.expectedDomain } : {}),
    ...(p.expectedNonce ? { nonce: p.expectedNonce } : {}),
    ...(p.now ? { time: p.now } : {}),
  });
  if (!ok) return { valid: false, reason: 'SIWE field validation failed (domain/nonce/time)' };

  return { valid: true, address: recovered };
}

/**
 * Provision a full messaging identity from the one-time identity-derivation signature.
 * @param {{identitySignature: Uint8Array, oneTimeCount?: number}} p
 * @returns {Promise<{signing:object, keyMaterial:object, bundle:object}>}
 */
export async function provisionIdentity(p) {
  const signing = await deriveIdentityKey(p.identitySignature);
  const keyMaterial = await generateKeyMaterial(signing, p.oneTimeCount ?? 10);
  const bundle = await buildPreKeyBundle(keyMaterial);
  return { signing, keyMaterial, bundle };
}

/**
 * Shape the arguments for IdentityRegistry.register(). The caller pins `bundle` to IPFS first and
 * passes the resulting CID; the signing public key is the on-chain anchor.
 * @param {{signingPubKey: Uint8Array, preKeyBundleCID: string, profileCID: string}} p
 * @returns {{signingPubKeyHex:`0x${string}`, preKeyBundleCID:string, profileCID:string}}
 */
export function buildRegistrationPayload(p) {
  const hex = '0x' + Array.from(p.signingPubKey).map((b) => b.toString(16).padStart(2, '0')).join('');
  return {
    signingPubKeyHex: /** @type {`0x${string}`} */ (hex),
    preKeyBundleCID: p.preKeyBundleCID,
    profileCID: p.profileCID,
  };
}
