// Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryStore } from '../src/storage/store.js';
import { deriveIdentityKey } from '../src/crypto/message.js';
import {
  attachMedia,
  loadMedia,
  encodePayload,
  decodePayload,
  isExpired,
} from '../src/media.js';

const enc = (s) => new TextEncoder().encode(s);
const dec = (u) => new TextDecoder().decode(u);

test('attachMedia stores ciphertext; loadMedia recovers the bytes', async () => {
  const store = new InMemoryStore();
  const signing = await deriveIdentityKey(enc('author'));
  const image = enc('PNG-bytes-pretend-🖼️-confidential');

  const desc = await attachMedia(store, image, signing, { mime: 'image/png', name: 'cat.png' });
  assert.equal(desc.mime, 'image/png');
  assert.equal(desc.name, 'cat.png');
  assert.equal(desc.size, image.length);

  // What's stored must not contain the plaintext marker.
  const raw = dec(await store.get(desc.cid));
  assert.ok(!raw.includes('confidential'));

  const back = await loadMedia(store, desc, signing.publicKey);
  assert.equal(dec(back), 'PNG-bytes-pretend-🖼️-confidential');
});

test('loadMedia rejects a wrong signer (authenticity)', async () => {
  const store = new InMemoryStore();
  const signing = await deriveIdentityKey(enc('author'));
  const impostor = await deriveIdentityKey(enc('impostor'));
  const desc = await attachMedia(store, enc('x'), signing);
  await assert.rejects(() => loadMedia(store, desc, impostor.publicKey), /MITM/);
});

test('payload envelope encodes/decodes text and media', () => {
  const t = decodePayload(encodePayload({ t: 'text', body: 'hi', ttl: 60 }));
  assert.equal(t.t, 'text');
  assert.equal(t.body, 'hi');
  assert.equal(t.ttl, 60);

  const m = decodePayload(encodePayload({ t: 'media', body: 'caption', media: { cid: 'bafy', key: 'k', mime: 'image/png', name: 'a', size: 3 } }));
  assert.equal(m.t, 'media');
  assert.equal(m.media.cid, 'bafy');
});

test('decodePayload treats a bare string as text (back-compat)', () => {
  const p = decodePayload('just text');
  assert.equal(p.t, 'text');
  assert.equal(p.body, 'just text');
});

test('isExpired honors the self-destruct ttl', () => {
  const sentAt = 1_000_000;
  assert.equal(isExpired(0, sentAt, sentAt + 999_999), false); // no ttl
  assert.equal(isExpired(60, sentAt, sentAt + 59_000), false); // not yet
  assert.equal(isExpired(60, sentAt, sentAt + 60_000), true); // exactly at ttl
  assert.equal(isExpired(60, sentAt, sentAt + 61_000), true); // past
});
