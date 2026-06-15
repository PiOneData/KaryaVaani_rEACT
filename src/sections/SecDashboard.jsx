/* SecDashboard — converted 1:1 from karya-vaani_v3.html · <section id="sec-dashboard"> */
export default function SecDashboard() {
  return (
    <section id="sec-dashboard" className="section active">
      <div className="crumbs">
        <span>Overview</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Executive dashboard</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Daikin Sricity</div>
          {' '}
          <h1 className="page-title">
            {"Unified Workforce Governance. "}
            <em>Defensible</em>
            {" Audit Readiness."}
          </h1>
          {' '}
          <p className="page-sub">
            Synthesize live signals across talent acquisition, contractor compliance, and OHS into a singular statutory posture rollup. Instantly drill into any risk vector to verify the unbroken, cryptographically traceable evidence chain.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn primary" onClick={(event) => { window.dashExportPdf() }} data-onclick="dashExportPdf()">
            Export bilingual PDF
          </button>
        </div>
      </div>
      {' '}
      {/*  KPI row  */}
      {' '}
      <div className="g4" style={{ marginBottom: "8px" }}>
        <div className="kpi">
          <div className="kpi-bar">
            <span style={{ width: "72%", background: "var(--green)" }} />
          </div>
          {' '}
          <div className="kpi-eye">
            {"Compliance score "}
            <span className="kpi-help" onClick={(event) => { window.dashKpiHelp('score') }} data-onclick="dashKpiHelp('score')" title="How is this computed?">
              ⓘ
            </span>
          </div>
          {' '}
          <div className="kpi-val">
            72
            <small>/100</small>
          </div>
          {' '}
          <div className="kpi-sub">
            <span className="kpi-delta up">▲ 4</span>
            {" vs last quarter"}
          </div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-bar">
            <span style={{ width: "46%", background: "var(--amber)" }} />
          </div>
          {' '}
          <div className="kpi-eye">
            {"Estimated exposure "}
            <span className="kpi-help" onClick={(event) => { window.dashKpiHelp('exposure') }} data-onclick="dashKpiHelp('exposure')" title="How is this computed?">
              ⓘ
            </span>
          </div>
          {' '}
          <div className="kpi-val">
            ₹1.4
            <small>Cr</small>
          </div>
          {' '}
          <div className="kpi-sub">
            <span className="kpi-delta neu">range</span>
            {" ₹0.8 – ₹2.3 Cr"}
          </div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-bar">
            <span style={{ width: "88%", background: "var(--indigo)" }} />
          </div>
          {' '}
          <div className="kpi-eye">
            {"Onboarding throughput "}
            <span className="kpi-help" onClick={(event) => { window.dashKpiHelp('throughput') }} data-onclick="dashKpiHelp('throughput')" title="How is this computed?">
              ⓘ
            </span>
          </div>
          {' '}
          <div className="kpi-val">
            142
            <small>/wk</small>
          </div>
          {' '}
          <div className="kpi-sub">
            <span className="kpi-delta up">▲ 18%</span>
            {" contract intensity rising"}
          </div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-bar">
            <span style={{ width: "32%", background: "var(--red)" }} />
          </div>
          {' '}
          <div className="kpi-eye">
            {"Open contractor gaps "}
            <span className="kpi-help" onClick={(event) => { window.dashKpiHelp('gaps') }} data-onclick="dashKpiHelp('gaps')" title="How is this computed?">
              ⓘ
            </span>
          </div>
          {' '}
          <div className="kpi-val">23</div>
          {' '}
          <div className="kpi-sub">
            <span className="kpi-delta dn">▼ 5</span>
            {" 4 critical · 19 advisory"}
          </div>
        </div>
      </div>
      {' '}
      {/*  KPI computation help drill-down  */}
      {' '}
      <div id="dash-kpi-help" style={{ display: "none", marginBottom: "18px" }} />
      {' '}
      {/*  Body grid  */}
      {' '}
      <div className="g23">
        <div>
          {/*  Module health  */}
          {' '}
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Module health</div>
                {' '}
                <div className="card-h-sub">Live status across all platform modules — click a row to drill down</div>
              </div>
              {' '}
              <span className="pill outline">last sync · 14:02 IST</span>
            </div>
            {' '}
            <table className="t" id="dash-modhealth">
              <thead>
                <tr>
                  <th style={{ width: "18px" }} />
                  <th>Module</th>
                  <th>Status</th>
                  <th>Open items</th>
                  <th>SLA breaches</th>
                  <th>Posture</th>
                </tr>
              </thead>
              <tbody id="dash-modhealth-body" />
            </table>
          </div>
        </div>
        {' '}
        <div>
          {/*  Compliance score wheel + breakdown  */}
          {' '}
          <div className="card" style={{ marginBottom: "16px" }}>
            <div className="card-h">
              <div>
                <div className="card-h-title">Posture by domain</div>
                {' '}
                <div className="card-h-sub">Weighted by enforcement frequency</div>
              </div>
            </div>
            {' '}
            <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "14px" }}>
              <div className="score-wheel">
                <svg width="132" height="132" viewBox="0 0 132 132">
                  <circle cx="66" cy="66" r="56" stroke="#EDEAE2" strokeWidth="12" fill="none" />
                  {' '}
                  <circle cx="66" cy="66" r="56" stroke="#B8721C" strokeWidth="12" fill="none" strokeDasharray="252 352" strokeLinecap="round" />
                </svg>
                {' '}
                <div className="score-wheel-num">
                  <div className="sw-n">72</div>
                  <div className="sw-t">posture</div>
                </div>
              </div>
              {' '}
              <div style={{ flex: "1" }}>
                <div className="row-between" style={{ marginBottom: "8px" }}>
                  <span className="tiny muted">Wages & benefits</span>
                  {' '}
                  <span className="tiny mono t-strong">81</span>
                </div>
                {' '}
                <div className="bar thin" style={{ marginBottom: "10px" }}>
                  <span style={{ width: "81%", background: "var(--green)" }} />
                </div>
                {' '}
                <div className="row-between" style={{ marginBottom: "8px" }}>
                  <span className="tiny muted">OHS & factories</span>
                  {' '}
                  <span className="tiny mono t-strong">76</span>
                </div>
                {' '}
                <div className="bar thin" style={{ marginBottom: "10px" }}>
                  <span style={{ width: "76%", background: "var(--green)" }} />
                </div>
                {' '}
                <div className="row-between" style={{ marginBottom: "8px" }}>
                  <span className="tiny muted">Industrial relations</span>
                  {' '}
                  <span className="tiny mono t-strong">70</span>
                </div>
                {' '}
                <div className="bar thin" style={{ marginBottom: "10px" }}>
                  <span style={{ width: "70%", background: "var(--amber)" }} />
                </div>
                {' '}
                <div className="row-between" style={{ marginBottom: "8px" }}>
                  <span className="tiny muted">Contractor & CLRA</span>
                  {' '}
                  <span className="tiny mono t-strong">54</span>
                </div>
                {' '}
                <div className="bar thin">
                  <span style={{ width: "54%", background: "var(--red)" }} />
                </div>
              </div>
            </div>
            {' '}
            <div className="note">
              <strong>Largest financial exposure:</strong>
              {" wage definition restructuring under "}
              <span className="mono">s.2(y) Code on Wages</span>
              {" — basic ≥ 50% of total wages — pending notification in AP. Estimated impact range ₹40–90 L on PF, gratuity and leave encashment provisions.\n        "}
            </div>
          </div>
          {' '}
          {/*  Activity  */}
          {' '}
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Recent activity</div>
                {' '}
                <div className="card-h-sub">Cryptographically chained audit events</div>
              </div>
              {' '}
              <span className="card-h-action" onClick={(event) => { window.nav('audit', document.querySelectorAll('.sb-item')[15]) }} data-onclick="nav('audit', document.querySelectorAll('.sb-item')[15])">
                Trail →
              </span>
            </div>
            {' '}
            <div className="chain">
              <div className="chain-row green">
                <div className="chain-time">14:02:11 · today</div>
                {' '}
                <div className="chain-title">Safety briefing dispatched · 4 languages</div>
                {' '}
                <div className="chain-detail">2,087 workers · WA + PA + notice board · MSG-87412</div>
                {' '}
                <div className="chain-hash">a3f7…d290</div>
              </div>
              {' '}
              <div className="chain-row amber">
                <div className="chain-time">11:47:02 · today</div>
                {' '}
                <div className="chain-title">Contractor licence expiring · Sri Lakshmi Engg</div>
                {' '}
                <div className="chain-detail">CLRA renewal due in 21 days · routed to contractor portal</div>
                {' '}
                <div className="chain-hash">b9e1…44ac</div>
              </div>
              {' '}
              <div className="chain-row">
                <div className="chain-time">09:18:55 · today</div>
                {' '}
                <div className="chain-title">Rule bundle v2026.05.2 activated</div>
                {' '}
                <div className="chain-detail">Approved by Customer IT Admin · Rakesh K · adds AP gazette of 12 May</div>
                {' '}
                <div className="chain-hash">7c22…1f08</div>
              </div>
              {' '}
              <div className="chain-row red">
                <div className="chain-time">17:42:30 · yesterday</div>
                {' '}
                <div className="chain-title">ESIC mismatch · Compressor Line</div>
                {' '}
                <div className="chain-detail">142 deployed · 138 on May challan · 4-worker shortfall flagged</div>
                {' '}
                <div className="chain-hash">10ed…ab44</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {' '}
      {/*  ─── hiring cost vs budget ───  */}
      {' '}
      <div className="card" style={{ marginTop: "16px" }}>
        <div className="card-h">
          <div>
            <div className="card-h-title">Hiring cost vs budget</div>
            {' '}
            <div className="card-h-sub">
              Annualised cost-to-company of hires this cycle against the sanctioned hiring budget — click a row to drill into who was hired
            </div>
          </div>
          {' '}
          <span className="pill outline" id="cv-status-pill">—</span>
        </div>
        {' '}
        {/*  budget KPI strip  */}
        {' '}
        <div className="g4" style={{ margin: "14px 0 4px" }}>
          <div className="kpi">
            <div className="kpi-eye">Sanctioned budget</div>
            <div className="kpi-val" id="cv-kpi-budget">—</div>
            <div className="kpi-sub">approved hiring budget · annual CTC</div>
          </div>
          {' '}
          <div className="kpi">
            <div className="kpi-eye">Committed cost</div>
            <div className="kpi-val" id="cv-kpi-actual">—</div>
            <div className="kpi-sub" id="cv-kpi-actual-sub">—</div>
          </div>
          {' '}
          <div className="kpi" id="cv-kpi-var-tile">
            <div className="kpi-eye" id="cv-kpi-var-eye">Variance</div>
            <div className="kpi-val" id="cv-kpi-var">—</div>
            <div className="kpi-sub" id="cv-kpi-var-sub">—</div>
          </div>
          {' '}
          <div className="kpi">
            <div className="kpi-eye">Headcount hired</div>
            <div className="kpi-val" id="cv-kpi-hc">—</div>
            <div className="kpi-sub" id="cv-kpi-hc-sub">—</div>
          </div>
        </div>
        {' '}
        {/*  budget utilisation bar  */}
        {' '}
        <div className="cv-bar-wrap">
          <div className="cv-bar" id="cv-bar" />
          {' '}
          <div className="cv-bar-legend" id="cv-bar-legend" />
        </div>
        {' '}
        {/*  per-group cost table with drill-down  */}
        {' '}
        <table className="t" id="cv-grid" style={{ marginTop: "6px" }}>
          <thead>
            <tr>
              <th style={{ width: "18px" }} />
              <th>Hiring group</th>
              <th>Headcount</th>
              <th>Avg CTC</th>
              <th>Committed cost · annual</th>
              <th>Budget · annual</th>
              <th>Variance</th>
            </tr>
          </thead>
          <tbody id="cv-grid-body" />
        </table>
        {' '}
        {/*  excess-over-budget drill-down  */}
        {' '}
        <div id="cv-excess" style={{ display: "none" }} />
      </div>
    </section>
  );
}
