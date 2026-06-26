// Live 1:1 secret chat engine. Apache-2.0
//
// Wires @teleblock/shared end-to-end IN THE BROWSER: two identities perform X3DH, seed two
// Conversations (directional roots derived from the shared secret) over a single InMemoryRelay, and
// exchange real AEAD-encrypted+signed frames. A simulated peer decrypts and auto-replies so the
// round-trip is observable. The raw ciphertext that crosses the relay is captured so the UI can
// prove no plaintext is ever on the wire.
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  getSodium,
  InMemoryRelay,
  InMemoryStore,
  deriveConversationTopic,
  Conversation,
  initiateSession,
  respondSession,
  provisionIdentity,
  identityChallenge,
  attachMedia,
  loadMedia,
  encodePayload,
  decodePayload,
} from '@teleblock/shared';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { hexToBytes } from 'viem';
import type { Identity } from './identity';

export interface MediaInfo {
  cid: string;
  mime: string;
  name: string;
  size: number;
}

export interface IncomingMessage {
  text: string;
  fromPeer: boolean;
  ttl?: number;
  media?: MediaInfo;
}

async function burner(): Promise<Identity> {
  const account = privateKeyToAccount(generatePrivateKey());
  const sig = await account.signMessage({ message: identityChallenge(account.address) });
  const { signing, keyMaterial, bundle } = await provisionIdentity({
    identitySignature: hexToBytes(sig),
  });
  return { address: account.address, signing, keyMaterial, bundle };
}

export class SecretChat {
  private relay = new InMemoryRelay();
  private store = new InMemoryStore(); // encrypted media blobs (IPFS stand-in)
  private me: Identity;
  private peer!: Identity;
  private myConvo!: any;
  private peerConvo!: any;
  private onMessage: (m: IncomingMessage) => void = () => {};
  /** The most recent ciphertext frame seen on the wire (for the encryption inspector). */
  lastWireFrame: Record<string, unknown> | null = null;

  constructor(me: Identity) {
    this.me = me;
  }

  /** Establish the session: peer identity, X3DH, directional roots, both Conversations. */
  async init(onMessage: (m: IncomingMessage) => void) {
    this.onMessage = onMessage;
    this.peer = await burner();
    const sodium = await getSodium();

    // X3DH: I initiate against the peer's bundle; the peer responds with my header.
    const { secret, header } = await initiateSession(this.me.keyMaterial, this.peer.bundle);
    const { secret: peerSecret } = await respondSession(this.peer.keyMaterial, header);

    const dir = (s: Uint8Array, label: string) =>
      sodium.crypto_generichash(32, s, sodium.from_string(label));
    const rootMe2Peer = dir(secret, 'TeleBlock/dir/AB');
    const rootPeer2Me = dir(secret, 'TeleBlock/dir/BA');
    // Peer derives the identical roots from its copy of the secret.
    const pRootMe2Peer = dir(peerSecret, 'TeleBlock/dir/AB');
    const pRootPeer2Me = dir(peerSecret, 'TeleBlock/dir/BA');

    const topic = await deriveConversationTopic(
      this.me.signing.publicKey,
      this.peer.signing.publicKey,
    );
    const aad = sodium.from_string(topic);

    this.myConvo = new Conversation({
      transport: this.relay,
      topic,
      sendRoot: rootMe2Peer,
      recvRoot: rootPeer2Me,
      signing: this.me.signing,
      peerSigningPub: this.peer.signing.publicKey,
      aad,
    });
    this.peerConvo = new Conversation({
      transport: this.relay,
      topic,
      sendRoot: pRootPeer2Me,
      recvRoot: pRootMe2Peer,
      signing: this.peer.signing,
      peerSigningPub: this.me.signing.publicKey,
      aad,
    });

    // Capture raw frames on the wire (ciphertext only).
    this.relay.subscribe(topic, (frame: Record<string, unknown>) => {
      this.lastWireFrame = frame;
    });

    // I receive the peer's decrypted replies (payloads decoded back to text/media).
    this.myConvo.start((m: any) => {
      if (m.error) return;
      const p = decodePayload(m.text);
      this.onMessage({ text: p.body ?? '', fromPeer: true, ttl: p.ttl, media: p.media });
    });
    // The peer decrypts my messages and auto-replies to demonstrate the round-trip.
    this.peerConvo.start((m: any) => {
      if (m.error) return;
      const p = decodePayload(m.text);
      setTimeout(() => {
        this.peerConvo.send(encodePayload({ t: 'text', body: canReply(p) }));
      }, 700);
    });
  }

  /** Encrypt+sign+publish a text message (with optional self-destruct ttl in seconds). */
  async send(text: string, ttl?: number) {
    await this.myConvo.send(encodePayload({ t: 'text', body: text, ttl }));
  }

  /**
   * Encrypt media to the store (IPFS stand-in), then send a media message referencing the CID.
   * Returns the descriptor + the decrypted-back bytes (proving the encrypt→store→decrypt roundtrip),
   * which the UI renders for the sender's own bubble.
   */
  async sendMedia(bytes: Uint8Array, meta: { mime: string; name: string }, caption = '', ttl?: number) {
    const desc = await attachMedia(this.store, bytes, this.me.signing, meta);
    await this.myConvo.send(encodePayload({ t: 'media', body: caption, media: desc, ttl }));
    // Load it back from the store, decrypting + verifying our own signature — the full media path.
    const roundTrip = await loadMedia(this.store, desc, this.me.signing.publicKey);
    return { media: { cid: desc.cid, mime: desc.mime, name: desc.name, size: desc.size } as MediaInfo, bytes: roundTrip };
  }

  /** Fetch + decrypt a media blob by descriptor (e.g. for a received media message). */
  async loadMedia(desc: { cid: string; key: string; mime?: string }, signerPub: Uint8Array) {
    return loadMedia(this.store, desc, signerPub);
  }

  peerAddress() {
    return this.peer?.address;
  }
}

function canReply(p: { t?: string; body?: string }): string {
  if (p.t === 'media') return 'got your image ✓ — fetched the CID and decrypted it on my device 🔒';
  const t = (p.body ?? '').toLowerCase();
  if (t.includes('?')) return 'good question — and yes, this whole exchange is end-to-end encrypted 🔒';
  if (t.includes('hi') || t.includes('hey') || t.includes('gm')) return 'hey! 👋 decrypted your message just now';
  return 'got it ✓ (decrypted on my device)';
}
