// Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getSodium, sealMessage, deriveIdentityKey } from '../src/crypto/message.js';
import { frameHash, buildMerkleRoot, merkleProof, verifyMerkleProof } from '../src/anchor.js';

const enc = (s) => new TextEncoder().encode(s);

async function makeFrames(n) {
  const sodium = await getSodium();
  const signing = await deriveIdentityKey(enc('anchorer'));
  const frames = [];
  for (let i = 0; i < n; i++) {
    frames.push(await sealMessage(enc(`msg ${i}`), sodium.randombytes_buf(32), signing.privateKey));
  }
  return frames;
}

test('frameHash is deterministic and 32 bytes', async () => {
  const [f] = await makeFrames(1);
  const a = await frameHash(f);
  const b = await frameHash(f);
  assert.equal(a.length, 32);
  assert.deepEqual(a, b);
});

test('every leaf in a batch verifies against the root', async () => {
  const frames = await makeFrames(5); // odd count exercises the duplicate-last path
  const leaves = await Promise.all(frames.map(frameHash));
  const root = await buildMerkleRoot(leaves);
  for (let i = 0; i < leaves.length; i++) {
    const proof = await merkleProof(leaves, i);
    assert.equal(await verifyMerkleProof(leaves[i], proof, root), true, `leaf ${i}`);
  }
});

test('a tampered/foreign leaf does NOT verify (tamper-evidence)', async () => {
  const frames = await makeFrames(4);
  const leaves = await Promise.all(frames.map(frameHash));
  const root = await buildMerkleRoot(leaves);
  const proof = await merkleProof(leaves, 1);
  // A frame not in the batch must fail against position 1's proof.
  const [foreign] = await makeFrames(1);
  const foreignLeaf = await frameHash(foreign);
  assert.equal(await verifyMerkleProof(foreignLeaf, proof, root), false);
});

test('reordering the batch changes the root', async () => {
  const frames = await makeFrames(4);
  const leaves = await Promise.all(frames.map(frameHash));
  const root = await buildMerkleRoot(leaves);
  const swapped = [leaves[1], leaves[0], leaves[2], leaves[3]];
  const root2 = await buildMerkleRoot(swapped);
  const sodium = await getSodium();
  assert.equal(sodium.memcmp(root, root2), false);
});

test('single-leaf and empty batches are handled', async () => {
  const frames = await makeFrames(1);
  const leaves = await Promise.all(frames.map(frameHash));
  const root = await buildMerkleRoot(leaves);
  assert.equal(await verifyMerkleProof(leaves[0], await merkleProof(leaves, 0), root), true);
  const empty = await buildMerkleRoot([]);
  assert.equal(empty.length, 32);
});

test('merkleProof rejects an out-of-range index', async () => {
  const leaves = await Promise.all((await makeFrames(2)).map(frameHash));
  await assert.rejects(() => merkleProof(leaves, 5), /out of range/);
});
