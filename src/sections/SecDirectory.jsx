/* SecDirectory — converted 1:1 from karya-vaani_v3.html · <section id="sec-directory"> */
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
          <div className="page-eyebrow">Directory · every worker in one searchable view</div>
          {' '}
          <h1 className="page-title">
            {"Find any worker, "}
            <em>drill into</em>
            {" their compliance"}
          </h1>
          {' '}
          <p className="page-sub">
            One searchable grid across all direct employees and contract workers. Filter by track or compliance status, search by name, ID, role or contractor — then open any worker to drill into their full compliance detail.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" onClick={(event) => { window.dirExport() }} data-onclick="dirExport()">
            Export directory
          </button>
        </div>
      </div>
      {' '}
      {/*  KPI strip  */}
      {' '}
      <div className="g4" style={{ marginBottom: "18px" }}>
        <div className="kpi">
          <div className="kpi-eye">Total workforce</div>
          <div className="kpi-val" id="dir-kpi-total">—</div>
          <div className="kpi-sub" id="dir-kpi-split">—</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Compliant</div>
          <div className="kpi-val" id="dir-kpi-ok" style={{ color: "var(--green-dk)" }}>—</div>
          <div className="kpi-sub">no open compliance issue</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Needs attention</div>
          <div className="kpi-val" id="dir-kpi-watch" style={{ color: "var(--amber-dk)" }}>—</div>
          <div className="kpi-sub">pending or expiring items</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Critical</div>
          <div className="kpi-val" id="dir-kpi-crit" style={{ color: "var(--red-dk)" }}>—</div>
          <div className="kpi-sub">breach · blocked from push</div>
        </div>
      </div>
      {' '}
      <div className="card">
        <div className="card-h">
          <div>
            <div className="card-h-title">Worker directory</div>
            {' '}
            <div className="card-h-sub">Search, filter, then click any worker to drill into compliance detail</div>
          </div>
          {' '}
          <span className="pill outline" id="dir-count">—</span>
        </div>
        {' '}
        {/*  search + filters  */}
        {' '}
        <div className="dir-controls">
          <div className="wk-search dir-search">
            <span className="wk-search-ico">⌕</span>
            {' '}
            <input type="text" id="dir-search" className="wk-search-in" autoComplete="off" placeholder="Search by name, worker ID, role or contractor…" onInput={(event) => { window.dirRender() }} />
            {' '}
            <span className="wk-search-clear" id="dir-search-clear" onClick={(event) => { window.dirSearchClear() }} data-onclick="dirSearchClear()" style={{ display: "none" }}>
              ✕
            </span>
          </div>
          {' '}
          <div className="dir-filters" id="dir-filter-track">
            <button className="dir-fbtn on" onClick={(event) => { window.dirFilter('track','all') }} data-onclick="dirFilter('track','all')">
              All workers
            </button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.dirFilter('track','direct') }} data-onclick="dirFilter('track','direct')">
              Direct
            </button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.dirFilter('track','contract') }} data-onclick="dirFilter('track','contract')">
              Contract
            </button>
          </div>
          {' '}
          <div className="dir-filters" id="dir-filter-status">
            <button className="dir-fbtn on" onClick={(event) => { window.dirFilter('status','all') }} data-onclick="dirFilter('status','all')">
              Any status
            </button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.dirFilter('status','ok') }} data-onclick="dirFilter('status','ok')">
              Compliant
            </button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.dirFilter('status','watch') }} data-onclick="dirFilter('status','watch')">
              Attention
            </button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.dirFilter('status','critical') }} data-onclick="dirFilter('status','critical')">
              Critical
            </button>
          </div>
        </div>
        {' '}
        <table className="t" id="dir-grid">
          <thead>
            <tr>
              <th>Worker</th>
              <th>Track</th>
              <th>Role / Category</th>
              <th>Department / Contractor</th>
              <th>Compliance</th>
              <th style={{ textAlign: "right" }}>Detail</th>
            </tr>
          </thead>
          <tbody id="dir-grid-body" />
        </table>
        {' '}
        <div id="dir-noresults" className="wk-noresults" style={{ display: "none" }}>
          No workers match your search and filters.
        </div>
      </div>
      {' '}
      {' '}
      {/*  ─── OM Manpower · manager mapping (real roster from the .ods) ───  */}
      {' '}
      <div className="g4" style={{ margin: "22px 0 18px" }}>
        <div className="kpi">
          <div className="kpi-eye">OM Manpower associates</div>
          <div className="kpi-val" id="om-kpi-assoc">—</div>
          <div className="kpi-sub">contract workforce · SRICITY-FG</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Reporting managers</div>
          <div className="kpi-val" id="om-kpi-mgr">—</div>
          <div className="kpi-sub">across the roster</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Departments</div>
          <div className="kpi-val" id="om-kpi-dept">—</div>
          <div className="kpi-sub">production · warehouse · more</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Languages</div>
          <div className="kpi-val" id="om-kpi-lang">—</div>
          <div className="kpi-sub">preferred for broadcasts</div>
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
                <th>Associate code</th>
                <th>Name</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Reporting manager</th>
                <th>UAN no</th>
                <th>ESI no</th>
                <th>Language</th>
              </tr>
            </thead>
            <tbody id="om-grid-body" />
          </table>
        </div>
        {' '}
        <div id="om-noresults" className="wk-noresults" style={{ display: "none" }}>
          No associates match your search and filters.
        </div>
      </div>
      {/*  ─── compliance drill-down ───  */}
      {' '}
      <div className="drill" id="dir-drill" style={{ display: "none" }}>
        <div className="drill-h">
          <div className="drill-h-left">
            <span className="drill-h-eye" id="dir-drill-eye">Compliance detail</span>
            {' '}
            <span className="drill-h-title" id="dir-drill-title">—</span>
            {' '}
            <span className="drill-h-sub" id="dir-drill-sub">—</span>
          </div>
          {' '}
          <div className="drill-h-stats" id="dir-drill-stats" />
          {' '}
          <span className="drill-h-close" onClick={(event) => { window.dirCloseDrill() }} data-onclick="dirCloseDrill()">
            Close ✕
          </span>
        </div>
        {' '}
        <div className="dir-drill-body" id="dir-drill-body" />
      </div>
    </section>
  );
}
