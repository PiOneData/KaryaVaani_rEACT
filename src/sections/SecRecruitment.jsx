/* SecRecruitment — converted 1:1 from karya-vaani_v3.html · <section id="sec-recruitment"> */
export default function SecRecruitment() {
  return (
    <section id="sec-recruitment" className="section">
      <div className="crumbs">
        <span>Operational Pillars</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Talent Acquisition & Progression</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Module 1 · success factors · Position IDs · SLAs · progress ladders</div>
          {' '}
          <h1 className="page-title">
            {"Track every "}
            <em>Position ID</em>
            {" through the progression ladder"}
          </h1>
          {' '}
          <p className="page-sub">
            Each requisition gets a persistent Position ID with explicit success factors, SLAs and an inspectable progress ladder. Stages, breach reasons, hiring manager and recruiter ownership are captured at every step and rolled up by function, location and recruiter.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" disabled title="Coming soon">Configure ladder</button>
          {' '}
          <button className="btn primary" disabled title="Coming soon">+ New requisition</button>
        </div>
      </div>
      {' '}
      <div className="g4" style={{ marginBottom: "18px" }}>
        <div className="kpi">
          <div className="kpi-eye">Open positions</div>
          <div className="kpi-val">14</div>
          <div className="kpi-sub">Plant floor 5 · Engg 2 · Other 7</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Avg time to fill</div>
          <div className="kpi-val">
            38
            <small>d</small>
          </div>
          <div className="kpi-sub">
            <span className="kpi-delta dn">▼ 6d</span>
            {" vs target 45d"}
          </div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Offer acceptance</div>
          <div className="kpi-val">
            82
            <small>%</small>
          </div>
          <div className="kpi-sub">last 90 days</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">SLA breaches</div>
          <div className="kpi-val">2</div>
          <div className="kpi-sub">Sourcing · Screening</div>
        </div>
      </div>
      {' '}
      <div className="card" style={{ marginBottom: "16px" }} id="req-detail-card">
        <div className="card-h">
          <div>
            <div className="card-h-title" id="req-detail-title">—</div>
            {' '}
            <div className="card-h-sub" id="req-detail-sub">—</div>
          </div>
          {' '}
          <span className="pill" id="req-detail-pill">—</span>
        </div>
        {' '}
        <div className="ladder" id="req-ladder" />
        {' '}
        <div className="note" id="req-detail-note" style={{ marginTop: "14px" }} />
        {' '}
        <div id="req-ref-host" style={{ marginTop: "14px" }} />
      </div>
      {' '}
      <div className="card">
        <div className="card-h">
          <div>
            <div className="card-h-title">Open requisitions</div>
            {' '}
            <div className="card-h-sub" id="req-grid-sub">
              Click any row to inspect · click any stage to jump to that step in the ladder
            </div>
          </div>
          {' '}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div className="search-wrap">
              <input type="text" id="req-search" className="search-input" placeholder="Search Position ID, role, function…" autoComplete="off" />
              {' '}
              <span id="req-search-clear" className="search-clear" title="Clear">✕</span>
            </div>
            {' '}
            <span className="tiny muted" id="req-sort-state">Sorted by Days open · desc</span>
            {' '}
            <span className="card-h-action" onClick={(event) => { window.resetReqSort() }} data-onclick="resetReqSort()">
              Reset
            </span>
            {' '}
            <button className="dl-btn" onClick={(event) => { window.downloadReqs() }} data-onclick="downloadReqs()" title="Download as Excel">
              Excel
            </button>
          </div>
        </div>
        {' '}
        <table className="t" id="req-grid">
          <thead>
            <tr>
              <th className="sortable" data-col="id">
                Position ID
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="role">
                Role
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="fn">
                Function
                <span className="sort-ind">↕</span>
              </th>
              <th>Contractor</th>
              <th className="sortable" data-col="knRef">
                Decision ref
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="apprRank">
                Approval
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="stageIdx">
                Stage
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="days">
                Days open
                <span className="sort-ind">↕</span>
              </th>
              <th className="sortable" data-col="slaRank">
                SLA
                <span className="sort-ind">↕</span>
              </th>
            </tr>
          </thead>
          <tbody id="req-grid-body" />
        </table>
      </div>
    </section>
  );
}
