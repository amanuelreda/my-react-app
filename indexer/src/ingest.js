// TeleBlock indexer — on-chain log ingestion. Apache-2.0
//
// Reads logs from an EVM RPC (viem), decodes them against the contract ABIs, normalizes them to the
// { name, args, blockNumber, logIndex } shape the reducer expects, and feeds an IndexStore. Runs as
// a backfill (historical range) followed by a live subscription. viem is imported lazily so unit
// tests of the reducer (store.test.js) don't require a chain. The custom indexer complements the
// subgraph: it owns search and any off-chain message metadata the subgraph can't model.
//
// Usage:
//   const store = await runIngest({ rpcUrl, addresses, fromBlock });
//   // store is now queryable: store.listGroups(), store.forumThreads(id), ...

import { IndexStore } from './store.js';

/** Convert a viem-decoded log to the reducer's normalized event. */
export function normalizeLog(log) {
  // log.eventName + log.args from viem's decoded logs; args are named per the ABI.
  const args = {};
  for (const [k, v] of Object.entries(log.args ?? {})) {
    args[k] = typeof v === 'bigint' ? v.toString() : v;
  }
  return {
    name: log.eventName,
    args,
    blockNumber: Number(log.blockNumber),
    logIndex: Number(log.logIndex),
    txHash: log.transactionHash,
  };
}

/**
 * Backfill historical logs then keep the store live. Returns the populated IndexStore.
 * @param {{rpcUrl:string, addresses:Record<string,`0x${string}`>, abis:Record<string,any>, fromBlock?:bigint, store?:IndexStore}} cfg
 */
export async function runIngest(cfg) {
  const { createPublicClient, http, parseAbi } = await import('viem');
  const store = cfg.store ?? new IndexStore();
  const client = createPublicClient({ transport: http(cfg.rpcUrl) });

  const watched = Object.entries(cfg.addresses); // [name, address]
  const abis = cfg.abis;

  // Backfill.
  const latest = await client.getBlockNumber();
  for (const [name, address] of watched) {
    const logs = await client.getLogs({
      address,
      events: parseAbi ? abis[name] : abis[name],
      fromBlock: cfg.fromBlock ?? 0n,
      toBlock: latest,
    });
    const normalized = logs.map(normalizeLog).sort(orderLogs);
    store.applyAll(normalized);
  }

  // Live tail: subscribe to new logs for each contract.
  for (const [name, address] of watched) {
    client.watchEvent({
      address,
      events: abis[name],
      onLogs: (logs) => store.applyAll(logs.map(normalizeLog).sort(orderLogs)),
    });
  }

  return store;
}

/** Total order across contracts by (block, logIndex). */
export function orderLogs(a, b) {
  return a.blockNumber - b.blockNumber || a.logIndex - b.logIndex;
}
