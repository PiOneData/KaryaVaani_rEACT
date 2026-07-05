/* AccountModal — change password for the signed-in user (requires the current
   password). Opened from the TopBar. Self-contained React overlay. */
import { useState } from 'react';

export default function AccountModal({ user, onClose }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!cur || !next) { setErr('Enter your current and new password.'); return; }
    if (next.length < 6) { setErr('New password must be at least 6 characters.'); return; }
    if (next !== confirm) { setErr('New passwords do not match.'); return; }
    setBusy(true); setErr('');
    try {
      const base = window.__KV_API_BASE || '';
      const r = await fetch(base + '/api/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username, currentPassword: cur, newPassword: next }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) { setDone(true); }
      else { setErr(j.error || 'Could not change password.'); }
    } catch { setErr('Cannot reach the server. Check your connection.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="acct-overlay" onClick={onClose}>
      <div className="acct-modal" onClick={(e) => e.stopPropagation()}>
        <div className="acct-h">
          <div>
            <div className="acct-h-title">Change password</div>
            <div className="acct-h-sub">{user.name} · {user.username}</div>
          </div>
          <button className="acct-close" onClick={onClose}>✕</button>
        </div>

        {done ? (
          <div className="acct-body">
            <div className="login-notice">Password updated successfully.</div>
            <button className="btn primary login-submit" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form className="acct-body login-form" onSubmit={submit}>
            <label className="login-l">Current password</label>
            <input className="input" type="password" autoFocus value={cur} onChange={(e) => setCur(e.target.value)} />
            <label className="login-l">New password</label>
            <input className="input" type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="at least 6 characters" />
            <label className="login-l">Confirm new password</label>
            <input className="input" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {err ? <div className="login-err">{err}</div> : null}
            <div className="acct-actions">
              <button className="btn" type="button" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
