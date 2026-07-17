/* App — 1:1 React replica of karya-vaani_v3.html.
   Styling: src/styles/app.css (verbatim copy of the original <style> block).
   Behaviour: public/legacy/app.js (verbatim copy of the original <script>),
   loaded after mount via useLegacyApp(). */
import { useState, useEffect } from 'react';
import { useLegacyApp } from './legacy/useLegacyApp.js';
import Login from './components/Login.jsx';
import TopBar from './components/TopBar.jsx';
import NavBar from './components/NavBar.jsx';
import EmailModal from './components/EmailModal.jsx';
import Toast from './components/Toast.jsx';
import SecDashboard from './sections/SecDashboard.jsx';
import SecDiagnostic from './sections/SecDiagnostic.jsx';
import SecArchitecture from './sections/SecArchitecture.jsx';
import SecKaryaNirnay from './sections/SecKaryaNirnay.jsx';
import SecRecruitment from './sections/SecRecruitment.jsx';
import SecOnboarding from './sections/SecOnboarding.jsx';
import SecInduction from './sections/SecInduction.jsx';
import SecAppointmentOrder from './sections/SecAppointmentOrder.jsx';
import SecVendor from './sections/SecVendor.jsx';
import SecOhs from './sections/SecOhs.jsx';
import SecCompliance from './sections/SecCompliance.jsx';
import SecVaaniBroadcast from './sections/SecVaaniBroadcast.jsx';
import SecAnalytics from './sections/SecAnalytics.jsx';
import SecChat from './sections/SecChat.jsx';
import SecEmpHome from './sections/SecEmpHome.jsx';
import SecCtHome from './sections/SecCtHome.jsx';
import SecTransport from './sections/SecTransport.jsx';
import SecLms from './sections/SecLms.jsx';
import SecRules from './sections/SecRules.jsx';
import SecLocale from './sections/SecLocale.jsx';
import SecAudit from './sections/SecAudit.jsx';
import SecHandoff from './sections/SecHandoff.jsx';
import SecDirectory from './sections/SecDirectory.jsx';
import SecCtdirectory from './sections/SecCtdirectory.jsx';

const KVUSER_KEY = 'kvUser';
function readStoredUser() {
  try { return JSON.parse(localStorage.getItem(KVUSER_KEY) || 'null'); } catch { return null; }
}

/* Auth gate: unauthenticated → Login; otherwise route the role to its surface. */
export default function App() {
  const [user, setUser] = useState(readStoredUser);
  useEffect(() => { window.__KVUSER = user || null; }, [user]);

  if (!user) {
    return <Login onLogin={(u) => { localStorage.setItem(KVUSER_KEY, JSON.stringify(u)); setUser(u); }} />;
  }
  return <AuthedApp user={user} onLogout={() => { localStorage.removeItem(KVUSER_KEY); window.location.href = '/'; }} />;
}

function AuthedApp({ user, onLogout }) {
  // expose the session to the legacy layer BEFORE its script is injected, so
  // role-application (kvApplyRole) can lock a worker/contractor into their home.
  window.__KVUSER = user;
  useLegacyApp();
  // Hold a loading overlay until the legacy layer has applied the role and
  // navigated to the correct home — otherwise the default dashboard flashes
  // for a moment before a contractor/worker view takes over.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    window.__KVUSER = user;
    let tries = 0, done = false;
    const finish = () => { if (!done) { done = true; setReady(true); } };
    const apply = () => {
      if (done) return;
      if (window.kvApplyRole && window.__kvLegacyReady) {
        try { window.kvApplyRole(user); } catch (e) { /* keep app rendering */ }
        // give the DOM a beat to settle on the target view before revealing
        setTimeout(finish, 120);
      } else if (tries++ < 150) { setTimeout(apply, 60); }
      else { finish(); }
    };
    apply();
    return () => { done = true; };
  }, [user]);

  return (
    <>
      {!ready && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '18px', background: '#f6f7fb', color: '#334155' }}>
          <style>{'@keyframes kvspin{to{transform:rotate(360deg)}}'}</style>
          <div style={{ width: 46, height: 46, borderRadius: '50%', border: '4px solid #e2e8f0',
            borderTopColor: '#2563eb', animation: 'kvspin 0.8s linear infinite' }} />
          <div style={{ fontSize: '0.95rem', letterSpacing: '0.02em', fontWeight: 600 }}>
            Loading your Karya Vaani workspace…
          </div>
        </div>
      )}
      {/*  ════ TOP BAR ════  */}
      <TopBar user={user} onLogout={onLogout} />
      {/*  ════ TOP NAV BAR ════  */}
      <NavBar />
      <div className="shell">
        <main className="main">
          {/*  ─────────────────────────────────────────────────────────────────
     1 · EXECUTIVE DASHBOARD
     ─────────────────────────────────────────────────────────────────  */}
          <SecDashboard />
          {/*  ─────────────────────────────────────────────────────────────────
     2 · LABOUR CODE READINESS SURVEY  (replaces Continuous Compliance Engine)
     9-question pulse survey → scored sector benchmark + gap report
     ─────────────────────────────────────────────────────────────────  */}
          <SecDiagnostic />
          {/*  ─────────────────────────────────────────────────────────────────
     3 · ARCHITECTURAL BLUEPRINT
     ─────────────────────────────────────────────────────────────────  */}
          <SecArchitecture />
          {/*  ─────────────────────────────────────────────────────────────────
     KARYA NIRṆAY · WORKFORCE DECISION BUILDER
     First pillar — guided 4-step workforce-structure decision engine
     ─────────────────────────────────────────────────────────────────  */}
          <SecKaryaNirnay />
          {/*  ─────────────────────────────────────────────────────────────────
     4 · TALENT ACQUISITION & PROGRESSION
     ─────────────────────────────────────────────────────────────────  */}
          <SecRecruitment />
          {/*  ─────────────────────────────────────────────────────────────────
     5 · ONBOARDING
     ─────────────────────────────────────────────────────────────────  */}
          <SecOnboarding />
          {/*  ─────────────────────────────────────────────────────────────────
     6 · INDUCTION TRAINING · MODULE 3
     ─────────────────────────────────────────────────────────────────  */}
          <SecInduction />
          {/*  ─────────────────────────────────────────────────────────────────
     HR DOCUMENTS · APPOINTMENT ORDER
     Form → professionally formatted appointment letter (PDF) on company
     letterhead. Download / print / email via the existing mailer.
     ─────────────────────────────────────────────────────────────────  */}
          <SecAppointmentOrder />
          {/*  ─────────────────────────────────────────────────────────────────
     7 · VENDOR / CONTRACTOR COMPLIANCE
     ─────────────────────────────────────────────────────────────────  */}
          <SecVendor />
          {/*  ─────────────────────────────────────────────────────────────────
     7 · WORKPLACE SAFETY & OHS ANALYTICS
     ─────────────────────────────────────────────────────────────────  */}
          <SecOhs />
          {/*  ─────────────────────────────────────────────────────────────────
     8 · COMPLIANCE ASSESSMENT (UMBRELLA)
     ─────────────────────────────────────────────────────────────────  */}
          <SecCompliance />
          {/*  ─────────────────────────────────────────────────────────────────
     9 · VAANI TRANSLATION & BROADCASTING  (merged)
     Compose → translate into two Indian languages → broadcast to a
     small named group, with a live delivery + acknowledgement demo.
     ─────────────────────────────────────────────────────────────────  */}
          <SecVaaniBroadcast />
          {/*  ─────────────────────────────────────────────────────────────────
     KARYA VAANI CHAT · WhatsApp look-alike chatbot
     Shows multilingual messages flowing from the Vaani Localisation
     engine to workers. The bot appears as a contact.
     ─────────────────────────────────────────────────────────────────  */}
          {/*  Analytics hub (Governance): Exposure analytics + Chat engagement
     analytics (the latter moved here from its own section).  */}
          <SecAnalytics />
          <SecChat />
          {/*  ─────────────────────────────────────────────────────────────────
     10c · EMPLOYEE HOME — the worker-facing surface
     A single page that pulls everything Karya Vaani knows about a
     worker into one place: their identity, today's alerts, messages
     pending acknowledgement, personal compliance score, and the
     time-to-read trends across recent broadcasts.
     ─────────────────────────────────────────────────────────────────  */}
          <SecEmpHome />
          {/*  ─────────────────────────────────────────────────────────────────
     10d · CONTRACTOR HOME — the firm-facing surface
     A single page that pulls everything Karya Vaani knows about a
     contractor firm: their compliance score, deployed workforce,
     statutory state (CLRA / ESIC / PF), liability exposure, and the
     chat thread with Plant HR / compliance.
     ─────────────────────────────────────────────────────────────────  */}
          <SecCtHome />
          {/*  ─────────────────────────────────────────────────────────────────
     10b · TRANSPORT SCHEDULE  — weekly plan · 2 shifts · 5 buses
     ─────────────────────────────────────────────────────────────────  */}
          <SecTransport />
          {/*  ─────────────────────────────────────────────────────────────────
     11 · KNOWLEDGE CENTER
     ─────────────────────────────────────────────────────────────────  */}
          <SecLms />
          {/*  ─────────────────────────────────────────────────────────────────
     13 · RULE LIBRARY
     ─────────────────────────────────────────────────────────────────  */}
          <SecRules />
          {/*  ─────────────────────────────────────────────────────────────────
     14 · GLOBAL LOCALIZATION ENGINE
     ─────────────────────────────────────────────────────────────────  */}
          <SecLocale />
          {/*  ─────────────────────────────────────────────────────────────────
     15 · AUDIT TRAIL
     ─────────────────────────────────────────────────────────────────  */}
          <SecAudit />
          {/*  ─────────────────────────────────────────────────────────────────
     16 · API HANDOFF
     ─────────────────────────────────────────────────────────────────  */}
          <SecHandoff />
          {/*  ─────────────────────────────────────────────────────────────────
     WORKFORCE DIRECTORY · searchable grid · direct + contract
     ─────────────────────────────────────────────────────────────────  */}
          <SecDirectory />
          {/*  ─────────────────────────────────────────────────────────────────
     CONTRACTOR DIRECTORY · searchable grid · compliance drill-down
     ─────────────────────────────────────────────────────────────────  */}
          <SecCtdirectory />
        </main>
      </div>
      {/*  /shell  */}
      {/*  ════ EMAIL COMPOSE MODAL ════  */}
      <EmailModal />
      {/*  ════ TOAST ════  */}
      <Toast />
    </>
  );
}
