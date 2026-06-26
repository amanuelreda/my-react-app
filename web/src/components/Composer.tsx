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
}: {
  onSend: (text: string, ttl: number) => void;
  onSendFile: (file: File, ttl: number) => void;
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
      <button className="send" onClick={submit} disabled={!text.trim()} aria-label="Send">
        ➤
      </button>
    </div>
  );
}
