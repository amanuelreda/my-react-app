// Profile + settings section. Apache-2.0
import { useState } from 'react';
import { fingerprint } from './LoginScreen';
import type { Identity } from '../engine/identity';
import type { Theme } from '../App';

const THEMES: { key: Theme; label: string }[] = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
  { key: 'amoled', label: 'AMOLED' },
];

export function ProfileView({
  identity,
  theme,
  setTheme,
}: {
  identity: Identity;
  theme: Theme;
  setTheme: (t: Theme) => void;
}) {
  const [readReceipts, setReadReceipts] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [network, setNetwork] = useState('base-sepolia');

  const exportData = () => {
    // Public, non-secret export. Private keys would go in a separately passphrase-encrypted archive.
    const data = {
      version: 1,
      exportedFrom: 'TeleBlock',
      address: identity.address,
      signingKeyFingerprint: fingerprint(identity.signing.publicKey),
      settings: { theme, network, readReceipts, showOnline },
      note: 'Private keys are NOT included here; export them via the encrypted key backup.',
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'teleblock-export.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const row = (label: string, value: string, testid?: string) => (
    <div className="row" style={{ borderRadius: 10 }}>
      <div className="meta">
        <div className="preview" style={{ textTransform: 'uppercase', fontSize: 11 }}>{label}</div>
        <div className="name" data-testid={testid} style={{ fontFamily: 'ui-monospace, monospace', wordBreak: 'break-all' }}>
          {value}
        </div>
      </div>
    </div>
  );

  const toggle = (label: string, on: boolean, set: (v: boolean) => void, testid: string) => (
    <div className="row" style={{ borderRadius: 10 }}>
      <div className="meta">
        <div className="name">{label}</div>
      </div>
      <button
        data-testid={testid}
        onClick={() => set(!on)}
        aria-pressed={on}
        style={{
          width: 44,
          height: 26,
          borderRadius: 13,
          background: on ? 'var(--tg-accent)' : 'var(--tg-bg-hover)',
          position: 'relative',
          transition: 'background .15s',
        }}
      >
        <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
      </button>
    </div>
  );

  return (
    <>
      <div className="list">
        <div className="search" style={{ color: 'var(--tg-text-secondary)', fontSize: 13, padding: 14 }}>
          Profile
        </div>
        <div className="rows">
          <div className="row active">
            <div className="avatar" style={{ background: 'var(--tg-accent)' }}>ME</div>
            <div className="meta">
              <div className="name">You</div>
              <div className="preview">{identity.address.slice(0, 10)}…</div>
            </div>
          </div>
        </div>
      </div>

      <section className="convo">
        <header className="header">
          <div className="avatar" style={{ width: 40, height: 40, background: 'var(--tg-accent)' }}>ME</div>
          <div>
            <div className="title">Your identity</div>
            <div className="sub">keys held on this device</div>
          </div>
        </header>
        <div className="scroll" style={{ padding: 12 }} data-testid="profile">
          {row('Wallet address', identity.address, 'profile-address')}
          {row('E2EE signing key (fingerprint)', fingerprint(identity.signing.publicKey))}
          {row('Status', '🔒 End-to-end encrypted · keys never leave this device')}

          <div style={{ padding: '14px 8px 6px', color: 'var(--tg-hint)', fontSize: 12, textTransform: 'uppercase' }}>Appearance</div>
          <div className="row" style={{ borderRadius: 10 }}>
            <div className="meta"><div className="name">Theme</div></div>
            <div style={{ display: 'flex', gap: 6 }}>
              {THEMES.map((t) => (
                <button
                  key={t.key}
                  data-testid={`theme-${t.key}`}
                  onClick={() => setTheme(t.key)}
                  style={{ padding: '6px 12px', borderRadius: 14, fontSize: 13, background: theme === t.key ? 'var(--tg-bg-active)' : 'var(--tg-bg-hover)', color: 'var(--tg-text)' }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: '14px 8px 6px', color: 'var(--tg-hint)', fontSize: 12, textTransform: 'uppercase' }}>Privacy</div>
          {toggle('Send read receipts', readReceipts, setReadReceipts, 'toggle-receipts')}
          {toggle('Show online status', showOnline, setShowOnline, 'toggle-online')}

          <div style={{ padding: '14px 8px 6px', color: 'var(--tg-hint)', fontSize: 12, textTransform: 'uppercase' }}>Network</div>
          <div className="row" style={{ borderRadius: 10 }}>
            <div className="meta"><div className="name">Blockchain network</div></div>
            <select
              data-testid="network-select"
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              style={{ background: 'var(--tg-bg-hover)', color: 'var(--tg-text)', border: 'none', borderRadius: 8, padding: '6px 10px', fontSize: 13 }}
            >
              <option value="base-sepolia">Base Sepolia (testnet)</option>
              <option value="base">Base</option>
              <option value="arbitrum">Arbitrum</option>
            </select>
          </div>

          <div style={{ padding: '14px 8px 6px', color: 'var(--tg-hint)', fontSize: 12, textTransform: 'uppercase' }}>Data</div>
          <div className="row" style={{ borderRadius: 10 }}>
            <div className="meta"><div className="name">Export my data</div><div className="preview">profile + settings (keys excluded)</div></div>
            <button data-testid="export-data" onClick={exportData} style={{ color: 'var(--tg-accent)', fontWeight: 600, fontSize: 14, padding: '6px 10px' }}>Export</button>
          </div>
        </div>
      </section>
    </>
  );
}
