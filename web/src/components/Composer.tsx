// TeleBlock composer — text, encrypted media attach, and self-destruct timer. Apache-2.0
import { useRef, useState } from 'react';

const TTL_OPTIONS = [
  { label: 'off', secs: 0 },
  { label: '5s', secs: 5 },
  { label: '1m', secs: 60 },
];

export function Composer({
  onSend,
  onSendFile,
  onVoice,
  onPoll,
  replyTo,
  onCancelReply,
}: {
  onSend: (text: string, ttl: number) => void;
  onSendFile: (file: File, ttl: number) => void;
  onVoice?: (ttl: number) => void;
  onPoll?: () => void;
  replyTo?: { author: string; preview: string } | null;
  onCancelReply?: () => void;
}) {
  const [text, setText] = useState('');
  const [ttlIdx, setTtlIdx] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const ttl = TTL_OPTIONS[ttlIdx].secs;

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t, ttl);
    setText('');
  };

  return (
    <div>
    {replyTo && (
      <div
        data-testid="reply-preview"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          background: 'var(--tg-bg-panel)',
          borderTop: '1px solid var(--tg-divider)',
          borderLeft: '3px solid var(--tg-accent)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: 'var(--tg-accent)', fontWeight: 600, fontSize: 13 }}>Reply to {replyTo.author}</div>
          <div style={{ color: 'var(--tg-text-secondary)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {replyTo.preview}
          </div>
        </div>
        <button data-testid="cancel-reply" onClick={onCancelReply} style={{ color: 'var(--tg-hint)', fontSize: 18, padding: '0 4px' }}>
          ✕
        </button>
      </div>
    )}
    <div className="composer">
      <button
        className="send"
        style={{ background: ttl > 0 ? 'var(--tg-danger)' : 'var(--tg-bg-hover)' }}
        title="Self-destruct timer"
        data-testid="ttl-toggle"
        onClick={() => setTtlIdx((i) => (i + 1) % TTL_OPTIONS.length)}
      >
        {ttl > 0 ? `🔥${TTL_OPTIONS[ttlIdx].label}` : '🔥'}
      </button>

      <button
        className="send"
        style={{ background: 'var(--tg-bg-hover)' }}
        title="Attach an image (encrypted, stored on IPFS)"
        data-testid="attach"
        onClick={() => fileRef.current?.click()}
      >
        📎
      </button>
      <button
        className="send"
        style={{ background: 'var(--tg-bg-hover)' }}
        title="Create a poll"
        data-testid="poll-btn"
        onClick={() => onPoll?.()}
      >
        📊
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        data-testid="file-input"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onSendFile(f, ttl);
          e.target.value = '';
        }}
      />

      <input
        placeholder="Message"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      {text.trim() ? (
        <button className="send" onClick={submit} aria-label="Send">
          ➤
        </button>
      ) : (
        <button className="send" data-testid="voice" title="Record a voice message" onClick={() => onVoice?.(ttl)} aria-label="Record voice message">
          🎤
        </button>
      )}
    </div>
    </div>
  );
}
