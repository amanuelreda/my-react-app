// Forums section — interactive: reputation-weighted voting + new threads, applied to the in-browser
// indexer (live re-ranking) and encoded as on-chain ForumManager calldata. Apache-2.0
import { useMemo, useState } from 'react';
import { initials } from '../data';
import { FORUM_META, POST_META, DYNAMIC_POST_META, USER_NAME, govLabel } from '../engine/indexerData';
import type { Identity } from '../engine/identity';
import { encodeVoteCall, encodeCreatePostCall, encodeModerateCall } from '@teleblock/shared';

const STATUS = { active: 0, hidden: 1, locked: 2, pinned: 3 } as const;

/* eslint-disable @typescript-eslint/no-explicit-any */
const B32 = (s: string) => ('0x' + s.replace(/[^0-9a-f]/gi, '').padEnd(64, '0').slice(0, 64)) as `0x${string}`;

export function ForumsView({ store, identity }: { store: any; identity: Identity }) {
  const me = identity.address.toLowerCase();
  const [version, setVersion] = useState(0);
  const bump = () => setVersion((v) => v + 1);
  const [forumId, setForumId] = useState<string>([...store.forums.values()][0]?.id ?? '');
  const [sort, setSort] = useState<'top' | 'new'>('top');
  const [threadId, setThreadId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyDraft, setReplyDraft] = useState('');
  const [extraMeta, setExtraMeta] = useState<Record<string, { title: string; preview: string }>>({});
  const [lastTx, setLastTx] = useState<string>('');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const COLLAPSE_BELOW = 0; // reputation-gated visibility: negative-score posts start collapsed
  const reveal = (id: string) => setRevealed((s) => new Set(s).add(id));

  const forums = useMemo(
    () => [...store.forums.values()].map((f: any) => ({ id: f.id, gov: f.gov })),
    [store],
  );
  const threads = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => (forumId ? store.forumThreads(forumId, { sort }) : []),
    [store, forumId, sort, version],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const replies = useMemo(() => (threadId ? store.replies(threadId) : []), [store, threadId, version]);
  const fmeta = (id: string) => FORUM_META[id] ?? { name: `Forum ${id}`, color: '#5eb5f7' };
  const pmeta = (id: string) => extraMeta[id] ?? DYNAMIC_POST_META[id] ?? POST_META[id] ?? { title: `Post ${id}`, preview: '' };

  const myVote = (postId: string): number => store.posts.get(postId)?.votes?.get(me) ?? 0;

  const weight = () => Math.max(1, Math.floor(Math.sqrt(store.reputationOf(me))));

  const vote = (postId: string, dir: number) => {
    const cur = myVote(postId);
    const next = cur === dir ? 0 : dir; // toggle
    store.apply({ name: 'Voted', args: { postId, voter: me, dir: next, weight: weight() }, blockNumber: 1e9, logIndex: Date.now() });
    setLastTx(`vote(${postId}, ${next}) → ${encodeVoteCall(postId, next).slice(0, 18)}…`);
    bump();
  };

  // Moderation: pin/hide/lock a thread (owner/mod/DAO on-chain; here the demo user acts as a mod).
  const moderate = (postId: string, statusName: keyof typeof STATUS) => {
    const cur = store.posts.get(postId)?.status;
    const next = cur === statusName ? 'active' : statusName; // toggle back to active
    store.apply({ name: 'Moderated', args: { postId, newStatus: STATUS[next as keyof typeof STATUS] }, blockNumber: 1e9, logIndex: Date.now() });
    setLastTx(`moderate(${postId}, ${STATUS[next as keyof typeof STATUS]}) → ${encodeModerateCall(postId, STATUS[next as keyof typeof STATUS], B32(postId)).slice(0, 18)}…`);
    bump();
  };

  const nextPostId = () => String(Math.max(0, ...[...store.posts.keys()].map(Number)) + 1);

  const postThread = () => {
    const title = draft.trim();
    if (!title || !forumId) return;
    const id = nextPostId();
    const cid = B32(id + forumId);
    store.apply({ name: 'PostCreated', args: { postId: id, forumId, parentId: '0', author: me, contentCID: cid }, blockNumber: 1e9, logIndex: Date.now() });
    setExtraMeta((m) => ({ ...m, [id]: { title, preview: 'posted just now' } }));
    setLastTx(`createPost(${forumId}, 0) → ${encodeCreatePostCall(forumId, 0, cid, cid).slice(0, 18)}…`);
    setDraft('');
    bump();
  };

  const postReply = (parentId: string) => {
    const body = replyDraft.trim();
    if (!body || !forumId) return;
    const id = nextPostId();
    const cid = B32(id + parentId);
    store.apply({ name: 'PostCreated', args: { postId: id, forumId, parentId, author: me, contentCID: cid }, blockNumber: 1e9, logIndex: Date.now() });
    setExtraMeta((m) => ({ ...m, [id]: { title: body, preview: body } }));
    setLastTx(`createPost(${forumId}, ${parentId}) → ${encodeCreatePostCall(forumId, parentId, cid, cid).slice(0, 18)}…`);
    setReplyDraft('');
    bump();
  };

  return (
    <>
      <div className="list">
        <div className="search" style={{ color: 'var(--tg-text-secondary)', fontSize: 13, padding: 14 }}>Forums</div>
        <div className="rows" data-testid="forums-list">
          {forums.map((f: any) => (
            <div key={f.id} className={`row ${f.id === forumId ? 'active' : ''}`} onClick={() => { setForumId(f.id); setThreadId(null); }}>
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
          {lastTx && <div className="sub" data-testid="last-tx" style={{ marginLeft: 10, fontFamily: 'ui-monospace, monospace', fontSize: 11 }}>{lastTx}</div>}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {(['top', 'new'] as const).map((s) => (
              <button key={s} onClick={() => setSort(s)} data-testid={`sort-${s}`} style={{ padding: '4px 10px', borderRadius: 14, fontSize: 13, background: sort === s ? 'var(--tg-bg-active)' : 'var(--tg-bg-hover)', color: '#fff' }}>
                {s === 'top' ? 'Hot' : 'New'}
              </button>
            ))}
          </div>
        </header>

        <div className="composer" style={{ borderTop: 'none', borderBottom: '1px solid var(--tg-divider)' }}>
          <input placeholder="Start a new thread…" value={draft} data-testid="new-thread-input" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') postThread(); }} />
          <button className="send" onClick={postThread} disabled={!draft.trim()} data-testid="post-thread">＋</button>
        </div>

        <div className="scroll" data-testid="threads" style={{ padding: 10 }}>
          {threads.map((t: any) => {
            const collapsed = t.score < COLLAPSE_BELOW && !revealed.has(t.id);
            return (
            <div key={t.id} className="row" data-testid="thread" data-score={t.score} style={{ borderRadius: 10, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 36 }}>
                <button data-testid="upvote" onClick={() => vote(t.id, 1)} style={{ color: myVote(t.id) === 1 ? 'var(--tg-online)' : 'var(--tg-hint)', fontSize: 14 }}>▲</button>
                <span style={{ fontWeight: 700, fontSize: 15 }} data-testid="thread-score">{t.score}</span>
                <button data-testid="downvote" onClick={() => vote(t.id, -1)} style={{ color: myVote(t.id) === -1 ? 'var(--tg-danger)' : 'var(--tg-hint)', fontSize: 14 }}>▼</button>
              </div>
              {collapsed ? (
                <div className="meta" data-testid="collapsed">
                  <div className="preview" style={{ fontStyle: 'italic' }}>
                    Low-reputation post hidden (score {t.score}) ·{' '}
                    <button data-testid="show-collapsed" onClick={() => reveal(t.id)} style={{ color: 'var(--tg-accent)' }}>show</button>
                  </div>
                </div>
              ) : (
              <div className="meta" onClick={() => setThreadId(threadId === t.id ? null : t.id)} style={{ cursor: 'pointer' }}>
                <div className="top">
                  <span className="name">{t.status === 'pinned' ? '📌 ' : ''}{t.status === 'locked' ? '🔒 ' : ''}{pmeta(t.id).title}</span>
                </div>
                <div className="preview">{pmeta(t.id).preview} · {USER_NAME[t.author] ?? t.author} · {store.replies(t.id).length} replies</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }} onClick={(e) => e.stopPropagation()}>
                  <button data-testid="mod-pin" onClick={() => moderate(t.id, 'pinned')} style={{ fontSize: 12, color: t.status === 'pinned' ? 'var(--tg-online)' : 'var(--tg-hint)' }}>{t.status === 'pinned' ? '📌 Unpin' : '📌 Pin'}</button>
                  <button data-testid="mod-lock" onClick={() => moderate(t.id, 'locked')} style={{ fontSize: 12, color: t.status === 'locked' ? 'var(--tg-read)' : 'var(--tg-hint)' }}>{t.status === 'locked' ? '🔓 Unlock' : '🔒 Lock'}</button>
                  <button data-testid="mod-hide" onClick={() => moderate(t.id, 'hidden')} style={{ fontSize: 12, color: 'var(--tg-hint)' }}>🚫 Hide</button>
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
                    {t.status === 'locked' ? (
                      <div data-testid="locked-note" style={{ color: 'var(--tg-hint)', fontSize: 13, marginTop: 6, fontStyle: 'italic' }}>🔒 Thread locked — replies are disabled</div>
                    ) : (
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        placeholder="Reply…"
                        value={replyDraft}
                        data-testid="reply-input"
                        onChange={(e) => setReplyDraft(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') postReply(t.id); }}
                        style={{ flex: 1, padding: '6px 10px', borderRadius: 14, border: 'none', background: 'var(--tg-bg)', color: 'var(--tg-text)', outline: 'none', fontSize: 13 }}
                      />
                      <button data-testid="post-reply" onClick={() => postReply(t.id)} disabled={!replyDraft.trim()} style={{ color: 'var(--tg-accent)', fontWeight: 600, fontSize: 13 }}>Reply</button>
                    </div>
                    )}
                  </div>
                )}
              </div>
              )}
            </div>
            );
          })}
        </div>
      </section>
    </>
  );
}
