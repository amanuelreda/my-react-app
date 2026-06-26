# TeleBlock — Go-Live Runbook (testnet → mainnet)

How to take TeleBlock from the in-browser demo to a real on-chain deployment. The app runs in **demo
mode** out of the box (in-browser seed + simulated/cross-tab peers); setting the `VITE_*` env vars
below switches it to **live mode** against deployed contracts + your indexer.

> You provide a funded testnet key and an RPC endpoint — this is the only part that can't run inside
> a sandbox. Everything else (contracts, indexer, client) is in this repo and tested.

## 1. Deploy the contracts (Base Sepolia)

```bash
cd contracts
cp ../.env.example .env        # set BASE_SEPOLIA_RPC_URL + a funded deployer key / --account
forge install foundry-rs/forge-std OpenZeppelin/openzeppelin-contracts
forge script script/Deploy.s.sol --rpc-url base_sepolia --broadcast --verify
```

`Deploy.s.sol` deploys `IdentityRegistry`, `GroupManager`, `Reputation`, `ForumManager` and wires
the Reputation hook. Copy the four printed addresses.

> Pre-deploy gate (no chain needed): `npm install && npm run compile && npm run test:evm` — compiles
> and executes the contracts locally.

## 2. Configure + run the indexer

```bash
cd indexer && npm install
RPC_URL=https://sepolia.base.org \
IDENTITY_REGISTRY_ADDRESS=0x... GROUP_MANAGER_ADDRESS=0x... \
FORUM_MANAGER_ADDRESS=0x... REPUTATION_ADDRESS=0x... \
PORT=8090 npm start
# backfills historical logs then tails; serves the read API on :8090
```

Or bring up the whole backend (Waku + IPFS + indexer + Postgres + Meilisearch):

```bash
docker compose -f infra/docker-compose.yml up -d
```

## 3. (Optional) Deploy the subgraph

```bash
cd subgraph
# set the deployed addresses + startBlock in subgraph.yaml
npm install && npm run codegen && npm run build && npm run deploy
```

## 4. Point the web client at the live deployment

Create `web/.env`:

```bash
VITE_BASE_SEPOLIA_RPC=https://sepolia.base.org
VITE_IDENTITY_REGISTRY=0x...
VITE_GROUP_MANAGER=0x...
VITE_FORUM_MANAGER=0x...
VITE_REPUTATION=0x...
VITE_INDEXER_URL=http://localhost:8090
VITE_IPFS_GATEWAY=https://ipfs.io/ipfs/
```

```bash
npm install && npm run dev:web
```

With `VITE_IDENTITY_REGISTRY` set, the client enters **live mode**: Profile → *On-chain identity →
Publish* submits `IdentityRegistry.register(signingPubKey, preKeyBundleCID, profileCID)` through the
connected wallet (after pinning the pre-key bundle to IPFS).

## 5. Verify

- `curl localhost:8090/groups` returns indexed groups as activity happens on-chain.
- Create a group / post in the app → the tx appears on the block explorer and the indexer/subgraph
  picks it up.

## Mainnet

Same steps against Base mainnet: deploy behind a **timelocked multisig** (UUPS-upgradeable), verify
sources, publish addresses + reproducible build hashes, and complete an external audit + bug-bounty
window first (see `SECURITY.md`).
