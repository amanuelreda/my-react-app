// Forums section — threads ranked by reputation-weighted score, from the indexer. Apache-2.0
import { useMemo, useState } from 'react';
import { initials } from '../data';
import { FORUM_META, POST_META, USER_NAME, govLabel } from '../engine/indexerData';

/* eslint-disable @typescript-eslint/no-explicit-any */
export function ForumsView({ store }: { store: any }) {
  const forums = useMemo(
    () => [...store.forums.values()].map((f: any) => ({ id: f.id, gov: f.gov, visibility: f.visibility })),
    [store],
  );
  const [forumId, setForumId] = useState<string>(forums[0]?.id ?? '');
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [threadId, setThreadId] = useState<string | null>(null);

  const threads = useMemo(
    () => (forumId ? store.forumThreads(forumId, { sort }) : []),
    [store, forumId, sort],
  );
  const replies = useMemo(() => (threadId ? store.replies(threadId) : []), [store, threadId]);
  const fmeta = (id: string) => FORUM_META[id] ?? { name: `Forum ${id}`, color: '#5eb5f7' };
  const pmeta = (id: string) => POST_META[id] ?? { title: `Post ${id}`, preview: '' };

  return (
    <>
      <div className="list">
        <div className="search" style={{ color: 'var(--tg-text-secondary)', fontSize: 13, padding: 14 }}>
          Forums
        </div>
        <div className="rows" data-testid="forums-list">
          {forums.map((f: any) => (
            <div
              key={f.id}
              className={`row ${f.id === forumId ? 'active' : ''}`}
              onClick={() => {
                setForumId(f.id);
                setThreadId(null);
              }}
            >
              <div className="avatar" style={{ background: fmeta(f.id).color }}>{initials(fmeta(f.id).name)}</div>
              <div className="meta">
                <div className="top">
                  <span className="name">{fmeta(f.id).name}</span>
                  <span className="time">{govLabel(f.gov)}</span>
                </div>
                <div className="preview">{store.forumThreads(f.id).length} threads</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <section className="convo">
        <header className="header">
          <div className="title">{forumId ? fmeta(forumId).name : 'Forums'}</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {(['top', 'new'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                data-testid={`sort-${s}`}
                style={{
                  padding: '4px 10px',
                  borderRadius: 14,
                  fontSize: 13,
                  background: sort === s ? 'var(--tg-bg-active)' : 'var(--tg-bg-hover)',
                  color: '#fff',
                }}
              >
                {s === 'top' ? 'Hot' : 'New'}
              </button>
            ))}
          </div>
        </header>

        <div className="scroll" data-testid="threads" style={{ padding: 10 }}>
          {threads.map((t: any) => (
            <div
              key={t.id}
              className="row"
              data-testid="thread"
              data-score={t.score}
              style={{ borderRadius: 10, alignItems: 'flex-start' }}
              onClick={() => setThreadId(threadId === t.id ? null : t.id)}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 34 }}>
                <span style={{ fontSize: 13 }}>▲</span>
                <span style={{ fontWeight: 700, fontSize: 15 }} data-testid="thread-score">{t.score}</span>
              </div>
              <div className="meta">
                <div className="top">
                  <span className="name">
                    {t.status === 'pinned' ? '📌 ' : ''}
                    {pmeta(t.id).title}
                  </span>
                </div>
                <div className="preview">
                  {pmeta(t.id).preview} · {USER_NAME[t.author] ?? t.author} · {store.replies(t.id).length} replies
                </div>
                {threadId === t.id && (
                  <div data-testid="replies" style={{ marginTop: 8, borderLeft: '2px solid var(--tg-divider)', paddingLeft: 10 }}>
                    {replies.map((r: any) => (
                      <div key={r.id} style={{ padding: '4px 0', fontSize: 14 }}>
                        <span style={{ color: 'var(--tg-text-secondary)' }}>{USER_NAME[r.author] ?? r.author}: </span>
                        {pmeta(r.id).preview || pmeta(r.id).title}
                      </div>
                    ))}
                    {replies.length === 0 && <div style={{ color: 'var(--tg-hint)', fontSize: 13 }}>No replies yet</div>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
