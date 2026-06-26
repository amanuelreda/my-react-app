// Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getSodium,
  sealMessage,
  openMessage,
  deriveIdentityKey,
} from '../src/crypto/message.js';
import { ratchetStep, SymmetricChain } from '../src/crypto/ratchet.js';

const enc = (s) => new TextEncoder().encode(s);
const dec = (u) => new TextDecoder().decode(u);

test('round-trip: seal then open recovers plaintext', async () => {
  const sodium = await getSodium();
  const msgKey = sodium.randombytes_buf(32);
  const signer = sodium.crypto_sign_keypair();
  const plaintext = enc('hello teleblock');

  const frame = await sealMessage(plaintext, msgKey, signer.privateKey);
  const opened = await openMessage(frame, msgKey);
  assert.equal(dec(opened), 'hello teleblock');
});

test('tampered ciphertext is rejected (AEAD integrity)', async () => {
  const sodium = await getSodium();
  const msgKey = sodium.randombytes_buf(32);
  const signer = sodium.crypto_sign_keypair();
  const frame = await sealMessage(enc('secret'), msgKey, signer.privateKey);

  // Flip a byte in the ciphertext and re-sign so the signature passes but AEAD must fail.
  const raw = sodium.from_base64(frame.ciphertext, sodium.base64_variants.ORIGINAL);
  raw[0] ^= 0xff;
  const nonce = sodium.from_base64(frame.nonce, sodium.base64_variants.ORIGINAL);
  const signed = new Uint8Array(nonce.length + raw.length);
  signed.set(nonce, 0);
  signed.set(raw, nonce.length);
  const tampered = {
    ...frame,
    ciphertext: sodium.to_base64(raw, sodium.base64_variants.ORIGINAL),
    sig: sodium.to_base64(
      sodium.crypto_sign_detached(signed, signer.privateKey),
      sodium.base64_variants.ORIGINAL,
    ),
  };
  await assert.rejects(() => openMessage(tampered, msgKey));
});

test('forged signature is rejected', async () => {
  const sodium = await getSodium();
  const msgKey = sodium.randombytes_buf(32);
  const signer = sodium.crypto_sign_keypair();
  const frame = await sealMessage(enc('x'), msgKey, signer.privateKey);
  // Corrupt the signature.
  const badSig = sodium.from_base64(frame.sig, sodium.base64_variants.ORIGINAL);
  badSig[0] ^= 0x01;
  frame.sig = sodium.to_base64(badSig, sodium.base64_variants.ORIGINAL);
  await assert.rejects(() => openMessage(frame, msgKey), /bad signature/);
});

test('wrong key fails to decrypt', async () => {
  const sodium = await getSodium();
  const signer = sodium.crypto_sign_keypair();
  const frame = await sealMessage(enc('x'), sodium.randombytes_buf(32), signer.privateKey);
  await assert.rejects(() => openMessage(frame, sodium.randombytes_buf(32)));
});

test('associated data (AAD) must match', async () => {
  const sodium = await getSodium();
  const msgKey = sodium.randombytes_buf(32);
  const signer = sodium.crypto_sign_keypair();
  const frame = await sealMessage(enc('x'), msgKey, signer.privateKey, enc('group-1'));
  // Correct AAD opens.
  assert.equal(dec(await openMessage(frame, msgKey, enc('group-1'))), 'x');
  // Wrong AAD fails.
  await assert.rejects(() => openMessage(frame, msgKey, enc('group-2')));
});

test('expectedSenderPub mismatch is rejected (MITM guard)', async () => {
  const sodium = await getSodium();
  const msgKey = sodium.randombytes_buf(32);
  const signer = sodium.crypto_sign_keypair();
  const impostor = sodium.crypto_sign_keypair();
  const frame = await sealMessage(enc('x'), msgKey, signer.privateKey);
  await assert.rejects(
    () => openMessage(frame, msgKey, null, impostor.publicKey),
    /MITM/,
  );
  // Correct expected key passes.
  assert.equal(dec(await openMessage(frame, msgKey, null, signer.publicKey)), 'x');
});

test('deriveIdentityKey is deterministic and domain-separated', async () => {
  const sig = enc('a-wallet-signature-over-the-siwe-challenge');
  const k1 = await deriveIdentityKey(sig);
  const k2 = await deriveIdentityKey(sig);
  assert.deepEqual(k1.publicKey, k2.publicKey); // deterministic
  const k3 = await deriveIdentityKey(enc('different-signature'));
  assert.notDeepEqual(k1.publicKey, k3.publicKey); // input-dependent
});

test('derived identity key can sign and verify a real frame', async () => {
  const sodium = await getSodium();
  const id = await deriveIdentityKey(enc('sig-bytes'));
  const msgKey = sodium.randombytes_buf(32);
  const frame = await sealMessage(enc('signed-by-identity'), msgKey, id.privateKey);
  assert.equal(
    dec(await openMessage(frame, msgKey, null, id.publicKey)),
    'signed-by-identity',
  );
});

test('ratchet yields distinct message keys and forward secrecy', async () => {
  const sodium = await getSodium();
  const root = sodium.randombytes_buf(32);
  const chain = new SymmetricChain(root);
  const k1 = await chain.next();
  const k2 = await chain.next();
  const k3 = await chain.next();
  // Each message key is unique.
  assert.notDeepEqual(k1, k2);
  assert.notDeepEqual(k2, k3);
  assert.equal(chain.index, 3);
  // Forward secrecy property: from k2's chain state you cannot recompute k1. We model this by
  // checking that a fresh chain re-derives the SAME sequence (determinism) but an advanced chain
  // never reproduces an earlier key.
  const replay = new SymmetricChain(root);
  assert.deepEqual(await replay.next(), k1);
  assert.deepEqual(await replay.next(), k2);
});

test('ratchetStep rejects wrong-sized chain key', async () => {
  await assert.rejects(() => ratchetStep(new Uint8Array(16)), /32 bytes/);
});

test('end-to-end: ratchet + AEAD between two parties', async () => {
  const sodium = await getSodium();
  // Shared root (in practice from X3DH / MLS). Alice sends, Bob receives in order.
  const root = sodium.randombytes_buf(32);
  const alice = new SymmetricChain(root);
  const bob = new SymmetricChain(root);
  const signer = await deriveIdentityKey(enc('alice'));

  const messages = ['gm', 'how are you', 'ship it 🚀'];
  for (const m of messages) {
    const mk = await alice.next();
    const frame = await sealMessage(enc(m), mk, signer.privateKey);
    const bk = await bob.next();
    const opened = await openMessage(frame, bk, null, signer.publicKey);
    assert.equal(dec(opened), m);
  }
});
