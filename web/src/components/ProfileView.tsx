// Profile + settings section. Apache-2.0
import { useState } from 'react';
import { fingerprint } from './LoginScreen';
import type { Identity } from '../engine/identity';
import type { Theme } from '../App';
import { CONTRACTS, LIVE_MODE, NETWORKS } from '../config';
import { buildRegisterTx, sendRegister } from '../engine/registration';
import { encodeClaimUsernameCall } from '@teleblock/shared';

const THEMES: { key: Theme; label: string }[] = [
  { key: 'dark', label: 'Dark' },
  { key: 'light', label: 'Light' },
  { key: 'amoled', label: 'AMOLED' },
];

export function ProfileView({
  identity,
  theme,
  setTheme,
  onBack,
  accounts = [],
  activeIdx = 0,
  onSwitch,
  onAddAccount,
}: {
  identity: Identity;
  theme: Theme;
  setTheme: (t: Theme) => void;
  onBack?: () => void;
  accounts?: Identity[];
  activeIdx?: number;
  onSwitch?: (i: number) => void;
  onAddAccount?: () => void;
}) {
  const [readReceipts, setReadReceipts] = useState(true);
  const [showOnline, setShowOnline] = useState(true);
  const [network, setNetwork] = useState('base-sepolia');
  const [publishMsg, setPublishMsg] = useState<string>('');
  const [unameDraft, setUnameDraft] = useState('');
  const [username, setUsername] = useState<string | null>(null);

  const claimUsername = () => {
    const name = unameDraft.trim().replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
    if (!name) return;
    encodeClaimUsernameCall(name); // calldata for IdentityRegistry.claimUsername(keccak(name))
    setUsername(name);
    setUnameDraft('');
  };

  const publishOnChain = async () => {
    try {
      // In production the pre-key bundle is pinned to IPFS first; use a placeholder CID here.
      const tx = buildRegisterTx(identity, { contractAddress: CONTRACTS.identityRegistry as `0x${string}`, preKeyBundleCID: 'bafk-prekey', profileCID: '' });
      const hash = await sendRegister(tx);
      setPublishMsg(`Submitted: ${hash.slice(0, 14)}…`);
    } catch (e) {
      setPublishMsg((e as Error).message);
    }
  };

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
          <button className="mobile-only" data-testid="view-back" aria-label="Back" onClick={onBack} style={{ fontSize: 20, color: 'var(--tg-text-secondary)', marginRight: 4 }}>◀</button>
          <div className="avatar" style={{ width: 40, height: 40, background: 'var(--tg-accent)' }}>ME</div>
          <div>
            <div className="title">Your identity</div>
            <div className="sub">keys held on this device</div>
          </div>
        </header>
        <div className="scroll" style={{ padding: 12 }} data-testid="profile">
          {row('Wallet address', identity.address, 'profile-address')}
          <div className="row" style={{ borderRadius: 10 }}>
            <div className="meta">
              <div className="preview" style={{ textTransform: 'uppercase', fontSize: 11 }}>Username</div>
              {username ? (
                <div className="name" data-testid="username">@{username}</div>
              ) : (
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input data-testid="username-input" placeholder="claim a name" value={unameDraft} onChange={(e) => setUnameDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') claimUsername(); }} style={{ flex: 1, padding: '6px 8px', borderRadius: 8, border: 'none', background: 'var(--tg-bg-hover)', color: 'var(--tg-text)' }} />
                  <button data-testid="claim-username" onClick={claimUsername} disabled={!unameDraft.trim()} style={{ color: 'var(--tg-accent)', fontWeight: 600 }}>Claim</button>
                </div>
              )}
            </div>
          </div>
          {row('E2EE signing key (fingerprint)', fingerprint(identity.signing.publicKey))}
          {row('Status', '🔒 End-to-end encrypted · keys never leave this device')}

          <div style={{ padding: '14px 8px 6px', color: 'var(--tg-hint)', fontSize: 12, textTransform: 'uppercase' }}>Accounts</div>
          <div data-testid="accounts-list">
            {accounts.map((a, i) => (
              <div key={a.address} className="row" data-testid="account-row" style={{ borderRadius: 10, cursor: 'pointer' }} onClick={() => onSwitch?.(i)}>
                <div className="avatar" style={{ width: 36, height: 36, background: i === activeIdx ? 'var(--tg-accent)' : '#33414d' }}>{a.address.slice(2, 4).toUpperCase()}</div>
                <div className="meta">
                  <div className="name">{a.address.slice(0, 8)}…{a.address.slice(-4)}</div>
                  <div className="preview">{i === activeIdx ? '✓ active' : 'tap to switch'}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="row" style={{ borderRadius: 10 }}>
            <div className="meta"><div className="name" style={{ color: 'var(--tg-accent)' }}>＋ Add account</div></div>
            <button data-testid="add-account" onClick={onAddAccount} style={{ color: 'var(--tg-accent)', fontWeight: 600, fontSize: 14, padding: '6px 10px' }}>Add</button>
          </div>

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

          <div style={{ padding: '14px 8px 6px', color: 'var(--tg-hint)', fontSize: 12, textTransform: 'uppercase' }}>On-chain identity</div>
          <div className="row" style={{ borderRadius: 10 }}>
            <div className="meta">
              <div className="name">Publish to IdentityRegistry</div>
              <div className="preview" data-testid="onchain-status">
                {LIVE_MODE
                  ? `Registry ${(CONTRACTS.identityRegistry as string).slice(0, 10)}… on ${NETWORKS[network]?.name ?? network}`
                  : 'Demo mode — set VITE_IDENTITY_REGISTRY to publish on-chain (see docs/RUNBOOK.md)'}
                {publishMsg ? ` · ${publishMsg}` : ''}
              </div>
            </div>
            <button data-testid="publish-onchain" disabled={!LIVE_MODE} onClick={publishOnChain} style={{ color: LIVE_MODE ? 'var(--tg-accent)' : 'var(--tg-hint)', fontWeight: 600, fontSize: 14, padding: '6px 10px' }}>
              Publish
            </button>
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
