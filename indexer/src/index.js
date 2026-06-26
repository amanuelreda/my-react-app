// TeleBlock indexer service entrypoint. Apache-2.0
//
// Boots the read API over an IndexStore. If RPC + contract addresses are configured (env), it also
// backfills + tails on-chain logs via ingest.js; otherwise it serves an empty store (useful for
// local smoke tests and as the first run before contracts are deployed).
//
// Env:
//   PORT                       HTTP port (default 8080)
//   RPC_URL                    EVM RPC endpoint (optional)
//   IDENTITY_REGISTRY_ADDRESS  deployed contract addresses (optional)
//   GROUP_MANAGER_ADDRESS
//   FORUM_MANAGER_ADDRESS
//   REPUTATION_ADDRESS
//   START_BLOCK                backfill start (default 0)
import { IndexStore } from './store.js';
import { createApi } from './server.js';

export async function start({ port = Number(process.env.PORT) || 8080, store = new IndexStore() } = {}) {
  const rpc = process.env.RPC_URL;
  const addresses = {
    IdentityRegistry: process.env.IDENTITY_REGISTRY_ADDRESS,
    GroupManager: process.env.GROUP_MANAGER_ADDRESS,
    ForumManager: process.env.FORUM_MANAGER_ADDRESS,
    Reputation: process.env.REPUTATION_ADDRESS,
  };

  if (rpc && Object.values(addresses).some(Boolean)) {
    try {
      const { runIngest } = await import('./ingest.js');
      const { loadAbis } = await import('./abis.js').catch(() => ({ loadAbis: null }));
      const present = Object.fromEntries(Object.entries(addresses).filter(([, a]) => a));
      await runIngest({
        rpcUrl: rpc,
        addresses: present,
        abis: loadAbis ? loadAbis() : {},
        fromBlock: BigInt(process.env.START_BLOCK || 0),
        store,
      });
      console.log(`[indexer] ingesting from ${rpc} for ${Object.keys(present).join(', ')}`);
    } catch (e) {
      console.error(`[indexer] ingest disabled: ${e.message}`);
    }
  } else {
    console.log('[indexer] no RPC/addresses configured — serving an empty store');
  }

  const server = createApi(store);
  await new Promise((resolve) => server.listen(port, resolve));
  console.log(`[indexer] read API listening on :${port}`);
  return server;
}

// Auto-run when invoked directly (node src/index.js).
if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
