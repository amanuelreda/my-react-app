// Apache-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { privateKeyToAccount } from 'viem/accounts';
import { generateSiweNonce } from 'viem/siwe';
import { hexToBytes } from 'viem';

import {
  identityChallenge,
  buildLoginMessage,
  verifyLogin,
  provisionIdentity,
  buildRegistrationPayload,
} from '../src/identity/siwe.js';
import {
  generateKeyMaterial,
  buildPreKeyBundle,
  verifyPreKeyBundle,
} from '../src/identity/prekeys.js';
import { initiateSession, respondSession } from '../src/identity/x3dh.js';
import { SymmetricChain } from '../src/crypto/ratchet.js';
import { sealMessage, openMessage } from '../src/crypto/message.js';

// Deterministic test accounts (well-known anvil keys).
const ALICE_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const BOB_PK = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const enc = (s) => new TextEncoder().encode(s);
const dec = (u) => new TextDecoder().decode(u);

test('SIWE login: valid signature verifies', async () => {
  const account = privateKeyToAccount(ALICE_PK);
  const nonce = generateSiweNonce();
  const message = buildLoginMessage({
    address: account.address,
    domain: 'app.teleblock.example',
    uri: 'https://app.teleblock.example',
    chainId: 8453,
    nonce,
  });
  const signature = await account.signMessage({ message });

  const res = await verifyLogin({
    message,
    signature,
    expectedDomain: 'app.teleblock.example',
    expectedNonce: nonce,
  });
  assert.equal(res.valid, true);
  assert.equal(res.address.toLowerCase(), account.address.toLowerCase());
});

test('SIWE login: tampered message is rejected', async () => {
  const account = privateKeyToAccount(ALICE_PK);
  const nonce = generateSiweNonce();
  const message = buildLoginMessage({
    address: account.address,
    domain: 'app.teleblock.example',
    uri: 'https://app.teleblock.example',
    chainId: 8453,
    nonce,
  });
  const signature = await account.signMessage({ message });
  // Swap the address in the message to Bob's; signature no longer matches.
  const bob = privateKeyToAccount(BOB_PK);
  const tampered = message.replace(account.address, bob.address);
  const res = await verifyLogin({ message: tampered, signature });
  assert.equal(res.valid, false);
});

test('SIWE login: wrong expected nonce is rejected', async () => {
  const account = privateKeyToAccount(ALICE_PK);
  const message = buildLoginMessage({
    address: account.address,
    domain: 'app.teleblock.example',
    uri: 'https://app.teleblock.example',
    chainId: 8453,
    nonce: generateSiweNonce(),
  });
  const signature = await account.signMessage({ message });
  const res = await verifyLogin({ message, signature, expectedNonce: generateSiweNonce() });
  assert.equal(res.valid, false);
});

test('identity derivation is stable across logins (nonce-free challenge)', async () => {
  const account = privateKeyToAccount(ALICE_PK);
  const challenge = identityChallenge(account.address);
  // Sign the SAME fixed challenge twice -> same signature -> same identity key.
  const sig1 = hexToBytes(await account.signMessage({ message: challenge }));
  const sig2 = hexToBytes(await account.signMessage({ message: challenge }));
  const id1 = await provisionIdentity({ identitySignature: sig1 });
  const id2 = await provisionIdentity({ identitySignature: sig2 });
  assert.deepEqual(id1.signing.publicKey, id2.signing.publicKey);
});

test('provisionIdentity yields a verifiable pre-key bundle', async () => {
  const account = privateKeyToAccount(ALICE_PK);
  const sig = hexToBytes(await account.signMessage({ message: identityChallenge(account.address) }));
  const { bundle } = await provisionIdentity({ identitySignature: sig, oneTimeCount: 3 });
  assert.equal(bundle.oneTimePreKeys.length, 3);
  const decoded = await verifyPreKeyBundle(bundle); // throws if tampered
  assert.ok(decoded.identityKeyX.length === 32);
});

test('tampered pre-key bundle fails verification', async () => {
  const km = await generateKeyMaterial(
    await (await import('../src/crypto/message.js')).deriveIdentityKey(enc('seed')),
    2,
  );
  const bundle = await buildPreKeyBundle(km);
  // Flip a char in the signed pre-key (base64) -> signature must fail.
  bundle.signedPreKey = bundle.signedPreKey.slice(0, -2) + (bundle.signedPreKey.endsWith('A') ? 'B' : 'A') + '=';
  await assert.rejects(() => verifyPreKeyBundle(bundle), /signature invalid/);
});

test('buildRegistrationPayload hex-encodes the signing key', async () => {
  const account = privateKeyToAccount(ALICE_PK);
  const sig = hexToBytes(await account.signMessage({ message: identityChallenge(account.address) }));
  const { signing } = await provisionIdentity({ identitySignature: sig });
  const payload = buildRegistrationPayload({
    signingPubKey: signing.publicKey,
    preKeyBundleCID: 'bafkreitestcid',
    profileCID: 'bafkreiprofile',
  });
  assert.match(payload.signingPubKeyHex, /^0x[0-9a-f]{64}$/); // 32-byte Ed25519 pubkey
  assert.equal(payload.preKeyBundleCID, 'bafkreitestcid');
});

test('X3DH: both parties derive the same shared secret', async () => {
  const aliceAcc = privateKeyToAccount(ALICE_PK);
  const bobAcc = privateKeyToAccount(BOB_PK);
  const aliceSig = hexToBytes(await aliceAcc.signMessage({ message: identityChallenge(aliceAcc.address) }));
  const bobSig = hexToBytes(await bobAcc.signMessage({ message: identityChallenge(bobAcc.address) }));

  const alice = await provisionIdentity({ identitySignature: aliceSig });
  const bob = await provisionIdentity({ identitySignature: bobSig });

  // Alice initiates against Bob's published bundle.
  const { secret: aliceSecret, header } = await initiateSession(alice.keyMaterial, bob.bundle);
  // Bob processes Alice's first-message header.
  const { secret: bobSecret } = await respondSession(bob.keyMaterial, header);

  assert.deepEqual(aliceSecret, bobSecret);
  assert.equal(aliceSecret.length, 32);
});

test('X3DH: works without a one-time pre-key (fallback)', async () => {
  const aliceAcc = privateKeyToAccount(ALICE_PK);
  const bobAcc = privateKeyToAccount(BOB_PK);
  const aliceSig = hexToBytes(await aliceAcc.signMessage({ message: identityChallenge(aliceAcc.address) }));
  const bobSig = hexToBytes(await bobAcc.signMessage({ message: identityChallenge(bobAcc.address) }));
  const alice = await provisionIdentity({ identitySignature: aliceSig, oneTimeCount: 0 });
  const bob = await provisionIdentity({ identitySignature: bobSig, oneTimeCount: 0 });

  const { secret: a, header } = await initiateSession(alice.keyMaterial, bob.bundle);
  const { secret: b } = await respondSession(bob.keyMaterial, header);
  assert.deepEqual(a, b);
  assert.equal(header.usedOneTimePreKey, -1);
});

test('end-to-end 1:1 secret chat: X3DH -> ratchet -> AEAD', async () => {
  const aliceAcc = privateKeyToAccount(ALICE_PK);
  const bobAcc = privateKeyToAccount(BOB_PK);
  const aliceSig = hexToBytes(await aliceAcc.signMessage({ message: identityChallenge(aliceAcc.address) }));
  const bobSig = hexToBytes(await bobAcc.signMessage({ message: identityChallenge(bobAcc.address) }));
  const alice = await provisionIdentity({ identitySignature: aliceSig });
  const bob = await provisionIdentity({ identitySignature: bobSig });

  const { secret, header } = await initiateSession(alice.keyMaterial, bob.bundle);
  const { secret: bobSecret } = await respondSession(bob.keyMaterial, header);

  // Seed both ratchets from the X3DH secret; Alice sends, Bob receives in order.
  const aliceChain = new SymmetricChain(secret);
  const bobChain = new SymmetricChain(bobSecret);

  const convo = ['hey bob 👋', 'are we encrypted?', 'yep — end to end'];
  for (const m of convo) {
    const mk = await aliceChain.next();
    const frame = await sealMessage(enc(m), mk, alice.signing.privateKey);
    const bk = await bobChain.next();
    const opened = await openMessage(frame, bk, null, alice.signing.publicKey);
    assert.equal(dec(opened), m);
  }
});
