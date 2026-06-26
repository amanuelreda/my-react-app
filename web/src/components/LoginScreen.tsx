// TeleBlock login gate — wallet / burner onboarding. Apache-2.0
import { useEffect, useState } from 'react';
import { createBurnerIdentity, fingerprint, type Identity } from '../engine/identity';
import { connectWallet, walletSignIn } from '../engine/wallet';

export function LoginScreen({ onAuthed }: { onAuthed: (id: Identity) => void }) {
  const [busy, setBusy] = useState<null | 'burner' | 'wallet'>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasWallet, setHasWallet] = useState(false);

  useEffect(() => {
    setHasWallet(typeof window !== 'undefined' && (!!window.ethereum || !!window.__TB_TEST_PK__));
  }, []);

  const start = async () => {
    setBusy('burner');
    setError(null);
    try {
      const id = await createBurnerIdentity();
      onAuthed(id);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
    }
  };

  const startWallet = async () => {
    setBusy('wallet');
    setError(null);
    try {
      const connector = await connectWallet();
      const session = await walletSignIn(connector);
      onAuthed(session.identity);
    } catch (e) {
      setError((e as Error).message);
      setBusy(null);
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
          onClick={startWallet}
          disabled={!!busy || !hasWallet}
          data-testid="connect-wallet"
          title={hasWallet ? 'Sign in with your wallet (SIWE)' : 'No wallet detected'}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            background: 'var(--tg-accent)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            opacity: busy === 'wallet' ? 0.6 : !hasWallet ? 0.45 : 1,
          }}
        >
          {busy === 'wallet' ? 'Check your wallet…' : 'Connect a wallet'}
        </button>
        <button
          onClick={start}
          disabled={!!busy}
          data-testid="create-identity"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            marginTop: 10,
            background: 'var(--tg-bg-panel)',
            color: 'var(--tg-text)',
            fontSize: 15,
            opacity: busy === 'burner' ? 0.6 : 1,
          }}
        >
          {busy === 'burner' ? 'Creating your keys…' : 'Create an identity (no wallet)'}
        </button>
        {error && <div style={{ color: 'var(--tg-danger)', marginTop: 12 }}>{error}</div>}
      </div>
    </div>
  );
}

export { fingerprint };
