/* SecVendor — converted 1:1 from karya-vaani_v3.html · <section id="sec-vendor"> */
export default function SecVendor() {
  return (
    <section id="sec-vendor" className="section">
      <div className="crumbs">
        <span>Operational Pillars</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Vendor compliance</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Module 4 · principal employer exposure</div>
          {' '}
          <h1 className="page-title">
            {"Real-time view on "}
            <em>contractor</em>
            {" compliance"}
          </h1>
          {' '}
          <p className="page-sub">
            Contractors register through a self-service portal; the principal employer (you) approves and gets a live compliance score, ESIC/PF reconciliation against deployment, and quantified joint-liability exposure.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" onClick={() => { window.vwImportOpen && window.vwImportOpen() }} data-onclick="vwImportOpen()">⬆ Import vendor data</button>
          {' '}
          <button className="btn">Invite contractor</button>
          {' '}
          <button className="btn amber">⚠ Open ESIC mismatch</button>
        </div>
      </div>
      {' '}
      <div className="g4" style={{ marginBottom: "18px" }}>
        <div className="kpi">
          <div className="kpi-eye">Active contractors</div>
          <div className="kpi-val">7</div>
          <div className="kpi-sub">1,400 deployed workers</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">{"Licences expiring < 30d"}</div>
          <div className="kpi-val" style={{ color: "var(--amber-dk)" }}>2</div>
          <div className="kpi-sub">Sri Lakshmi · Coastal</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">ESIC mismatches</div>
          <div className="kpi-val" style={{ color: "var(--red-dk)" }}>1</div>
          <div className="kpi-sub">Sri Lakshmi · May</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Joint-liability exposure</div>
          <div className="kpi-val">—</div>
          <div className="kpi-sub">mid case · sums by contractor</div>
        </div>
      </div>
      {' '}
      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="card-h">
          <div>
            <div className="card-h-title">Contractor master</div>
            {' '}
            <div className="card-h-sub">
              Self-service portal with principal employer approval gates · click a row to drill into compliance, tasks & liability exposure
            </div>
          </div>
          {' '}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div className="search-wrap">
              <input type="text" id="ct-search" className="search-input" placeholder="Search contractor…" autoComplete="off" />
              {' '}
              <span id="ct-search-clear" className="search-clear" title="Clear">✕</span>
            </div>
            {' '}
            <span className="tiny muted" id="ct-sort-state">Sorted by Joint liability · desc</span>
            {' '}
            <span className="card-h-action" onClick={(event) => { window.resetCtSort() }} data-onclick="resetCtSort()">
              Reset
            </span>
            {' '}
            <button className="dl-btn" onClick={(event) => { window.downloadContractors() }} data-onclick="downloadContractors()" title="Download as Excel">
              Excel
            </button>
          </div>
        </div>
        {' '}
        <table className="t" id="ct-grid">
          <thead>
            <tr>
              <th className="sortable" data-col="name">
                Contractor
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="deployed">
                Deployed
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="score">
                Score
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="clraRank">
                CLRA licence
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="esicRank">
                ESIC reconcile
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="pfRank">
                PF reconcile
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="liab">
                Joint liability
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="openTasks">
                Open tasks
                <span className="sort-ind">↕</span>
              </th>
            </tr>
          </thead>
          <tbody id="ct-grid-body" />
        </table>
      </div>
      {' '}
      {/*  ─── contractor drill-down ───  */}
      {' '}
      <div className="sd-drill" id="ct-drill">
        <div className="sd-drill-h">
          <div className="sd-drill-h-left">
            <span className="sd-drill-h-eye" id="ct-drill-eye">Contractor compliance · drill-down</span>
            {' '}
            <span className="sd-drill-h-title" id="ct-drill-title">—</span>
            {' '}
            <span className="sd-drill-h-meta" id="ct-drill-meta">—</span>
          </div>
          {' '}
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div className="score-ring" id="ct-drill-ring">
              <svg viewBox="0 0 100 100">
                <circle className="ring-bg" cx="50" cy="50" r="42" />
                {' '}
                <circle className="ring-fg" id="ct-ring-fg" cx="50" cy="50" r="42" strokeDasharray="263.9" strokeDashoffset="263.9" />
              </svg>
              {' '}
              <span className="score-num" id="ct-ring-num">—</span>
              {' '}
              <span className="score-cap">SCORE</span>
            </div>
            {' '}
            <span className="modal-h-close" onClick={(event) => { window.closeCtDrill() }} data-onclick="closeCtDrill()">
              Close ✕
            </span>
          </div>
        </div>
        {' '}
        <div className="sd-drill-tabs">
          <div className="sd-drill-tab on" onClick={(event) => { window.ctTab(event, 'overview') }} data-onclick="ctTab(event, 'overview')">
            Overview
          </div>
          {' '}
          <div className="sd-drill-tab" onClick={(event) => { window.ctTab(event, 'workers') }} data-onclick="ctTab(event, 'workers')">
            Workers deployed
          </div>
          {' '}
          <div className="sd-drill-tab" onClick={(event) => { window.ctTab(event, 'tasks') }} data-onclick="ctTab(event, 'tasks')">
            Open tasks
          </div>
          {' '}
          <div className="sd-drill-tab" onClick={(event) => { window.ctTab(event, 'liability') }} data-onclick="ctTab(event, 'liability')">
            Liability exposure
          </div>
          {' '}
          <div className="sd-drill-tab" onClick={(event) => { window.ctTab(event, 'docs') }} data-onclick="ctTab(event, 'docs')">
            Documents
          </div>
          {' '}
          <div className="sd-drill-tab" onClick={(event) => { window.ctTab(event, 'comms') }} data-onclick="ctTab(event, 'comms')">
            Communications
          </div>
        </div>
        {' '}
        <div className="sd-drill-body">
          <div className="sd-pane on" id="ct-pane-overview" />
          {' '}
          <div className="sd-pane" id="ct-pane-workers" />
          {' '}
          <div className="sd-pane" id="ct-pane-tasks" />
          {' '}
          <div className="sd-pane" id="ct-pane-liability" />
          {' '}
          <div className="sd-pane" id="ct-pane-docs" />
          {' '}
          <div className="sd-pane" id="ct-pane-comms" />
        </div>
      </div>
      {' '}
      <div className="g2" style={{ marginTop: "18px" }}>
        <div className="card">
          <div className="card-h-title" style={{ marginBottom: "10px" }}>
            Open contractor tasks · all contractors
          </div>
          {' '}
          <div className="card-h-sub" style={{ marginBottom: "14px", fontSize: "0.74rem", color: "var(--ink-3)" }}>
            Tasks aggregated across contractors · click a contractor row above to filter
          </div>
          {' '}
          <div id="ct-tasks-all" className="ct-tasks-scroll" style={{ maxHeight: "330px", overflowY: "auto", paddingRight: "6px" }} />
        </div>
        {' '}
        <div className="card">
          <div className="card-h-title" style={{ marginBottom: "10px" }}>
            Joint-liability exposure · principal employer
          </div>
          {' '}
          <div className="note red">
            <strong>SS Code s.67 (pending notification in AP)</strong>
            {" exposes principal employer to contractor PF/ESIC failure. Mid-case exposure is the sum of all contractor exposures plus a fixed disruption + customer audit overhead."}
          </div>
          {' '}
          <div id="ct-liab-summary" style={{ marginTop: "12px" }} />
        </div>
      </div>
      {' '}
      {/* ── VENDOR MANAGEMENT · manpower supply + compliance (full width) ── */}
      <div className="card" style={{ marginTop: "16px" }}>
        <div className="card-h">
          <div>
            <div className="card-h-title">Vendor management · manpower supply &amp; compliance</div>
            <div className="card-h-sub">
              Every manpower-supply vendor with its deployed headcount, skill mix and a compliance score —
              scored from the contractor master where matched. Click a vendor to drill into its contractor compliance.
            </div>
          </div>
          <span className="pill outline" id="vendor-mgmt-count">—</span>
        </div>
        <div id="vendor-mgmt-kpis" className="g4" style={{ margin: "4px 0 14px" }} />
        <div className="dir-controls" style={{ marginBottom: "10px" }}>
          <input type="text" className="input" id="vendor-mgmt-search" autoComplete="off" placeholder="Search vendor, type, status…" style={{ maxWidth: "360px" }} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="t">
            <thead>
              <tr><th>Vendor</th><th>Type</th><th>Deployed</th><th>Skill mix (S / Semi / Un)</th><th>Compliance</th><th>Status</th></tr>
            </thead>
            <tbody id="vendor-mgmt-body" />
          </table>
        </div>
        <div id="vendor-mgmt-pagination" className="om-pagination" />
      </div>
    </section>
  );
}
