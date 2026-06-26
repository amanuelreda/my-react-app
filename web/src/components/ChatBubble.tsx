// TeleBlock ChatBubble — Telegram-styled. Apache-2.0
import { useRef } from 'react';
import { Poll, type PollData } from './Poll';

export type Status = 'sent' | 'delivered' | 'read';

export interface Reaction {
  emoji: string;
  count: number;
}

export interface ChatBubbleProps {
  text: string;
  outgoing: boolean;
  time: string;
  status?: Status;
  reactions?: Reaction[];
  replyTo?: { author: string; preview: string };
  encrypted?: boolean;
  mediaUrl?: string;
  mediaMime?: string;
  ttl?: number;
  poll?: PollData;
  onPollVote?: (i: number) => void;
  onSwipeReply?: () => void;
  onReact?: () => void;
  onReply?: () => void;
  onCrosspost?: () => void;
  onPin?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

function Ticks({ status }: { status: Status }) {
  const read = status === 'read';
  return (
    <span
      aria-label={status}
      style={{ fontSize: 12, marginLeft: 4, color: read ? 'var(--tg-read)' : 'inherit', opacity: 0.9 }}
    >
      {status === 'sent' ? '✓' : '✓✓'}
    </span>
  );
}

export function ChatBubble({
  text,
  outgoing,
  time,
  status = 'read',
  reactions = [],
  replyTo,
  encrypted,
  mediaUrl,
  mediaMime,
  ttl,
  poll,
  onPollVote,
  onSwipeReply,
  onReact,
  onReply,
  onCrosspost,
  onPin,
  onContextMenu,
}: ChatBubbleProps) {
  const isVoice = !!mediaUrl && (mediaMime?.startsWith('audio/') ?? false);
  const startX = useRef(0);
  return (
    <div
      style={{ display: 'flex', padding: '1px 12px', margin: '1px 0', justifyContent: outgoing ? 'flex-end' : 'flex-start' }}
      onContextMenu={onContextMenu}
      onTouchStart={(e) => (startX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (e.changedTouches[0].clientX - startX.current > 56) (onReply ?? onSwipeReply)?.();
      }}
    >
      {onReply && (
        <button
          data-testid="reply-btn"
          title="Reply"
          onClick={onReply}
          style={{
            alignSelf: 'center',
            order: outgoing ? -1 : 1,
            opacity: 0.5,
            color: 'var(--tg-text-secondary)',
            padding: '0 6px',
            fontSize: 14,
          }}
        >
          ↩
        </button>
      )}
      {onCrosspost && text && (
        <button
          data-testid="crosspost-btn"
          title="Crystallize to a forum thread"
          onClick={onCrosspost}
          style={{ alignSelf: 'center', order: outgoing ? -1 : 1, opacity: 0.5, color: 'var(--tg-text-secondary)', padding: '0 4px', fontSize: 13 }}
        >
          🗂️
        </button>
      )}
      {onPin && (text || poll) && (
        <button
          data-testid="pin-btn"
          title="Pin this message"
          onClick={onPin}
          style={{ alignSelf: 'center', order: outgoing ? -1 : 1, opacity: 0.5, color: 'var(--tg-text-secondary)', padding: '0 4px', fontSize: 13 }}
        >
          📌
        </button>
      )}
      <div
        onDoubleClick={onReact}
        style={{
          maxWidth: '76%',
          padding: '6px 9px 5px',
          borderRadius: 14,
          borderBottomRightRadius: outgoing ? 4 : 14,
          borderBottomLeftRadius: outgoing ? 14 : 4,
          fontSize: 15,
          lineHeight: 1.3,
          wordBreak: 'break-word',
          background: outgoing ? 'var(--tg-bubble-out)' : 'var(--tg-bubble-in)',
          color: 'var(--tg-text)',
          boxShadow: '0 1px 1px rgba(0,0,0,.18)',
        }}
      >
        {replyTo && (
          <div
            style={{
              borderLeft: '2px solid var(--tg-accent)',
              padding: '2px 6px',
              marginBottom: 4,
              borderRadius: 4,
              background: 'rgba(255,255,255,.06)',
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--tg-accent)' }}>{replyTo.author}</div>
            <div style={{ opacity: 0.8 }}>{replyTo.preview}</div>
          </div>
        )}
        {mediaUrl && isVoice && (
          <div data-testid="voice-message" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 180 }}>
            <span style={{ fontSize: 18 }}>🎤</span>
            {/* Native controls keep this simple + accessible; a custom waveform can replace it. */}
            <audio data-testid="voice-audio" src={mediaUrl} controls style={{ height: 32, maxWidth: 200 }} />
          </div>
        )}
        {mediaUrl && !isVoice && (
          <img
            src={mediaUrl}
            alt={text || 'image'}
            data-testid="bubble-image"
            style={{ display: 'block', maxWidth: 240, maxHeight: 240, borderRadius: 10, marginBottom: text ? 4 : 0 }}
          />
        )}
        {poll && <Poll poll={poll} onVote={(i) => onPollVote?.(i)} />}
        {text && <span>{text}</span>}
        <span style={{ float: 'right', margin: '6px 0 0 8px', fontSize: 12, opacity: 0.75, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          {ttl ? <span title={`self-destructs in ${ttl}s`}>🔥</span> : null}
          {encrypted && <span title="End-to-end encrypted">🔒</span>}
          <span style={{ color: 'var(--tg-hint)' }}>{time}</span>
          {outgoing && <Ticks status={status} />}
        </span>
        {reactions.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {reactions.map((r) => (
              <span key={r.emoji} style={{ background: 'rgba(255,255,255,.12)', borderRadius: 10, padding: '1px 7px', fontSize: 13 }}>
                {r.emoji} {r.count}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
