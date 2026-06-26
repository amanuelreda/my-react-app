# Security Policy

TeleBlock is privacy-and-security-critical software. We take vulnerabilities seriously and
appreciate responsible disclosure.

## Reporting a vulnerability

**Do not open public issues or PRs for security vulnerabilities.**

Instead, email the maintainers at **security@teleblock.example** (replace with the project's real
address) with:

- A description of the issue and its impact.
- Steps to reproduce or a proof-of-concept.
- Affected component(s): contracts, crypto core, relay, indexer, client.
- Your suggested severity.

We aim to acknowledge within **72 hours** and to provide a remediation timeline after triage.
Coordinated disclosure: we ask for up to 90 days before public disclosure, sooner if a fix ships.

## Scope & priorities (highest first)

1. **Cryptographic flaws** — key handling, E2EE break, nonce reuse, signature bypass, downgrade.
2. **Smart-contract bugs** — privilege escalation (roles/bans/governance), fund/asset loss, reentrancy, DoS.
3. **Metadata leakage** — deanonymization, social-graph exposure beyond the documented model.
4. **Client/storage** — plaintext leaks, insecure key storage, IPFS content exposure.

## What is in the threat model

See [`docs/THREAT_MODEL.md`](./docs/THREAT_MODEL.md) for the full STRIDE analysis, trust
boundaries, and explicitly out-of-scope threats (e.g. a fully compromised endpoint device).

## Safe harbor

Good-faith security research that complies with this policy will not be pursued or reported. Do not
access or modify other users' data, degrade service, or run automated scanning against production
relays/indexers without prior coordination.

## Bug bounty

A bounty program will be published before mainnet launch (see the roadmap). Crypto and contract
findings carry the highest rewards.
