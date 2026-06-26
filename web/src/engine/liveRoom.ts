// Real cross-tab 1:1 session (presence + X3DH + ratchet). Apache-2.0
//
// Discovers another tab/window of the same origin over a BroadcastChannel "presence" channel,
// performs a real X3DH handshake against the peer's published pre-key bundle, and runs an encrypted
// Conversation over the BroadcastTransport. Open the app twice, log in on each, and the two tabs
// message each other end-to-end — no simulated peer. Lower address = X3DH initiator (deterministic).
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  getSodium,
  deriveConversationTopic,
  Conversation,
  initiateSession,
  respondSession,
  verifyPreKeyBundle,
  encodePayload,
  decodePayload,
} from '@teleblock/shared';
import { BroadcastTransport } from './broadcastTransport';
import type { Identity } from './identity';

export interface RoomMessage {
  text: string;
  fromPeer: boolean;
}

export class LiveRoom {
  private presence: BroadcastChannel;
  private transport = new BroadcastTransport('teleblock-relay');
  private me: Identity;
  private sessions = new Map<string, { convo?: any; bundle: any }>();
  private onMessage: (m: RoomMessage) => void = () => {};
  private onPeer: (addr: string | null) => void = () => {};
  private peerAddr: string | null = null;

  constructor(me: Identity) {
    this.me = me;
    this.presence = new BroadcastChannel('teleblock-presence');
  }

  start(onMessage: (m: RoomMessage) => void, onPeer: (addr: string | null) => void) {
    this.onMessage = onMessage;
    this.onPeer = onPeer;
    this.presence.onmessage = (e: MessageEvent) => this.handle(e.data).catch(() => {});
    this.announce('hello');
  }

  private announce(type: 'hello' | 'hi', to?: string) {
    this.presence.postMessage({ type, id: this.me.address, bundle: this.me.bundle, to });
  }

  private async handle(msg: any) {
    if (!msg || msg.id === this.me.address) return;

    if (msg.type === 'hello' || msg.type === 'hi') {
      if (msg.type === 'hello') this.announce('hi', msg.id); // let the new tab learn us
      if (!this.sessions.has(msg.id)) {
        this.sessions.set(msg.id, { bundle: msg.bundle });
        const initiator = this.me.address.toLowerCase() < msg.id.toLowerCase();
        if (initiator) {
          const { secret, header } = await initiateSession(this.me.keyMaterial, msg.bundle);
          this.presence.postMessage({ type: 'x3dh', id: this.me.address, to: msg.id, header });
          await this.openConversation(msg.id, msg.bundle, secret, true);
        }
      }
    } else if (msg.type === 'x3dh' && msg.to === this.me.address) {
      const s = this.sessions.get(msg.id);
      if (s && !s.convo) {
        const { secret } = await respondSession(this.me.keyMaterial, msg.header);
        await this.openConversation(msg.id, s.bundle, secret, false);
      }
    }
  }

  private async openConversation(peerId: string, peerBundle: any, secret: Uint8Array, initiator: boolean) {
    const entry = this.sessions.get(peerId);
    if (!entry || entry.convo) return;

    const sodium = await getSodium();
    const b = await verifyPreKeyBundle(peerBundle); // throws on a forged bundle
    const dir = (label: string) => sodium.crypto_generichash(32, secret, sodium.from_string(label));
    const rootAB = dir('TeleBlock/room/AB'); // initiator → responder
    const rootBA = dir('TeleBlock/room/BA');

    const topic = await deriveConversationTopic(this.me.signing.publicKey, b.signingKeyEd);
    const aad = sodium.from_string(topic);

    const convo = new Conversation({
      transport: this.transport,
      topic,
      sendRoot: initiator ? rootAB : rootBA,
      recvRoot: initiator ? rootBA : rootAB,
      signing: this.me.signing,
      peerSigningPub: b.signingKeyEd,
      aad,
    });
    convo.start((m: any) => {
      if (m.error) return;
      const p = decodePayload(m.text);
      this.onMessage({ text: p.body ?? '', fromPeer: true });
    });

    entry.convo = convo;
    this.peerAddr = peerId;
    this.onPeer(peerId);
  }

  async send(text: string) {
    const session = [...this.sessions.values()].find((s) => s.convo);
    if (!session?.convo) return false; // no peer connected yet
    await session.convo.send(encodePayload({ t: 'text', body: text }));
    return true;
  }

  connectedPeer() {
    return this.peerAddr;
  }

  stop() {
    this.presence.close();
    this.transport.close();
  }
}
