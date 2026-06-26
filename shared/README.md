# @teleblock/shared

The cross-platform protocol core for TeleBlock: cryptography, identity/X3DH, transport, and storage.
Plain ESM JavaScript with JSDoc types — no build step — so web (Vite/Next) and tooling consume it
directly. **30 tests** run on Node's built-in test runner.

```bash
npm install
npm test
```

## Modules

| Module | What it provides |
|---|---|
| `crypto/message.js` | XChaCha20-Poly1305 AEAD message frames, Ed25519 sign/verify, AAD binding, MITM guard, deterministic wallet→identity key derivation |
| `crypto/ratchet.js` | Symmetric ratchet (`SymmetricChain`) for per-message forward secrecy |
| `identity/prekeys.js` | X25519 key material + signed pre-key bundles (authenticity-signed by the Ed25519 identity key) |
| `identity/x3dh.js` | X3DH key agreement (`initiateSession` / `respondSession`) seeding a session root |
| `identity/siwe.js` | SIWE (EIP-4361) login build/verify via viem, stable identity challenge, identity provisioning, registration payload for `IdentityRegistry` |
| `transport/relay.js` | `Transport` interface, hashed content topics, `InMemoryRelay` (pub/sub + store history) |
| `transport/conversation.js` | `Conversation` — ratchet + AEAD + transport glue for a live secret chat |
| `transport/waku.js` | Production Waku v2 transport adapter (same interface; lazy `@waku/sdk`) |
| `storage/store.js` | Content-addressed `ContentStore`, `InMemoryStore`, encrypt-before-store helpers |
| `storage/ipfs.js` | Production Helia/IPFS adapter (same interface; lazy `@helia/*`) |

## Security properties exercised by tests

- AEAD confidentiality + integrity; tampered ciphertext, forged signatures, and wrong keys rejected.
- Context binding via AAD (e.g. group/topic id); MITM guard via `expectedSenderPub`.
- Stable, domain-separated identity derivation (same wallet → same key across devices/logins).
- SIWE login: valid signatures verify; tampered messages and wrong nonces are rejected.
- X3DH: initiator and responder derive the same secret (with and without a one-time pre-key).
- End-to-end 1:1 secret chat: X3DH → ratchet → AEAD, routed over the relay by hashed topic.
- Storage stores ciphertext only (plaintext never present); decryption verifies authorship.

## Design notes

- **Two wallet signatures, two purposes.** A per-login SIWE signature (with nonce) authenticates a
  session; a separate fixed, nonce-free signature deterministically derives the long-term identity
  key. Mixing them would change the identity every login — see `identity/siwe.js`.
- **Transport-agnostic.** `InMemoryRelay`/`InMemoryStore` (tests/dev) and `waku.js`/`ipfs.js`
  (production) share one interface, so app code never hard-codes a backend.
- **Encrypt before store/transport.** Relays and storage only ever see ciphertext frames.

## Dependency note

`viem` pulls in a transitive `ws` advisory (memory-exhaustion DoS) used only by viem's WebSocket
transport, which this package does not use (SIWE/account paths are pure crypto). `npm audit fix
--force` would downgrade viem to 0.2.x and break the API, so it is intentionally not applied; revisit
when viem ships an updated `ws`.
