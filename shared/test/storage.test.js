// Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  InMemoryStore,
  cidOf,
  putEncrypted,
  getDecrypted,
} from '../src/storage/store.js';
import { deriveIdentityKey } from '../src/crypto/message.js';

const enc = (s) => new TextEncoder().encode(s);
const dec = (u) => new TextDecoder().decode(u);

test('content-addressing: identical bytes -> identical CID', async () => {
  const a = await cidOf(enc('hello'));
  const b = await cidOf(enc('hello'));
  const c = await cidOf(enc('world'));
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^bafy[0-9a-f]{64}$/);
});

test('InMemoryStore put/get/has round-trip', async () => {
  const store = new InMemoryStore();
  const cid = await store.put(enc('some media bytes'));
  assert.equal(await store.has(cid), true);
  assert.equal(dec(await store.get(cid)), 'some media bytes');
  await assert.rejects(() => store.get('bafymissing'), /not found/);
});

test('putEncrypted stores ciphertext, getDecrypted recovers plaintext', async () => {
  const store = new InMemoryStore();
  const signing = await deriveIdentityKey(enc('author'));
  const media = enc('🔒 confidential image bytes');

  const { cid, key } = await putEncrypted(store, media, signing);

  // What's actually stored must NOT contain the plaintext.
  const storedRaw = dec(await store.get(cid));
  assert.ok(!storedRaw.includes('confidential'));

  const recovered = await getDecrypted(store, cid, key, signing.publicKey);
  assert.equal(dec(recovered), '🔒 confidential image bytes');
});

test('getDecrypted rejects a wrong signer (authenticity)', async () => {
  const store = new InMemoryStore();
  const signing = await deriveIdentityKey(enc('author'));
  const impostor = await deriveIdentityKey(enc('impostor'));
  const { cid, key } = await putEncrypted(store, enc('x'), signing);
  await assert.rejects(() => getDecrypted(store, cid, key, impostor.publicKey), /MITM/);
});
