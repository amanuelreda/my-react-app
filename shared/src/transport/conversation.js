// TeleBlock conversation session — Apache-2.0
//
// Ties the pieces together: a Conversation owns a sending ratchet, a receiving ratchet, a signing
// key, and a Transport topic. send() ratchets a fresh key, seals+signs the plaintext, and publishes
// the frame; incoming frames are verified against the peer's signing key, decrypted with the
// receiving ratchet, and surfaced to a handler. This is the off-chain hot path a 1:1 secret chat
// runs on; group chats use the same shape with an MLS-derived key schedule (Phase 2).

import { SymmetricChain } from '../crypto/ratchet.js';
import { sealMessage, openMessage, getSodium } from '../crypto/message.js';

const enc = (s) => (typeof s === 'string' ? new TextEncoder().encode(s) : s);
const dec = (u) => new TextDecoder().decode(u);

export class Conversation {
  /**
   * @param {object} p
   * @param {import('./relay.js').Transport} p.transport
   * @param {string} p.topic content topic both peers publish/subscribe to
   * @param {Uint8Array} p.sendRoot 32-byte root for the sending chain (e.g. from X3DH)
   * @param {Uint8Array} p.recvRoot 32-byte root for the receiving chain
   * @param {{publicKey:Uint8Array, privateKey:Uint8Array}} p.signing our Ed25519 signing keypair
   * @param {Uint8Array} p.peerSigningPub peer's Ed25519 signing public key (for verification)
   * @param {Uint8Array} [p.aad] associated data bound into every frame (e.g. the topic bytes)
   */
  constructor(p) {
    this.transport = p.transport;
    this.topic = p.topic;
    this.signing = p.signing;
    this.peerSigningPub = p.peerSigningPub;
    this.aad = p.aad ?? null;
    this._send = new SymmetricChain(p.sendRoot);
    this._recv = new SymmetricChain(p.recvRoot);
    this._unsub = null;
    this._ownPubB64 = null; // base64 of our signing public key, computed lazily
  }

  async _ownPub() {
    if (this._ownPubB64 === null) {
      const sodium = await getSodium();
      this._ownPubB64 = sodium.to_base64(this.signing.publicKey, sodium.base64_variants.ORIGINAL);
    }
    return this._ownPubB64;
  }

  /** Subscribe to the topic and decrypt incoming frames in order. */
  start(onMessage) {
    // Serialize frame handling so async awaits in _handle can't interleave ratchet steps.
    let queue = Promise.resolve();
    this._unsub = this.transport.subscribe(this.topic, (frame) => {
      queue = queue.then(() => this._handle(frame, onMessage));
    });
    return this;
  }

  async _handle(frame, onMessage) {
    // On a shared topic we also receive our own frames; skip them WITHOUT advancing the receive
    // chain so it stays in lock-step with the peer's send chain.
    if (frame.senderPub === (await this._ownPub())) return;
    try {
      const key = await this._recv.next();
      const plaintext = await openMessage(frame, key, this.aad, this.peerSigningPub);
      onMessage({ text: dec(plaintext), bytes: plaintext, index: this._recv.index });
    } catch (e) {
      onMessage({ error: e.message, index: this._recv.index });
    }
  }

  /** Ratchet, encrypt+sign, and publish a message. */
  async send(plaintext) {
    const key = await this._send.next();
    const frame = await sealMessage(enc(plaintext), key, this.signing.privateKey, this.aad);
    await this.transport.publish(this.topic, frame);
    return { index: this._send.index };
  }

  stop() {
    if (this._unsub) this._unsub();
    this._unsub = null;
  }
}
