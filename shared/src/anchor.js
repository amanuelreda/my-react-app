// TeleBlock message anchoring (Merkle commitments). Apache-2.0
//
// Tamper-evidence for off-chain messages without putting content on-chain. A batch of message
// frames is reduced to a Merkle root (BLAKE2b); only that 32-byte root is anchored via
// GroupManager.appendCommitment(). Anyone holding a frame can later prove it was part of an anchored
// batch — and a malicious relay can't silently drop, reorder, or forge anchored history — without
// revealing any content. Leaves are domain-separated to prevent second-preimage attacks.

import { getSodium } from './crypto/message.js';

const LEAF = 'TeleBlock/anchor/leaf';
const NODE = 'TeleBlock/anchor/node';

/** Hash one message frame (over its signed bytes: nonce||ciphertext||sig) into a 32-byte leaf. */
export async function frameHash(frame) {
  const sodium = await getSodium();
  const dec = (s) => sodium.from_base64(s, sodium.base64_variants.ORIGINAL);
  const parts = [dec(frame.nonce), dec(frame.ciphertext), dec(frame.sig)];
  let total = 0;
  for (const p of parts) total += p.length;
  const cat = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    cat.set(p, off);
    off += p.length;
  }
  return sodium.crypto_generichash(32, cat, sodium.from_string(LEAF));
}

async function hashNode(sodium, a, b) {
  const cat = new Uint8Array(a.length + b.length);
  cat.set(a, 0);
  cat.set(b, a.length);
  return sodium.crypto_generichash(32, cat, sodium.from_string(NODE));
}

/**
 * Build a Merkle root from an array of 32-byte leaves. Odd levels duplicate the last node.
 * @param {Uint8Array[]} leaves
 * @returns {Promise<Uint8Array>} 32-byte root (zero hash for an empty batch)
 */
export async function buildMerkleRoot(leaves) {
  const sodium = await getSodium();
  if (leaves.length === 0) return sodium.crypto_generichash(32, new Uint8Array(0), sodium.from_string(NODE));
  let level = leaves.slice();
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : level[i]; // duplicate last if odd
      next.push(await hashNode(sodium, a, b));
    }
    level = next;
  }
  return level[0];
}

/**
 * Produce a Merkle proof (sibling path) for the leaf at `index`.
 * @param {Uint8Array[]} leaves
 * @param {number} index
 * @returns {Promise<{sibling:Uint8Array, right:boolean}[]>} path from leaf to root
 */
export async function merkleProof(leaves, index) {
  const sodium = await getSodium();
  if (index < 0 || index >= leaves.length) throw new Error('index out of range');
  const proof = [];
  let level = leaves.slice();
  let idx = index;
  while (level.length > 1) {
    const isRight = idx % 2 === 1;
    const sibIdx = isRight ? idx - 1 : idx + 1;
    const sibling = sibIdx < level.length ? level[sibIdx] : level[idx]; // duplicated last
    proof.push({ sibling, right: !isRight }); // is the sibling on the right of our node?
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i];
      const b = i + 1 < level.length ? level[i + 1] : level[i];
      next.push(await hashNode(sodium, a, b));
    }
    level = next;
    idx = Math.floor(idx / 2);
  }
  return proof;
}

/** Verify a Merkle proof: does `leaf` + `proof` reconstruct `root`? */
export async function verifyMerkleProof(leaf, proof, root) {
  const sodium = await getSodium();
  let node = leaf;
  for (const step of proof) {
    node = step.right ? await hashNode(sodium, node, step.sibling) : await hashNode(sodium, step.sibling, node);
  }
  return sodium.memcmp(node, root);
}
