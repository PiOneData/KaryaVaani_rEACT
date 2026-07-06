/* SecTransport — transport operations board (GoKarya layout).
   Shift tabs (A morning / B general / C night) · compact route cards with an
   EMP-vs-contract split → a roster drawer that expands under the grid; each
   passenger opens the full tabbed employee detail. Night shift surfaces the
   OSHC Rule-83 women-transport compliance strip, live scan feed and SOS.
   All rendering is driven by the tr* functions in public/legacy/app.js. */
export default function SecTransport() {
  return (
    <section id="sec-transport" className="section">
      <div className="crumbs">
        <span>Localisation Engine</span>
        {' '}<span className="crumb-sep">/</span>{' '}
        <span className="crumb-here">Transport</span>
      </div>
      {' '}
      <div className="page-h" style={{ marginBottom: "12px" }}>
        <div className="page-h-left">
          <div className="page-eyebrow">Localisation Engine · worker transport operations</div>
          <h1 className="page-title">Transport <em>operations board</em></h1>
          <p className="page-sub">
            Live routes, rosters and boarding by shift. Click a route for its passenger roster;
            click a passenger for their full profile, travel history and attendance. Night shift
            adds the OSHC Rule-83 women-transport safety view.
          </p>
        </div>
      </div>

      <div className="gktr">
        {/* ── shift tabs ── */}
        <div className="gktr-shifts">
          <div className="stab on" id="tr-tab-A" onClick={() => { window.trShift('A') }}>
            <span className="stab-letter">A</span>
            <div className="stab-info"><span className="stab-time">06:00 – 14:00</span><span className="stab-count">Morning transport</span></div>
          </div>
          <div className="stab" id="tr-tab-B" onClick={() => { window.trShift('B') }}>
            <span className="stab-letter">B</span>
            <div className="stab-info"><span className="stab-time">14:00 – 22:00</span><span className="stab-count">General transport</span></div>
          </div>
          <div className="stab" id="tr-tab-C" onClick={() => { window.trShift('C') }}>
            <span className="stab-letter">C</span>
            <div className="stab-info"><span className="stab-time">22:00 – 06:00</span><span className="stab-count"><span className="stab-night">♀ night transport · OSHC R.83</span></span></div>
          </div>
          <div className="tab-right">
            <div className="ts-kpi"><div className="ts-val" style={{ color: "var(--gk)" }}>2,757</div><div className="ts-lbl">Contract labour · 16 agencies</div></div>
            <div className="ts-sep" />
            <div className="ts-kpi"><div className="ts-val" style={{ color: "var(--gold)" }}>769</div><div className="ts-lbl">Daikin trainees</div></div>
            <div className="ts-sep" />
            <div className="ts-kpi"><div className="ts-val" style={{ color: "var(--rose)" }}>32</div><div className="ts-lbl">♀ Night · OSHC R.83</div></div>
          </div>
        </div>

        {/* ── OSHC compliance strip (night only) ── */}
        <div className="oshc-strip" id="tr-oshc">
          <div className="os-label">
            <div className="os-rule">OSHC Rule 83(c)(d)(f)</div>
            <div className="os-title">Night transport compliance</div>
            <div className="os-meta">Women · Shift C · Sricity</div>
          </div>
          <div className="os-items">
            <div className="osi osi-ok" id="tr-oshc-consent-box"><div className="osi-dot" /><span className="osi-val" id="tr-oshc-consent">—</span>&nbsp;Consent · R.83</div>
            <div className="osi osi-ok"><div className="osi-dot" /><span className="osi-val">4/4</span>&nbsp;Vehicles</div>
            <div className="osi osi-warn"><div className="osi-dot" /><span className="osi-val">28/32</span>&nbsp;Pickup confirmed</div>
            <div className="osi osi-risk"><div className="osi-dot" /><span className="osi-val">3/32</span>&nbsp;Safe drops</div>
            <div className="osi osi-ok"><div className="osi-dot" /><span className="osi-val">4/4</span>&nbsp;R.83(f) helpline</div>
            <div className="osi osi-risk"><div className="osi-dot" /><span className="osi-val">1</span>&nbsp;Unaccounted</div>
            <div style={{ marginLeft: "auto" }}><button className="btn-sos" onClick={() => { window.trGkTriggerSOS() }}>⚠ SOS protocol</button></div>
          </div>
        </div>

        {/* ── access-card scan feed ── */}
        <div className="scan-feed">
          <span className="sf-lbl">🪪 Access card</span>
          <div className="sf-events" id="tr-scan-feed" />
          <button className="sf-btn" onClick={() => { window.trGkAddScan() }}>+ Scan</button>
        </div>

        {/* ── main grid ── */}
        <div className="gktr-main">
          <div className="routes">
            <div className="routes-hd">
              <span className="rhd-title" id="tr-routes-title">Routes</span>
              <span className="rhd-count">Daikin Sricity · AP corridor</span>
            </div>
            <div className="route-grid" id="tr-route-grid" />

            <div className="roster-drawer" id="tr-roster-drawer">
              <div className="rd-hd">
                <div>
                  <div className="rd-title" id="tr-rd-title">Route roster</div>
                  <div className="rd-meta"><span id="tr-rd-bus">Bus —</span><span id="tr-rd-dept">Departs —</span><span id="tr-rd-operator" style={{ color: "var(--gk)", fontWeight: 600 }}>Operator —</span><span id="tr-rd-total">— workers</span></div>
                </div>
                <button className="rd-close" onClick={() => { window.trGkCloseRoster() }}>✕</button>
              </div>
              <div className="rd-legend">
                <div className="rdl"><div className="rdl-swatch" style={{ background: "var(--gk3)" }} />EMP — Daikin direct</div>
                <div className="rdl"><div className="rdl-swatch" style={{ background: "var(--amber2)" }} />CTR — Contract labour</div>
                <div className="rdl"><div className="rdl-swatch" style={{ background: "rgba(176,53,32,.4)" }} />Not boarded</div>
                <div className="rdl"><div className="rdl-swatch" style={{ background: "rgba(138,80,16,.3)" }} />Pending</div>
                <span style={{ marginLeft: "auto", fontSize: "9.5px", color: "var(--txt4)" }}>click a worker for full details →</span>
              </div>
              <div className="rd-table-wrap">
                <table className="rt">
                  <thead><tr><th>Name</th><th>ID</th><th>Type</th><th>Agency</th><th>Pickup point</th><th>Departs</th><th>Boarded</th><th>Consent · R.83</th></tr></thead>
                  <tbody id="tr-rd-tbody" />
                </table>
              </div>
              <div className="rd-footer">
                <span id="tr-rd-emp">— direct</span>
                <span id="tr-rd-ctr">— contract</span>
                <span id="tr-rd-rate">— boarding</span>
                <span style={{ marginLeft: "auto", display: "inline-flex", gap: "6px" }}>
                  <button className="rd-act" onClick={() => { window.trGkNotifyOpen() }}>Notify batch</button>
                  <button className="rd-act primary" onClick={() => { window.trGkAttendOpen() }}>Take attendance</button>
                </span>
              </div>
            </div>
          </div>

          {/* ── right column ── */}
          <div className="right-col">
            <div className="shift-summary">
              <div className="ss-hd" id="tr-summary-label">Shift A · morning transport</div>
              <div className="ss-grid" id="tr-summary-grid" />
            </div>

            <div className="women-strip" id="tr-women-strip">
              <div className="ws-hd"><span className="ws-title">♀ Night transport · OSHC Rule 83</span><span className="ws-stat" id="tr-women-stat">Women · Shift C</span></div>
              <div className="ws-tokens" id="tr-women-tokens" />
            </div>

            <div className="kv-panel">
              <div className="kv-hd">
                <div className="kv-pip" />
                <div><div className="kv-name">Karyavaani</div><div className="kv-sub">Transport comms</div></div>
              </div>
              <div className="kv-msgs" id="tr-kv-msgs" />
            </div>

            <div className="sos-row" id="tr-sos-row">
              <div className="sos-lbl">Emergency · OSHC Rule 83(f)</div>
              <div className="sos-nums"><span className="sos-n">181</span><span className="sos-n">1800-XXX-0001</span></div>
              <button className="btn-sos" onClick={() => { window.trGkTriggerSOS() }}>Trigger SOS</button>
            </div>
          </div>
        </div>
      </div>

      <div className="sos-alert" id="tr-sos-alert">
        <span className="sa-icon">🚨</span>
        <div className="sa-text"><strong style={{ color: "var(--ember)" }}>SOS protocol activated</strong><br />Control tower · Plant security · AP 181 · Vehicle pin · Evidence log sealed.</div>
        <span className="sa-x" onClick={() => { const e = document.getElementById('tr-sos-alert'); if (e) e.classList.remove('show'); }}>✕</span>
      </div>
    </section>
  );
}
