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
import { buildReadModel, DYNAMIC_POST_META } from './engine/indexerData';
import { makeWavTone } from './engine/audio';
import { encodeCreatePostCall } from '@teleblock/shared';
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

// Stamp a self-destruct deadline onto a message if it carries a ttl.
const withExpiry = (m: Message): Message =>
  m.ttl ? { ...m, expiresAt: Date.now() + m.ttl * 1000 } : m;

export type Theme = 'dark' | 'light' | 'amoled';

export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('tb-theme') as Theme) || 'dark');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('tb-theme', theme);
  }, [theme]);

  if (!identity) return <LoginScreen onAuthed={setIdentity} />;
  return <Shell identity={identity} theme={theme} setTheme={setTheme} />;
}

function Shell({ identity, theme, setTheme }: { identity: Identity; theme: Theme; setTheme: (t: Theme) => void }) {
  const [section, setSection] = useState<Section>('chats');
  const [chats, setChats] = useState<Chat[]>(CHATS);
  const [activeId, setActiveId] = useState<string>(CHATS[0].id);
  const [showInspector, setShowInspector] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<{ author: string; preview: string } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState<string | null>(null);
  const engine = useRef<SecretChat | null>(null);

  const appendMessage = (chatId: string, msg: Message) =>
    setChats((prev) => prev.map((c) => (c.id === chatId ? { ...c, messages: [...c.messages, msg] } : c)));

  // Boot the live E2EE engine once an identity exists.
  useEffect(() => {
    let cancelled = false;
    const sc = new SecretChat(identity);
    engine.current = sc;
    sc.init(
      (m: IncomingMessage) => {
        if (cancelled) return;
        appendMessage(LIVE_CHAT_ID, withExpiry({
          id: `peer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          text: m.text,
          outgoing: false,
          time: nowTime(),
          encrypted: true,
          ttl: m.ttl,
        }));
      },
      (typing: boolean) => {
        if (!cancelled) setPeerTyping(typing);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Self-destruct sweep: drop messages whose timer has elapsed, releasing any media object URLs.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setChats((prev) =>
        prev.map((c) => {
          const kept = c.messages.filter((m) => {
            const dead = m.expiresAt != null && m.expiresAt <= now;
            if (dead && m.mediaUrl) URL.revokeObjectURL(m.mediaUrl);
            return !dead;
          });
          return kept.length === c.messages.length ? c : { ...c, messages: kept };
        }),
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Read model derived from on-chain events via the real indexer reducer (in-browser).
  const readModel = useMemo(() => buildReadModel(), []);

  const active = chats.find((c) => c.id === activeId) ?? null;
  const isLive = active?.id === LIVE_CHAT_ID;

  const send = (text: string, ttl = 0) => {
    if (!active) return;
    const msg = withExpiry({
      id: `local-${Date.now()}`,
      text,
      outgoing: true,
      time: nowTime(),
      status: 'sent',
      encrypted: true,
      ttl: ttl || undefined,
      replyTo: replyTo ?? undefined,
    });
    appendMessage(active.id, msg);
    setReplyTo(null);

    if (active.id === LIVE_CHAT_ID && engine.current) {
      // Real path: encrypt+sign+publish over the relay; peer decrypts and replies.
      engine.current.send(text, ttl || undefined);
      setTimeout(() => updateStatus(active.id, msg.id, 'delivered'), 200);
      setTimeout(() => updateStatus(active.id, msg.id, 'read'), 800);
    } else {
      setTimeout(() => updateStatus(active.id, msg.id, 'delivered'), 300);
      setTimeout(() => updateStatus(active.id, msg.id, 'read'), 1100);
    }
  };

  // Voice message: synthesize a short clip (no mic in headless), then run it through the SAME
  // encrypted media path as any attachment and render a playable voice bubble.
  const sendVoice = async (ttl = 0) => {
    if (!active) return;
    const bytes = makeWavTone();
    if (active.id === LIVE_CHAT_ID && engine.current) {
      const { media, bytes: back } = await engine.current.sendMedia(bytes, { mime: 'audio/wav', name: 'voice.wav' }, '', ttl || undefined);
      const url = URL.createObjectURL(new Blob([back], { type: media.mime }));
      appendMessage(active.id, withExpiry({ id: `voice-${Date.now()}`, text: '', outgoing: true, time: nowTime(), status: 'read', encrypted: true, mediaUrl: url, mediaMime: 'audio/wav', ttl: ttl || undefined }));
    } else {
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'audio/wav' }));
      appendMessage(active.id, withExpiry({ id: `voice-${Date.now()}`, text: '', outgoing: true, time: nowTime(), status: 'read', encrypted: true, mediaUrl: url, mediaMime: 'audio/wav', ttl: ttl || undefined }));
    }
  };

  // Attach an image: encrypt → store (IPFS stand-in) → send a media frame → render the decrypted-back
  // bytes locally (proving the encrypt→store→decrypt roundtrip ran in the browser).
  const sendFile = async (file: File, ttl = 0) => {
    if (!active) return;
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (active.id === LIVE_CHAT_ID && engine.current) {
      const { media, bytes: back } = await engine.current.sendMedia(bytes, { mime: file.type, name: file.name }, '', ttl || undefined);
      const url = URL.createObjectURL(new Blob([back], { type: media.mime }));
      appendMessage(active.id, withExpiry({
        id: `local-${Date.now()}`,
        text: '',
        outgoing: true,
        time: nowTime(),
        status: 'read',
        encrypted: true,
        mediaUrl: url,
        mediaMime: media.mime,
        ttl: ttl || undefined,
      }));
    } else {
      const url = URL.createObjectURL(new Blob([bytes], { type: file.type }));
      appendMessage(active.id, withExpiry({
        id: `local-${Date.now()}`,
        text: '',
        outgoing: true,
        time: nowTime(),
        status: 'read',
        encrypted: true,
        mediaUrl: url,
        ttl: ttl || undefined,
      }));
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

  // "Crystallize" a chat message into a public forum thread (chat → forum). Applies a PostCreated
  // event to the shared read model (forum 1) and builds the on-chain createPost() calldata.
  const FORUM_FOR_CROSSPOST = '1';
  const crosspost = (text: string) => {
    if (!text) return;
    const id = String(Math.max(0, ...[...readModel.posts.keys()].map(Number)) + 1);
    const cid = ('0x' + (id + text).replace(/[^0-9a-f]/gi, '').padEnd(64, '0').slice(0, 64)) as `0x${string}`;
    readModel.apply({ name: 'PostCreated', args: { postId: id, forumId: FORUM_FOR_CROSSPOST, parentId: '0', author: identity.address.toLowerCase(), contentCID: cid }, blockNumber: 1e9, logIndex: Date.now() });
    DYNAMIC_POST_META[id] = { title: `From chat: ${text.slice(0, 40)}`, preview: text };
    encodeCreatePostCall(FORUM_FOR_CROSSPOST, 0, cid, cid); // calldata ready for on-chain submission
    setBanner('Posted to the “Protocol & Governance” forum →');
    setTimeout(() => setBanner(null), 4000);
  };

  // Create a poll (demo question). Polls render locally and are votable; the simulated peer casts a
  // vote on the live chat.
  const sendPoll = () => {
    if (!active) return;
    const id = `poll-${Date.now()}`;
    appendMessage(active.id, {
      id,
      text: '',
      outgoing: true,
      time: nowTime(),
      status: 'read',
      encrypted: true,
      poll: { question: 'Which L2 should we deploy on?', options: [
        { text: 'Base', votes: 0 },
        { text: 'Arbitrum', votes: 0 },
        { text: 'Optimism', votes: 0 },
      ] },
    });
    if (active.id === LIVE_CHAT_ID) {
      // The peer casts a vote shortly after, demonstrating multi-party tallying.
      setTimeout(() => pollVote(active.id, id, 0, true), 900);
    }
  };

  const pollVote = (chatId: string, msgId: string, optIdx: number, fromPeer = false) =>
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== msgId || !m.poll) return m;
            if (!fromPeer && m.poll.voted != null) return m; // one vote per local user
            const options = m.poll.options.map((o, i) => (i === optIdx ? { ...o, votes: o.votes + 1 } : o));
            return { ...m, poll: { ...m.poll, options, voted: fromPeer ? m.poll.voted : optIdx } };
          }),
        };
      }),
    );

  // Double-tap a bubble to toggle a 👍 reaction (Telegram-style quick reaction).
  const toggleReaction = (chatId: string, msgId: string) =>
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        return {
          ...c,
          messages: c.messages.map((m) => {
            if (m.id !== msgId) return m;
            const has = (m.reactions ?? []).some((r) => r.emoji === '👍');
            return { ...m, reactions: has ? [] : [{ emoji: '👍', count: 1 }] };
          }),
        };
      }),
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
        <GroupsView store={readModel} identity={identity} />
      ) : section === 'forums' ? (
        <ForumsView store={readModel} identity={identity} />
      ) : section === 'discover' ? (
        <DiscoverView store={readModel} />
      ) : section === 'profile' ? (
        <ProfileView identity={identity} theme={theme} setTheme={setTheme} />
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
                  <div className="sub" data-testid="chat-subtitle">
                    {isLive && peerTyping ? (
                      <span style={{ color: 'var(--tg-accent)' }}>typing…</span>
                    ) : active.kind === 'group' ? (
                      `${active.members ?? 0} members`
                    ) : active.online ? (
                      'online'
                    ) : (
                      'last seen recently'
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setChatSearch((s) => (s === null ? '' : null))}
                  title="Search this chat"
                  data-testid="toggle-chat-search"
                  style={{ marginLeft: 'auto', color: 'var(--tg-text-secondary)', fontSize: 16, padding: '0 8px' }}
                >
                  🔍
                </button>
                <button
                  className="lock"
                  onClick={() => setShowInspector((s) => !s)}
                  title="Show the ciphertext that crossed the wire"
                  data-testid="toggle-inspector"
                >
                  🔒 {isLive ? 'live E2EE' : 'encrypted'}
                </button>
              </header>

              {chatSearch !== null && (
                <div style={{ padding: '6px 12px', background: 'var(--tg-bg-panel)', borderBottom: '1px solid var(--tg-divider)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    autoFocus
                    data-testid="chat-search-input"
                    placeholder="Search in chat"
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    style={{ flex: 1, padding: '7px 12px', borderRadius: 16, border: 'none', background: 'var(--tg-bg)', color: 'var(--tg-text)', outline: 'none' }}
                  />
                  <span data-testid="chat-search-count" style={{ color: 'var(--tg-hint)', fontSize: 13 }}>
                    {chatSearch.trim() ? `${active.messages.filter((m) => m.text.toLowerCase().includes(chatSearch.toLowerCase())).length} found` : ''}
                  </span>
                </div>
              )}

              {banner && (
                <div data-testid="crosspost-banner" style={{ background: 'var(--tg-bg-active)', color: '#fff', padding: '6px 14px', fontSize: 13 }}>
                  {banner}
                </div>
              )}
              <div className="scroll" data-testid="messages">
                {active.messages
                  .filter((m) => !chatSearch?.trim() || m.text.toLowerCase().includes(chatSearch.toLowerCase()))
                  .map((m) => (
                  <ChatBubble
                    key={m.id}
                    text={m.text}
                    outgoing={m.outgoing}
                    time={m.time}
                    status={m.status}
                    encrypted={m.encrypted}
                    reactions={m.reactions}
                    replyTo={m.replyTo}
                    mediaUrl={m.mediaUrl}
                    mediaMime={m.mediaMime}
                    ttl={m.ttl}
                    poll={m.poll}
                    onPollVote={(i) => pollVote(active.id, m.id, i)}
                    onReact={() => toggleReaction(active.id, m.id)}
                    onReply={() =>
                      setReplyTo({
                        author: m.outgoing ? 'You' : active.name,
                        preview: m.text || (m.mediaUrl ? '📷 Photo' : ''),
                      })
                    }
                    onCrosspost={() => crosspost(m.text)}
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

              <Composer onSend={send} onSendFile={sendFile} onVoice={sendVoice} onPoll={sendPoll} replyTo={replyTo} onCancelReply={() => setReplyTo(null)} />
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
