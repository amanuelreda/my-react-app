// Right-click / long-press context menu. Apache-2.0
import { useEffect } from 'react';

export interface MenuItem {
  icon?: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
}

export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Keep the menu on-screen.
  const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 1280) - 210);
  const top = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 800) - (items.length * 40 + 16));

  return (
    <>
      <div data-testid="menu-backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 150 }} />
      <div
        data-testid="context-menu"
        style={{ position: 'fixed', left, top, zIndex: 151, background: 'var(--tg-bg-panel)', border: '1px solid var(--tg-divider)', borderRadius: 10, padding: 6, minWidth: 190, boxShadow: '0 8px 28px rgba(0,0,0,.45)' }}
      >
        {items.map((it, i) => (
          <button
            key={i}
            data-testid="menu-item"
            onClick={() => { it.onClick(); onClose(); }}
            style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '9px 12px', borderRadius: 6, fontSize: 15, color: it.danger ? 'var(--tg-danger)' : 'var(--tg-text)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--tg-bg-hover)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ width: 18 }}>{it.icon}</span>
            <span>{it.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}
