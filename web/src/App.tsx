// TeleBlock web shell — Telegram-style 3-column layout. Apache-2.0
//
// This is the UI shell: navigation rail, chat list, conversation pane, composer — styled to match
// Telegram. Messages are local/optimistic here; wiring to @teleblock/shared (Conversation over a
// Transport, GroupSession for groups) happens behind the same component API. See src/data.ts and
// the integration note in web/README.md.
import { useMemo, useState } from 'react';
import { ChatBubble } from './components/ChatBubble';
import { ChatList } from './components/ChatList';
import { Composer } from './components/Composer';
import { CHATS, initials, type Chat, type Message, type Section } from './data';
import './theme.css';

const NAV: { key: Section; icon: string; label: string }[] = [
  { key: 'chats', icon: '💬', label: 'Chats' },
  { key: 'groups', icon: '👥', label: 'Groups' },
  { key: 'forums', icon: '🗂️', label: 'Forums' },
  { key: 'discover', icon: '🧭', label: 'Discover' },
  { key: 'profile', icon: '👤', label: 'Profile' },
];

const nowTime = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

export default function App() {
  const [section, setSection] = useState<Section>('chats');
  const [chats, setChats] = useState<Chat[]>(CHATS);
  const [activeId, setActiveId] = useState<string>(CHATS[0].id);

  const visible = useMemo(() => {
    if (section === 'groups') return chats.filter((c) => c.kind === 'group');
    if (section === 'chats') return chats;
    return chats; // forums/discover/profile reuse the list area in this shell
  }, [chats, section]);

  const active = chats.find((c) => c.id === activeId) ?? null;

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
    setChats((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, messages: [...c.messages, msg] } : c)),
    );
    // Simulate delivery + read receipts (optimistic UX, like Telegram).
    setTimeout(() => updateStatus(active.id, msg.id, 'delivered'), 300);
    setTimeout(() => updateStatus(active.id, msg.id, 'read'), 1100);
  };

  const updateStatus = (chatId: string, msgId: string, status: Message['status']) =>
    setChats((prev) =>
      prev.map((c) =>
        c.id === chatId
          ? { ...c, messages: c.messages.map((m) => (m.id === msgId ? { ...m, status } : m)) }
          : c,
      ),
    );

  return (
    <div className="app show-list">
      {/* left rail */}
      <nav className="rail">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={section === n.key ? 'active' : ''}
            title={n.label}
            onClick={() => setSection(n.key)}
          >
            {n.icon}
          </button>
        ))}
        <div className="spacer" />
        <button title="Settings">⚙️</button>
      </nav>

      {/* chat list */}
      <ChatList chats={visible} activeId={activeId} onSelect={setActiveId} />

      {/* conversation */}
      {active ? (
        <section className="convo">
          <header className="header">
            <div className="avatar" style={{ width: 40, height: 40, background: active.color }}>
              {initials(active.name)}
            </div>
            <div>
              <div className="title">{active.name}</div>
              <div className="sub">
                {active.kind === 'group'
                  ? `${active.members ?? 0} members`
                  : active.online
                    ? 'online'
                    : 'last seen recently'}
              </div>
            </div>
            <div className="lock">🔒 end-to-end encrypted</div>
          </header>

          <div className="scroll">
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

          <Composer onSend={send} />
        </section>
      ) : (
        <section className="convo">
          <div className="empty">Select a chat to start messaging</div>
        </section>
      )}
    </div>
  );
}
