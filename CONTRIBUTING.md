# Contributing to TeleBlock

Thanks for helping build a secure, decentralized messenger! TeleBlock is **Apache-2.0** and
welcomes contributions from everyone. This doc summarizes how to participate. The authoritative
build plan and architecture live in [`SPEC.md`](./SPEC.md).

## Ground rules

- **License & DCO:** All contributions are Apache-2.0. Sign off every commit (`git commit -s`,
  adding `Signed-off-by: Name <email>`), certifying the [Developer Certificate of Origin](https://developercertificate.org/).
- **Security first:** Anything touching cryptography, key handling, or smart contracts requires
  review from a designated **security reviewer** in addition to a normal maintainer.
- **No secrets in the repo.** Use `.env.example`; never commit keys, mnemonics, or RPC secrets.

## Workflow

1. Open or claim an issue (look for `good-first-issue` / `help-wanted`).
2. For protocol- or contract-affecting changes, open a short **RFC/ADR** in `docs/adr/` first.
3. Branch from `main` (trunk-based), keep PRs focused.
4. Ensure CI is green (see below) and request review.
5. PRs need **1 maintainer approval** (plus a security reviewer for crypto/contract changes).

## Quality gates (CI must pass)

| Area | Checks |
|---|---|
| Contracts | `forge test` incl. **fuzz + invariant**, `forge coverage` ≥ 90%, **Slither** clean, `forge fmt --check` |
| Shared/Web | type-check, lint, unit tests, build |
| Mobile | `flutter analyze`, `flutter test`, build |
| Supply chain | dependency audit, pinned versions, Dependabot |

## Coding standards

- **Solidity:** OpenZeppelin primitives, NatSpec on public functions, events for all state changes,
  checks-effects-interactions, no plaintext/PII on-chain.
- **TypeScript:** strict mode, no `any` in protocol code, fail-closed on crypto errors.
- **Flutter/Dart:** match the Telegram-style design tokens; 60fps; accessibility labels required.
- Match the style of the surrounding code; keep diffs minimal and reviewable.

## Reporting vulnerabilities

**Do not open public issues for security bugs.** Follow `SECURITY.md` (responsible disclosure +
bug bounty). Cryptographic and smart-contract issues are highest priority.

## Releases

Semver, signed tags, reproducible builds, and a published changelog. Mainnet contract deploys go
through a timelocked multisig with verified sources and published build hashes.
