// Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SearchIndex, tokenize, buildSearchIndex } from '../src/search.js';
import { IndexStore } from '../src/store.js';

test('tokenize lowercases, splits, drops stopwords/short tokens', () => {
  assert.deepEqual(tokenize('The MLS Re-keying!'), ['mls', 'keying']);
});

test('search ranks title matches above body matches', () => {
  const si = new SearchIndex();
  si.add({ id: 'a', type: 'post', refId: '1', title: 'Encryption basics', body: 'intro' });
  si.add({ id: 'b', type: 'post', refId: '2', title: 'Networking', body: 'about encryption internals' });
  const res = si.search('encryption');
  assert.equal(res[0].id, 'a'); // title hit outranks body hit
  assert.equal(res.length, 2);
});

test('multi-token query ranks docs matching more distinct tokens first', () => {
  const si = new SearchIndex();
  si.add({ id: 'a', type: 'post', refId: '1', title: 'forum governance proposal', body: '' });
  si.add({ id: 'b', type: 'post', refId: '2', title: 'forum rules', body: '' });
  const res = si.search('forum governance');
  assert.equal(res[0].id, 'a'); // matches both tokens
});

test('prefix match on the final token (typeahead)', () => {
  const si = new SearchIndex();
  si.add({ id: 'a', type: 'group', refId: '1', title: 'Encrypted builders', body: '' });
  const res = si.search('encr');
  assert.equal(res.length, 1);
  assert.equal(res[0].id, 'a');
});

test('type filter restricts results', () => {
  const si = new SearchIndex();
  si.add({ id: 'g', type: 'group', refId: '1', title: 'crypto club', body: '' });
  si.add({ id: 'p', type: 'post', refId: '2', title: 'crypto thread', body: '' });
  assert.equal(si.search('crypto', { type: 'group' }).length, 1);
  assert.equal(si.search('crypto').length, 2);
});

test('remove takes a doc out of results', () => {
  const si = new SearchIndex();
  si.add({ id: 'a', type: 'post', refId: '1', title: 'deletable', body: '' });
  assert.equal(si.search('deletable').length, 1);
  si.remove('a');
  assert.equal(si.search('deletable').length, 0);
});

test('no match returns empty', () => {
  const si = new SearchIndex();
  si.add({ id: 'a', type: 'post', refId: '1', title: 'hello world', body: '' });
  assert.deepEqual(si.search('zzzzz'), []);
  assert.deepEqual(si.search('   '), []);
});

test('buildSearchIndex indexes groups, forums, posts, users from a store', () => {
  let seq = 0;
  const ev = (name, args) => ({ name, args, blockNumber: 1, logIndex: seq++ });
  const s = new IndexStore();
  s.applyAll([
    ev('GroupCreated', { groupId: '1', owner: '0xa', visibility: 0, metadataCID: 'c' }),
    ev('ForumCreated', { forumId: '1', owner: '0xa', gov: 2, visibility: 0 }),
    ev('PostCreated', { postId: '10', forumId: '1', parentId: '0', author: '0xa', contentCID: 'c' }),
  ]);
  const si = buildSearchIndex(s, {
    groups: { '1': { name: 'TeleBlock Builders' } },
    forums: { '1': { name: 'Protocol Governance' } },
    posts: { '10': { title: 'MLS rekeying', preview: 'O(log n) groups' } },
    users: { '0xa': 'alice.eth' },
  });
  assert.equal(si.search('builders')[0].type, 'group');
  assert.equal(si.search('governance')[0].type, 'forum');
  assert.equal(si.search('rekeying')[0].type, 'post');
  assert.equal(si.search('alice')[0].type, 'user');
  // cross-type: "protocol" hits the forum title
  assert.equal(si.search('protocol')[0].refId, '1');
});
