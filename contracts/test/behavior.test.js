// Apache-2.0
// Executes the contracts in an in-process EVM (see evm-harness.js) — Foundry-style behavior tests
// that run anywhere npm runs. Complements `forge test` (the full pipeline in CI).
//
// Note: viem's decodeFunctionResult returns a scalar for single-output functions and a tuple array
// for structs (e.g. the `posts` getter), so single reads are compared directly and struct fields by
// index.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Chain, addr } from './evm-harness.js';
import { keccak256, toBytes, zeroAddress } from 'viem';

const OWNER = 0xffff;
const B32 = (s) => ('0x' + Buffer.from(s).toString('hex').padEnd(64, '0').slice(0, 64));
const lc = (a) => String(a).toLowerCase();

test('IdentityRegistry: register, double-register revert, username uniqueness', async () => {
  const chain = await Chain.create();
  const reg = await chain.deploy('IdentityRegistry');
  const alice = addr(0xa1);
  const bob = addr(0xb0b);

  await reg.send('register', ['0x1234', 'cidPre', 'cidProf'], { from: alice });
  assert.equal(await reg.call('isRegistered', [alice.toString()]), true);
  await reg.expectRevert('register', ['0x1234', 'a', 'b'], { from: alice }); // double register

  const name = keccak256(toBytes('satoshi'));
  await reg.send('register', ['0x5678', 'p', 'q'], { from: bob });
  await reg.send('claimUsername', [name], { from: alice });
  await reg.expectRevert('claimUsername', [name], { from: bob }); // taken
  assert.equal(lc(await reg.call('usernameToAddr', [name])), lc(alice.toString()));
});

test('GroupManager: create → owner perms, join, ban blocks rejoin', async () => {
  const chain = await Chain.create();
  const gm = await chain.deploy('GroupManager');
  const owner = addr(1);
  const member = addr(2);

  await gm.send('createGroup', [B32('meta'), 0, zeroAddress, B32('mls')], { from: owner }); // groupId 1
  assert.equal(await gm.call('perms', [1n, owner.toString()]), OWNER);

  await gm.send('join', [1n, '0x'], { from: member });
  assert.equal(await gm.call('isMember', [1n, member.toString()]), true);

  await gm.send('ban', [1n, member.toString(), B32('spam')], { from: owner });
  assert.equal(await gm.call('isMember', [1n, member.toString()]), false);
  assert.equal(await gm.call('banned', [1n, member.toString()]), true);
  await gm.expectRevert('join', [1n, '0x'], { from: member }); // banned
  await gm.expectRevert('ban', [1n, owner.toString(), B32('x')], { from: member }); // not permitted
});

test('Reputation: authorized award + sqrt voting weight', async () => {
  const chain = await Chain.create();
  const rep = await chain.deploy('Reputation'); // deployer (addr 1) is owner
  const hook = addr(0xc0c0);
  const user = addr(0x1234);

  await rep.send('setHook', [hook.toString(), true], { from: addr(1) });
  await rep.expectRevert('award', [user.toString(), 100n, B32('x')], { from: addr(2) }); // unauthorized
  await rep.send('award', [user.toString(), 100n, B32('x')], { from: hook });
  assert.equal(await rep.call('reputationOf', [user.toString()]), 100n);
  assert.equal(await rep.call('weight', [user.toString()]), 10n); // sqrt(100)
});

test('ForumManager: post, signed weighted vote, DAO-only moderation', async () => {
  const chain = await Chain.create();
  const fm = await chain.deploy('ForumManager', { args: [zeroAddress] }); // no reputation -> weight 1
  const owner = addr(1);
  const author = addr(3);
  const voter = addr(4);
  const dao = addr(0x0da0);

  // Owner-governed forum (gov=0).
  await fm.send('createForum', [B32('m'), 0, zeroAddress, 0], { from: owner }); // forumId 1
  await fm.send('createPost', [1n, 0n, B32('cid'), B32('h')], { from: author }); // postId 1

  // Post struct fields: [forumId, parentId, author, contentCID, contentHash, ts, score, status]
  await fm.send('vote', [1n, 1], { from: voter });
  assert.equal((await fm.call('posts', [1n]))[6], 1n); // score +1
  await fm.send('vote', [1n, -1], { from: voter }); // switch to downvote -> -1 (signed, not abs)
  assert.equal((await fm.call('posts', [1n]))[6], -1n);

  // DAO-governed forum: even the owner cannot moderate; only the governor.
  await fm.send('createForum', [B32('m'), 2, dao.toString(), 0], { from: owner }); // forumId 2
  await fm.send('createPost', [2n, 0n, B32('c'), B32('h')], { from: author }); // postId 2
  await fm.expectRevert('moderate', [2n, 1, B32('r')], { from: owner });
  await fm.send('moderate', [2n, 1, B32('r')], { from: dao }); // hidden
  assert.equal((await fm.call('posts', [2n]))[7], 1); // status = Hidden
});
