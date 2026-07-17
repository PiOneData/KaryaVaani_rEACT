/* TopBar — converted 1:1 from karya-vaani_v3.html, plus the signed-in user
   chip, change-password and logout for the role-based session. */
import { useState, useEffect } from 'react';
import AccountModal from './AccountModal.jsx';

function initials(name) {
  return String(name || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

/* Notification centre — reads the shared window.__KVNOTIFY feed the legacy
   layer pushes to (via kvNotify) and re-renders on the 'kv-notify' event. */
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(() => (typeof window !== 'undefined' && window.__KVNOTIFY) || []);
  useEffect(() => {
    const sync = () => setItems(((typeof window !== 'undefined' && window.__KVNOTIFY) || []).slice());
    window.addEventListener('kv-notify', sync);
    return () => window.removeEventListener('kv-notify', sync);
  }, []);
  const unread = items.filter((n) => !n.read).length;
  const markAllRead = () => {
    (window.__KVNOTIFY || []).forEach((n) => { n.read = true; });
    setItems((window.__KVNOTIFY || []).slice());
  };
  const fmt = (iso) => { try { return new Date(iso).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
  return (
    <div style={{ position: 'relative' }}>
      <button className="tb-action" title="Notifications" onClick={() => { setOpen((o) => !o); if (!open) markAllRead(); }}
        style={{ position: 'relative', cursor: 'pointer', border: 'none', background: 'transparent', fontSize: '1.05rem' }}>
        🔔
        {unread > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8,
            background: '#dc2626', color: '#fff', fontSize: '0.62rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread}</span>
        )}
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{ position: 'absolute', top: '130%', right: 0, width: 340, maxHeight: 420, overflowY: 'auto', zIndex: 50,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 12px 40px rgba(15,23,42,0.18)' }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid #eef2f7', fontWeight: 700, fontSize: '0.85rem', color: '#0f172a' }}>Notifications</div>
            {items.length === 0 ? (
              <div style={{ padding: '18px 14px', color: '#64748b', fontSize: '0.82rem' }}>No notifications yet.</div>
            ) : items.map((n) => (
              <div key={n.id} style={{ padding: '11px 14px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: 10 }}>
                <span style={{ flex: '0 0 auto', width: 8, height: 8, borderRadius: '50%', marginTop: 5,
                  background: n.kind === 'success' ? '#16a34a' : n.kind === 'warn' ? '#d97706' : '#2563eb' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#0f172a' }}>{n.title}</div>
                  {n.body && <div style={{ fontSize: '0.76rem', color: '#475569', marginTop: 2 }}>{n.body}</div>}
                  <div style={{ fontSize: '0.68rem', color: '#94a3b8', marginTop: 3 }}>{fmt(n.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function TopBar({ user, onLogout }) {
  const [showAccount, setShowAccount] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const name = (user && user.name) || 'Priya Menon';
  const title = (user && user.title) || 'CHRO';
  return (
    <div className="topbar">
      <div className="tb-brand">
        <span className="tb-mark">Karya Vaani</span>
        {' '}
        <span className="tb-tag">Workforce Compliance Assessment</span>
      </div>
      {' '}
      <div className="tb-right">
        <a className="tb-walkthrough" href="https://walkthru.pionedata.com/" target="_blank" rel="noopener" title="Open the product walkthrough">
          <span className="tb-walkthrough-ico">▶</span>
          {' '}
          <span className="tb-walkthrough-l">
            <span className="tb-walkthrough-eye">DEMO</span>
            {' '}
            <span className="tb-walkthrough-name">Walkthrough</span>
          </span>
        </a>
        {' '}
        <div className="tb-customer">
          <span className="tb-customer-dot" />
          {' '}
          <span className="tb-customer-label">Tenant</span>
          {' '}
          <span className="tb-customer-name">Daikin Sricity · AP</span>
        </div>
        {' '}
        <div className="tb-action">日本語</div>
        {' '}
        <NotificationBell />
        {' '}
        <div className="tb-profile">
          <button className="tb-profile-btn" onClick={() => setMenuOpen((o) => !o)} title="Account" aria-haspopup="true" aria-expanded={menuOpen}>
            <span className="tb-user">{initials(name)}</span>
            <span className="tb-userinfo">
              <span className="tb-userinfo-name">{name}</span>
              <span className="tb-userinfo-title">{title}</span>
            </span>
            <span className="tb-profile-caret" style={{ transform: menuOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
          </button>
          {menuOpen ? (
            <>
              <div className="tb-profile-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="tb-profile-menu" role="menu">
                <div className="tb-profile-head">
                  <div className="tb-profile-head-name">{name}</div>
                  <div className="tb-profile-head-title">{title}</div>
                </div>
                <button className="tb-profile-item" role="menuitem" onClick={() => { setMenuOpen(false); setShowAccount(true); }}>
                  Change password
                </button>
                <button className="tb-profile-item danger" role="menuitem" onClick={() => { setMenuOpen(false); if (onLogout) onLogout(); }}>
                  Sign out
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
      {showAccount && user ? <AccountModal user={user} onClose={() => setShowAccount(false)} /> : null}
    </div>
  );
}
