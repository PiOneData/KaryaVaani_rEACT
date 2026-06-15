/* SecCtdirectory — converted 1:1 from karya-vaani_v3.html · <section id="sec-ctdirectory"> */
export default function SecCtdirectory() {
  return (
    <section id="sec-ctdirectory" className="section">
      <div className="crumbs">
        <span>Directory</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Contractor directory</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Directory · every contractor in one searchable view</div>
          {' '}
          <h1 className="page-title">
            {"Find any contractor, "}
            <em>drill into</em>
            {" their compliance"}
          </h1>
          {' '}
          <p className="page-sub">
            One searchable grid of every engaged contractor. Filter by compliance standing, search by name, ID, area or lead — then open any contractor to drill into their full compliance profile, statutory standing and liability exposure.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" onClick={(event) => { window.ctdExport() }} data-onclick="ctdExport()">
            Export directory
          </button>
        </div>
      </div>
      {' '}
      {/*  KPI strip  */}
      {' '}
      <div className="g4" style={{ marginBottom: "18px" }}>
        <div className="kpi">
          <div className="kpi-eye">Contractors engaged</div>
          <div className="kpi-val" id="ctd-kpi-total">—</div>
          <div className="kpi-sub" id="ctd-kpi-deployed">—</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Compliant</div>
          <div className="kpi-val" id="ctd-kpi-ok" style={{ color: "var(--green-dk)" }}>—</div>
          <div className="kpi-sub">score 80+ · no open issue</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Needs attention</div>
          <div className="kpi-val" id="ctd-kpi-watch" style={{ color: "var(--amber-dk)" }}>—</div>
          <div className="kpi-sub">pending or expiring items</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Critical</div>
          <div className="kpi-val" id="ctd-kpi-crit" style={{ color: "var(--red-dk)" }}>—</div>
          <div className="kpi-sub">breach · joint-liability risk</div>
        </div>
      </div>
      {' '}
      <div className="card">
        <div className="card-h">
          <div>
            <div className="card-h-title">Contractor directory</div>
            {' '}
            <div className="card-h-sub">Search, filter, then click any contractor to drill into compliance detail</div>
          </div>
          {' '}
          <span className="pill outline" id="ctd-count">—</span>
        </div>
        {' '}
        <div className="dir-controls">
          <div className="wk-search dir-search">
            <span className="wk-search-ico">⌕</span>
            {' '}
            <input type="text" id="ctd-search" className="wk-search-in" autoComplete="off" placeholder="Search by contractor name, ID, deployment area or compliance lead…" onInput={(event) => { window.ctdRender() }} />
            {' '}
            <span className="wk-search-clear" id="ctd-search-clear" onClick={(event) => { window.ctdSearchClear() }} data-onclick="ctdSearchClear()" style={{ display: "none" }}>
              ✕
            </span>
          </div>
          {' '}
          <div className="dir-filters" id="ctd-filter-status">
            <button className="dir-fbtn on" onClick={(event) => { window.ctdFilter('all') }} data-onclick="ctdFilter('all')">
              Any status
            </button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.ctdFilter('ok') }} data-onclick="ctdFilter('ok')">
              Compliant
            </button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.ctdFilter('watch') }} data-onclick="ctdFilter('watch')">
              Attention
            </button>
            {' '}
            <button className="dir-fbtn" onClick={(event) => { window.ctdFilter('critical') }} data-onclick="ctdFilter('critical')">
              Critical
            </button>
          </div>
        </div>
        {' '}
        <table className="t" id="ctd-grid">
          <thead>
            <tr>
              <th>Contractor</th>
              <th>Deployment area</th>
              <th>Workers</th>
              <th>Compliance score</th>
              <th>Standing</th>
              <th style={{ textAlign: "right" }}>Detail</th>
            </tr>
          </thead>
          <tbody id="ctd-grid-body" />
        </table>
        {' '}
        <div id="ctd-noresults" className="wk-noresults" style={{ display: "none" }}>
          No contractors match your search and filters.
        </div>
      </div>
      {' '}
      {/*  ─── contractor compliance drill-down ───  */}
      {' '}
      <div className="drill" id="ctd-drill" style={{ display: "none" }}>
        <div className="drill-h">
          <div className="drill-h-left">
            <span className="drill-h-eye" id="ctd-drill-eye">Contractor compliance detail</span>
            {' '}
            <span className="drill-h-title" id="ctd-drill-title">—</span>
            {' '}
            <span className="drill-h-sub" id="ctd-drill-sub">—</span>
          </div>
          {' '}
          <div className="drill-h-stats" id="ctd-drill-stats" />
          {' '}
          <span className="drill-h-close" onClick={(event) => { window.ctdCloseDrill() }} data-onclick="ctdCloseDrill()">
            Close ✕
          </span>
        </div>
        {' '}
        <div className="dir-drill-body" id="ctd-drill-body" />
      </div>
    </section>
  );
}
