// Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAbis } from '../src/abis.js';

test('loadAbis returns parsed event ABIs for all four contracts', () => {
  const abis = loadAbis();
  assert.deepEqual(Object.keys(abis).sort(), ['ForumManager', 'GroupManager', 'IdentityRegistry', 'Reputation']);
  const eventNames = (a) => a.filter((x) => x.type === 'event').map((x) => x.name);
  assert.ok(eventNames(abis.GroupManager).includes('GroupCreated'));
  assert.ok(eventNames(abis.ForumManager).includes('Voted'));
  assert.ok(eventNames(abis.IdentityRegistry).includes('Registered'));
  assert.ok(eventNames(abis.Reputation).includes('Awarded'));
});

test('entrypoint serves an empty store with no RPC configured', async () => {
  const { start } = await import('../src/index.js');
  const server = await start({ port: 0 });
  const { port } = server.address();
  const res = await fetch(`http://localhost:${port}/groups`);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { groups: [] });
  await new Promise((r) => server.close(r));
});
