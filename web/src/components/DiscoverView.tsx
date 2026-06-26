// Discover section — search + trending groups, top forums, top users by reputation. Apache-2.0
import { useMemo, useState } from 'react';
import { initials } from '../data';
import { GROUP_META, FORUM_META, POST_META, USER_NAME, govLabel, buildSearch } from '../engine/indexerData';

/* eslint-disable @typescript-eslint/no-explicit-any */
const TYPE_ICON: Record<string, string> = { group: '👥', forum: '🗂️', post: '💬', user: '👤' };

export function DiscoverView({ store }: { store: any }) {
  const search = useMemo(() => buildSearch(store), [store]);
  const [q, setQ] = useState('');
  const results = useMemo(() => (q.trim() ? search.search(q, { limit: 20 }) : []), [search, q]);

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

  const resultSubtitle = (r: any) => {
    if (r.type === 'post') return POST_META[r.refId]?.preview ?? '';
    if (r.type === 'group') return 'group';
    if (r.type === 'forum') return 'forum';
    return 'person';
  };

  return (
    <>
      <div className="list">
        <div className="search">
          <input
            placeholder="Search groups, forums, posts, people"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="search-input"
          />
        </div>

        {q.trim() ? (
          <div className="rows" data-testid="search-results">
            {results.length === 0 && <div className="empty" style={{ padding: 24 }}>No results for “{q}”</div>}
            {results.map((r: any) => (
              <div key={r.id} className="row" data-result-type={r.type}>
                <div className="avatar" style={{ background: '#33414d' }}>{TYPE_ICON[r.type] ?? '?'}</div>
                <div className="meta">
                  <div className="top">
                    <span className="name">{r.title}</span>
                    <span className="time" style={{ textTransform: 'capitalize' }}>{r.type}</span>
                  </div>
                  <div className="preview">{resultSubtitle(r)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
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
        )}
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
