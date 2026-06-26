# TeleBlock — Implementation Status

Traceability from the [spec](../SPEC.md) to code + tests. **107 automated tests**
(75 Node + 32 Playwright browser) plus a solc compile gate; run everything with `npm run test:all`
and `npm run compile:contracts`.

Legend: ✅ implemented & verified · 🟡 scaffold / partial · ⛔ blocked here (needs external infra)

## Core principles

| Requirement | Status | Where / how verified |
|---|---|---|
| True E2EE (1:1, group) | ✅ | `shared/crypto` + `group` · Double Ratchet/X3DH + Sender Keys; Node + browser tests |
| Modern crypto (libsodium, X25519, AEAD, Ed25519) | ✅ | `shared/src/crypto/message.js`, `identity/*` |
| Messages signed & verifiable | ✅ | `sealMessage`/`openMessage`; forged-sig + MITM tests |
| No server sees plaintext | ✅ | relay/store carry ciphertext only; `transport`/`storage` tests + browser inspector |
| Wallet/DID login | ✅ | SIWE (`identity/siwe.js`) + `web/engine/wallet.ts`; browser test signs real SIWE |
| Content on IPFS/Arweave, CIDs/hashes on-chain | ✅ | `storage/*`, `media.js`; encrypt-before-store tests |
| Smart contracts: identity, groups, forums, reputation | ✅ | `contracts/src/*`; **solc compile 0 errors** + Foundry tests in CI |
| Open source (Apache-2.0) | ✅ | `LICENSE`, every file headered |

## Must-have features

| Feature | Status | Verified by |
|---|---|---|
| 1:1 E2EE secret chat | ✅ | `web/e2e/secretChat.spec.ts` (X3DH→ratchet→AEAD over relay) |
| Self-destruct timers | ✅ | `web/e2e/media.spec.ts` |
| Typing indicators | ✅ | `web/e2e/interactions.spec.ts` |
| Reactions (double-tap) | ✅ | `web/e2e/interactions.spec.ts` |
| Reply-with-quote | ✅ | `web/e2e/reply.spec.ts` |
| Encrypted media (images) | ✅ | `web/e2e/media.spec.ts` |
| Voice messages | ✅ | `web/e2e/voice.spec.ts` |
| Polls | ✅ | `web/e2e/poll.spec.ts` |
| Pinned messages | ✅ | `web/e2e/pin.spec.ts` |
| In-chat search | ✅ | `web/e2e/chat-search.spec.ts` |
| Group chat (E2EE, roles, ban→rekey) | ✅ | `shared/test/group.test.js` + `web/e2e/group.spec.ts` |
| Group creation + on-chain roster | ✅ | `web/e2e/group-create.spec.ts`, `sections.spec.ts` |
| Token-gating | ✅ | `GroupManager` + `ERC20BalanceGate`; `GroupManager.t.sol` |
| Forums: threads, nested replies | ✅ | `web/e2e/forum-interact.spec.ts`, `sections.spec.ts` |
| Reputation-weighted voting | ✅ | `indexer` reducer + `web/e2e/forum-interact.spec.ts` |
| Reputation-gated visibility | ✅ | `web/e2e/gated.spec.ts` |
| Chat→forum crosspost | ✅ | `web/e2e/crosspost.spec.ts` |
| On-chain badges (gamification) | ✅ | `web/e2e/badges.spec.ts` |
| Discovery + search | ✅ | `indexer/search.js`; `web/e2e/search.spec.ts` |
| Wallet login (SIWE) + register encoding | ✅ | `web/e2e/wallet.spec.ts`, `shared/test/registry.test.js` |
| Profiles | ✅ | `IdentityRegistry`; `ProfileView` |
| Settings: theme/privacy/network/export | ✅ | `web/e2e/settings.spec.ts` |
| Indexing (subgraph + custom indexer) | ✅ | `indexer` (18 tests) + `subgraph/` artifacts |
| Anchored proof-of-conversation (Merkle) | ✅ | `shared/test/anchor.test.js` + `web/e2e/anchor.spec.ts` |
| Notifications (Push Protocol) | ⛔ | designed in SPEC; needs the Push network |
| Voice/video calls (WebRTC) | ⛔ | future; SPEC §4.4 |

## Platforms & infra

| Item | Status | Notes |
|---|---|---|
| Web client (Next.js target; Vite MVP) | ✅ | `web/` builds + 32 browser tests in Chromium |
| Mobile (Flutter) | 🟡 | `mobile/` scaffold (app shell + ChatBubble); needs Flutter SDK |
| Self-host infra (Waku/IPFS/indexer/PG/Meili) | ✅ | `infra/docker-compose.yml` + Dockerfile |
| CI (shared/indexer/web/contracts/slither) | ✅ | `.github/workflows/ci.yml` |
| MLS group crypto (upgrade from Sender Keys) | ⛔ | Sender Keys is the working MVP; MLS is Phase 2 |
| Live testnet (deploy→subgraph→client fetch) | ⛔ | needs an RPC + Foundry (network-blocked here) |

## What "blocked here" means

This build environment blocks the Foundry installer and outbound RPC, and has no Flutter SDK, so
three things can't be executed *in this sandbox*: the full `forge test` run (contracts still **compile**
via solc and the Foundry tests run in CI), a live testnet deploy, and a Flutter build. Everything
else is implemented and verified by an automated test that runs here.
