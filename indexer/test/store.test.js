// Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IndexStore, PERM } from '../src/store.js';
import { createApi } from '../src/server.js';
import { normalizeLog, orderLogs } from '../src/ingest.js';

let seq = 0;
const ev = (name, args, blockNumber = 1) => ({ name, args, blockNumber, logIndex: seq++ });

test('groups: create, join, role, ban update the roster', () => {
  seq = 0;
  const s = new IndexStore();
  s.applyAll([
    ev('GroupCreated', { groupId: '1', owner: 'alice', visibility: 0, metadataCID: 'cid' }),
    ev('MemberJoined', { groupId: '1', member: 'bob', permMask: PERM.POST | PERM.MEDIA }),
    ev('MemberJoined', { groupId: '1', member: 'carol', permMask: PERM.POST }),
    ev('RoleChanged', { groupId: '1', member: 'bob', permMask: PERM.MANAGE_ADMINS | PERM.BAN | PERM.POST }),
    ev('MemberBanned', { groupId: '1', member: 'carol', reasonCID: 'spam' }),
  ]);

  const groups = s.listGroups();
  assert.equal(groups.length, 1);
  assert.equal(groups[0].memberCount, 2); // alice + bob (carol banned)
  assert.equal(groups[0].visibility, 'public');

  const members = s.groupMembers('1');
  const bob = members.find((m) => m.address === 'bob');
  assert.ok(bob.isAdmin);
  assert.ok(members.find((m) => m.address === 'alice').isOwner);
  assert.equal(s.isBanned('1', 'carol'), true);
  assert.ok(!members.find((m) => m.address === 'carol'));
});

test('forums: posts, nested replies, weighted voting and ranking', () => {
  seq = 0;
  const s = new IndexStore();
  s.applyAll([
    ev('ForumCreated', { forumId: '1', owner: 'alice', gov: 0, visibility: 0 }),
    ev('PostCreated', { postId: '10', forumId: '1', parentId: '0', author: 'alice', contentCID: 'a' }),
    ev('PostCreated', { postId: '11', forumId: '1', parentId: '0', author: 'bob', contentCID: 'b' }),
    ev('PostCreated', { postId: '12', forumId: '1', parentId: '10', author: 'carol', contentCID: 'c' }),
    // weighted upvotes: post 11 gets weight 10, post 10 gets weight 1
    ev('Voted', { postId: '11', voter: 'whale', dir: 1, weight: 10 }),
    ev('Voted', { postId: '10', voter: 'carol', dir: 1, weight: 1 }),
  ]);

  const threads = s.forumThreads('1', { sort: 'top' });
  assert.equal(threads.length, 2); // 10 and 11 are top-level; 12 is a reply
  assert.equal(threads[0].id, '11'); // higher weighted score ranks first
  assert.equal(threads[0].score, 10);
  assert.equal(threads[1].score, 1);

  const replies = s.replies('10');
  assert.equal(replies.length, 1);
  assert.equal(replies[0].id, '12');
});

test('forums: downvote subtracts, vote change adjusts, clear resets', () => {
  seq = 0;
  const s = new IndexStore();
  s.applyAll([
    ev('ForumCreated', { forumId: '1', owner: 'a', gov: 0, visibility: 0 }),
    ev('PostCreated', { postId: '1', forumId: '1', parentId: '0', author: 'a', contentCID: 'x' }),
    ev('Voted', { postId: '1', voter: 'v', dir: 1, weight: 3 }), // +3
  ]);
  assert.equal(s.posts.get('1').score, 3);
  s.apply(ev('Voted', { postId: '1', voter: 'v', dir: -1, weight: 3 })); // -> -3
  assert.equal(s.posts.get('1').score, -3);
  s.apply(ev('Voted', { postId: '1', voter: 'v', dir: 0, weight: 3 })); // -> 0
  assert.equal(s.posts.get('1').score, 0);
});

test('forums: moderation hides and pins; hidden threads drop out of listings', () => {
  seq = 0;
  const s = new IndexStore();
  s.applyAll([
    ev('ForumCreated', { forumId: '1', owner: 'a', gov: 1, visibility: 0 }),
    ev('PostCreated', { postId: '1', forumId: '1', parentId: '0', author: 'a', contentCID: 'x' }),
    ev('PostCreated', { postId: '2', forumId: '1', parentId: '0', author: 'b', contentCID: 'y' }),
    ev('Moderated', { postId: '1', newStatus: 1, reasonCID: 'r' }), // hidden
    ev('Moderated', { postId: '2', newStatus: 3, reasonCID: 'r' }), // pinned
  ]);
  const threads = s.forumThreads('1');
  assert.equal(threads.length, 1); // hidden post excluded
  assert.equal(threads[0].id, '2');
  assert.equal(threads[0].status, 'pinned');
});

test('reputation + badges + identity', () => {
  seq = 0;
  const s = new IndexStore();
  s.applyAll([
    ev('Registered', { user: 'alice', signingPubKey: '0xabc', preKeyBundleCID: 'pk' }),
    ev('ProfileUpdated', { user: 'alice', profileCID: 'prof' }),
    ev('UsernameClaimed', { user: 'alice', nameHash: '0xname' }),
    ev('Awarded', { user: 'alice', amount: 5, sourceRef: '0x', newTotal: 5 }),
    ev('Awarded', { user: 'alice', amount: 5, sourceRef: '0x', newTotal: 10 }),
    ev('BadgeMinted', { user: 'alice', badgeId: 1 }),
  ]);
  const id = s.identityOf('alice');
  assert.equal(id.preKeyBundleCID, 'pk');
  assert.equal(id.profileCID, 'prof');
  assert.equal(id.username, '0xname');
  assert.equal(s.reputationOf('alice'), 10);
  assert.deepEqual(s.badgesOf('alice'), ['1']);
});

test('cursor: out-of-order / replayed events are ignored', () => {
  seq = 0;
  const s = new IndexStore();
  s.apply({ name: 'GroupCreated', args: { groupId: '1', owner: 'a', visibility: 0, metadataCID: 'c' }, blockNumber: 5, logIndex: 2 });
  // A stale event (earlier block) must be ignored.
  s.apply({ name: 'MemberJoined', args: { groupId: '1', member: 'b', permMask: 1 }, blockNumber: 5, logIndex: 1 });
  assert.equal(s.groups.get('1').memberCount, 1);
  // A newer event applies.
  s.apply({ name: 'MemberJoined', args: { groupId: '1', member: 'b', permMask: 1 }, blockNumber: 5, logIndex: 3 });
  assert.equal(s.groups.get('1').memberCount, 2);
});

test('ingest.normalizeLog: bigints stringified, fields normalized', () => {
  const norm = normalizeLog({
    eventName: 'MemberJoined',
    args: { groupId: 7n, member: 'bob', permMask: 3n },
    blockNumber: 12n,
    logIndex: 4n,
    transactionHash: '0xdead',
  });
  assert.equal(norm.name, 'MemberJoined');
  assert.equal(norm.args.groupId, '7');
  assert.equal(norm.args.permMask, '3');
  assert.equal(norm.blockNumber, 12);
  assert.deepEqual([norm].sort(orderLogs)[0].name, 'MemberJoined');
});

test('HTTP API serves derived lists', async () => {
  seq = 0;
  const s = new IndexStore();
  s.applyAll([
    ev('GroupCreated', { groupId: '1', owner: 'alice', visibility: 0, metadataCID: 'c' }),
    ev('MemberJoined', { groupId: '1', member: 'bob', permMask: 1 }),
  ]);
  const server = createApi(s);
  await new Promise((r) => server.listen(0, r));
  const { port } = server.address();

  const res = await fetch(`http://localhost:${port}/groups`);
  const body = await res.json();
  assert.equal(body.groups[0].memberCount, 2);

  const m = await (await fetch(`http://localhost:${port}/groups/1/members`)).json();
  assert.equal(m.members.length, 2);

  const nf = await fetch(`http://localhost:${port}/nope`);
  assert.equal(nf.status, 404);

  await new Promise((r) => server.close(r));
});
