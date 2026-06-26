// TeleBlock web shell — Telegram-style 3-column layout with LIVE E2EE. Apache-2.0
//
// The first DM ("Nadia") is a real end-to-end-encrypted conversation powered by @teleblock/shared:
// X3DH key agreement, a symmetric ratchet, and AEAD frames over an in-memory relay, with a
// simulated peer that decrypts and replies. The encryption inspector shows the actual ciphertext
// that crossed the wire. Other chats use local/optimistic state. Login provisions a real identity
// (burner or, later, wallet) via SIWE-style key derivation.
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChatBubble } from './components/ChatBubble';
import { ChatList } from './components/ChatList';
import { Composer } from './components/Composer';
import { LoginScreen, fingerprint } from './components/LoginScreen';
import { GroupsView } from './components/GroupsView';
import { ForumsView } from './components/ForumsView';
import { DiscoverView } from './components/DiscoverView';
import { ProfileView } from './components/ProfileView';
import { CHATS, initials, type Chat, type Message, type Section } from './data';
import { SecretChat, type IncomingMessage } from './engine/secretChat';
import { buildReadModel } from './engine/indexerData';
import type { Identity } from './engine/identity';
import './theme.css';

const NAV: { key: Section; icon: string; label: string }[] = [
  { key: 'chats', icon: '💬', label: 'Chats' },
  { key: 'groups', icon: '👥', label: 'Groups' },
  { key: 'forums', icon: '🗂️', label: 'Forums' },
  { key: 'discover', icon: '🧭', label: 'Discover' },
  { key: 'profile', icon: '👤', label: 'Profile' },
];

const LIVE_CHAT_ID = 'dm-nadia';

const nowTime = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  if (!identity) return <LoginScreen onAuthed={setIdentity} />;
  return <Shell identity={identity} />;
}

function Shell({ identity }: { identity: Identity }) {
  const [section, setSection] = useState<Section>('chats');
  const [chats, setChats] = useState<Chat[]>(CHATS);
  const [activeId, setActiveId] = useState<string>(CHATS[0].id);
  const [showInspector, setShowInspector] = useState(false);
  const engine = useRef<SecretChat | null>(null);

  const appendMessage = (chatId: string, msg: Message) =>
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, msg] } : c)));

  // Boot the live E2EE engine once an identity exists.
  useEffect(() => {
    let cancelled = false;
    const sc = new SecretChat(identity);
    engine.current = sc;
    sc.init((m: IncomingMessage) => {
      if (cancelled) return;
      appendMessage(LIVE_CHAT_ID, {
        id: `peer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text: m.text,
        outgoing: false,
        time: nowTime(),
        encrypted: true,
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Read model derived from on-chain events via the real indexer reducer (in-browser).
  const readModel = useMemo(() => buildReadModel(), []);

  const active = chats.find((c) => c.id === activeId) ?? null;
  const isLive = active?.id === LIVE_CHAT_ID;

  const send = (text: string) => {
    if (!active) return;
    const msg: Message = {
      id: `local-${Date.now()}`,
      text,
      outgoing: true,
      time: nowTime(),
      status: 'sent',
      encrypted: true,
    };
    appendMessage(active.id, msg);

    if (active.id === LIVE_CHAT_ID && engine.current) {
      // Real path: encrypt+sign+publish over the relay; peer decrypts and replies.
      engine.current.send(text);
      setTimeout(() => updateStatus(active.id, msg.id, 'delivered'), 200);
      setTimeout(() => updateStatus(active.id, msg.id, 'read'), 800);
    } else {
      setTimeout(() => updateStatus(active.id, msg.id, 'delivered'), 300);
      setTimeout(() => updateStatus(active.id, msg.id, 'read'), 1100);
    }
  };

  const updateStatus = (chatId: string, msgId: string, status: Message['status']) =>
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, status } : m)) }
          : c,
      ),
    );

  const wire = engine.current?.lastWireFrame;

  return (
    <div className="app show-list">
      <nav className="rail">
        {NAV.map((n) => (
          <button key={n.key} className={section === n.key ? 'active' : ''} title={n.label} onClick={() => setSection(n.key)}>
            {n.icon}
          </button>
        ))}
        <div className="spacer" />
        <button title={`You: ${identity.address.slice(0, 6)}… · key ${fingerprint(identity.signing.publicKey)}`}>👤</button>
      </nav>

      {section === 'groups' ? (
        <GroupsView store={readModel} />
      ) : section === 'forums' ? (
        <ForumsView store={readModel} />
      ) : section === 'discover' ? (
        <DiscoverView store={readModel} />
      ) : section === 'profile' ? (
        <ProfileView identity={identity} />
      ) : (
        <>
          <ChatList chats={chats} activeId={activeId} onSelect={setActiveId} />
          {active ? (
            <section className="convo">
              <header className="header">
                <div className="avatar" style={{ width: 40, height: 40, background: active.color }}>
                  {initials(active.name)}
                </div>
                <div>
                  <div className="title">{active.name}</div>
                  <div className="sub">
                    {active.kind === 'group' ? `${active.members ?? 0} members` : active.online ? 'online' : 'last seen recently'}
                  </div>
                </div>
                <button
                  className="lock"
                  onClick={() => setShowInspector((s) => !s)}
                  title="Show the ciphertext that crossed the wire"
                  data-testid="toggle-inspector"
                >
                  🔒 {isLive ? 'live E2EE' : 'encrypted'}
                </button>
              </header>

              <div className="scroll" data-testid="messages">
                {active.messages.map((m) => (
                  <ChatBubble
                    key={m.id}
                    text={m.text}
                    outgoing={m.outgoing}
                    time={m.time}
                    status={m.status}
                    encrypted={m.encrypted}
                    reactions={m.reactions}
                    replyTo={m.replyTo}
                  />
                ))}
              </div>

              {showInspector && isLive && (
                <div
                  data-testid="inspector"
                  style={{
                    background: '#0b1118',
                    borderTop: '1px solid var(--tg-divider)',
                    padding: '8px 12px',
                    fontFamily: 'ui-monospace, monospace',
                    fontSize: 11,
                    color: 'var(--tg-text-secondary)',
                    maxHeight: 120,
                    overflow: 'auto',
                  }}
                >
                  <div style={{ color: 'var(--tg-online)', marginBottom: 4 }}>
                    ↑ last frame on the relay (ciphertext only — no plaintext leaves the device):
                  </div>
                  <div style={{ wordBreak: 'break-all' }}>
                    {wire ? JSON.stringify(wire) : 'send a message to inspect the encrypted frame'}
                  </div>
                </div>
              )}

              <Composer onSend={send} />
            </section>
          ) : (
            <section className="convo">
              <div className="empty">Select a chat to start messaging</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
