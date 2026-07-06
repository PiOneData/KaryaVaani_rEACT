/* SecDirectory — Directory · Worker directory.
   Trimmed to show ONLY the OM Manpower · manager mapping (the real roster from
   the attendance / mapping sheet) — the demo "Worker directory" grid, its KPI
   strip and compliance drill-down were removed since that data was illustrative
   only. The OM roster is the single real dataset here. */
export default function SecDirectory() {
  return (
    <section id="sec-directory" className="section">
      <div className="crumbs">
        <span>Directory</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Worker directory</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Directory · OM Manpower manager mapping</div>
          {' '}
          <h1 className="page-title">
            {"OM Manpower · "}
            <em>manager mapping</em>
          </h1>
          {' '}
          <p className="page-sub">
            The live roster from the OM Manpower attendance / mapping sheet — every associate with
            their designation, department, reporting manager and statutory IDs (UAN / ESI). Search,
            sort, or filter by department.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" onClick={(event) => { window.omExport() }} data-onclick="omExport()">
            Export roster
          </button>
        </div>
      </div>
      {' '}
      {/*  ─── OM Manpower · manager mapping (real roster from the .ods) ───  */}
      {' '}
      <div className="g4" style={{ margin: "4px 0 18px" }}>
        <div className="kpi">
          <div className="kpi-eye">OM Manpower associates</div>
          <div className="kpi-val" id="om-kpi-assoc">—</div>
          <div className="kpi-sub">workforce · SRICITY-FG</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Compliant</div>
          <div className="kpi-val" id="om-kpi-compliant" style={{ color: "var(--green-dk)" }}>—</div>
          <div className="kpi-sub" id="om-kpi-compliant-sub">—</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Non-compliant</div>
          <div className="kpi-val" id="om-kpi-noncompliant" style={{ color: "var(--red-dk)" }}>—</div>
          <div className="kpi-sub" id="om-kpi-noncompliant-sub">—</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Aadhaar pending</div>
          <div className="kpi-val" id="om-kpi-aadhaar" style={{ color: "var(--amber-dk)" }}>—</div>
          <div className="kpi-sub">eKYC not verified · click a row</div>
        </div>
      </div>
      {' '}
      <div className="card">
        <div className="card-h">
          <div>
            <div className="card-h-title">OM Manpower · manager mapping</div>
            {' '}
            <div className="card-h-sub">Live roster from the attendance / mapping sheet — associate, designation, department, reporting manager and statutory IDs</div>
          </div>
          {' '}
          <span className="pill outline" id="om-count">—</span>
        </div>
        {' '}
        <div className="dir-controls">
          <div className="wk-search dir-search">
            <span className="wk-search-ico">⌕</span>
            {' '}
            <input type="text" id="om-search" className="wk-search-in" autoComplete="off" placeholder="Search by name, code, designation, manager, UAN…" onInput={(event) => { window.omSearch() }} />
            {' '}
            <span className="wk-search-clear" id="om-search-clear" onClick={(event) => { window.omSearchClear() }} data-onclick="omSearchClear()" style={{ display: "none" }}>
              ✕
            </span>
          </div>
          {' '}
          <div className="dir-filters" id="om-filter-dept">
            <button className="dir-fbtn on" onClick={(event) => { window.omFilterDept('all', event.currentTarget) }} data-onclick="omFilterDept('all',this)">All depts</button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.omFilterDept('Production', event.currentTarget) }} data-onclick="omFilterDept('Production',this)">Production</button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.omFilterDept('Warehouse', event.currentTarget) }} data-onclick="omFilterDept('Warehouse',this)">Warehouse</button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.omFilterDept('Utility', event.currentTarget) }} data-onclick="omFilterDept('Utility',this)">Utility</button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.omFilterDept('Quality Control', event.currentTarget) }} data-onclick="omFilterDept('Quality Control',this)">Quality Control</button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.omFilterDept('GA', event.currentTarget) }} data-onclick="omFilterDept('GA',this)">GA</button>
          </div>
        </div>
        {' '}
        <div style={{ overflowX: "auto" }}>
          <table className="t" id="om-grid">
            <thead>
              <tr>
                <th className="om-th-sort" data-omcol="code" onClick={(event) => { window.omSort('code') }}>Associate code <span className="om-caret">⇅</span></th>
                <th className="om-th-sort" data-omcol="name" onClick={(event) => { window.omSort('name') }}>Name <span className="om-caret">⇅</span></th>
                <th className="om-th-sort" data-omcol="desig" onClick={(event) => { window.omSort('desig') }}>Designation <span className="om-caret">⇅</span></th>
                <th className="om-th-sort" data-omcol="dept" onClick={(event) => { window.omSort('dept') }}>Department <span className="om-caret">⇅</span></th>
                <th className="om-th-sort" data-omcol="mgr" onClick={(event) => { window.omSort('mgr') }}>Reporting manager <span className="om-caret">⇅</span></th>
                <th className="om-th-sort" data-omcol="uan" onClick={(event) => { window.omSort('uan') }}>UAN no <span className="om-caret">⇅</span></th>
                <th className="om-th-sort" data-omcol="esi" onClick={(event) => { window.omSort('esi') }}>ESI no <span className="om-caret">⇅</span></th>
                <th className="om-th-sort" data-omcol="lang" onClick={(event) => { window.omSort('lang') }}>Language <span className="om-caret">⇅</span></th>
                <th className="om-th-sort" data-omcol="compliance" onClick={(event) => { window.omSort('compliance') }}>Compliance <span className="om-caret">⇅</span></th>
              </tr>
            </thead>
            <tbody id="om-grid-body" />
          </table>
        </div>
        {' '}
        <div id="om-noresults" className="wk-noresults" style={{ display: "none" }}>
          No associates match your search and filters.
        </div>
        {' '}
        <div id="om-pagination" className="om-pagination" />
      </div>
      {' '}
      {/* ─── Onboarded workers (from the Onboarding module · stored in the DB) ─── */}
      <div className="card" style={{ marginTop: "18px" }}>
        <div className="card-h">
          <div>
            <div className="card-h-title">Onboarded workers</div>
            <div className="card-h-sub">Profiles captured in Onboarding — tracked here with compliance · click a row for full details · edit or remove</div>
          </div>
          <span className="pill outline" id="ob-count">—</span>
        </div>
        <div className="dir-controls" style={{ marginBottom: "10px" }}>
          <input type="text" className="input" id="ob-search" autoComplete="off" placeholder="Search ID, name, type, category, contractor, status…" style={{ maxWidth: "380px" }} />
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="t" id="ob-grid">
            <thead>
              <tr>
                <th>Worker ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Category</th>
                <th>Contractor / Position</th>
                <th>Aadhaar</th>
                <th>Status</th>
                <th>Compliance</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody id="ob-grid-body" />
          </table>
        </div>
        <div id="ob-pagination" className="om-pagination" />
        <div id="ob-noresults" className="wk-noresults">
          No workers onboarded yet — capture a profile in Onboarding (Operational Pillars).
        </div>
      </div>
    </section>
  );
}
