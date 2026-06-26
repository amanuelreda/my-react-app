# TeleBlock Threat Model

Status: living document (Phase 0). Pairs with [`../SPEC.md`](../SPEC.md) §7 and
[`../SECURITY.md`](../SECURITY.md).

## 1. Assets

| Asset | Why it matters |
|---|---|
| Message plaintext (1:1, group, forum-private) | Core confidentiality guarantee |
| Long-term identity keys (Ed25519) & message keys | Compromise breaks authenticity / confidentiality |
| Social graph & metadata (who, when, how often) | Deanonymization risk even with content encrypted |
| Group/forum authority (roles, bans, governance) | Integrity of communities |
| Media blobs on IPFS/Arweave | Confidentiality + availability |
| On-chain commitments | Tamper-evidence / ordering proofs |

## 2. Trust boundaries

```
[ User device ] --trusted--> (key store, plaintext, E2EE engine)
      |  ciphertext only
      v
[ Relays (Waku) ]  <-- untrusted: see ciphertext + topic + timing
[ IPFS/Arweave ]   <-- untrusted: see encrypted blobs + access patterns
[ Indexer/Graph ]  <-- untrusted: see public on-chain data only
[ L2 chain ]       <-- public, integrity-trusted (consensus), NOT confidential
```

**Core invariant:** plaintext and private keys never cross the device boundary. Everything outside
the device is treated as honest-but-curious at best, actively malicious at worst.

## 3. Adversaries

| Adversary | Capability | Goal |
|---|---|---|
| Malicious relay/storage operator | Observe/drop/reorder ciphertext, correlate metadata | Read content, censor, deanonymize |
| Network observer (ISP/state) | Traffic analysis, timing | Map social graph, identify users |
| Malicious group member | Valid member key, can post | Exfiltrate after removal, spam, escalate |
| On-chain attacker | Submit txs, deploy contracts | Privilege escalation, governance capture, griefing |
| Sybil farm | Many cheap identities | Skew forum votes/discovery, spam |
| Endpoint attacker | Malware on a device | Steal keys/plaintext (largely out of scope) |

## 4. STRIDE analysis

| Threat | Vector | Mitigation | Residual risk |
|---|---|---|---|
| **Spoofing** | Key substitution / impersonation | On-chain signing keys + safety-number verify + key-change warnings; frame signatures | User ignores key-change warning |
| **Tampering** | Relay/IPFS alters or reorders | Per-frame Ed25519 sigs + Merkle-root anchors; AEAD integrity | Unanchored very-recent msgs (small window) |
| **Repudiation** | Deny an action | Signed frames + on-chain governance events | 1:1 deniability is *intended* |
| **Info disclosure (content)** | Operator reads messages | E2EE (XChaCha20-Poly1305 + MLS/Double Ratchet); encrypted IPFS blobs | Endpoint compromise |
| **Info disclosure (metadata)** | Timing / social-graph analysis | Hashed topics, sealed-sender, optional cover traffic + mixnet, presence controls | Strong global passive adversary still hard |
| **DoS** | Spam, relay flood, gas grief | Slow mode, RLN rate-limit nullifiers, membership proofs, paymaster caps | Resourced flooding of public relays |
| **Elevation of privilege** | Non-admin admin action | On-chain permission bitmask enforced by contracts; banned keys removed from MLS epoch | Compromised admin key |
| **Sybil** | Fake accounts skew votes | sqrt-dampened reputation weight, optional proof-of-personhood, token-gating | Determined, funded sybils |

## 5. Cryptographic guarantees (verified in `shared/test`)

- **Confidentiality + integrity:** AEAD round-trip; tampered ciphertext rejected; wrong key fails.
- **Authenticity:** forged signatures rejected; `expectedSenderPub` MITM guard.
- **Context binding:** AAD (e.g. `groupId`) must match to decrypt.
- **Forward secrecy (message layer):** symmetric ratchet yields unique per-message keys in order.
- **Deterministic, domain-separated identity** derivation from a wallet signature.

Post-compromise security and O(log n) group rekeying are provided by the MLS layer (Phase 1/2),
not yet in this repo's test surface.

## 6. Explicitly out of scope (current phase)

- Fully compromised endpoint (malware/root) — keys and plaintext are then exposed by definition.
- Coercion / rubber-hose attacks (mitigated only partially by self-destruct & deniability).
- Global passive adversary defeating all timing analysis (best-effort mitigations only).
- Availability of third-party RPC/gateway providers (mitigated by self-hosting support).

## 7. Open items / TODO before mainnet

- [ ] External cryptographic review of MLS integration.
- [ ] External smart-contract audit (roles, governance, gating adapters).
- [ ] Formal spec of the anchoring/commitment ordering proof.
- [ ] RLN parameters and slashing economics.
- [ ] Sealed-sender + cover-traffic design doc and benchmarks.
