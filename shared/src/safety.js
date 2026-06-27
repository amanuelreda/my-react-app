// TeleBlock safety numbers — verifiable identity. Apache-2.0
//
// Inspired by Signal/EXTRA SAFE Chat: a human-comparable code derived deterministically from BOTH
// parties' long-term signing public keys. Two contacts read it out (or scan) and confirm it matches
// to detect a man-in-the-middle key substitution. Order-independent so both sides see the same code.
import { getSodium } from './crypto/message.js';

const CONTEXT = 'TeleBlock/safety/v1';

/**
 * Derive a 60-digit safety number (12 groups of 5) from two Ed25519 signing public keys.
 * @param {Uint8Array} pubA
 * @param {Uint8Array} pubB
 * @returns {Promise<string>} e.g. "01234 56789 …"
 */
export async function safetyNumber(pubA, pubB) {
  const sodium = await getSodium();
  const a = sodium.to_hex(pubA);
  const b = sodium.to_hex(pubB);
  const [lo, hi] = a <= b ? [a, b] : [b, a]; // order-independent
  const h = sodium.crypto_generichash(32, sodium.from_string(lo + hi), sodium.from_string(CONTEXT));

  const groups = [];
  for (let i = 0; i < 12; i++) {
    const off = i * 2; // overlapping 4-byte windows across the 32-byte digest
    const v = ((h[off] << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]) >>> 0;
    groups.push((v % 100000).toString().padStart(5, '0'));
  }
  return groups.join(' ');
}

/**
 * Session-style identifier (Session app): a stable, address-free ID derived from the signing key, so
 * a contact can be reached without exposing a wallet address (metadata minimization). 66 chars,
 * "05"-prefixed like Session's X25519 account IDs.
 * @param {Uint8Array} signingPub
 * @returns {Promise<string>}
 */
export async function sessionId(signingPub) {
  const sodium = await getSodium();
  return '05' + sodium.to_hex(sodium.crypto_generichash(32, signingPub, sodium.from_string('TeleBlock/sessionid/v1')));
}
