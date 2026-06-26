# TeleBlock Indexer

Off-chain indexer that turns the contract event log into the read-optimized state clients need
(group rosters, forum threads ranked by score, reputation, identities) and serves it over a small
HTTP API. Complements the [subgraph](../subgraph) by additionally owning **search** and off-chain
message metadata. **Indexes only public on-chain data — never message content.**

```bash
npm install
npm test          # 8 tests: reducer, ranking, signed voting, moderation, reputation, cursor, API
npm start         # run the ingest + API service (needs RPC + deployed addresses)
```

## Design

- `src/store.js` — **pure event reducer** (`IndexStore`). `apply({name,args,blockNumber,logIndex})`
  updates derived state; a `(block, logIndex)` cursor makes replays/re-orgs idempotent. Query
  methods: `listGroups`, `groupMembers`, `forumThreads`, `replies`, `reputationOf`, `badgesOf`,
  `identityOf`. Event names/args mirror the Solidity events in [`../contracts`](../contracts).
- `src/ingest.js` — reads logs via viem, `normalizeLog`s them, feeds the reducer (backfill + live
  tail). viem is imported lazily so the reducer tests need no chain.
- `src/server.js` — dependency-free HTTP read API (`/groups`, `/groups/:id/members`,
  `/forums/:id/threads`, `/posts/:id/replies`, `/users/:addr`).
- `src/search.js` — `SearchIndex`: an inverted-index full-text search over **public** documents
  (groups, forums, forum posts, usernames) with TF scoring, a title-field boost, and prefix
  typeahead on the final token. `buildSearchIndex(store, meta)` populates it from an `IndexStore`.
  Meilisearch backs the same interface in production; private/E2EE content is never indexed here.

## Why both an indexer and a subgraph?

The subgraph is the canonical decentralized read layer. This indexer adds what subgraphs do poorly:
full-text **search** (front it with Meilisearch over `contentCID`/metadata and public fields) and
joins with off-chain message metadata. Because the reducer is a pure function, its logic is
unit-tested independently — the same code path that runs in production is exercised by synthetic
events in `test/`.

## Scaling

Stateless workers shard by contract/topic and share a Postgres-backed store; the in-memory store
here is the reference reducer. Voting/ranking matches `ForumManager.vote()` exactly (signed
`(dir - prev) * weight`), so indexer scores equal on-chain `Post.score`.
