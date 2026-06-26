// Groups section — rosters & roles from the indexer. Apache-2.0
import { useMemo, useState } from 'react';
import { initials } from '../data';
import { GROUP_META, USER_NAME, visLabel, PERM } from '../engine/indexerData';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function GroupsView({ store }: { store: any }) {
  const groups = useMemo(() => store.listGroups(), [store]);
  const [activeId, setActiveId] = useState<string>(groups[0]?.id ?? '');
  const members = useMemo(() => (activeId ? store.groupMembers(activeId) : []), [store, activeId]);
  const meta = (id: string) => GROUP_META[id] ?? { name: `Group ${id}`, color: '#6d7f8f' };

  const roleLabel = (m: any) =>
    m.isOwner ? 'owner' : m.isAdmin ? 'admin' : (m.perms & PERM.POST) !== 0 ? 'member' : 'restricted';

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
              <div key={g.id} className={`row ${g.id === activeId ? 'active' : ''}`} onClick={() => setActiveId(g.id)}>
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
                <div className="sub">{members.length} members · roles enforced on-chain</div>
              </div>
            </header>
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
          </>
        ) : (
          <div className="empty">No groups</div>
        )}
      </section>
    </>
  );
}
