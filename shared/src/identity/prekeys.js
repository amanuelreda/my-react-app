// TeleBlock key material & pre-key bundles — Apache-2.0
//
// A user's messaging identity has two key types:
//   - an Ed25519 *signing* key (anchored on-chain in IdentityRegistry), derived deterministically
//     from a wallet signature (see crypto/message.js#deriveIdentityKey); and
//   - an X25519 *identity* key plus a signed pre-key and one-time pre-keys, used for X3DH key
//     agreement. Their public parts form the pre-key bundle published to IPFS (CID anchored
//     on-chain). The X25519 public keys are signed by the Ed25519 key so a relay/storage node
//     cannot substitute them undetected.

import { getSodium } from '../crypto/message.js';

const b64 = (sodium, u) => sodium.to_base64(u, sodium.base64_variants.ORIGINAL);
const unb64 = (sodium, s) => sodium.from_base64(s, sodium.base64_variants.ORIGINAL);

/**
 * @typedef {Object} KeyMaterial  full secret + public material held on-device
 * @property {{publicKey:Uint8Array, privateKey:Uint8Array}} signing  Ed25519 (on-chain identity)
 * @property {{publicKey:Uint8Array, privateKey:Uint8Array}} identityX X25519 long-term DH key
 * @property {{publicKey:Uint8Array, privateKey:Uint8Array}} signedPreKey X25519 medium-term
 * @property {Array<{publicKey:Uint8Array, privateKey:Uint8Array}>} oneTimePreKeys X25519 ephemeral
 */

/**
 * Generate fresh X25519 key material bound to an existing Ed25519 signing keypair.
 * @param {{publicKey:Uint8Array, privateKey:Uint8Array}} signing Ed25519 keypair (from deriveIdentityKey)
 * @param {number} oneTimeCount how many one-time pre-keys to pre-generate
 * @returns {Promise<KeyMaterial>}
 */
export async function generateKeyMaterial(signing, oneTimeCount = 10) {
  const sodium = await getSodium();
  const identityX = sodium.crypto_box_keypair(); // Curve25519 (X25519)
  const signedPreKey = sodium.crypto_box_keypair();
  const oneTimePreKeys = [];
  for (let i = 0; i < oneTimeCount; i++) oneTimePreKeys.push(sodium.crypto_box_keypair());
  return { signing, identityX, signedPreKey, oneTimePreKeys };
}

/**
 * Build the public pre-key bundle to publish to IPFS. X25519 public keys are signed by the Ed25519
 * key for authenticity.
 * @param {KeyMaterial} km
 * @returns {Promise<object>} JSON-serializable bundle
 */
export async function buildPreKeyBundle(km) {
  const sodium = await getSodium();
  // Sign the concatenation of identityX || signedPreKey publics so neither can be swapped.
  const toSign = new Uint8Array(km.identityX.publicKey.length + km.signedPreKey.publicKey.length);
  toSign.set(km.identityX.publicKey, 0);
  toSign.set(km.signedPreKey.publicKey, km.identityX.publicKey.length);
  const sig = sodium.crypto_sign_detached(toSign, km.signing.privateKey);

  return {
    v: 1,
    signingKeyEd: b64(sodium, km.signing.publicKey),
    identityKeyX: b64(sodium, km.identityX.publicKey),
    signedPreKey: b64(sodium, km.signedPreKey.publicKey),
    preKeySig: b64(sodium, sig),
    oneTimePreKeys: km.oneTimePreKeys.map((k) => b64(sodium, k.publicKey)),
  };
}

/**
 * Verify a peer's pre-key bundle authenticity against its Ed25519 signing key. Returns the decoded
 * public keys on success; throws on a bad signature (fail-closed).
 * @param {object} bundle
 * @returns {Promise<{signingKeyEd:Uint8Array, identityKeyX:Uint8Array, signedPreKey:Uint8Array, oneTimePreKeys:Uint8Array[]}>}
 */
export async function verifyPreKeyBundle(bundle) {
  const sodium = await getSodium();
  const signingKeyEd = unb64(sodium, bundle.signingKeyEd);
  const identityKeyX = unb64(sodium, bundle.identityKeyX);
  const signedPreKey = unb64(sodium, bundle.signedPreKey);
  const sig = unb64(sodium, bundle.preKeySig);

  const signed = new Uint8Array(identityKeyX.length + signedPreKey.length);
  signed.set(identityKeyX, 0);
  signed.set(signedPreKey, identityKeyX.length);
  if (!sodium.crypto_sign_verify_detached(sig, signed, signingKeyEd)) {
    throw new Error('pre-key bundle signature invalid — possible key substitution');
  }
  return {
    signingKeyEd,
    identityKeyX,
    signedPreKey,
    oneTimePreKeys: (bundle.oneTimePreKeys || []).map((s) => unb64(sodium, s)),
  };
}
