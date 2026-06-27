// Apache-2.0 — features synthesized from Status/Session/EXTRA SAFE/Mixin/ChatLink/Wispr.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveIdentityKey } from '../src/crypto/message.js';
import { safetyNumber } from '../src/safety.js';
import { proofHash } from '../src/anchor.js';
import { encodePayload, decodePayload } from '../src/media.js';

const enc = (s) => new TextEncoder().encode(s);

test('safety number is order-independent and key-dependent (EXTRA SAFE)', async () => {
  const a = await deriveIdentityKey(enc('alice'));
  const b = await deriveIdentityKey(enc('bob'));
  const ab = await safetyNumber(a.publicKey, b.publicKey);
  const ba = await safetyNumber(b.publicKey, a.publicKey);
  assert.equal(ab, ba); // both sides compute the same code
  assert.match(ab, /^(\d{5} ){11}\d{5}$/); // 12 groups of 5 digits

  const c = await deriveIdentityKey(enc('carol'));
  assert.notEqual(ab, await safetyNumber(a.publicKey, c.publicKey)); // changes if a key changes
});

test('payment payload round-trips (Mixin in-chat transfer)', () => {
  const p = decodePayload(encodePayload({ t: 'payment', payment: { asset: 'USDC', amount: '12.50', memo: 'lunch' } }));
  assert.equal(p.t, 'payment');
  assert.equal(p.payment.asset, 'USDC');
  assert.equal(p.payment.amount, '12.50');
});

test('proofHash is deterministic + tamper-evident (ChatLink on-chain record)', async () => {
  const h1 = await proofHash(enc('the agreed terms'));
  const h2 = await proofHash(enc('the agreed terms'));
  const h3 = await proofHash(enc('the agreed terms.'));
  assert.equal(h1, h2);
  assert.notEqual(h1, h3);
  assert.match(h1, /^0x[0-9a-f]{64}$/);
});
