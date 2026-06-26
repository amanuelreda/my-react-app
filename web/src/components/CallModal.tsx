// Call screen with real local media (WebRTC-ready). Apache-2.0
//
// Captures the local camera/mic via getUserMedia and shows a live preview; mute and camera buttons
// toggle the real MediaStream tracks. Peer-to-peer audio/video uses RTCPeerConnection with
// decentralized signaling over the relay (SPEC §4.4) — this wires the local-media half and the call
// surface. Falls back to a simulated view when no device/permission is available (e.g. some CI).
import { useEffect, useRef, useState } from 'react';
import { initials, type Contact } from '../data';

export function CallModal({ contact, video, onEnd }: { contact: Contact; video: boolean; onEnd: () => void }) {
  const [secs, setSecs] = useState(0);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cam, setCam] = useState(video);
  const [hasMedia, setHasMedia] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Acquire local media once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setHasMedia(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        setHasMedia(false); // no device/permission — keep the simulated UI
      }
    })();
    const t = setTimeout(() => setConnected(true), 1000); // ring → connect (signaling stand-in)
    return () => {
      cancelled = true;
      clearTimeout(t);
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, [video]);

  useEffect(() => {
    if (!connected) return;
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [connected]);

  // Mute / camera toggle the real tracks.
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
  };
  const toggleCam = () => {
    const next = !cam;
    setCam(next);
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
  };

  const mmss = `${Math.floor(secs / 60)}:${(secs % 60).toString().padStart(2, '0')}`;
  const showVideo = hasMedia && cam;

  return (
    <div
      data-testid="call-modal"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'radial-gradient(circle at 50% 30%, #1b2a3a, #0a0f14)', display: 'grid', placeItems: 'center', color: '#fff' }}
    >
      {/* live local preview (mirrored), shown for video calls with media */}
      <video
        ref={videoRef}
        data-testid="call-video"
        autoPlay
        playsInline
        muted
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', opacity: showVideo ? 0.5 : 0 }}
      />
      <div style={{ textAlign: 'center', position: 'relative' }}>
        {!showVideo && <div className="avatar" style={{ width: 120, height: 120, fontSize: 42, background: contact.color, margin: '0 auto 16px' }}>{initials(contact.name)}</div>}
        <div style={{ fontSize: 24, fontWeight: 600 }}>{contact.name}</div>
        <div data-testid="call-status" style={{ color: '#9fb3c8', marginTop: 6 }}>
          {connected ? `🔒 ${cam ? 'Video' : 'Voice'} call · ${mmss}` : `Calling${cam ? ' (video)' : ''}…`}
          {hasMedia ? ' · 🎙️ live' : ''}
        </div>

        <div style={{ display: 'flex', gap: 18, justifyContent: 'center', marginTop: 40 }}>
          <CallBtn testid="call-mute" active={muted} onClick={toggleMute}>{muted ? '🔇' : '🎙️'}</CallBtn>
          <CallBtn testid="call-cam" active={cam} onClick={toggleCam}>{cam ? '🎥' : '📷'}</CallBtn>
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
      aria-pressed={active}
      onClick={onClick}
      style={{ width: 60, height: 60, borderRadius: '50%', fontSize: 24, background: danger ? 'var(--tg-danger)' : active ? 'var(--tg-accent)' : 'rgba(255,255,255,.14)', color: '#fff' }}
    >
      {children}
    </button>
  );
}
