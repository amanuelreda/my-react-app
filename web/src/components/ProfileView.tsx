// Profile section. Apache-2.0
import { fingerprint } from './LoginScreen';
import type { Identity } from '../engine/identity';

export function ProfileView({ identity }: { identity: Identity }) {
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
        </div>
      </section>
    </>
  );
}
