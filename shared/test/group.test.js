// Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGroupSession } from '../src/group/groupSession.js';
import { deriveIdentityKey } from '../src/crypto/message.js';

const enc = (s) => new TextEncoder().encode(s);
const dec = (u) => new TextDecoder().decode(u);
const GID = 'group:42';

async function member(id) {
  const signing = await deriveIdentityKey(enc(id));
  return createGroupSession({ groupId: GID, myId: id, signing });
}

/** Distribute every member's sender key to every other member. */
async function exchangeKeys(sessions) {
  for (const a of sessions) {
    const bundle = await a.senderKeyBundle();
    for (const b of sessions) {
      if (a !== b) await b.addMemberKey(bundle);
    }
  }
}

test('group: all members decrypt each others messages', async () => {
  const alice = await member('alice');
  const bob = await member('bob');
  const carol = await member('carol');
  await exchangeKeys([alice, bob, carol]);

  const m1 = await alice.encrypt('gm everyone');
  assert.equal(dec(await bob.decrypt(m1)), 'gm everyone');
  assert.equal(dec(await carol.decrypt(m1)), 'gm everyone');

  const m2 = await bob.encrypt('gm alice');
  assert.equal(dec(await alice.decrypt(m2)), 'gm alice');
  assert.equal(dec(await carol.decrypt(m2)), 'gm alice');
});

test('group: messages from the same sender decrypt in order', async () => {
  const alice = await member('alice');
  const bob = await member('bob');
  await exchangeKeys([alice, bob]);

  for (const text of ['one', 'two', 'three']) {
    const m = await alice.encrypt(text);
    assert.equal(dec(await bob.decrypt(m)), text);
  }
});

test('group: out-of-order delivery is handled via skipped-key cache', async () => {
  const alice = await member('alice');
  const bob = await member('bob');
  await exchangeKeys([alice, bob]);

  const m1 = await alice.encrypt('first');
  const m2 = await alice.encrypt('second');
  const m3 = await alice.encrypt('third');
  // Deliver out of order: 3, 1, 2.
  assert.equal(dec(await bob.decrypt(m3)), 'third');
  assert.equal(dec(await bob.decrypt(m1)), 'first');
  assert.equal(dec(await bob.decrypt(m2)), 'second');
});

test('group: replayed/stale iteration is rejected', async () => {
  const alice = await member('alice');
  const bob = await member('bob');
  await exchangeKeys([alice, bob]);
  const m1 = await alice.encrypt('once');
  await bob.decrypt(m1);
  await assert.rejects(() => bob.decrypt(m1), /stale or replayed/);
});

test('group: forged sender signature is rejected', async () => {
  const alice = await member('alice');
  const bob = await member('bob');
  await exchangeKeys([alice, bob]);

  // An impostor crafts a message and lies that it is from "alice". Bob has alice's real group
  // signing key installed, so the MITM/sender-key check rejects it.
  const impostor = await member('mallory-as-alice');
  const forged = await impostor.encrypt('i am alice');
  forged.senderId = 'alice';
  await assert.rejects(() => bob.decrypt(forged), /signature|MITM|no sender key/);
});

test('group: removed+rotated member loses forward access; remaining members continue', async () => {
  const alice = await member('alice');
  const bob = await member('bob');
  const carol = await member('carol');
  await exchangeKeys([alice, bob, carol]);

  // Before removal, carol can read alice.
  const pre = await alice.encrypt('before removal');
  assert.equal(dec(await carol.decrypt(pre)), 'before removal');

  // Ban carol: remaining members drop her key and ROTATE their sender chains, then re-distribute
  // only among themselves (carol never receives the new seeds).
  alice.removeMember('carol');
  bob.removeMember('carol');
  await alice.rotate();
  await bob.rotate();
  for (const [a, b] of [[alice, bob], [bob, alice]]) {
    await b.addMemberKey(await a.senderKeyBundle());
  }

  // Alice posts after the rotation.
  const post = await alice.encrypt('after removal — secret');

  // Bob (still a member) decrypts fine.
  assert.equal(dec(await bob.decrypt(post)), 'after removal — secret');

  // Carol still holds her OLD receive chain for alice and never got the rotated seed -> she cannot
  // decrypt the post-removal message.
  await assert.rejects(() => carol.decrypt(post));
});
