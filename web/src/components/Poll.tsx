// TeleBlock poll bubble. Apache-2.0
export interface PollData {
  question: string;
  options: { text: string; votes: number }[];
  voted?: number;
}

export function Poll({ poll, onVote }: { poll: PollData; onVote: (i: number) => void }) {
  const total = poll.options.reduce((n, o) => n + o.votes, 0);
  return (
    <div data-testid="poll" style={{ minWidth: 220 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>📊 {poll.question}</div>
      {poll.options.map((o, i) => {
        const pct = total ? Math.round((o.votes / total) * 100) : 0;
        const mine = poll.voted === i;
        return (
          <button
            key={i}
            data-testid="poll-option"
            disabled={poll.voted != null}
            onClick={() => onVote(i)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              position: 'relative',
              padding: '6px 8px',
              margin: '3px 0',
              borderRadius: 8,
              background: 'rgba(255,255,255,.08)',
              color: 'inherit',
              overflow: 'hidden',
              cursor: poll.voted != null ? 'default' : 'pointer',
            }}
          >
            <span style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: mine ? 'rgba(94,181,247,.35)' : 'rgba(255,255,255,.10)' }} />
            <span style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
              <span>{mine ? '✓ ' : ''}{o.text}</span>
              {poll.voted != null && <span style={{ opacity: 0.8 }}>{pct}%</span>}
            </span>
          </button>
        );
      })}
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }} data-testid="poll-total">
        {total} vote{total === 1 ? '' : 's'}
      </div>
    </div>
  );
}
