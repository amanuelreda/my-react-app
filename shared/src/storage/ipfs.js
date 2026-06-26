// TeleBlock IPFS (Helia) storage adapter — Apache-2.0
//
// Production ContentStore backed by Helia (the modern JS IPFS implementation). Implements the same
// put/get/has API as InMemoryStore so application code is storage-agnostic. Blobs are stored via
// UnixFS; the returned CID is the real IPFS CIDv1. A pinning cluster (see infra/) keeps hot content
// available; forum archives are additionally pushed to Arweave. @helia/* deps are imported lazily so
// this module is safe to load without them and unit tests can use InMemoryStore.
//
// Usage (client / pin service):
//   import { createIpfsStore } from '@teleblock/shared/storage/ipfs';
//   const store = await createIpfsStore();
//   const cid = await store.put(encryptedBytes);   // -> publish CID in a frame / on-chain
//   const bytes = await store.get(cid);

/**
 * @returns {Promise<import('./store.js').ContentStore & { helia: any, stop: () => Promise<void> }>}
 */
export async function createIpfsStore(opts = {}) {
  const { createHelia } = await import('helia');
  const { unixfs } = await import('@helia/unixfs');
  const { CID } = await import('multiformats/cid');

  const helia = await createHelia(opts);
  const fs = unixfs(helia);

  return {
    helia,

    async put(bytes) {
      const cid = await fs.addBytes(bytes);
      return cid.toString();
    },

    async get(cid) {
      const chunks = [];
      for await (const chunk of fs.cat(CID.parse(cid))) chunks.push(chunk);
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const out = new Uint8Array(total);
      let off = 0;
      for (const c of chunks) {
        out.set(c, off);
        off += c.length;
      }
      return out;
    },

    async has(cid) {
      try {
        for await (const _ of fs.cat(CID.parse(cid))) return true;
        return true;
      } catch {
        return false;
      }
    },

    async stop() {
      await helia.stop();
    },
  };
}
