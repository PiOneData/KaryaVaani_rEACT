/* SecAnalytics — Analytics hub (Governance).
   Two tabs:
     • Exposure analytics  — compliance-driven liability/exposure analytics,
       rendered by initExposureAnalytics() in public/legacy/app.js from the
       contractors' scores, sub-scores and liability breakdown.
     • Chat engagement analytics — the existing chat analytics, embedded here
       (SecChatAnalytics) and rendered by the existing chat renderers.
   Tab switching is handled by window.anTab(name, el). */
import SecChatAnalytics from './SecChatAnalytics.jsx';

export default function SecAnalytics() {
  return (
    <section id="sec-analytics" className="section">
      <div className="crumbs">
        <span>Governance</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Analytics</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Governance · analytics</div>
          {' '}
          <h1 className="page-title">
            {"Exposure & engagement "}
            <em>analytics</em>
          </h1>
          {' '}
          <p className="page-sub">
            Compliance-driven liability exposure across contractors, and broadcast / chat
            engagement — in one place. Switch lenses with the tabs below.
          </p>
        </div>
      </div>
      {' '}
      {/* tab bar */}
      <div className="tabs" style={{ marginBottom: "16px" }}>
        <div className="tab on" id="an-tab-exposure" onClick={(event) => { window.anTab('exposure', event.currentTarget) }} data-onclick="anTab('exposure', this)">
          Exposure analytics
        </div>
        {' '}
        <div className="tab" id="an-tab-readiness" onClick={(event) => { window.anTab('readiness', event.currentTarget) }} data-onclick="anTab('readiness', this)">
          Readiness trend
        </div>
        {' '}
        <div className="tab" id="an-tab-chat" onClick={(event) => { window.anTab('chat', event.currentTarget) }} data-onclick="anTab('chat', this)">
          Chat engagement analytics
        </div>
      </div>
      {' '}
      {/* ── EXPOSURE ANALYTICS PANE (compliance-driven) ── */}
      <div id="an-pane-exposure" className="an-pane">
        {/* KPI strip — filled by initExposureAnalytics() */}
        <div id="exp-kpis" className="g4" style={{ margin: "4px 0 16px" }} />
        {' '}
        <div className="g2" style={{ marginBottom: "16px" }}>
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Exposure by contractor</div>
                <div className="card-h-sub">Estimated liability (mid-case) · ranked · coloured by compliance band</div>
              </div>
            </div>
            <div id="exp-bycontractor" />
          </div>
          {' '}
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Exposure composition</div>
                <div className="card-h-sub">What the total liability is made of</div>
              </div>
            </div>
            <div id="exp-composition" />
          </div>
        </div>
        {' '}
        <div className="g2" style={{ marginBottom: "16px" }}>
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Compliance sub-scores · 6 dimensions</div>
                <div className="card-h-sub">Average across contractors — the lowest dimension drives the most exposure</div>
              </div>
            </div>
            <div id="exp-subscores" />
          </div>
          {' '}
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Compliance score distribution</div>
                <div className="card-h-sub">Contractors by readiness band</div>
              </div>
            </div>
            <div id="exp-bands" />
          </div>
        </div>
        {' '}
        <div className="card">
          <div className="card-h">
            <div>
              <div className="card-h-title">At-risk contractors</div>
              <div className="card-h-sub">Sorted by estimated exposure · click-through to the contractor directory for the full ledger</div>
            </div>
            <span className="pill outline" id="exp-table-count">—</span>
          </div>
          <table className="t" id="exp-table">
            <thead>
              <tr>
                <th>Contractor</th>
                <th>Area</th>
                <th>Deployed</th>
                <th>Score</th>
                <th>Weakest dimension</th>
                <th>Exposure (mid)</th>
              </tr>
            </thead>
            <tbody id="exp-table-body" />
          </table>
        </div>
      </div>
      {' '}
      {/* ── READINESS TREND PANE (Labour Code Readiness Survey history) ── */}
      <div id="an-pane-readiness" className="an-pane" style={{ display: "none" }}>
        <div id="rdz-kpis" className="g4" style={{ margin: "4px 0 16px" }} />
        {' '}
        <div className="card" style={{ marginBottom: "16px" }}>
          <div className="card-h">
            <div>
              <div className="card-h-title">Readiness score over time</div>
              <div className="card-h-sub">Every completed Labour Code Readiness Survey, by the date it was taken — watch the trajectory move</div>
            </div>
            <span className="pill outline" id="rdz-trend-count">—</span>
          </div>
          <div id="rdz-trend" />
        </div>
        {' '}
        <div className="g2" style={{ marginBottom: "16px" }}>
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Month-by-month</div>
                <div className="card-h-sub">Average and latest score per month</div>
              </div>
            </div>
            <table className="t" id="rdz-month">
              <thead>
                <tr><th>Month</th><th>Checks</th><th>Avg score</th><th>Latest</th><th>Trend</th></tr>
              </thead>
              <tbody id="rdz-month-body" />
            </table>
          </div>
          {' '}
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Day-by-day history</div>
                <div className="card-h-sub">Each check with its date and score on that day</div>
              </div>
            </div>
            <table className="t" id="rdz-history">
              <thead>
                <tr><th>Date</th><th>Score</th><th>Band</th><th>Sector</th><th>Gaps</th></tr>
              </thead>
              <tbody id="rdz-history-body" />
            </table>
          </div>
        </div>
      </div>
      {' '}
      {/* ── CHAT ENGAGEMENT ANALYTICS PANE (moved here) ── */}
      <div id="an-pane-chat" className="an-pane" style={{ display: "none" }}>
        <SecChatAnalytics />
      </div>
    </section>
  );
}
