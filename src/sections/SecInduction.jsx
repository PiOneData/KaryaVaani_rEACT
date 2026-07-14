/* SecInduction — converted 1:1 from karya-vaani_v3.html · <section id="sec-induction"> */
export default function SecInduction() {
  return (
    <section id="sec-induction" className="section">
      <div className="crumbs">
        <span>Operational Pillars</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Induction training</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Module 3 · induction · PPE issuance + statutory briefings</div>
          {' '}
          <h1 className="page-title">
            {"Get every joinee "}
            <em>floor-ready</em>
            {" in 4 days"}
          </h1>
          {' '}
          <p className="page-sub">
            Tracks PPE/uniform sizing, fitment readiness and induction completion for both direct employees and contract workers. Safety briefings under Factories Act s.41-B and Schedule 21 cannot be marked complete without PPE issued.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" disabled title="Coming soon">Schedule batch induction</button>
          {' '}
          <button className="btn primary" disabled title="Coming soon">+ Configure track</button>
        </div>
      </div>
      {' '}
      {/*  alerts  */}
      {' '}
      <div id="ind-alert-host" />
      {' '}
      {/*  KPI strip  */}
      {' '}
      <div className="g4" style={{ marginBottom: "18px" }}>
        <div className="kpi">
          <div className="kpi-eye">In flight</div>
          <div className="kpi-val" id="ind-kpi-flight">—</div>
          <div className="kpi-sub">workers in induction</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Completion rate</div>
          <div className="kpi-val" id="ind-kpi-comp">
            —
            <small>%</small>
          </div>
          <div className="kpi-sub" id="ind-kpi-comp-sub">—</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Avg days to complete</div>
          <div className="kpi-val" id="ind-kpi-days">
            —
            <small>d</small>
          </div>
          <div className="kpi-sub">target ≤ 4d</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">At risk</div>
          <div className="kpi-val" id="ind-kpi-risk" style={{ color: "var(--red-dk)" }}>—</div>
          <div className="kpi-sub" id="ind-kpi-risk-sub">—</div>
        </div>
      </div>
      {' '}
      {/*  Induction tracks  */}
      {' '}
      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="card-h">
          <div>
            <div className="card-h-title">Induction tracks</div>
            {' '}
            <div className="card-h-sub">
              Four tracks · every worker takes Common + one of Direct/Contract + their Role-specific module
            </div>
          </div>
        </div>
        {' '}
        <div className="induction-tracks">
          <div className="ind-track common">
            <div className="ind-track-h">Common · all workers</div>
            {' '}
            <div className="ind-track-t">Plant orientation</div>
            {' '}
            <div className="ind-track-c">
              Site rules, emergency map, evacuation, basic Hindi/Telugu/Tamil safety phrases.
            </div>
            {' '}
            <div className="ind-track-modules">
              <span className="ind-m">Site rules</span>
              {' '}
              <span className="ind-m">Evacuation</span>
              {' '}
              <span className="ind-m">Emergency contacts</span>
            </div>
            {' '}
            <div className="ind-track-meta">
              <span>
                {"Modules "}
                <span className="v">3</span>
              </span>
              {' '}
              <span>
                {"Duration "}
                <span className="v">4 hrs</span>
              </span>
              {' '}
              <span>
                {"Language "}
                <span className="v">TE/HI/EN/JP</span>
              </span>
            </div>
          </div>
          {' '}
          <div className="ind-track direct">
            <div className="ind-track-h">Direct employees</div>
            {' '}
            <div className="ind-track-t">Code & HR policies</div>
            {' '}
            <div className="ind-track-c">
              Code of conduct, IESO standing orders, leave, attendance, HRMS walkthrough.
            </div>
            {' '}
            <div className="ind-track-modules">
              <span className="ind-m">Code of conduct</span>
              {' '}
              <span className="ind-m">Standing orders</span>
              {' '}
              <span className="ind-m">HRMS · LMS</span>
              {' '}
              <span className="ind-m">Leave & attendance</span>
            </div>
            {' '}
            <div className="ind-track-meta">
              <span>
                {"Modules "}
                <span className="v">4</span>
              </span>
              {' '}
              <span>
                {"Duration "}
                <span className="v">6 hrs</span>
              </span>
              {' '}
              <span>
                {"Mandatory "}
                <span className="v">Yes</span>
              </span>
            </div>
          </div>
          {' '}
          <div className="ind-track contract">
            <div className="ind-track-h">Contract workers</div>
            {' '}
            <div className="ind-track-t">Contractor-specific</div>
            {' '}
            <div className="ind-track-c">
              CLRA worker rights, ESIC card use, wage register, contractor portal, native-language safety.
            </div>
            {' '}
            <div className="ind-track-modules">
              <span className="ind-m">CLRA rights</span>
              {' '}
              <span className="ind-m">ESIC card use</span>
              {' '}
              <span className="ind-m">Wage register</span>
            </div>
            {' '}
            <div className="ind-track-meta">
              <span>
                {"Modules "}
                <span className="v">3</span>
              </span>
              {' '}
              <span>
                {"Duration "}
                <span className="v">3 hrs</span>
              </span>
              {' '}
              <span>
                {"Mandatory "}
                <span className="v">Yes · CLRA s.34</span>
              </span>
            </div>
          </div>
          {' '}
          <div className="ind-track role">
            <div className="ind-track-h">Role-specific</div>
            {' '}
            <div className="ind-track-t">Safety competency</div>
            {' '}
            <div className="ind-track-c">
              Per-role safety briefing — varies by zone (compressor line, paint shop, logistics, tool-room, etc).
            </div>
            {' '}
            <div className="ind-track-modules">
              <span className="ind-m">Zone PPE drill</span>
              {' '}
              <span className="ind-m">Machine-specific lockout</span>
              {' '}
              <span className="ind-m">Chemical handling</span>
              {' '}
              <span className="ind-m">Confined-space (where applicable)</span>
            </div>
            {' '}
            <div className="ind-track-meta">
              <span>
                {"Modules "}
                <span className="v">var</span>
              </span>
              {' '}
              <span>
                {"Duration "}
                <span className="v">4–8 hrs</span>
              </span>
              {' '}
              <span>
                {"Mandatory "}
                <span className="v">Factories Act 41-B</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      {' '}
      {/*  Worker progress grid  */}
      {' '}
      <div className="card">
        <div className="card-h">
          <div>
            <div className="card-h-title">Joinees · induction progress</div>
            {' '}
            <div className="card-h-sub">
              Direct + contract · click a worker for the full ledger · click a chip above to filter · sort by Language to group workers by induction language
            </div>
          </div>
          {' '}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div className="search-wrap">
              <input type="text" id="ind-search" className="search-input" placeholder="Search worker, role, contractor…" autoComplete="off" />
              {' '}
              <span id="ind-search-clear" className="search-clear" title="Clear">✕</span>
            </div>
            {' '}
            <span className="tiny muted" id="ind-sort-state">Sorted by Risk · desc</span>
            {' '}
            <span className="card-h-action" onClick={(event) => { window.resetIndSort() }} data-onclick="resetIndSort()">
              Reset
            </span>
            {' '}
            <button className="dl-btn" onClick={(event) => { window.downloadInduction() }} data-onclick="downloadInduction()" title="Download as Excel">
              Excel
            </button>
          </div>
        </div>
        {' '}
        <div id="ind-filter-banner" className="filter-banner" style={{ display: "none" }} />
        {' '}
        <table className="t" id="ind-grid">
          <thead>
            <tr>
              <th className="sortable" data-col="name">
                Worker
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="type">
                Type
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="anchor">
                Position / Contractor
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="joinDate">
                Join date
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="langRank">
                Language
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="ppeRank">
                PPE / Uniform
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="progress">
                Induction progress
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="statusRank">
                Status
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="riskRank">
                Risk
                <span className="sort-ind">↕</span>
              </th>
            </tr>
          </thead>
          <tbody id="ind-grid-body" />
        </table>
      </div>
      {' '}
      {/*  per-worker induction drill-down  */}
      {' '}
      <div className="sd-drill" id="ind-drill">
        <div className="sd-drill-h">
          <div className="sd-drill-h-left">
            <span className="sd-drill-h-eye" id="ind-drill-eye">Induction ledger</span>
            {' '}
            <span className="sd-drill-h-title" id="ind-drill-title">—</span>
            {' '}
            <span className="sd-drill-h-meta" id="ind-drill-meta">—</span>
          </div>
          {' '}
          <span className="modal-h-close" onClick={(event) => { window.closeIndDrill() }} data-onclick="closeIndDrill()">
            Close ✕
          </span>
        </div>
        {' '}
        <div className="sd-drill-body" style={{ gridTemplateColumns: "1.1fr 1fr" }}>
          <div className="drill-list" id="ind-drill-modules" />
          {' '}
          <div className="drill-detail" id="ind-drill-side" />
        </div>
      </div>
    </section>
  );
}
