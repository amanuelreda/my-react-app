# TeleBlock self-host infra

Optional community/self-host backend for TeleBlock. The protocol is decentralized — these are the
off-chain pieces you can run yourself so you depend on **your own** infrastructure, not anyone's.

## Stack

| Service | Role | Port |
|---|---|---|
| `waku` (nwaku) | decentralized real-time transport (relay + store) | 8645 REST |
| `ipfs` (Kubo) | encrypted media/blob storage + gateway | 5001 API / 8080 gw |
| `indexer` | read API (rosters, forum rankings, search) | 8090 |
| `postgres` | indexer persistence | 5432 |
| `meilisearch` | full-text search | 7700 |

## Run

```bash
# from the repo root
cp .env.example infra/.env   # set RPC_URL + deployed contract addresses (optional)
docker compose -f infra/docker-compose.yml up -d

# the indexer serves immediately (empty until contracts are deployed/ingested):
curl localhost:8090/groups
```

Without `RPC_URL` + addresses the indexer serves an empty store (handy for a first run / smoke test).
With them set, it backfills historical logs and tails new ones (see `indexer/src/ingest.js`).

## Point the client at your infra

In the app, **Settings → Network** lets you set your own relay, IPFS gateway, and indexer endpoints.
Running all three yourself gives you full exit-rights: no reliance on any hosted provider.

## Notes

- Keep the IPFS API (`5001`) and Postgres off the public internet; expose only the gateway and the
  indexer read API.
- Set a real `MEILI_MASTER_KEY` in production.
- The Waku node is a light relay/store for development; production deployments run a fleet behind a
  load balancer and enable RLN rate-limiting.
