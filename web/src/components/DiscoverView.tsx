// Discover section — trending groups, top forums, top users by reputation. Apache-2.0
import { useMemo } from 'react';
import { initials } from '../data';
import { GROUP_META, FORUM_META, USER_NAME, govLabel } from '../engine/indexerData';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function DiscoverView({ store }: { store: any }) {
  const groups = useMemo(
    () => [...store.listGroups()].sort((a: any, b: any) => b.memberCount - a.memberCount),
    [store],
  );
  const forums = useMemo(() => [...store.forums.values()], [store]);
  const topUsers = useMemo(
    () =>
      [...store.reputation.entries()]
        .map(([address, rep]: [string, number]) => ({ address, rep }))
        .sort((a: any, b: any) => b.rep - a.rep),
    [store],
  );

  return (
    <>
      <div className="list">
        <div className="search" style={{ color: 'var(--tg-text-secondary)', fontSize: 13, padding: 14 }}>
          Discover
        </div>
        <div className="rows">
          <div style={{ padding: '6px 14px', color: 'var(--tg-hint)', fontSize: 12, textTransform: 'uppercase' }}>Trending groups</div>
          {groups.map((g: any) => {
            const m = GROUP_META[g.id] ?? { name: `Group ${g.id}`, color: '#6d7f8f' };
            return (
              <div key={g.id} className="row">
                <div className="avatar" style={{ background: m.color }}>{initials(m.name)}</div>
                <div className="meta">
                  <div className="name">{m.name}</div>
                  <div className="preview">{g.memberCount} members</div>
                </div>
              </div>
            );
          })}
          <div style={{ padding: '6px 14px', color: 'var(--tg-hint)', fontSize: 12, textTransform: 'uppercase' }}>Public forums</div>
          {forums.map((f: any) => {
            const m = FORUM_META[f.id] ?? { name: `Forum ${f.id}`, color: '#5eb5f7' };
            return (
              <div key={f.id} className="row">
                <div className="avatar" style={{ background: m.color }}>{initials(m.name)}</div>
                <div className="meta">
                  <div className="name">{m.name}</div>
                  <div className="preview">{govLabel(f.gov)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <section className="convo">
        <header className="header">
          <div className="title">Recommended people</div>
          <div className="sub" style={{ marginLeft: 8 }}>ranked by on-chain reputation</div>
        </header>
        <div className="scroll" data-testid="top-users" style={{ padding: 12 }}>
          {topUsers.map((u: any, i: number) => (
            <div key={u.address} className="row" style={{ borderRadius: 10 }}>
              <div className="avatar" style={{ width: 38, height: 38, background: i === 0 ? '#caa83a' : '#33414d' }}>
                {initials(USER_NAME[u.address] ?? u.address.slice(2, 4))}
              </div>
              <div className="meta">
                <div className="top">
                  <span className="name">{USER_NAME[u.address] ?? u.address}</span>
                  <span className="time" style={{ color: 'var(--tg-online)' }}>★ {u.rep}</span>
                </div>
                <div className="preview">reputation {u.rep} · weight √rep ≈ {Math.floor(Math.sqrt(u.rep))}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
