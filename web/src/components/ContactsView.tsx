// Contacts: searchable list → contact profile with Message / Call. Apache-2.0
import { useMemo, useState } from 'react';
import { CONTACTS, initials, type Contact } from '../data';

export function ContactsView({
  onClose,
  onMessage,
  onCall,
}: {
  onClose: () => void;
  onMessage: (c: Contact) => void;
  onCall: (c: Contact, video: boolean) => void;
}) {
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Contact | null>(null);

  const filtered = useMemo(
    () => CONTACTS.filter((c) => (c.name + ' ' + c.address).toLowerCase().includes(q.toLowerCase())),
    [q],
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
            <Row label="🔒 Encryption" value="end-to-end (verify safety number)" />
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
