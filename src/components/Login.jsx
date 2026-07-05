/* Login — role-based sign-in gate for Karya Vaani.
   Three demo roles: HR / Site Manager (full app), Contractor (their firm home),
   Worker / Labourer (their personal home). On success the authenticated user is
   handed up to App, which routes each role to the right surface. */
import { useState } from 'react';

const DEMO = [
  { username: 'hr',         password: 'hr@daikin',         label: 'HR / Site Manager', sub: 'Full compliance workspace', accent: 'var(--indigo)' },
  { username: 'contractor', password: 'contractor@daikin', label: 'Contractor / Vendor', sub: 'Your firm’s compliance home', accent: 'var(--amber-dk)' },
  { username: 'worker',     password: 'worker@daikin',     label: 'Worker / Labourer', sub: 'Your personal worker home', accent: 'var(--green-dk)' },
];

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(u, p) {
    const un = (u != null ? u : username).trim();
    const pw = (p != null ? p : password);
    if (!un || !pw) { setErr('Enter your username and password.'); return; }
    setBusy(true); setErr('');
    try {
      const base = window.__KV_API_BASE || '';
      const r = await fetch(base + '/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: un, password: pw }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok && j.user) { onLogin(j.user); return; }
      setErr(j.error || 'Sign-in failed. Please try again.');
    } catch (e) {
      setErr('Cannot reach the server. Check your connection.');
    } finally {
      setBusy(false);
    }
  }

  function quick(acc) {
    setUsername(acc.username); setPassword(acc.password);
    submit(acc.username, acc.password);
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-mark">Karya Vaani</span>
          <span className="login-tag">Workforce Compliance Assessment</span>
        </div>
        <div className="login-tenant">Daikin Sricity · AP</div>

        <form className="login-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label className="login-l">Username</label>
          <input className="input" autoFocus autoComplete="username" value={username}
            onChange={(e) => setUsername(e.target.value)} placeholder="e.g. hr" />
          <label className="login-l">Password</label>
          <input className="input" type="password" autoComplete="current-password" value={password}
            onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          {err ? <div className="login-err">{err}</div> : null}
          <button className="btn primary login-submit" type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="login-demo-h">Demo accounts · one click to enter</div>
        <div className="login-demo">
          {DEMO.map((a) => (
            <button key={a.username} className="login-demo-btn" onClick={() => quick(a)} disabled={busy}
              style={{ borderLeftColor: a.accent }}>
              <span className="login-demo-role">{a.label}</span>
              <span className="login-demo-sub">{a.sub}</span>
              <span className="login-demo-cred">{a.username} · {a.password}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
