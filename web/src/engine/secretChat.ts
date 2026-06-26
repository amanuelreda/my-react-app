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
  deriveConversationTopic,
  Conversation,
  initiateSession,
  respondSession,
  provisionIdentity,
  identityChallenge,
} from '@teleblock/shared';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { hexToBytes } from 'viem';
import type { Identity } from './identity';

export interface IncomingMessage {
  text: string;
  fromPeer: boolean;
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

    // I receive the peer's decrypted replies.
    this.myConvo.start((m: any) => {
      if (!m.error) this.onMessage({ text: m.text, fromPeer: true });
    });
    // The peer decrypts my messages and auto-replies to demonstrate the round-trip.
    this.peerConvo.start((m: any) => {
      if (m.error) return;
      setTimeout(() => {
        this.peerConvo.send(canReply(m.text));
      }, 700);
    });
  }

  /** Encrypt+sign+publish a message from the local user. */
  async send(text: string) {
    await this.myConvo.send(text);
  }

  peerAddress() {
    return this.peer?.address;
  }
}

function canReply(incoming: string): string {
  const t = incoming.toLowerCase();
  if (t.includes('?')) return 'good question — and yes, this whole exchange is end-to-end encrypted 🔒';
  if (t.includes('hi') || t.includes('hey') || t.includes('gm')) return 'hey! 👋 decrypted your message just now';
  return 'got it ✓ (decrypted on my device)';
}
