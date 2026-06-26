# TeleBlock Contracts

Solidity smart contracts for TeleBlock identity, groups, forums, and reputation. Built with
[Foundry](https://book.getfoundry.sh/).

## Contracts

| Contract | Responsibility |
|---|---|
| `IdentityRegistry` | Messaging identities: Ed25519 signing keys, X25519 pre-key bundle CIDs, profile CIDs, usernames. No PII. |
| `GroupManager` | Group creation, roles/permissions (bitmask), bans, token-gating (`IGate`), MLS epoch & message-commitment anchoring. |
| `ForumManager` | Threaded forums, nested posts, reputation-weighted voting, owner/moderator/DAO moderation, chat→forum cross-posting. |
| `Reputation` | Soulbound reputation (sqrt-dampened voting weight) and achievement badges. |
| `SoulboundMembership` | ERC-1155-subset membership token; per-group soulbound (non-transferable) flag. GroupManager mints on join / burns on ban. |
| `gates/ERC20BalanceGate` | Example `IGate` adapter (token-gated groups). |

**Privacy invariant:** no message plaintext or PII is ever stored on-chain — only addresses,
public keys, content identifiers (CIDs), hashes, roles, and numeric state.

## Setup

```bash
# Install Foundry (https://book.getfoundry.sh/getting-started/installation)
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Install dependencies (forge-std + OpenZeppelin) — see remappings.txt
forge install foundry-rs/forge-std
forge install OpenZeppelin/openzeppelin-contracts
```

## Foundry-independent checks (run anywhere npm runs)

```bash
npm install
npm run compile    # solc 0.8.24 → all src/ contracts, 0 errors/warnings
npm run test:evm   # deploys + EXECUTES the contracts in an in-process EVM (@ethereumjs/evm)
```

`test:evm` (see `test/behavior.test.js` + `test/evm-harness.js`) runs real on-chain behavior tests —
register/username-uniqueness, group create→ban→rejoin-blocked, reputation auth + sqrt voting weight,
and forum signed-voting + DAO-only moderation — without a node or Foundry. `forge build`/`forge test`
below remain the full pipeline (fuzz/invariant) in CI.

## Build, test, deploy

```bash
forge build
forge test -vvv          # unit + fuzz + invariant
forge coverage           # target >= 90%
forge fmt --check

# Deploy to Base Sepolia testnet
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
```

Required env vars for deploy/verify: `BASE_SEPOLIA_RPC_URL`, `ETHERSCAN_API_KEY`, and a configured
signer (e.g. `--account` / `--ledger` / `PRIVATE_KEY`).

## Test coverage

| Suite | Focus |
|---|---|
| `IdentityRegistry.t.sol` | register / rotate / username uniqueness & reclaim; fuzz |
| `GroupManager.t.sol` | roles, join/ban/unban, gating (allow/deny), ownership transfer, commitments |
| `ForumManager.t.sol` | posts/replies, weighted voting, reputation rewards, owner/mod/DAO moderation, locks, cross-post authorship |
| `Reputation.t.sol` | authorization, sqrt weight & whale-dampening, soulbound badges; fuzz monotonicity |
