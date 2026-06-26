# TeleBlock Subgraph

The Graph subgraph indexing TeleBlock's on-chain events into queryable entities (users, groups,
members, forums, posts, votes, badges). Clients read lists and rankings from here instead of
scanning the chain. **Only public on-chain data is indexed — never message content.**

## Layout

- `schema.graphql` — entities and relationships (derived fields for rosters, replies, votes…).
- `subgraph.yaml` — manifest: 4 data sources (IdentityRegistry, GroupManager, ForumManager,
  Reputation) with their event handlers.
- `src/mapping.ts` — AssemblyScript handlers (event → entity).
- `abis/*.json` — event ABIs the codegen + indexing use.

## Build & deploy

```bash
npm install
# 1) set deployed addresses + startBlock in subgraph.yaml
npm run codegen     # generates ../generated/* from schema + ABIs (not committed)
npm run build
npm run deploy      # to The Graph Studio (or deploy-local against a local graph-node)
```

## Example queries

```graphql
# Trending threads in a forum (rank client-side or by score)
{ posts(where: { forum: "1", parent: null }, orderBy: score, orderDirection: desc, first: 20) {
    id author { id username } score status contentCID } }

# A group's roster with roles
{ group(id: "1") { memberCount members { user { id } permMask banned } } }

# A user's reputation, badges, and memberships
{ user(id: "0xabc…") { reputation badges { badgeId } memberships { group { id } permMask } } }
```

## Relationship to the custom indexer

The subgraph is the canonical, decentralized read layer for on-chain state. The custom
[`../indexer`](../indexer) complements it for **search** (Meilisearch over public fields) and any
off-chain message metadata the subgraph can't model. Both consume the same events; the indexer's
reducer is unit-tested so the indexing logic is verified independently of a chain connection.

> The score/voting logic in `handleVoted` mirrors `ForumManager.vote()` exactly (signed
> `(dir - prev) * weight` deltas), so subgraph scores match on-chain `Post.score`.
