// Contacts: searchable list → contact profile with Message / Call / Verify. Apache-2.0
import { useMemo, useState } from 'react';
import { CONTACTS, initials, type Contact } from '../data';
import { safetyNumber, deriveIdentityKey } from '@teleblock/shared';
import type { Identity } from '../engine/identity';

export function ContactsView({
  identity,
  onClose,
  onMessage,
  onCall,
}: {
  identity: Identity;
  onClose: () => void;
  onMessage: (c: Contact) => void;
  onCall: (c: Contact, video: boolean) => void;
}) {
  const [safety, setSafety] = useState<string | null>(null);
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [added, setAdded] = useState<Contact[]>([]);
  const [newId, setNewId] = useState('');
  const PAL = ['#e17076', '#6ec9cb', '#7bc862', '#a695e7', '#faa774', '#5eb5f7'];

  // Add a contact by Session ID ("05…") or wallet address — Session-style reachability without a
  // phone number.
  const addContact = () => {
    const id = newId.trim();
    const ok = /^05[0-9a-f]{64}$/i.test(id) || /^0x[0-9a-fA-F]{40}$/.test(id) || id.endsWith('.eth');
    if (!ok) return;
    const short = id.startsWith('05') ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
    setAdded((prev) => [{ id: `c-${id.slice(2, 10)}`, name: short, address: id, color: PAL[prev.length % PAL.length] }, ...prev]);
    setNewId('');
  };

  // Compute the safety number from my signing key + a key derived from the contact (demo: derived
  // from their address; in production it's their on-chain Ed25519 key). EXTRA SAFE / Signal-style.
  const showSafety = async (c: Contact) => {
    const theirs = await deriveIdentityKey(new TextEncoder().encode(c.address));
    setSafety(await safetyNumber(identity.signing.publicKey, theirs.publicKey));
  };
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Contact | null>(null);

  const filtered = useMemo(
    () => [...added, ...CONTACTS].filter((c) => (c.name + ' ' + c.address).toLowerCase().includes(q.toLowerCase())),
    [q, added],
  );

  if (selected) {
    const c = selected;
    return (
      <section className="convo" data-testid="contact-profile">
        <header className="header">
          <button data-testid="contact-back" aria-label="Back" onClick={() => setSelected(null)} style={{ fontSize: 20, color: 'var(--tg-text-secondary)', marginRight: 4 }}>◀</button>
          <div className="title">Contact info</div>
        </header>
        <div className="scroll" style={{ padding: 16, alignItems: 'center' }}>
          <div className="avatar" style={{ width: 96, height: 96, fontSize: 34, background: c.color, margin: '8px auto' }}>{initials(c.name)}</div>
          <div style={{ textAlign: 'center' }}>
            <div className="name" style={{ fontSize: 20 }}>{c.name}</div>
            <div className="preview">{c.online ? '🟢 online' : 'last seen recently'}</div>
            <div className="preview" style={{ fontFamily: 'ui-monospace, monospace', marginTop: 4 }} data-testid="contact-address">{c.address}</div>
            {c.bio && <div style={{ color: 'var(--tg-text-secondary)', marginTop: 8 }}>{c.bio}</div>}
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', margin: '18px 0' }}>
            <ActionBtn testid="profile-message" icon="💬" label="Message" onClick={() => onMessage(c)} />
            <ActionBtn testid="profile-call" icon="📞" label="Call" onClick={() => onCall(c, false)} />
            <ActionBtn testid="profile-video" icon="🎥" label="Video" onClick={() => onCall(c, true)} />
          </div>
          <div style={{ width: '100%', maxWidth: 360 }}>
            <div className="row" style={{ borderRadius: 10 }}>
              <div className="meta">
                <div className="name">🔒 Safety number</div>
                <div className="preview">{verified[c.id] ? '✅ verified' : 'verify to detect a MITM'}</div>
              </div>
              <button data-testid="verify-safety" onClick={() => showSafety(c)} style={{ color: 'var(--tg-accent)', fontWeight: 600, fontSize: 14, padding: '6px 10px' }}>Show</button>
            </div>
            {safety && (
              <div data-testid="safety-number" style={{ background: 'var(--tg-bg-panel)', borderRadius: 10, padding: 12, margin: '4px 0' }}>
                <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 15, letterSpacing: 1, textAlign: 'center' }}>{safety}</div>
                <div style={{ textAlign: 'center', marginTop: 8 }}>
                  <button data-testid="mark-verified" onClick={() => { setVerified((v) => ({ ...v, [c.id]: true })); setSafety(null); }} style={{ color: 'var(--tg-online)', fontWeight: 600 }}>Matches — mark verified</button>
                </div>
              </div>
            )}
            <Row label="🔔 Notifications" value="Enabled" />
            <Row label="🚫 Block contact" value="" danger />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="convo" data-testid="contacts">
      <header className="header">
        <div className="title">Contacts</div>
        <button data-testid="contacts-close" aria-label="Close" onClick={onClose} style={{ marginLeft: 'auto', fontSize: 18, color: 'var(--tg-text-secondary)' }}>✕</button>
      </header>
      <div className="search" style={{ padding: 12 }}>
        <input autoFocus data-testid="contacts-search" placeholder="Search contacts" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {/* Add a contact by Session ID / wallet address / ENS — Session-style, no phone number. */}
      <div style={{ display: 'flex', gap: 6, padding: '0 12px 10px' }}>
        <input
          data-testid="add-contact-input"
          placeholder="Add by Session ID (05…), 0x address, or name.eth"
          value={newId}
          onChange={(e) => setNewId(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addContact(); }}
          style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'var(--tg-bg-hover)', color: 'var(--tg-text)', fontSize: 13 }}
        />
        <button data-testid="add-contact-btn" onClick={addContact} disabled={!newId.trim()} style={{ color: 'var(--tg-accent)', fontWeight: 600, fontSize: 14, padding: '6px 12px' }}>＋ Add</button>
      </div>
      <div className="scroll" data-testid="contacts-list" style={{ padding: '0 6px' }}>
        {filtered.map((c) => (
          <div key={c.id} className="row" data-testid="contact-row" style={{ borderRadius: 10 }}>
            <div className="avatar" style={{ background: c.color }} onClick={() => setSelected(c)}>{initials(c.name)}</div>
            <div className="meta" onClick={() => setSelected(c)} style={{ cursor: 'pointer' }}>
              <div className="name">{c.name}</div>
              <div className="preview">{c.online ? 'online' : 'last seen recently'}</div>
            </div>
            <button data-testid="contact-message" title="Message" onClick={() => onMessage(c)} style={{ fontSize: 18, padding: '0 6px' }}>💬</button>
            <button data-testid="contact-call" title="Call" onClick={() => onCall(c, false)} style={{ fontSize: 18, padding: '0 6px' }}>📞</button>
          </div>
        ))}
        {filtered.length === 0 && <div className="empty" style={{ padding: 24 }}>No contacts found</div>}
      </div>
    </section>
  );
}

function ActionBtn({ icon, label, onClick, testid }: { icon: string; label: string; onClick: () => void; testid: string }) {
  return (
    <button data-testid={testid} onClick={onClick} style={{ display: 'grid', placeItems: 'center', gap: 4, padding: '10px 16px', borderRadius: 12, background: 'var(--tg-bg-hover)', color: 'var(--tg-accent)', minWidth: 76 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 12 }}>{label}</span>
    </button>
  );
}

function Row({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="row" style={{ borderRadius: 10 }}>
      <div className="meta">
        <div className="name" style={{ color: danger ? 'var(--tg-danger)' : 'var(--tg-text)' }}>{label}</div>
        {value && <div className="preview">{value}</div>}
      </div>
    </div>
  );
}
