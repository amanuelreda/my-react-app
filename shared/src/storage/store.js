// TeleBlock content-addressed storage — Apache-2.0
//
// Media and large message blobs are stored encrypted on IPFS (hot) and optionally pushed to Arweave
// (permanent). Only the content identifier (CID) is referenced in frames / on-chain. This module
// defines the ContentStore interface and an InMemoryStore for tests/dev that computes a CID from the
// content hash (content-addressing). Production uses the Helia adapter (ipfs.js) with the same API.
//
// Invariant: callers encrypt BEFORE storing. putEncrypted/getDecrypted enforce this so plaintext or
// unencrypted media never reaches the store.

import { getSodium, sealMessage, openMessage } from '../crypto/message.js';

/**
 * Compute a deterministic content identifier for bytes. The InMemoryStore mirrors IPFS's
 * content-addressing: identical bytes always map to the same CID.
 * @param {Uint8Array} bytes
 * @returns {Promise<string>}
 */
export async function cidOf(bytes) {
  const sodium = await getSodium();
  // BLAKE2b-256 digest, hex-encoded with a CIDv1-ish prefix. Real adapter emits a proper multihash.
  return 'bafy' + sodium.to_hex(sodium.crypto_generichash(32, bytes));
}

/**
 * @typedef {Object} ContentStore
 * @property {(bytes:Uint8Array)=>Promise<string>} put returns CID
 * @property {(cid:string)=>Promise<Uint8Array>} get throws if absent
 * @property {(cid:string)=>Promise<boolean>} has
 */

/** @implements {ContentStore} */
export class InMemoryStore {
  constructor() {
    /** @type {Map<string, Uint8Array>} */
    this._blobs = new Map();
  }

  async put(bytes) {
    const cid = await cidOf(bytes);
    this._blobs.set(cid, bytes);
    return cid;
  }

  async get(cid) {
    const b = this._blobs.get(cid);
    if (!b) throw new Error(`content not found: ${cid}`);
    return b;
  }

  async has(cid) {
    return this._blobs.has(cid);
  }
}

/**
 * Encrypt+sign a payload, then store the resulting frame. Returns the CID and the per-blob key so
 * the caller can reference it in a message frame.
 * @param {ContentStore} store
 * @param {Uint8Array} plaintext
 * @param {{publicKey:Uint8Array, privateKey:Uint8Array}} signing
 * @returns {Promise<{cid:string, key:Uint8Array}>}
 */
export async function putEncrypted(store, plaintext, signing) {
  const sodium = await getSodium();
  const key = sodium.randombytes_buf(32);
  const frame = await sealMessage(plaintext, key, signing.privateKey);
  const cid = await store.put(sodium.from_string(JSON.stringify(frame)));
  return { cid, key };
}

/**
 * Fetch and decrypt a stored blob, verifying the author's signature.
 * @param {ContentStore} store
 * @param {string} cid
 * @param {Uint8Array} key per-blob key returned by putEncrypted
 * @param {Uint8Array} [expectedSignerPub]
 * @returns {Promise<Uint8Array>}
 */
export async function getDecrypted(store, cid, key, expectedSignerPub = null) {
  const sodium = await getSodium();
  const raw = await store.get(cid);
  const frame = JSON.parse(sodium.to_string(raw));
  return openMessage(frame, key, null, expectedSignerPub);
}
