// Live group chat engine (Sender Keys). Apache-2.0
//
// Wires @teleblock/shared's GroupSession IN THE BROWSER: the local user plus two simulated members
// each hold a GroupSession for the group, exchange sender-key bundles, and route encrypted group
// messages over a shared InMemoryRelay on a hashed group topic. Sending encrypts with the local
// member's sender chain; the simulated members decrypt (proving group E2EE in the browser) and one
// auto-replies. This is the same Sender-Keys path unit-tested in shared/test/group.test.js, now
// exercised through real transport and the UI.
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  InMemoryRelay,
  deriveTopic,
  createGroupSession,
  deriveIdentityKey,
  encodePayload,
  decodePayload,
  getSodium,
  frameHash,
  buildMerkleRoot,
} from '@teleblock/shared';
import type { Identity } from './identity';

export interface GroupIncoming {
  senderId: string;
  senderName: string;
  text: string;
}

const PEERS = [
  { id: '0xbob', name: 'bob.eth' },
  { id: '0xcarol', name: 'carol.eth' },
];

export class GroupChat {
  private relay = new InMemoryRelay();
  private groupId: string;
  private meId: string;
  private me!: any;
  private peers: { id: string; name: string; session: any }[] = [];
  private topic = '';
  private queue: Promise<void> = Promise.resolve();
  private onMessage: (m: GroupIncoming) => void = () => {};
  private onCommit: (rootHex: string) => void = () => {};
  private leaves: Uint8Array[] = [];
  private static BATCH = 2; // anchor a Merkle root every N messages

  constructor(identity: Identity, groupId: string) {
    this.groupId = groupId;
    this.meId = identity.address;
    this.identity = identity;
  }
  private identity: Identity;

  async init(onMessage: (m: GroupIncoming) => void, onCommit?: (rootHex: string) => void) {
    this.onMessage = onMessage;
    if (onCommit) this.onCommit = onCommit;
    this.topic = await deriveTopic(`group:${this.groupId}`);

    this.me = await createGroupSession({
      groupId: this.groupId,
      myId: this.meId,
      signing: this.identity.signing,
    });

    for (const p of PEERS) {
      const signing = await deriveIdentityKey(new TextEncoder().encode(`group-peer:${p.id}`));
      const session = await createGroupSession({ groupId: this.groupId, myId: p.id, signing });
      this.peers.push({ ...p, session });
    }

    // Everyone shares their sender-key bundle with everyone else (over secure pairwise channels IRL).
    const all = [{ id: this.meId, session: this.me }, ...this.peers];
    for (const a of all) {
      const bundle = await a.session.senderKeyBundle();
      for (const b of all) if (a !== b) await b.session.addMemberKey(bundle);
    }

    // One subscription dispatches each frame to every member's session, serialized to keep the
    // per-sender receive chains in lock-step.
    this.relay.subscribe(this.topic, (msg: any) => {
      this.queue = this.queue.then(() => this.dispatch(msg));
    });
  }

  private async dispatch(msg: any) {
    // Local user view: surface messages authored by others.
    if (msg.senderId !== this.meId) {
      try {
        const bytes = await this.me.decrypt(msg);
        const p = decodePayload(new TextDecoder().decode(bytes));
        const peer = this.peers.find((x) => x.id === msg.senderId);
        this.onMessage({ senderId: msg.senderId, senderName: peer?.name ?? msg.senderId, text: p.body ?? '' });
      } catch {
        /* not for us / already advanced */
      }
    }
    // Simulated members decrypt too; the first peer auto-replies to the local user's messages.
    for (const peer of this.peers) {
      if (msg.senderId === peer.id) continue;
      try {
        const bytes = await peer.session.decrypt(msg);
        if (msg.senderId === this.meId && peer.id === PEERS[0].id) {
          const incoming = decodePayload(new TextDecoder().decode(bytes));
          setTimeout(() => this.peerSend(peer, groupReply(incoming.body ?? '')), 600);
        }
      } catch {
        /* ignore */
      }
    }
  }

  private async peerSend(peer: { session: any }, text: string) {
    const m = await peer.session.encrypt(encodePayload({ t: 'text', body: text }));
    await this.relay.publish(this.topic, m);
  }

  /** Encrypt+publish a group message from the local user, batching frames for Merkle anchoring. */
  async send(text: string) {
    const m = await this.me.encrypt(encodePayload({ t: 'text', body: text }));
    await this.relay.publish(this.topic, m);

    // Accumulate the frame's hash; every BATCH messages, compute + "anchor" a Merkle root.
    this.leaves.push(await frameHash(m.frame));
    if (this.leaves.length % GroupChat.BATCH === 0) {
      const sodium = await getSodium();
      const root = await buildMerkleRoot(this.leaves);
      this.onCommit('0x' + sodium.to_hex(root).slice(0, 16) + '…');
    }
  }
}

function groupReply(incoming: string): string {
  const t = incoming.toLowerCase();
  if (t.includes('?')) return 'decrypted your message with the group sender key 🔑 — and yes!';
  if (t.includes('gm') || t.includes('hi') || t.includes('hey')) return 'gm! 👋 (decrypted via Sender Keys)';
  return 'received & decrypted on my device ✓';
}
