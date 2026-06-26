// TeleBlock chat list — Apache-2.0
import { useState } from 'react';
import { type Chat, initials, lastPreview } from '../data';

export function ChatList({
  chats,
  activeId,
  onSelect,
}: {
  chats: Chat[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [q, setQ] = useState('');
  const filtered = chats.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="list">
      <div className="search">
        <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="rows">
        {filtered.map((c) => {
          const last = c.messages[c.messages.length - 1];
          return (
            <div
              key={c.id}
              className={`row ${c.id === activeId ? 'active' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              <div className="avatar" style={{ background: c.color }}>
                {initials(c.name)}
              </div>
              <div className="meta">
                <div className="top">
                  <span className="name">
                    {c.name}
                    {c.kind === 'group' && c.members ? ` · ${c.members}` : ''}
                  </span>
                  <span className="time">{last ? last.time : ''}</span>
                </div>
                <div className="top">
                  <span className="preview">{lastPreview(c)}</span>
                  {c.unread ? <span className="badge">{c.unread}</span> : null}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="empty" style={{ padding: 24 }}>No chats found</div>}
      </div>
    </div>
  );
}
