// TeleBlock X3DH key agreement — Apache-2.0
//
// Extended Triple Diffie-Hellman (Signal's X3DH) establishes a shared secret between an initiator
// (who has the responder's published pre-key bundle) and the responder (who later processes the
// initiator's first message). The resulting 32-byte secret seeds the symmetric ratchet root
// (crypto/ratchet.js), giving the 1:1 session forward secrecy. All DHs are X25519 via
// crypto_scalarmult; the secret is bound with a domain-separated BLAKE2b KDF.
//
// DH pairs (initiator A, responder B):
//   DH1 = DH(IK_A, SPK_B)   DH2 = DH(EK_A, IK_B)   DH3 = DH(EK_A, SPK_B)   [DH4 = DH(EK_A, OPK_B)]
// Both sides compute the same four shared points because X25519 DH is symmetric.

import { getSodium } from '../crypto/message.js';
import { verifyPreKeyBundle } from './prekeys.js';

const X3DH_CONTEXT = 'TeleBlock/x3dh/v1';

const b64 = (sodium, u) => sodium.to_base64(u, sodium.base64_variants.ORIGINAL);
const unb64 = (sodium, s) => sodium.from_base64(s, sodium.base64_variants.ORIGINAL);

function dh(sodium, sk, pk) {
  return sodium.crypto_scalarmult(sk, pk); // X25519
}

function kdf(sodium, parts) {
  let total = 0;
  for (const p of parts) total += p.length;
  const cat = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    cat.set(p, off);
    off += p.length;
  }
  return sodium.crypto_generichash(32, cat, sodium.from_string(X3DH_CONTEXT));
}

/**
 * Initiator side. Verifies the responder's bundle, generates an ephemeral key, computes the shared
 * secret, and returns it together with the header the responder needs to derive the same secret.
 * @param {KeyMaterial} myKeys initiator's own key material
 * @param {object} theirBundle responder's published pre-key bundle (JSON)
 * @returns {Promise<{secret:Uint8Array, header:object}>}
 */
export async function initiateSession(myKeys, theirBundle) {
  const sodium = await getSodium();
  const b = await verifyPreKeyBundle(theirBundle); // throws on bad signature

  const ephemeral = sodium.crypto_box_keypair();
  const useOpk = b.oneTimePreKeys.length > 0;
  const opk = useOpk ? b.oneTimePreKeys[0] : null;

  const dh1 = dh(sodium, myKeys.identityX.privateKey, b.signedPreKey);
  const dh2 = dh(sodium, ephemeral.privateKey, b.identityKeyX);
  const dh3 = dh(sodium, ephemeral.privateKey, b.signedPreKey);
  const parts = [dh1, dh2, dh3];
  if (useOpk) parts.push(dh(sodium, ephemeral.privateKey, opk));

  const secret = kdf(sodium, parts);
  return {
    secret,
    header: {
      v: 1,
      identityKeyX: b64(sodium, myKeys.identityX.publicKey),
      ephemeralKeyX: b64(sodium, ephemeral.publicKey),
      usedOneTimePreKey: useOpk ? 0 : -1, // index into the responder's published OPK list
    },
  };
}

/**
 * Responder side. Uses the initiator's header (their identity + ephemeral public keys, and which
 * one-time pre-key was consumed) to derive the identical shared secret.
 * @param {KeyMaterial} myKeys responder's own key material
 * @param {object} header initiator's X3DH header
 * @returns {Promise<{secret:Uint8Array}>}
 */
export async function respondSession(myKeys, header) {
  const sodium = await getSodium();
  const ikA = unb64(sodium, header.identityKeyX);
  const ekA = unb64(sodium, header.ephemeralKeyX);

  const dh1 = dh(sodium, myKeys.signedPreKey.privateKey, ikA);
  const dh2 = dh(sodium, myKeys.identityX.privateKey, ekA);
  const dh3 = dh(sodium, myKeys.signedPreKey.privateKey, ekA);
  const parts = [dh1, dh2, dh3];
  if (header.usedOneTimePreKey >= 0) {
    const opk = myKeys.oneTimePreKeys[header.usedOneTimePreKey];
    if (!opk) throw new Error('referenced one-time pre-key not found');
    parts.push(dh(sodium, opk.privateKey, ekA));
  }

  const secret = kdf(sodium, parts);
  return { secret };
}
