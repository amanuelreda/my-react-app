# TeleBlock

> **Telegram's feel. Your keys. No middleman.**

TeleBlock is an open-source, end-to-end-encrypted secure messenger with a Telegram-grade UX —
adding first-class **group chats** and **forums** — built on a hybrid architecture: real-time
off-chain messaging, decentralized storage (IPFS/Arweave), and on-chain anchoring for identity,
group membership, roles, and forum governance.

**No central server ever sees plaintext.** Content is encrypted on-device; the blockchain stores
only commitments (hashes), rights, and governance — never message content.

## What's here

- **[`SPEC.md`](./SPEC.md)** — the complete production specification & starter blueprint:
  architecture, tech stack, feature breakdown, UI/UX, smart-contract outlines, security/threat
  model, scalability strategy, starter code, roadmap, deployment & contribution guide.
- **[`contracts/`](./contracts)** — Foundry Solidity contracts (`IdentityRegistry`, `GroupManager`,
  `ForumManager`, `Reputation`, `IGate` adapters) with unit + fuzz tests and a deploy script.
- **[`shared/`](./shared)** — the protocol core: cryptography, identity/X3DH, group sessions,
  transport, and storage (libsodium AEAD frames, ratchet, SIWE login, pre-key bundles, Sender-Keys
  group session, in-memory relay + Waku adapter, content-addressed storage + IPFS adapter) with a
  **passing 36-test suite**.
- **[`web/`](./web)** — Telegram-style web client (Vite + React + TS) wired to the **real** crypto:
  burner-identity login and a **live X3DH→ratchet→AEAD 1:1 chat** with an encryption inspector.
  **Builds clean and is verified running in Chromium** via a Playwright E2E test.
- **[`docs/`](./docs)** — [`THREAT_MODEL.md`](./docs/THREAT_MODEL.md) and architecture ADRs.

### Status — Phase 0 (Foundations) ✅ complete · Phase 1 (MVP) in progress

| Component | State |
|---|---|
| Monorepo, CI, license, contributing, threat model | ✅ |
| Core contracts + Foundry tests (`contracts/`) | ✅ (run with `forge test`) |
| Crypto + identity + group + transport + storage (`shared/`) | ✅ `cd shared && npm install && npm test` → 36 passing |
| 1:1 (X3DH→ratchet→AEAD) + group (Sender Keys) sessions | ✅ in `shared/` |
| Telegram-style web UI shell (`web/`) | ✅ `npm --workspace @teleblock/web run build` |
| Web client wired to live E2EE (browser-verified) | ✅ `cd web && npm run e2e` (Playwright) |
| Full wallet login · MLS · subgraph/indexer | ⏳ Phase 1/2 next |

```bash
# verify the protocol core locally (crypto, SIWE, X3DH, group sessions, relay, storage)
cd shared && npm install && npm test

# build the Telegram-style web client
cd web && npm install && npm run build

# build & test the contracts (requires Foundry: https://book.getfoundry.sh)
cd contracts && forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts && forge test -vvv
```

## Highlights

- 🔒 **E2EE everywhere** — Double Ratchet (1:1) + **MLS** (groups/forums) via libsodium.
- ⛓️ **On-chain where it counts** — identity, membership, roles, forum governance on an L2 (Base/Arbitrum).
- 🗄️ **Decentralized storage** — IPFS (hot) → Arweave (permanent forum archives); only CIDs/hashes on-chain.
- ⚡ **Real-time feel** — Waku/libp2p pub-sub keeps the chain off the hot path.
- 🏛️ **Governed communities** — roles, token-gating, DAO-moderated forums, reputation-weighted voting.
- 📱 **Telegram-grade UI** — Flutter mobile + Next.js/Tauri web, dark-mode-first.

## License

Apache-2.0 — see [`LICENSE`](./LICENSE). Patent grant included; built to be audited, forked, and self-hosted.

## Status

Specification / blueprint stage. See the [roadmap](./SPEC.md#10-roadmap) for the build plan
(MVP: solid 1:1 + basic groups → full groups + forums → scale & advanced).
