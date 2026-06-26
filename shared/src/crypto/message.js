// TeleBlock message crypto core — Apache-2.0
//
// Encrypt + sign / verify + decrypt of individual message frames, and deterministic derivation
// of a stable Ed25519 identity key from a wallet signature. Authenticated encryption uses
// XChaCha20-Poly1305 (libsodium AEAD); frames are signed with Ed25519 so a malicious relay or
// storage node cannot forge or tamper with a message without detection. Decryption is fail-closed:
// any signature or AEAD failure throws.
//
// A frame is the unit published to the transport (Waku) or, for large payloads, a small frame
// referencing an IPFS CID whose blob is itself an encrypted frame.

// Loading libsodium-wrappers is environment-dependent: under Node its ESM build has a broken
// internal path map, so we use the CommonJS build via createRequire; under a browser bundler
// (Vite/webpack) the dynamic import resolves the package's browser/ESM build correctly. The Node
// branch uses a *dynamic* import of "node:module" so bundlers never try to resolve it for the web.
async function loadSodium() {
  const isNode =
    typeof process !== 'undefined' && process.versions?.node && typeof window === 'undefined';
  if (isNode) {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    return require('libsodium-wrappers');
  }
  const mod = await import('libsodium-wrappers');
  return mod.default ?? mod;
}

let sodiumReady;
/** Resolve the initialized libsodium instance (idempotent). */
export async function getSodium() {
  if (!sodiumReady) {
    sodiumReady = loadSodium().then((s) => s.ready.then(() => s));
  }
  return sodiumReady;
}

const IDENTITY_CONTEXT = 'TeleBlock/identity/v1';

/**
 * @typedef {Object} EncryptedFrame
 * @property {string} ciphertext base64 (XChaCha20-Poly1305)
 * @property {string} nonce      base64 (24-byte XChaCha nonce)
 * @property {string} sig        base64 (Ed25519 over nonce||ciphertext)
 * @property {string} senderPub  base64 (Ed25519 signing public key)
 */

const b64 = (sodium, u) => sodium.to_base64(u, sodium.base64_variants.ORIGINAL);
const unb64 = (sodium, s) => sodium.from_base64(s, sodium.base64_variants.ORIGINAL);

/**
 * Encrypt + sign a message with a per-message symmetric key.
 * @param {Uint8Array} plaintext
 * @param {Uint8Array} msgKey   32-byte key from the ratchet / MLS epoch
 * @param {Uint8Array} signingSecretKey Ed25519 secret key (64 bytes)
 * @param {Uint8Array} [aad]    optional associated data bound into the AEAD tag (e.g. groupId)
 * @returns {Promise<EncryptedFrame>}
 */
export async function sealMessage(plaintext, msgKey, signingSecretKey, aad = null) {
  const sodium = await getSodium();
  const nonce = sodium.randombytes_buf(sodium.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
    plaintext,
    aad,
    null,
    nonce,
    msgKey,
  );
  const signed = new Uint8Array(nonce.length + ciphertext.length);
  signed.set(nonce, 0);
  signed.set(ciphertext, nonce.length);
  const sig = sodium.crypto_sign_detached(signed, signingSecretKey);
  // A libsodium Ed25519 secret key is [seed(32) || publicKey(32)]; extract the embedded pubkey
  // rather than depending on crypto_sign_ed25519_sk_to_pk (absent in the standard build).
  const senderPub = signingSecretKey.slice(32, 64);
  return {
    ciphertext: b64(sodium, ciphertext),
    nonce: b64(sodium, nonce),
    sig: b64(sodium, sig),
    senderPub: b64(sodium, senderPub),
  };
}

/**
 * Verify the frame signature, then decrypt. Throws on any failure (fail-closed).
 * @param {EncryptedFrame} frame
 * @param {Uint8Array} msgKey
 * @param {Uint8Array} [aad]
 * @param {Uint8Array} [expectedSenderPub] if provided, the frame's senderPub must match exactly
 * @returns {Promise<Uint8Array>} plaintext
 */
export async function openMessage(frame, msgKey, aad = null, expectedSenderPub = null) {
  const sodium = await getSodium();
  const nonce = unb64(sodium, frame.nonce);
  const ciphertext = unb64(sodium, frame.ciphertext);
  const sig = unb64(sodium, frame.sig);
  const senderPub = unb64(sodium, frame.senderPub);

  if (expectedSenderPub && !constantTimeEqual(sodium, senderPub, expectedSenderPub)) {
    throw new Error('sender key mismatch — possible MITM');
  }

  const signed = new Uint8Array(nonce.length + ciphertext.length);
  signed.set(nonce, 0);
  signed.set(ciphertext, nonce.length);
  if (!sodium.crypto_sign_verify_detached(sig, signed, senderPub)) {
    throw new Error('bad signature — message rejected');
  }
  return sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, aad, nonce, msgKey);
}

/**
 * Derive a stable Ed25519 identity keypair from a wallet signature. Done once per device; the
 * wallet's own private key is never used to encrypt. Domain-separated so the same wallet signature
 * cannot be repurposed across protocols.
 * @param {Uint8Array} walletSignature raw bytes of a signature over a fixed SIWE-style challenge
 * @returns {Promise<{publicKey: Uint8Array, privateKey: Uint8Array, keyType: string}>}
 */
export async function deriveIdentityKey(walletSignature) {
  const sodium = await getSodium();
  const seed = sodium.crypto_generichash(
    32,
    walletSignature,
    sodium.from_string(IDENTITY_CONTEXT),
  );
  return sodium.crypto_sign_seed_keypair(seed);
}

/** Constant-time byte comparison. */
function constantTimeEqual(sodium, a, b) {
  if (a.length !== b.length) return false;
  try {
    return sodium.memcmp(a, b);
  } catch {
    // memcmp throws on length mismatch in some builds; treat as not-equal
    return false;
  }
}
