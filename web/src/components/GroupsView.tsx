// Groups section — live group chat (Sender Keys) + on-chain roster. Apache-2.0
import { useEffect, useMemo, useRef, useState } from 'react';
import { initials, type Message } from '../data';
import { GROUP_META, USER_NAME, visLabel, PERM } from '../engine/indexerData';
import { GroupChat, type GroupIncoming } from '../engine/groupChat';
import type { Identity } from '../engine/identity';
import { ChatBubble } from './ChatBubble';
import { Composer } from './Composer';

const LIVE_GROUP_ID = '1';

const nowTime = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function GroupsView({ store, identity }: { store: any; identity: Identity }) {
  const groups = useMemo(() => store.listGroups(), [store]);
  const [activeId, setActiveId] = useState<string>(groups[0]?.id ?? '');
  const [tab, setTab] = useState<'chat' | 'members'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const engine = useRef<GroupChat | null>(null);
  const meta = (id: string) => GROUP_META[id] ?? { name: `Group ${id}`, color: '#6d7f8f' };
  const members = useMemo(() => (activeId ? store.groupMembers(activeId) : []), [store, activeId]);

  // Boot the live group-chat engine once (group '1').
  useEffect(() => {
    let cancelled = false;
    const gc = new GroupChat(identity, LIVE_GROUP_ID);
    engine.current = gc;
    gc.init((m: GroupIncoming) => {
      if (cancelled) return;
      setMessages((prev) => [
        ...prev,
        { id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: `${m.senderName}: ${m.text}`, outgoing: false, time: nowTime(), encrypted: true },
      ]);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleLabel = (m: any) =>
    m.isOwner ? 'owner' : m.isAdmin ? 'admin' : (m.perms & PERM.POST) !== 0 ? 'member' : 'restricted';

  const send = (text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `me-${Date.now()}`, text, outgoing: true, time: nowTime(), status: 'read', encrypted: true },
    ]);
    engine.current?.send(text);
  };

  const isLive = activeId === LIVE_GROUP_ID;

  return (
    <>
      <div className="list">
        <div className="search" style={{ color: 'var(--tg-text-secondary)', fontSize: 13, padding: 14 }}>
          Smart-contract-managed groups
        </div>
        <div className="rows" data-testid="groups-list">
          {groups.map((g: any) => {
            const m = meta(g.id);
            return (
              <div
                key={g.id}
                className={`row ${g.id === activeId ? 'active' : ''}`}
                onClick={() => {
                  setActiveId(g.id);
                  setTab(g.id === LIVE_GROUP_ID ? 'chat' : 'members');
                }}
              >
                <div className="avatar" style={{ background: m.color }}>{initials(m.name)}</div>
                <div className="meta">
                  <div className="top">
                    <span className="name">{m.name}</span>
                    <span className="time">{visLabel(g.visibility)}</span>
                  </div>
                  <div className="preview">{g.memberCount} members · on-chain roster</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="convo">
        {activeId ? (
          <>
            <header className="header">
              <div className="avatar" style={{ width: 40, height: 40, background: meta(activeId).color }}>
                {initials(meta(activeId).name)}
              </div>
              <div>
                <div className="title">{meta(activeId).name}</div>
                <div className="sub">{members.length} members · E2EE via Sender Keys</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {(['chat', 'members'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    data-testid={`group-tab-${t}`}
                    style={{ padding: '4px 10px', borderRadius: 14, fontSize: 13, background: tab === t ? 'var(--tg-bg-active)' : 'var(--tg-bg-hover)', color: '#fff' }}
                  >
                    {t === 'chat' ? 'Chat' : 'Members'}
                  </button>
                ))}
              </div>
            </header>

            {tab === 'members' ? (
              <div className="scroll" data-testid="group-members" style={{ padding: 12 }}>
                {members.map((m: any) => (
                  <div key={m.address} className="row" style={{ borderRadius: 10 }}>
                    <div className="avatar" style={{ width: 38, height: 38, background: '#33414d' }}>
                      {initials(USER_NAME[m.address] ?? m.address.slice(2, 4))}
                    </div>
                    <div className="meta">
                      <div className="top">
                        <span className="name">{USER_NAME[m.address] ?? m.address}</span>
                        <span className="time" data-role={roleLabel(m)} style={{ color: m.isOwner ? 'var(--tg-online)' : m.isAdmin ? 'var(--tg-read)' : 'var(--tg-hint)' }}>
                          {roleLabel(m)}
                        </span>
                      </div>
                      <div className="preview">permission mask 0x{(m.perms >>> 0).toString(16)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : isLive ? (
              <>
                <div className="scroll" data-testid="group-messages">
                  {messages.length === 0 && <div className="empty">Send a message — it's E2EE to all members</div>}
                  {messages.map((m) => (
                    <ChatBubble key={m.id} text={m.text} outgoing={m.outgoing} time={m.time} status={m.status} encrypted={m.encrypted} />
                  ))}
                </div>
                <Composer onSend={send} onSendFile={() => {}} />
              </>
            ) : (
              <div className="scroll">
                <div className="empty">Live group chat is enabled for the demo group. Open its “Members” tab.</div>
              </div>
            )}
          </>
        ) : (
          <div className="empty">No groups</div>
        )}
      </section>
    </>
  );
}
