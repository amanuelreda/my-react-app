// Call screen (WebRTC-ready scaffold). Apache-2.0
//
// A full-screen call UI with mute / camera / end controls. Real audio/video uses WebRTC with
// decentralized signaling over the relay (SPEC §4.4, future); this is the call surface + state.
import { useEffect, useState } from 'react';
import { initials, type Contact } from '../data';

export function CallModal({ contact, video, onEnd }: { contact: Contact; video: boolean; onEnd: () => void }) {
  const [secs, setSecs] = useState(0);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cam, setCam] = useState(video);

  useEffect(() => {
    const t = setTimeout(() => setConnected(true), 1200); // simulate ring → connect
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [connected]);

  const mmss = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;

  return (
    <div
      data-testid="call-modal"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'radial-gradient(circle at 50% 30%, #1b2a3a, #0a0f14)', display: 'grid', placeItems: 'center', color: '#fff' }}
    >
      <div style={{ textAlign: 'center' }}>
        <div className="avatar" style={{ width: 120, height: 120, fontSize: 42, background: contact.color, margin: '0 auto 16px' }}>{initials(contact.name)}</div>
        <div style={{ fontSize: 24, fontWeight: 600 }}>{contact.name}</div>
        <div data-testid="call-status" style={{ color: '#9fb3c8', marginTop: 6 }}>
          {connected ? `🔒 ${cam ? 'Video' : 'Voice'} call · ${mmss}` : `Calling${cam ? ' (video)' : ''}…`}
        </div>

        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 40 }}>
          <CallBtn testid="call-mute" active={muted} onClick={() => setMuted((m) => !m)}>{muted ? '🔇' : '🎙️'}</CallBtn>
          <CallBtn testid="call-cam" active={cam} onClick={() => setCam((c) => !c)}>{cam ? '🎥' : '📷'}</CallBtn>
          <CallBtn testid="call-end" danger onClick={onEnd}>📵</CallBtn>
        </div>
      </div>
    </div>
  );
}

function CallBtn({ children, onClick, danger, active, testid }: { children: React.ReactNode; onClick: () => void; danger?: boolean; active?: boolean; testid: string }) {
  return (
    <button
      data-testid={testid}
      onClick={onClick}
      style={{ width: 60, height: 60, borderRadius: '50%', fontSize: 24, background: danger ? 'var(--tg-danger)' : active ? 'var(--tg-accent)' : 'rgba(255,255,255,.14)', color: '#fff' }}
    >
      {children}
    </button>
  );
}
