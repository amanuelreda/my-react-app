// TeleBlock login gate — wallet / burner onboarding. Apache-2.0
import { useState } from 'react';
import { createBurnerIdentity, fingerprint, type Identity } from '../engine/identity';

export function LoginScreen({ onAuthed }: { onAuthed: (id: Identity) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await createBurnerIdentity();
      onAuthed(id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        background: 'radial-gradient(circle at 50% 30%, #18222d, var(--tg-bg))',
      }}
    >
      <div style={{ width: 360, textAlign: 'center', padding: 24 }}>
        <div style={{ fontSize: 56 }}>🔒</div>
        <h1 style={{ margin: '8px 0 4px', fontSize: 26 }}>TeleBlock</h1>
        <p style={{ color: 'var(--tg-text-secondary)', marginTop: 0 }}>
          Telegram's feel. Your keys. No middleman.
        </p>
        <div style={{ textAlign: 'left', fontSize: 14, color: 'var(--tg-text-secondary)', margin: '18px 0' }}>
          <div>· End-to-end encrypted by default</div>
          <div>· No phone number, no email</div>
          <div>· Your keys never leave this device</div>
        </div>
        <button
          onClick={start}
          disabled={busy}
          data-testid="create-identity"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            background: 'var(--tg-accent)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? 'Creating your keys…' : 'Create an identity'}
        </button>
        <button
          disabled
          title="Wallet login (WalletConnect / SIWE) — Phase 1 integration"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            marginTop: 10,
            background: 'var(--tg-bg-panel)',
            color: 'var(--tg-text-secondary)',
            fontSize: 15,
          }}
        >
          Connect a wallet (coming soon)
        </button>
        {error && <div style={{ color: 'var(--tg-danger)', marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  );
}

export { fingerprint };
