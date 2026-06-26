// TeleBlock encrypted media attachments. Apache-2.0
//
// Media (images/video/files/voice) is encrypted on-device, stored as a ciphertext blob on IPFS
// (ContentStore), and referenced from a message by a compact descriptor. The per-blob key travels
// INSIDE the E2EE message frame, so it is itself encrypted end-to-end — the relay and the storage
// node only ever see ciphertext and an opaque CID. The receiver fetches the blob, verifies the
// sender's signature, and decrypts with the key from the descriptor.

import { getSodium } from './crypto/message.js';
import { putEncrypted, getDecrypted } from './storage/store.js';

/**
 * @typedef {Object} MediaDescriptor
 * @property {string} cid    IPFS content id of the encrypted blob
 * @property {string} key    base64 per-blob symmetric key (carried inside the E2EE frame)
 * @property {string} mime   MIME type (for rendering)
 * @property {string} name   original filename (optional)
 * @property {number} size   plaintext byte length
 */

/**
 * Encrypt+sign `bytes`, store the ciphertext, and return a descriptor to embed in a message.
 * @param {import('./storage/store.js').ContentStore} store
 * @param {Uint8Array} bytes
 * @param {{publicKey:Uint8Array, privateKey:Uint8Array}} signing
 * @param {{mime?:string, name?:string}} [meta]
 * @returns {Promise<MediaDescriptor>}
 */
export async function attachMedia(store, bytes, signing, meta = {}) {
  const sodium = await getSodium();
  const { cid, key } = await putEncrypted(store, bytes, signing);
  return {
    cid,
    key: sodium.to_base64(key, sodium.base64_variants.ORIGINAL),
    mime: meta.mime ?? 'application/octet-stream',
    name: meta.name ?? '',
    size: bytes.length,
  };
}

/**
 * Fetch and decrypt a media blob referenced by a descriptor, verifying the sender's signing key.
 * @param {import('./storage/store.js').ContentStore} store
 * @param {MediaDescriptor} descriptor
 * @param {Uint8Array} [expectedSignerPub]
 * @returns {Promise<Uint8Array>}
 */
export async function loadMedia(store, descriptor, expectedSignerPub = null) {
  const sodium = await getSodium();
  const key = sodium.from_base64(descriptor.key, sodium.base64_variants.ORIGINAL);
  return getDecrypted(store, descriptor.cid, key, expectedSignerPub);
}

// ---- message payload envelope ----
// A chat message is a small JSON object so a single E2EE channel can carry text and/or media (and
// self-destruct metadata). Encode before sending over a Conversation/GroupSession; decode on receipt.

/**
 * @typedef {Object} Poll
 * @property {string} question
 * @property {{text:string, votes:number}[]} options
 * @property {boolean} [multi]   allow multiple choices
 */

/**
 * @typedef {Object} MessagePayload
 * @property {'text'|'media'|'poll'} t
 * @property {string} [body]               text (or media caption)
 * @property {MediaDescriptor} [media]
 * @property {Poll} [poll]
 * @property {number} [ttl]                self-destruct seconds (0/undefined = permanent)
 */

const PAYLOAD_TYPES = new Set(['text', 'media', 'poll']);

/** @param {MessagePayload} payload @returns {string} */
export function encodePayload(payload) {
  return JSON.stringify(payload);
}

/** @param {string} s @returns {MessagePayload} */
export function decodePayload(s) {
  try {
    const p = JSON.parse(s);
    if (p && PAYLOAD_TYPES.has(p.t)) return p;
  } catch {
    /* fall through */
  }
  // Back-compat: a bare string is a text message.
  return { t: 'text', body: s };
}

/** Whether a self-destruct message has expired. `sentAt` and `now` are epoch ms. */
export function isExpired(ttlSeconds, sentAt, now) {
  if (!ttlSeconds || ttlSeconds <= 0) return false;
  return now - sentAt >= ttlSeconds * 1000;
}
