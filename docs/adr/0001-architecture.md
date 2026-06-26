# ADR 0001 — Hybrid off-chain messaging with on-chain anchoring

- Status: Accepted
- Date: 2026-06-26

## Context

TeleBlock must feel as fast as Telegram while being end-to-end encrypted and decentralized.
Putting messages on-chain is impossible at the required latency/throughput/cost; putting everything
on a central server breaks the trust model.

## Decision

Adopt a three-layer split:

1. **Off-chain hot path** (Waku/libp2p pub-sub) carries real-time encrypted frames.
2. **Decentralized storage** (IPFS hot → Arweave permanent) holds encrypted blobs and media; only
   content identifiers (CIDs) and hashes are referenced elsewhere.
3. **On-chain (L2)** stores only authoritative, public state: identity/keys, group membership and
   roles, forum governance, reputation, and **batched message commitments** (Merkle roots) for
   tamper-evidence.

E2EE uses Double Ratchet (1:1) and MLS (groups/forums). Identity signing keys are derived
deterministically from a domain-separated wallet signature, distinct from the wallet key itself.

## Consequences

- **Pro:** real-time UX; chain never on the critical path; cheap per-message cost via batching;
  auditable governance; self-hostable at every layer.
- **Pro:** confidentiality holds even against malicious relays/storage (they see only ciphertext).
- **Con:** added system complexity (relays, indexer, pinning); metadata protection requires extra
  work (sealed-sender, cover traffic); recent unanchored messages have a small tamper-evidence gap.
- **Con:** clients must manage key material and offline-first sync carefully.

## Alternatives considered

- **Fully on-chain messaging:** rejected — latency/cost/throughput and on-chain plaintext exposure.
- **Centralized server + E2EE (Signal-style):** rejected — reintroduces a trusted operator and a
  censorship/kill-switch point; no on-chain governance.
- **XMTP as-is:** strong DX and a great content-type model we reuse, but today's network is more
  centralized than our decentralization goal; we adopt its content-type patterns over Waku.
