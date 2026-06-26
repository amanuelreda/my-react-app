// Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  deriveTopic,
  deriveConversationTopic,
  InMemoryRelay,
} from '../src/transport/relay.js';
import { Conversation } from '../src/transport/conversation.js';
import { getSodium, deriveIdentityKey } from '../src/crypto/message.js';

const enc = (s) => new TextEncoder().encode(s);
const tick = () => new Promise((r) => setTimeout(r, 0));

test('deriveTopic is deterministic and opaque', async () => {
  const t1 = await deriveTopic('group:42');
  const t2 = await deriveTopic('group:42');
  const t3 = await deriveTopic('group:43');
  assert.equal(t1, t2);
  assert.notEqual(t1, t3);
  assert.match(t1, /^\/teleblock\/1\/[0-9a-f]{32}$/);
  assert.ok(!t1.includes('42')); // does not leak the underlying id
});

test('deriveConversationTopic is order-independent', async () => {
  const sodium = await getSodium();
  const a = sodium.randombytes_buf(32);
  const b = sodium.randombytes_buf(32);
  assert.equal(await deriveConversationTopic(a, b), await deriveConversationTopic(b, a));
});

test('InMemoryRelay delivers to subscribers and retains history', async () => {
  const relay = new InMemoryRelay();
  const topic = await deriveTopic('t');
  const got = [];
  relay.subscribe(topic, (f) => got.push(f));
  await relay.publish(topic, { n: 1 });
  await relay.publish(topic, { n: 2 });
  await tick();
  assert.deepEqual(got, [{ n: 1 }, { n: 2 }]);
  // Late subscriber can query history (store-node behavior).
  assert.deepEqual(await relay.query(topic), [{ n: 1 }, { n: 2 }]);
});

test('unsubscribe stops delivery', async () => {
  const relay = new InMemoryRelay();
  const topic = await deriveTopic('t');
  const got = [];
  const unsub = relay.subscribe(topic, (f) => got.push(f));
  await relay.publish(topic, { n: 1 });
  await tick();
  unsub();
  await relay.publish(topic, { n: 2 });
  await tick();
  assert.deepEqual(got, [{ n: 1 }]);
});

test('end-to-end secret chat over the relay (both directions)', async () => {
  const sodium = await getSodium();
  const relay = new InMemoryRelay();
  const topic = await deriveTopic('alice:bob');

  const aliceSign = await deriveIdentityKey(enc('alice'));
  const bobSign = await deriveIdentityKey(enc('bob'));

  // Shared roots from X3DH (modelled here as two agreed 32-byte roots). Alice's send chain must
  // equal Bob's receive chain and vice-versa, so the two parties cross their roots.
  const rootAB = sodium.randombytes_buf(32); // Alice->Bob direction
  const rootBA = sodium.randombytes_buf(32); // Bob->Alice direction
  const aad = sodium.from_string(topic);

  const alice = new Conversation({
    transport: relay,
    topic,
    sendRoot: rootAB,
    recvRoot: rootBA,
    signing: aliceSign,
    peerSigningPub: bobSign.publicKey,
    aad,
  });
  const bob = new Conversation({
    transport: relay,
    topic,
    sendRoot: rootBA,
    recvRoot: rootAB,
    signing: bobSign,
    peerSigningPub: aliceSign.publicKey,
    aad,
  });

  const bobGot = [];
  const aliceGot = [];
  // Both peers share one topic and receive each other's frames. Conversation skips self-authored
  // frames (matched by senderPub) so each receive chain advances only on the peer's messages.
  bob.start((m) => {
    if (!m.error) bobGot.push(m.text);
  });
  alice.start((m) => {
    if (!m.error) aliceGot.push(m.text);
  });

  await alice.send('gm bob');
  await tick();
  await bob.send('gm alice');
  await tick();
  await tick();

  assert.ok(bobGot.includes('gm bob'));
  assert.ok(aliceGot.includes('gm alice'));
});
