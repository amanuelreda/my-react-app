// TeleBlock group messaging — Sender Keys session — Apache-2.0
//
// Group E2EE for the MVP using the Sender Keys scheme (as in Signal groups):
//   - Each member owns a "sender chain" (a symmetric ratchet) and a group signing key.
//   - A member distributes its sender-key bundle (current chain seed + signing public key) to the
//     other members over the existing pairwise 1:1 channels (X3DH sessions).
//   - To send: ratchet the sender chain -> per-message key, AEAD-encrypt, Ed25519-sign.
//   - To receive: look up the sender's chain by senderId, fast-forward to the frame's iteration,
//     and decrypt — verifying the sender's group signing key.
//   - On member REMOVAL/ban: every remaining member rotates its sender chain (new random seed) and
//     re-distributes, so the removed member — who never received the new seeds — loses forward
//     access. This mirrors GroupManager.ban() -> rotateMlsEpoch() on-chain.
//
// This is O(n) key distribution per membership change. The Phase 2 upgrade swaps this module for MLS
// (TreeKEM) to get O(log n) rekeying and stronger post-compromise security; the GroupSession API is
// designed so callers (transport/UI) don't change when that swap happens.

import { getSodium, sealMessage, openMessage } from '../crypto/message.js';
import { SymmetricChain } from '../crypto/ratchet.js';

const MAX_SKIP = 256; // bound fast-forward to avoid unbounded work on a forged iteration

const b64 = (sodium, u) => sodium.to_base64(u, sodium.base64_variants.ORIGINAL);
const unb64 = (sodium, s) => sodium.from_base64(s, sodium.base64_variants.ORIGINAL);

/**
 * Create a group session for one member.
 * @param {object} p
 * @param {string} p.groupId
 * @param {string} p.myId stable member id (e.g. wallet address)
 * @param {{publicKey:Uint8Array, privateKey:Uint8Array}} p.signing member's Ed25519 group signing key
 * @returns {Promise<GroupSession>}
 */
export async function createGroupSession(p) {
  const sodium = await getSodium();
  const seed = sodium.randombytes_buf(32);
  return new GroupSession(p.groupId, p.myId, p.signing, seed);
}

export class GroupSession {
  constructor(groupId, myId, signing, senderSeed) {
    this.groupId = groupId;
    this.myId = myId;
    this.signing = signing;
    this._senderSeed = senderSeed; // current root of my sending chain (rotated on remove)
    this._send = new SymmetricChain(senderSeed);
    /** @type {Map<string, {chain: SymmetricChain, signingPub: Uint8Array, skipped: Map<number,Uint8Array>}>} */
    this._members = new Map();
  }

  /** The sender-key bundle to hand to other members over a secure pairwise channel. */
  async senderKeyBundle() {
    const sodium = await getSodium();
    return {
      groupId: this.groupId,
      memberId: this.myId,
      senderSeed: b64(sodium, this._senderSeed),
      signingPub: b64(sodium, this.signing.publicKey),
    };
  }

  /** Install (or replace) another member's sender key from their bundle. */
  async addMemberKey(bundle) {
    const sodium = await getSodium();
    this._members.set(bundle.memberId, {
      chain: new SymmetricChain(unb64(sodium, bundle.senderSeed)),
      signingPub: unb64(sodium, bundle.signingPub),
      skipped: new Map(),
    });
  }

  /** Stop accepting a removed member's frames. Call rotate() afterwards to cut forward access. */
  removeMember(memberId) {
    this._members.delete(memberId);
  }

  /**
   * Rotate our own sender chain (new random seed). After a removal, every remaining member rotates
   * and re-distributes senderKeyBundle() so the removed member cannot derive future message keys.
   */
  async rotate() {
    const sodium = await getSodium();
    this._senderSeed = sodium.randombytes_buf(32);
    this._send = new SymmetricChain(this._senderSeed);
  }

  /** Encrypt + sign a message for the group. */
  async encrypt(plaintext) {
    const sodium = await getSodium();
    const key = await this._send.next();
    const iteration = this._send.index;
    const aad = sodium.from_string(`${this.groupId}|${this.myId}|${iteration}`);
    const sealed = await sealMessage(
      typeof plaintext === 'string' ? sodium.from_string(plaintext) : plaintext,
      key,
      this.signing.privateKey,
      aad,
    );
    return { groupId: this.groupId, senderId: this.myId, iteration, frame: sealed };
  }

  /**
   * Decrypt a group frame from a known member. Verifies the sender's group signing key and binds the
   * AAD to (groupId, senderId, iteration). Throws on unknown sender, key mismatch, or bad signature.
   * @returns {Promise<Uint8Array>}
   */
  async decrypt(msg) {
    const sodium = await getSodium();
    const member = this._members.get(msg.senderId);
    if (!member) throw new Error(`no sender key for member ${msg.senderId}`);

    const key = await this._deriveMemberKey(member, msg.iteration);
    const aad = sodium.from_string(`${msg.groupId}|${msg.senderId}|${msg.iteration}`);
    return openMessage(msg.frame, key, aad, member.signingPub);
  }

  /** Fast-forward a member's receive chain to `iteration`, caching skipped keys for out-of-order. */
  async _deriveMemberKey(member, iteration) {
    if (member.skipped.has(iteration)) {
      const k = member.skipped.get(iteration);
      member.skipped.delete(iteration);
      return k;
    }
    if (iteration <= member.chain.index) {
      throw new Error('stale or replayed iteration');
    }
    if (iteration - member.chain.index > MAX_SKIP) {
      throw new Error('iteration gap exceeds MAX_SKIP');
    }
    let key;
    while (member.chain.index < iteration) {
      key = await member.chain.next();
      if (member.chain.index < iteration) member.skipped.set(member.chain.index, key);
    }
    return key;
  }
}
