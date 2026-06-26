// TeleBlock Waku transport adapter — Apache-2.0
//
// Production adapter implementing the same Transport interface as InMemoryRelay, backed by Waku v2
// (libp2p gossipsub + store nodes). Kept dependency-light: @waku/sdk is loaded lazily so the rest
// of the package (and its tests) don't require a running node. Wire this in the client; unit tests
// use InMemoryRelay.
//
// Frames are JSON-encoded into a Waku message payload on a content topic derived via
// transport/relay.js#deriveTopic. Rate-limiting (RLN) and store-node history are configured at the
// node level; see relay/ for the self-hostable node image.
//
// Usage (client):
//   import { createWakuTransport } from '@teleblock/shared/transport/waku';
//   const transport = await createWakuTransport();
//   const topic = await deriveTopic(`group:${groupId}`);
//   transport.subscribe(topic, onFrame);
//   await transport.publish(topic, frame);

/**
 * @returns {Promise<import('./relay.js').Transport & { node: any, stop: () => Promise<void> }>}
 */
export async function createWakuTransport(opts = {}) {
  // Lazy import so this module is safe to load without @waku/sdk installed.
  const { createLightNode, createEncoder, createDecoder, waitForRemotePeer } = await import('@waku/sdk');

  const node = await createLightNode({ defaultBootstrap: true, ...opts });
  await node.start();
  await waitForRemotePeer(node);

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  return {
    node,

    async publish(topic, frame) {
      const encoder = createEncoder({ contentTopic: topic });
      const payload = enc.encode(JSON.stringify(frame));
      await node.lightPush.send(encoder, { payload });
    },

    subscribe(topic, handler) {
      const decoder = createDecoder(topic);
      let unsub = () => {};
      node.filter
        .subscribe([decoder], (wakuMsg) => {
          if (!wakuMsg.payload) return;
          try {
            handler(JSON.parse(dec.decode(wakuMsg.payload)));
          } catch {
            /* drop malformed frame */
          }
        })
        .then((u) => {
          unsub = typeof u === 'function' ? u : () => {};
        });
      return () => unsub();
    },

    async query(topic) {
      const decoder = createDecoder(topic);
      const out = [];
      for await (const page of node.store.queryGenerator([decoder])) {
        for (const msgPromise of page) {
          const msg = await msgPromise;
          if (msg?.payload) {
            try {
              out.push(JSON.parse(dec.decode(msg.payload)));
            } catch {
              /* skip */
            }
          }
        }
      }
      return out;
    },

    async stop() {
      await node.stop();
    },
  };
}
