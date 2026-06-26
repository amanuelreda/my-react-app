// Groups section — live group chat (Sender Keys) + on-chain roster. Apache-2.0
import { useEffect, useMemo, useRef, useState } from 'react';
import { initials, type Message } from '../data';
import { GROUP_META, USER_NAME, visLabel, PERM } from '../engine/indexerData';
import { GroupChat, type GroupIncoming } from '../engine/groupChat';
import type { Identity } from '../engine/identity';
import { ChatBubble } from './ChatBubble';
import { Composer } from './Composer';
import { encodeCreateGroupCall } from '@teleblock/shared';

const B32 = (s: string) => ('0x' + s.replace(/[^0-9a-f]/gi, '').padEnd(64, '0').slice(0, 64)) as `0x${string}`;
const PALETTE = ['#e17076', '#7bc862', '#a695e7', '#ee7aae', '#6ec9cb', '#faa774'];

const LIVE_GROUP_ID = '1';

const nowTime = () => {
  const d = new Date();
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export function GroupsView({ store, identity }: { store: any; identity: Identity }) {
  const me = identity.address.toLowerCase();
  const [version, setVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const groups = useMemo(() => store.listGroups(), [store, version]);
  const [activeId, setActiveId] = useState<string>(groups[0]?.id ?? '');
  const [tab, setTab] = useState<'chat' | 'members'>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [extraMeta, setExtraMeta] = useState<Record<string, { name: string; color: string }>>({});
  const [lastTx, setLastTx] = useState('');
  const [commit, setCommit] = useState('');
  const engine = useRef<GroupChat | null>(null);
  const meta = (id: string) => extraMeta[id] ?? GROUP_META[id] ?? { name: `Group ${id}`, color: '#6d7f8f' };

  const createGroup = () => {
    const name = draft.trim();
    if (!name) return;
    const id = String(Math.max(0, ...[...store.groups.keys()].map(Number)) + 1);
    const cid = B32(id + name);
    store.apply({ name: 'GroupCreated', args: { groupId: id, owner: me, visibility: 0, metadataCID: cid }, blockNumber: 1e9, logIndex: Date.now() });
    setExtraMeta((m) => ({ ...m, [id]: { name, color: PALETTE[Number(id) % PALETTE.length] } }));
    setLastTx(`createGroup → ${encodeCreateGroupCall({ metadataCID: cid, visibility: 0, gate: undefined, mlsGroupId: cid }).slice(0, 18)}…`);
    setDraft('');
    setVersion((v) => v + 1);
    setActiveId(id);
    setTab('members');
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const members = useMemo(() => (activeId ? store.groupMembers(activeId) : []), [store, activeId, version]);

  // Boot the live group-chat engine once (group '1').
  useEffect(() => {
    let cancelled = false;
    const gc = new GroupChat(identity, LIVE_GROUP_ID);
    engine.current = gc;
    gc.init(
      (m: GroupIncoming) => {
        if (cancelled) return;
        setMessages((prev) => [
          ...prev,
          { id: `g-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: `${m.senderName}: ${m.text}`, outgoing: false, time: nowTime(), encrypted: true },
        ]);
      },
      (rootHex: string) => {
        if (!cancelled) setCommit(rootHex);
      },
    );
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
        <div className="composer" style={{ borderTop: 'none', borderBottom: '1px solid var(--tg-divider)' }}>
          <input placeholder="Create a group…" value={draft} data-testid="new-group-input" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') createGroup(); }} />
          <button className="send" onClick={createGroup} disabled={!draft.trim()} data-testid="create-group">＋</button>
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
              {lastTx && <div className="sub" data-testid="group-tx" style={{ marginLeft: 10, fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{lastTx}</div>}
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
                {commit && (
                  <div data-testid="anchor" style={{ background: '#0b1118', color: 'var(--tg-text-secondary)', padding: '5px 14px', fontSize: 11, fontFamily: 'ui-monospace, monospace' }}>
                    ⛓️ anchored batch · appendCommitment({commit})
                  </div>
                )}
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
