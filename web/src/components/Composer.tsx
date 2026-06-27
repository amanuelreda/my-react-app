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
  onPay,
  replyTo,
  onCancelReply,
}: {
  onSend: (text: string, ttl: number) => void;
  onSendFile: (file: File, ttl: number) => void;
  onVoice?: (ttl: number) => void;
  onPoll?: () => void;
  onPay?: (asset: string, amount: string, memo: string) => void;
  replyTo?: { author: string; preview: string } | null;
  onCancelReply?: () => void;
}) {
  const [text, setText] = useState('');
  const [ttlIdx, setTtlIdx] = useState(0);
  const [pay, setPay] = useState<{ asset: string; amount: string; memo: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ttl = TTL_OPTIONS[ttlIdx].secs;

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t, ttl);
    setText('');
  };

  const submitPay = () => {
    if (pay && Number(pay.amount) > 0) {
      onPay?.(pay.asset, pay.amount, pay.memo);
      setPay(null);
    }
  };

  return (
    <div>
    {pay && (
      <div data-testid="pay-panel" style={{ display: 'flex', gap: 8, padding: '8px 12px', background: 'var(--tg-bg-panel)', borderTop: '1px solid var(--tg-divider)', alignItems: 'center' }}>
        <span style={{ fontSize: 18 }}>💸</span>
        <select data-testid="pay-asset" value={pay.asset} onChange={(e) => setPay({ ...pay, asset: e.target.value })} style={{ background: 'var(--tg-bg)', color: 'var(--tg-text)', border: 'none', borderRadius: 8, padding: '6px' }}>
          {['ETH', 'USDC', 'DAI'].map((a) => <option key={a}>{a}</option>)}
        </select>
        <input data-testid="pay-amount" type="number" min="0" step="any" placeholder="0.00" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} style={{ width: 90, padding: '6px 8px', borderRadius: 8, border: 'none', background: 'var(--tg-bg)', color: 'var(--tg-text)' }} />
        <input data-testid="pay-memo" placeholder="memo" value={pay.memo} onChange={(e) => setPay({ ...pay, memo: e.target.value })} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: 'none', background: 'var(--tg-bg)', color: 'var(--tg-text)' }} />
        <button data-testid="pay-send" onClick={submitPay} disabled={!(Number(pay.amount) > 0)} style={{ color: 'var(--tg-accent)', fontWeight: 600 }}>Send</button>
        <button data-testid="pay-cancel" onClick={() => setPay(null)} style={{ color: 'var(--tg-hint)' }}>✕</button>
      </div>
    )}
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
      <button
        className="send"
        style={{ background: 'var(--tg-bg-hover)' }}
        title="Send crypto"
        data-testid="pay-btn"
        onClick={() => setPay((p) => (p ? null : { asset: 'ETH', amount: '', memo: '' }))}
      >
        💸
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
