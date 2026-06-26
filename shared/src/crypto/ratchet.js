// TeleBlock symmetric-ratchet helper — Apache-2.0
//
// A minimal, dependency-light symmetric key ratchet used to derive a fresh per-message key from a
// chain key, giving forward secrecy for the message-key layer: compromising the key for message N
// does not reveal keys for messages < N. This is the symmetric (sending/receiving chain) portion of
// the Double Ratchet; the asymmetric DH ratchet (X3DH handshake + DH steps) and MLS group ratchet
// live in dedicated modules. Exposed here so the encryption layer and tests can exercise FS directly.
//
// KDF: HKDF-style via BLAKE2b keyed hashing (libsodium crypto_kdf-compatible derivation).

import { getSodium } from './message.js';

const CHAIN_INFO = 'tb-chain'; // 8-byte context for chain-key step
const MSG_INFO = 'tb-msgkey0'; // context for message-key derivation

/**
 * Derive the next chain key and the message key for the current step.
 * @param {Uint8Array} chainKey 32-byte current chain key
 * @returns {Promise<{messageKey: Uint8Array, nextChainKey: Uint8Array}>}
 */
export async function ratchetStep(chainKey) {
  const sodium = await getSodium();
  if (chainKey.length !== 32) throw new Error('chainKey must be 32 bytes');
  // Two independent derivations from the same chain key: one for the message, one to advance.
  const messageKey = sodium.crypto_generichash(32, chainKey, sodium.from_string(MSG_INFO));
  const nextChainKey = sodium.crypto_generichash(32, chainKey, sodium.from_string(CHAIN_INFO));
  return { messageKey, nextChainKey };
}

/**
 * A sending/receiving chain that advances a chain key and yields message keys in order.
 */
export class SymmetricChain {
  /** @param {Uint8Array} rootChainKey 32-byte seed (e.g. from the DH/MLS root) */
  constructor(rootChainKey) {
    if (rootChainKey.length !== 32) throw new Error('rootChainKey must be 32 bytes');
    this._chainKey = rootChainKey;
    this._index = 0;
  }

  get index() {
    return this._index;
  }

  /** Advance once and return the next message key. */
  async next() {
    const { messageKey, nextChainKey } = await ratchetStep(this._chainKey);
    this._chainKey = nextChainKey;
    this._index += 1;
    return messageKey;
  }
}
