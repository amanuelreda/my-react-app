// TeleBlock transport layer — Apache-2.0
//
// The real-time hot path. Encrypted frames are published to content *topics*; subscribers on a
// topic receive them. Topics are hashed so a relay learns only an opaque topic id, never the
// conversation/group identity. This module defines the Transport interface and an InMemoryRelay
// used in tests and local dev. The production adapter (Waku) implements the same interface — see
// waku.js — so application code is transport-agnostic.

import { getSodium } from '../crypto/message.js';

const TOPIC_CONTEXT = 'TeleBlock/topic/v1';

/**
 * Derive an opaque content topic from a label (e.g. a groupId or conversation id). The relay sees
 * only this hash, not the underlying identifier.
 * @param {string|Uint8Array} label
 * @returns {Promise<string>} hex topic id
 */
export async function deriveTopic(label) {
  const sodium = await getSodium();
  const input = typeof label === 'string' ? sodium.from_string(label) : label;
  const h = sodium.crypto_generichash(16, input, sodium.from_string(TOPIC_CONTEXT));
  return '/teleblock/1/' + sodium.to_hex(h);
}

/**
 * Derive a stable 1:1 conversation topic from two participants' public keys, independent of order.
 * @param {Uint8Array} pubA
 * @param {Uint8Array} pubB
 * @returns {Promise<string>}
 */
export async function deriveConversationTopic(pubA, pubB) {
  const sodium = await getSodium();
  // Order-independent: sort the two keys lexicographically before hashing.
  const a = sodium.to_hex(pubA);
  const b = sodium.to_hex(pubB);
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return deriveTopic(lo + ':' + hi);
}

/**
 * @typedef {Object} Transport
 * @property {(topic:string, frame:object)=>Promise<void>} publish
 * @property {(topic:string, handler:(frame:object)=>void)=>(()=>void)} subscribe returns unsubscribe
 * @property {(topic:string)=>Promise<object[]>} [query] optional store-node history retrieval
 */

/**
 * In-memory pub/sub relay implementing the Transport interface. Retains a bounded per-topic history
 * so late subscribers can query past frames (mirrors a Waku store node).
 * @implements {Transport}
 */
export class InMemoryRelay {
  constructor({ historyLimit = 1000 } = {}) {
    /** @type {Map<string, Set<Function>>} */
    this._subs = new Map();
    /** @type {Map<string, object[]>} */
    this._history = new Map();
    this._historyLimit = historyLimit;
  }

  async publish(topic, frame) {
    const hist = this._history.get(topic) ?? [];
    hist.push(frame);
    if (hist.length > this._historyLimit) hist.shift();
    this._history.set(topic, hist);

    const handlers = this._subs.get(topic);
    if (handlers) {
      // Deliver asynchronously to mimic network behavior and avoid re-entrancy surprises.
      for (const h of handlers) queueMicrotask(() => h(frame));
    }
  }

  subscribe(topic, handler) {
    let set = this._subs.get(topic);
    if (!set) {
      set = new Set();
      this._subs.set(topic, set);
    }
    set.add(handler);
    return () => set.delete(handler);
  }

  async query(topic) {
    return [...(this._history.get(topic) ?? [])];
  }
}
