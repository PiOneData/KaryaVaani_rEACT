/* Login — role-based sign-in gate for Karya Vaani, with a forgot/reset flow.
   Three demo roles: HR / Site Manager (full app), Contractor (their firm home),
   Worker / Labourer (their personal home). */
import { useState } from 'react';

const DEMO = [
  { username: 'hr',         password: 'hr@daikin',         label: 'HR / Site Manager', sub: 'Full compliance workspace', accent: 'var(--indigo)' },
  { username: 'contractor', password: 'contractor@daikin', label: 'Contractor / Vendor', sub: 'Your firm’s compliance home', accent: 'var(--amber-dk)' },
  { username: 'worker',     password: 'worker@daikin',     label: 'Worker / Labourer', sub: 'Your personal worker home', accent: 'var(--green-dk)' },
];

const api = () => (window.__KV_API_BASE || '');

export default function Login({ onLogin }) {
  const [mode, setMode] = useState('login'); // 'login' | 'forgot'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [notice, setNotice] = useState('');

  // forgot-flow state
  const [step, setStep] = useState('request'); // 'request' | 'reset'
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');

  function reset(toMode) {
    setErr(''); setNotice(''); setBusy(false);
    setCode(''); setNewPw(''); setStep('request');
    if (toMode) setMode(toMode);
  }

  async function post(path, body) {
    const r = await fetch(api() + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    return { r, j };
  }

  async function submit(u, p) {
    const un = (u != null ? u : username).trim();
    const pw = (p != null ? p : password);
    if (!un || !pw) { setErr('Enter your username and password.'); return; }
    setBusy(true); setErr('');
    try {
      const { r, j } = await post('/api/login', { username: un, password: pw });
      if (r.ok && j.ok && j.user) { onLogin(j.user); return; }
      setErr(j.error || 'Sign-in failed. Please try again.');
    } catch { setErr('Cannot reach the server. Check your connection.'); }
    finally { setBusy(false); }
  }

  function quick(acc) { setUsername(acc.username); setPassword(acc.password); submit(acc.username, acc.password); }

  async function sendCode() {
    if (!username.trim()) { setErr('Enter your username.'); return; }
    setBusy(true); setErr(''); setNotice('');
    try {
      const { r, j } = await post('/api/forgot-password', { username: username.trim() });
      if (r.ok && j.ok) {
        setStep('reset');
        if (j.devCode) { setCode(j.devCode); setNotice('Demo: reset code prefilled (mailer not configured). ' + (j.devNote || '')); }
        else { setNotice(j.message || 'If that account exists, a reset code has been sent to its email.'); }
      } else { setErr(j.error || 'Could not start password reset.'); }
    } catch { setErr('Cannot reach the server. Check your connection.'); }
    finally { setBusy(false); }
  }

  async function doReset() {
    if (!code.trim() || !newPw) { setErr('Enter the reset code and a new password.'); return; }
    if (newPw.length < 6) { setErr('New password must be at least 6 characters.'); return; }
    setBusy(true); setErr('');
    try {
      const { r, j } = await post('/api/reset-password', { username: username.trim(), code: code.trim(), newPassword: newPw });
      if (r.ok && j.ok) { reset('login'); setNotice('Password updated. Please sign in with your new password.'); setPassword(''); }
      else { setErr(j.error || 'Could not reset password.'); }
    } catch { setErr('Cannot reach the server. Check your connection.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-mark">Karya Vaani</span>
          <span className="login-tag">Workforce Compliance Assessment</span>
        </div>
        <div className="login-tenant">Daikin Sricity · AP</div>

        {mode === 'login' && (
          <>
            <form className="login-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
              <label className="login-l">Username</label>
              <input className="input" autoFocus autoComplete="username" value={username}
                onChange={(e) => setUsername(e.target.value)} placeholder="e.g. hr" />
              <label className="login-l">Password</label>
              <input className="input" type="password" autoComplete="current-password" value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              {err ? <div className="login-err">{err}</div> : null}
              {notice ? <div className="login-notice">{notice}</div> : null}
              <button className="btn primary login-submit" type="submit" disabled={busy}>
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
            <button className="login-link" onClick={() => reset('forgot')} disabled={busy}>Forgot password?</button>

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
          </>
        )}

        {mode === 'forgot' && (
          <>
            <div className="login-demo-h" style={{ marginTop: 8, textAlign: 'left' }}>Reset your password</div>
            {step === 'request' ? (
              <form className="login-form" onSubmit={(e) => { e.preventDefault(); sendCode(); }}>
                <label className="login-l">Username</label>
                <input className="input" autoFocus value={username}
                  onChange={(e) => setUsername(e.target.value)} placeholder="your username" />
                {err ? <div className="login-err">{err}</div> : null}
                {notice ? <div className="login-notice">{notice}</div> : null}
                <button className="btn primary login-submit" type="submit" disabled={busy}>
                  {busy ? 'Sending…' : 'Send reset code'}
                </button>
              </form>
            ) : (
              <form className="login-form" onSubmit={(e) => { e.preventDefault(); doReset(); }}>
                {notice ? <div className="login-notice">{notice}</div> : null}
                <label className="login-l">Reset code</label>
                <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" />
                <label className="login-l">New password</label>
                <input className="input" type="password" value={newPw}
                  onChange={(e) => setNewPw(e.target.value)} placeholder="at least 6 characters" />
                {err ? <div className="login-err">{err}</div> : null}
                <button className="btn primary login-submit" type="submit" disabled={busy}>
                  {busy ? 'Updating…' : 'Set new password'}
                </button>
              </form>
            )}
            <button className="login-link" onClick={() => reset('login')} disabled={busy}>← Back to sign in</button>
          </>
        )}
      </div>
    </div>
  );
}
