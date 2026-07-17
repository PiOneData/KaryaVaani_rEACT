/* SecOnboarding — converted 1:1 from karya-vaani_v3.html · <section id="sec-onboarding"> */
export default function SecOnboarding() {
  return (
    <section id="sec-onboarding" className="section">
      <div className="crumbs">
        <span>Operational Pillars</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Onboarding</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Module 2 · single worker entity, two tracks</div>
          {' '}
          <h1 className="page-title">
            {"Verify, induct, attest — "}
            <em>differently</em>
            {" for direct vs. contract"}
          </h1>
          {' '}
          <p className="page-sub">
            {"Single worker entity with a "}
            <span className="mono">worker_type</span>
            {" discriminator. Direct employees and contract workers share a document store and audit trail; statutory requirements diverge where they must."}
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" id="ob-back-ct" onClick={(event) => { window.nav('ct-home', null) }} data-onclick="nav('ct-home', null)">← Contractor home</button>
          {' '}
          <button className="btn" onClick={(event) => { window.obGotoCapture('bulk') }} data-onclick="obGotoCapture('bulk')">Bulk import</button>
          {' '}
          <button className="btn primary" onClick={(event) => { window.obGotoCapture('single') }} data-onclick="obGotoCapture('single')">+ Start onboarding</button>
        </div>
      </div>
      {' '}
      {/*  ─── verification status dashboard summary ───  */}
      {' '}
      <div id="vdash-alert-host" />
      {' '}
      <div className="vdash">
        <div className="vdash-kpis">
          <div className="vdash-kpi green">
            <div className="vdash-kpi-eye">
              <span className="dot" style={{ background: "var(--green)" }} />
              Verified
            </div>
            {' '}
            <div className="vdash-kpi-val" id="vd-done">—</div>
            {' '}
            <div className="vdash-kpi-sub">
              <span className="pct" id="vd-done-pct">—</span>
              {" of all checks"}
            </div>
          </div>
          {' '}
          <div className="vdash-kpi amber">
            <div className="vdash-kpi-eye">
              <span className="dot" style={{ background: "var(--amber)" }} />
              Pending
            </div>
            {' '}
            <div className="vdash-kpi-val" id="vd-pending">—</div>
            {' '}
            <div className="vdash-kpi-sub">
              <span id="vd-pending-self">—</span>
              {" self-attest · "}
              <span id="vd-pending-dig">—</span>
              {" digital · "}
              <span id="vd-pending-esic">—</span>
              {" ESIC"}
            </div>
          </div>
          {' '}
          <div className="vdash-kpi red">
            <div className="vdash-kpi-eye">
              <span className="dot" style={{ background: "var(--red)" }} />
              Action required
            </div>
            {' '}
            <div className="vdash-kpi-val" id="vd-rejected">—</div>
            {' '}
            <div className="vdash-kpi-sub" id="vd-rej-action">—</div>
          </div>
          {' '}
          <div className="vdash-kpi indigo">
            <div className="vdash-kpi-eye">
              <span className="dot" style={{ background: "var(--indigo)" }} />
              Workers in onboarding
            </div>
            {' '}
            <div className="vdash-kpi-val" id="vd-workers">
              —
              <small id="vd-workers-split">—</small>
            </div>
            {' '}
            <div className="vdash-kpi-sub">
              <span id="vd-blocked">—</span>
              {" blocked from push to HRIS"}
            </div>
          </div>
          {' '}
          <div className="vdash-kpi" style={{ gridColumn: "span 2" }}>
            <div className="vdash-kpi-eye">
              <span className="dot" style={{ background: "var(--blue)" }} />
              Digital evidence vs self-attest
            </div>
            {' '}
            <div className="vdash-kpi-val" id="vd-digital-ratio">
              —
              <small id="vd-digital-sub">—</small>
            </div>
            {' '}
            <div className="vdash-kpi-sub" id="vd-digital-line">—</div>
          </div>
        </div>
        {' '}
        <div className="vdash-card">
          <div className="vdash-card-h">
            <div className="vdash-card-title">Verification breakdown</div>
            {' '}
            <div className="vdash-card-sub">by track & type</div>
          </div>
          {' '}
          <div id="vd-breakdown" />
          {' '}
          <div className="stack-legend">
            <span className="lg">
              <span className="d" style={{ background: "var(--green)" }} />
              Done
            </span>
            {' '}
            <span className="lg">
              <span className="d" style={{ background: "var(--amber)" }} />
              Pending
            </span>
            {' '}
            <span className="lg">
              <span className="d" style={{ background: "var(--red)" }} />
              Rejected
            </span>
          </div>
        </div>
      </div>
      {' '}
      {/*  ─── generic worker search · spans the whole module ───  */}
      {' '}
      <div className="ob-search-bar">
        <div className="wk-search ob-search-input">
          <span className="wk-search-ico">⌕</span>
          {' '}
          <input type="text" id="ob-gsearch" className="wk-search-in" autoComplete="off" placeholder="Search any employee or contract worker — by name, ID, role, contractor or verification action…" onInput={(event) => { window.obSearch() }} onFocus={(event) => { window.obSearch() }} />
          {' '}
          <span className="wk-search-clear" id="ob-gsearch-clear" onClick={(event) => { window.obSearchClear() }} data-onclick="obSearchClear()" style={{ display: "none" }}>
            ✕
          </span>
        </div>
        {' '}
        <div className="ob-search-results" id="ob-gsearch-results" style={{ display: "none" }} />
      </div>
      {' '}
      <div className="tabs">
        <div className="tab on" onClick={(event) => { window.subTab(event,'ob','capture') }} data-onclick="subTab(event,'ob','capture')">
          Capture / Upload personal details
        </div>
        {' '}
        <div className="tab" onClick={(event) => { window.subTab(event,'ob','track') }} data-onclick="subTab(event,'ob','track')">
          All Employee Track
        </div>
        {' '}
        <div className="tab" onClick={(event) => { window.subTab(event,'ob','docs') }} data-onclick="subTab(event,'ob','docs')">
          Shared document store
        </div>
      </div>
      {' '}
      {/*  ─── ALL EMPLOYEE TRACK — every onboarded employee, contractor-scoped ───  */}
      {' '}
      <div id="ob-track" className="subpane" style={{ display: "none" }}>
        <div className="card">
          <div className="card-h">
            <div>
              <div className="card-h-title">All Employee Track</div>
              {' '}
              <div className="card-h-sub" id="obt-scope">All onboarded employees</div>
            </div>
            {' '}
            <span className="pill outline" id="obt-count">0 employees</span>
          </div>
          {' '}
          <div className="wk-search">
            <span className="wk-search-ico">⌕</span>
            {' '}
            <input type="text" id="obt-search" className="wk-search-in" autoComplete="off" placeholder="Search by name, ID, route, gender or stage…" />
          </div>
          {' '}
          <table className="t" id="obt-grid">
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Route</th>
                <th>Gender / shift</th>
                <th>Aadhaar</th>
                <th>Onboarding stage</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody id="obt-body" />
          </table>
          {' '}
          <div id="obt-noresults" className="wk-noresults" style={{ display: "none" }}>
            No employees onboarded yet. Use Capture / Upload to add them.
          </div>
          {' '}
          <div id="obt-pagination" className="kv-pager" />
        </div>
      </div>
      {' '}
      <div id="ob-direct" className="subpane" style={{ display: "none" }}>
        <div className="g23">
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">In-progress · direct employees</div>
                {' '}
                <div className="card-h-sub">
                  Search and click a worker to inspect the verification ledger and action history
                </div>
              </div>
              {' '}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="pill outline" id="wk-count">9 active</span>
                {' '}
                <button className="dl-btn" onClick={(event) => { window.downloadDirect() }} data-onclick="downloadDirect()" title="Download as Excel">
                  Excel
                </button>
              </div>
            </div>
            {' '}
            <div className="wk-search">
              <span className="wk-search-ico">⌕</span>
              {' '}
              <input type="text" id="wk-search" className="wk-search-in" placeholder="Search by worker name, Position ID or role…" onInput={(event) => { window.wkSearch() }} />
              {' '}
              <span className="wk-search-clear" id="wk-search-clear" onClick={(event) => { window.wkSearchClear() }} data-onclick="wkSearchClear()" style={{ display: "none" }}>
                ✕
              </span>
            </div>
            {' '}
            <table className="t" id="wk-grid">
              <thead>
                <tr>
                  <th className="sortable" data-col="name">
                    Worker
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="posId">
                    Position ID
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="role">
                    Role
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="stageRank">
                    Stage
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="vRank">
                    Verification
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="ppeRank">
                    PPE / Size
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="indProg">
                    Induction
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="days">
                    Days
                    <span className="sort-ind">↕</span>
                  </th>
                </tr>
              </thead>
              <tbody id="wk-grid-body" />
            </table>
            {' '}
            <div id="wk-noresults" className="wk-noresults" style={{ display: "none" }}>
              No workers match that search.
            </div>
          </div>
          {' '}
          <div>
            <div className="card sunken" style={{ marginBottom: "14px" }}>
              <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Direct employee checklist</div>
              {' '}
              <hr className="div" />
              {' '}
              <div style={{ display: "flex", flexDirection: "column", gap: "7px", fontSize: "0.8rem", color: "var(--ink-2)" }}>
                <div className="row-between">
                  <span>Offer letter linked to Position ID</span>
                  <span className="pill green tiny">auto</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Aadhaar (eKYC where applicable)</span>
                  <span className="pill green tiny">auto</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>PAN + bank proof</span>
                  <span className="pill green tiny">auto</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>UAN portability check (EPFO)</span>
                  <span className="pill blue tiny">read-only</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Education + prior employment</span>
                  <span className="pill outline tiny">manual</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Standing-order acknowledgement</span>
                  <span className="pill green tiny">auto</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Code of conduct sign-off</span>
                  <span className="pill green tiny">auto</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Native-language welcome (WA)</span>
                  <span className="pill blue tiny">VAANI</span>
                </div>
              </div>
            </div>
            {' '}
            <div className="card">
              <div className="card-h-title" style={{ fontSize: "0.95rem" }}>On completion</div>
              {' '}
              <hr className="div" />
              {' '}
              <div className="tiny muted">
                Worker record pushes to Daikin HRIS via API handoff. Karya Vaani continues tracking in OHS and Compliance; master record now owned by HRIS.
              </div>
            </div>
          </div>
        </div>
        {' '}
        {/*  ─── per-worker verification drill-down ───  */}
        {' '}
        <div className="drill" id="wk-drill" style={{ display: "none" }}>
          <div className="drill-h">
            <div className="drill-h-left">
              <span className="drill-h-eye" id="wk-drill-eye">Verification ledger</span>
              {' '}
              <span className="drill-h-title" id="wk-drill-title">—</span>
              {' '}
              <span className="drill-h-sub" id="wk-drill-sub">—</span>
            </div>
            {' '}
            <div className="drill-h-stats" id="wk-drill-stats" />
            {' '}
            <span className="drill-h-close" onClick={(event) => { window.closeWkDrill() }} data-onclick="closeWkDrill()">
              Close ✕
            </span>
          </div>
          {' '}
          <div className="drill-body">
            <div className="drill-list">
              <div className="drill-list-h">
                <span>Documents & evidence</span>
                {' '}
                <span className="tiny muted" id="wk-drill-count">—</span>
              </div>
              {' '}
              <div id="wk-drill-list" />
            </div>
            {' '}
            <div className="drill-detail" id="wk-drill-detail" />
          </div>
        </div>
      </div>
      {' '}
      <div id="ob-contract" className="subpane" style={{ display: "none" }}>
        <div className="note red" style={{ marginBottom: "16px" }}>
          <strong>ESIC 3-day rule is the single highest-frequency contractor failure.</strong>
          {" Every contract worker must be enrolled in ESIC within 3 calendar days of joining. Karya Vaani enforces this gate; new contract workers cannot reach Ready-to-push without a valid ESIC IP number.\n    "}
        </div>
        {' '}
        <div className="g23">
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">In-progress · contract workers</div>
                {' '}
                <div className="card-h-sub">
                  Click any column to sort · ESIC breaches surface first when sorted by ESIC · Notify the vendor inline
                </div>
              </div>
              {' '}
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span className="pill outline" id="cw-count">— active</span>
                {' '}
                <button className="dl-btn" onClick={(event) => { window.downloadContract() }} data-onclick="downloadContract()" title="Download as Excel">
                  Excel
                </button>
              </div>
            </div>
            {' '}
            <table className="t" id="cw-grid">
              <thead>
                <tr>
                  <th className="sortable" data-col="name">
                    Worker
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="contractor">
                    Contractor
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="catRank">
                    Category
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="esicRank">
                    ESIC
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="migrant">
                    Migrant
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="clraRank">
                    CLRA
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="ppeRank">
                    PPE / Size
                    <span className="sort-ind">↕</span>
                  </th>
                  <th className="sortable" data-col="indProg">
                    Induction
                    <span className="sort-ind">↕</span>
                  </th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="cw-grid-body" />
            </table>
          </div>
          {' '}
          <div>
            <div className="card sunken">
              <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Contractor track checklist</div>
              {' '}
              <hr className="div" />
              {' '}
              <div style={{ display: "flex", flexDirection: "column", gap: "7px", fontSize: "0.8rem", color: "var(--ink-2)" }}>
                <div className="row-between">
                  <span>Linked to Contractor Master</span>
                  <span className="pill green tiny">required</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>ESIC enrolment ≤ 3 days</span>
                  <span className="pill red tiny">HARD GATE</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Worker category (skilled / semi…)</span>
                  <span className="pill amber tiny">min-wage</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Migrant registration (ISMW / OSHC)</span>
                  <span className="pill blue tiny">if applicable</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Contractor-specific induction</span>
                  <span className="pill blue tiny">statutory</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>CLRA licence reference + expiry</span>
                  <span className="pill green tiny">auto</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {' '}
      {/*  ─── capture personal details · profile-page redesign ───  */}
      {' '}
      <div id="ob-capture" className="subpane">
        {/*  mode switch: single profile vs bulk  */}
        {' '}
        <div className="cap-mode" id="cap-mode">
          <button className="cap-mode-btn on" onClick={(event) => { window.capSetMode('single') }} data-onclick="capSetMode('single')">
            <span className="cap-mode-ico">◑</span>
            {' '}
            <span>
              <span className="cap-mode-t">Single profile</span>
              <span className="cap-mode-s">Capture one worker at a time</span>
            </span>
          </button>
          {' '}
          <button className="cap-mode-btn" onClick={(event) => { window.capSetMode('bulk') }} data-onclick="capSetMode('bulk')">
            <span className="cap-mode-ico">⊞</span>
            {' '}
            <span>
              <span className="cap-mode-t">Bulk upload</span>
              <span className="cap-mode-s">Import many from a spreadsheet</span>
            </span>
          </button>
        </div>
        {' '}
        {/*  ════ SINGLE PROFILE ════  */}
        {' '}
        <div id="cap-single">
          <div className="cap-profile">
            {/*  profile sidebar: photo + identity + status  */}
            {' '}
            <aside className="cap-pside">
              <div className="cap-photo" id="cap-photo" onClick={(event) => { document.getElementById('cap-photo-input').click() }} data-onclick="document.getElementById('cap-photo-input').click()">
                <div className="cap-photo-img" id="cap-photo-img">
                  <span className="cap-photo-ph" id="cap-photo-ph">◍</span>
                </div>
                {' '}
                <div className="cap-photo-edit">Upload photo</div>
                {' '}
                <input type="file" id="cap-photo-input" accept="image/*" style={{ display: "none" }} onChange={(event) => { window.capPhoto(event) }} />
              </div>
              {' '}
              <div className="cap-pside-name" id="cap-pside-name">New worker</div>
              {' '}
              <div className="cap-pside-meta" id="cap-pside-meta">Profile not yet saved</div>
              {' '}
              <div className="cap-type-toggle" id="cap-type-toggle" style={{ margin: "14px 0 4px", width: "100%" }}>
                <button className="cap-type-btn on" onClick={(event) => { window.capSetType('direct') }} data-onclick="capSetType('direct')">
                  Direct
                </button>
                {' '}
                <button className="cap-type-btn" onClick={(event) => { window.capSetType('contract') }} data-onclick="capSetType('contract')">
                  Contract
                </button>
              </div>
              {' '}
              <hr className="div" />
              {' '}
              <div className="cap-pside-status">
                <div className="cap-pside-status-row">
                  <span>Photo</span>
                  <span className="cap-chk" id="cap-st-photo">○</span>
                </div>
                {' '}
                <div className="cap-pside-status-row">
                  <span>Personal details</span>
                  <span className="cap-chk" id="cap-st-personal">○</span>
                </div>
                {' '}
                <div className="cap-pside-status-row">
                  <span>Language set</span>
                  <span className="cap-chk" id="cap-st-lang">○</span>
                </div>
                {' '}
                <div className="cap-pside-status-row">
                  <span>PPE captured</span>
                  <span className="cap-chk" id="cap-st-ppe">○</span>
                </div>
                {' '}
                <div className="cap-pside-status-row">
                  <span>Worker confirmation</span>
                  <span className="cap-chk" id="cap-st-confirm">○</span>
                </div>
              </div>
              {' '}
              <hr className="div" />
              {' '}
              <div className="tiny muted">
                The worker reviews and confirms their own details via a secure link before the record is pushed to HRIS.
              </div>
            </aside>
            {' '}
            {/*  profile body: detail sections  */}
            {' '}
            <div className="cap-pbody">
              {/*  personal  */}
              {' '}
              <div className="card">
                <div className="cap-sec-h">
                  <span className="cap-sec-n">1</span>
                  {" Personal details"}
                </div>
                {' '}
                <div className="g2" style={{ gap: "10px 14px" }}>
                  <div className="field">
                    <label className="field-l">
                      {"Full name "}
                      <span className="cap-req">*</span>
                    </label>
                    <input className="input" id="cap-name" placeholder="As per Aadhaar" onInput={(event) => { window.capSync() }} />
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">
                      {"Date of birth "}
                      <span className="cap-req">*</span>
                    </label>
                    <input className="input" id="cap-dob" type="date" onChange={(event) => { window.capSync() }} />
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Gender</label>
                    {' '}
                    <select className="sel" id="cap-gender">
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                      <option>Prefer not to say</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">
                      {"Mobile Number / WhatsApp Number "}
                      <span className="cap-req">*</span>
                    </label>
                    <input className="input" id="cap-mobile" placeholder="10-digit · WhatsApp-enabled" onInput={(event) => { window.capSync() }} />
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">
                      {"Aadhaar number "}
                      <span className="cap-req">*</span>
                    </label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input className="input" id="cap-aadhaar" placeholder="XXXX XXXX XXXX" onInput={(event) => { window.capSync() }} style={{ flex: 1 }} />
                      <button type="button" className="btn" onClick={(event) => { window.capVerifyAadhaar() }} data-onclick="capVerifyAadhaar()" title="Upload Aadhaar document and auto-verify">Upload &amp; verify</button>
                    </div>
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">PAN number</label>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <input className="input" id="cap-pan" placeholder="ABCDE1234F" onInput={(event) => { window.capSync() }} style={{ flex: 1, textTransform: "uppercase" }} />
                      <button type="button" className="btn" onClick={(event) => { window.capVerifyPan() }} data-onclick="capVerifyPan()" title="Validate the PAN format">Verify</button>
                    </div>
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Emergency contact</label>
                    <input className="input" id="cap-emergency" placeholder="Name · relation · phone" />
                  </div>
                  {' '}
                  <div className="field" style={{ gridColumn: "span 2" }}>
                    <label className="field-l">Address line 1</label>
                    <input className="input" id="cap-addr1" placeholder="House / door no., street" />
                  </div>
                  {' '}
                  <div className="field" style={{ gridColumn: "span 2" }}>
                    <label className="field-l">Address line 2</label>
                    <input className="input" id="cap-addr2" placeholder="Area / landmark / village" />
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">City / town</label>
                    <input className="input" id="cap-city" placeholder="City or town" />
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">District</label>
                    <input className="input" id="cap-district" placeholder="District" />
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">PIN code</label>
                    <input className="input" id="cap-pin" placeholder="6-digit PIN" />
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Home state</label>
                    {' '}
                    <select className="sel" id="cap-homestate">
                      <option>Andhra Pradesh</option>
                      <option>Telangana</option>
                      <option>Tamil Nadu</option>
                      {' '}
                      <option>Odisha</option>
                      <option>West Bengal</option>
                      <option>Bihar</option>
                      {' '}
                      <option>Jharkhand</option>
                      <option>Uttar Pradesh</option>
                      <option>Other</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
                    <label className="cap-check">
                      <input type="checkbox" id="cap-migrant" />
                      {" Inter-state migrant worker (ISMW / OSHC)"}
                    </label>
                  </div>
                  {' '}
                  <div className="field" style={{ display: "flex", alignItems: "flex-end" }}>
                    <label className="cap-check">
                      <input type="checkbox" id="cap-nightconsent" />
                      {" Consents to night-shift (Shift C) transport — OSHC Rule 83"}
                    </label>
                  </div>
                </div>
                {' '}
                <div className="cap-hint" style={{ marginTop: "6px" }}>
                  Night-shift transport consent is required for workers rostered on Shift C (especially women, under OSHC Rule 83). It can also be collected later by the transport operator.
                </div>
              </div>
              {' '}
              {/*  language  */}
              {' '}
              <div className="card">
                <div className="cap-sec-h">
                  <span className="cap-sec-n">2</span>
                  {" Language & communication"}
                </div>
                {' '}
                <div className="field">
                  <label className="field-l">
                    {"Mother tongue / preferred language "}
                    <span className="cap-req">*</span>
                  </label>
                  {' '}
                  <div className="cap-lang-grid" id="cap-lang-grid" />
                  {' '}
                  <div className="cap-hint">
                    The confirmation link, native-language welcome and every safety briefing reach this worker in the language selected here.
                  </div>
                </div>
                {' '}
                <div className="g2" style={{ gap: "10px 14px" }}>
                  <div className="field">
                    <label className="field-l">Can read this language</label>
                    {' '}
                    <select className="sel" id="cap-canread">
                      <option>Yes — text + voice</option>
                      <option>Limited — voice preferred</option>
                      <option>No — voice only</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Spoken languages (also understands)</label>
                    {' '}
                    <input className="input" id="cap-spoken" placeholder="e.g. Telugu, Hindi" />
                  </div>
                </div>
              </div>
              {' '}
              {/*  employment  */}
              {' '}
              <div className="card">
                <div className="cap-sec-h">
                  <span className="cap-sec-n">3</span>
                  {' '}
                  <span id="cap-emp-title">Employment details</span>
                </div>
                {' '}
                <div className="note indigo cap-only-direct" style={{ marginBottom: "14px" }}>
                  <strong>Tagged to an approved record.</strong>
                  {" Pick an approved Position ID — the department, role and worker category are pulled from the position record created and approved in Talent Acquisition, so they cannot drift from what was sanctioned. "}
                  <span id="cap-approval-note" className="cap-gate-note" />
                </div>
                {' '}
                <div className="note indigo cap-only-contract" style={{ marginBottom: "14px", display: "none" }}>
                  <strong>Tagged to an approved record.</strong>
                  {" Pick an approved work order — the contractor, CLRA licence and category are pulled from the contractor work-order record already created and approved in Vendor compliance.\n            "}
                </div>
                {' '}
                <div className="g2" style={{ gap: "10px 14px" }}>
                  <div className="field cap-only-direct">
                    <label className="field-l">
                      {"Approved Position ID "}
                      <span className="cap-req">*</span>
                    </label>
                    {' '}
                    <select className="sel" id="cap-posid" onChange={(event) => { window.capPickPosition() }}>
                      <option value="">Select an approved position…</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field cap-only-direct">
                    <label className="field-l">Department / zone</label>
                    {' '}
                    <select className="sel" id="cap-dept" disabled>
                      <option>Production · Compressor Line</option>
                      <option>Production · Paint Shop</option>
                      <option>Quality & QC</option>
                      <option>Logistics & dispatch</option>
                      <option>Maintenance</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field cap-only-contract" style={{ display: "none" }}>
                    <label className="field-l">
                      {"Approved work order "}
                      <span className="cap-req">*</span>
                    </label>
                    {' '}
                    <select className="sel" id="cap-workorder" onChange={(event) => { window.capPickWorkorder() }}>
                      <option value="">Select an approved work order…</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field cap-only-contract" style={{ display: "none" }}>
                    <label className="field-l">
                      {"Vendor / contractor "}
                      <span className="cap-req">*</span>
                    </label>
                    {' '}
                    <select className="sel" id="cap-contractor" onChange={(event) => { window.capSync() }}>
                      <option value="">Select vendor…</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field cap-only-contract" style={{ display: "none" }}>
                    <label className="field-l">CLRA licence reference</label>
                    <input className="input" id="cap-clra" placeholder="Pulled from work order" readOnly />
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">
                      {"Worker category "}
                      <span className="cap-req">*</span>
                    </label>
                    {' '}
                    <select className="sel" id="cap-category">
                      <option>Unskilled</option>
                      <option>Semi-skilled</option>
                      <option>Skilled</option>
                      <option>Highly skilled</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Designation</label>
                    <input className="input" id="cap-designation" placeholder="e.g. Machine operator, Helper, Welder" onInput={(event) => { window.capSync() }} />
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Department</label>
                    {' '}
                    <select className="sel" id="cap-department" onChange={(event) => { window.capSync() }}>
                      <option value="">Select department…</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Date of joining</label>
                    <input className="input" id="cap-doj" type="date" />
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Reporting manager</label>
                    {' '}
                    <select className="sel" id="cap-manager">
                      <option value="">Select reporting manager…</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">UAN no (EPFO)</label>
                    <input className="input" id="cap-uan" placeholder="12-digit UAN" onInput={(event) => { window.capSync() }} />
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">ESI no (IP number)</label>
                    <input className="input" id="cap-esi" placeholder="ESIC insurance number" onInput={(event) => { window.capSync() }} />
                  </div>
                  {' '}
                  <div className="field cap-only-contract" style={{ display: "none" }}>
                    <label className="field-l">Shift</label>
                    {' '}
                    <select className="sel" id="cap-shift">
                      <option>Morning</option>
                      <option>General</option>
                      <option>Night</option>
                    </select>
                  </div>
                </div>
              </div>
              {' '}
              {/*  PPE  */}
              {' '}
              <div className="card">
                <div className="cap-sec-h">
                  <span className="cap-sec-n">4</span>
                  {" PPE & uniform details"}
                </div>
                {' '}
                <div className="cap-hint" style={{ marginBottom: "10px" }}>
                  Safety briefings under Factories Act s.41-B cannot be closed until PPE is issued. Sizes captured here drive the Induction module's PPE issuance.
                </div>
                {' '}
                <div className="g3" style={{ gap: "10px 14px" }}>
                  <div className="field">
                    <label className="field-l">Uniform / coverall size</label>
                    {' '}
                    <select className="sel" id="cap-uniform" onChange={(event) => { window.capSync() }}>
                      <option>XS</option>
                      <option>S</option>
                      <option>M</option>
                      <option>L</option>
                      <option>XL</option>
                      <option>XXL</option>
                      <option>XXXL</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Safety shoe size (UK)</label>
                    {' '}
                    <select className="sel" id="cap-shoe" onChange={(event) => { window.capSync() }}>
                      <option>5</option>
                      <option>6</option>
                      <option>7</option>
                      <option>8</option>
                      <option>9</option>
                      <option>10</option>
                      <option>11</option>
                      <option>12</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Helmet size</label>
                    {' '}
                    <select className="sel" id="cap-helmet">
                      <option>Small</option>
                      <option>Medium</option>
                      <option>Large</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Glove size</label>
                    {' '}
                    <select className="sel" id="cap-glove">
                      <option>7 · S</option>
                      <option>8 · M</option>
                      <option>9 · L</option>
                      <option>10 · XL</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Prescription eyewear</label>
                    {' '}
                    <select className="sel" id="cap-eyewear">
                      <option>Not required</option>
                      <option>Required — Rx safety glasses</option>
                      <option>Required — Rx insert</option>
                    </select>
                  </div>
                  {' '}
                  <div className="field">
                    <label className="field-l">Hearing protection</label>
                    {' '}
                    <select className="sel" id="cap-hearing">
                      <option>Standard ear plugs</option>
                      <option>Ear muffs</option>
                      <option>Custom-moulded</option>
                    </select>
                  </div>
                </div>
                {' '}
                <div className="field">
                  <label className="field-l">Role-specific PPE — select all that apply</label>
                  {' '}
                  <div className="chips" id="cap-ppe-extra" />
                </div>
                {' '}
                <div className="field">
                  <label className="cap-check">
                    <input type="checkbox" id="cap-ppe-ack" onChange={(event) => { window.capSync() }} />
                    {" Worker briefed on PPE use & acknowledged issue (Factories Act s.41-B)"}
                  </label>
                </div>
              </div>
              {' '}
              {/*  documents  */}
              {' '}
              <div className="card">
                <div className="cap-sec-h">
                  <span className="cap-sec-n">5</span>
                  {" Documents"}
                </div>
                <div className="cap-hint" style={{ marginBottom: "10px" }}>
                  Attach PAN, bank proof, education or prior-employment documents. They are stored against the worker and viewable later from the directory drilldown.
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                  <select className="sel" id="cap-doc-type" style={{ width: "auto" }}>
                    <option>PAN card</option>
                    <option>Bank proof</option>
                    <option>Education certificate</option>
                    <option>Prior employment</option>
                    <option>Address proof</option>
                    <option>Other</option>
                  </select>
                  <input type="file" id="cap-doc-file" accept="image/*,application/pdf" style={{ display: "none" }} onChange={(event) => { window.capAddDoc() }} />
                  <button type="button" className="btn" onClick={(event) => { document.getElementById('cap-doc-file').click() }} data-onclick="document.getElementById('cap-doc-file').click()">Add document</button>
                </div>
                <div id="cap-docs-list" style={{ marginTop: "10px" }} />
              </div>
              {' '}
              {/*  action footer  */}
              {' '}
              <div className="card sunken cap-action">
                <div className="cap-action-l">
                  <div className="card-h-title" style={{ fontSize: "0.92rem", marginBottom: "2px" }}>
                    Send for worker confirmation
                  </div>
                  {' '}
                  <div className="tiny" style={{ color: "var(--ink-2)", lineHeight: "1.55" }}>
                    A secure link is sent to the worker's WhatsApp number in their chosen language. They review their profile and confirm — the record is push-ready only once confirmed.
                  </div>
                </div>
                {' '}
                <div className="cap-action-r">
                  <button className="btn" onClick={(event) => { window.capReset() }} data-onclick="capReset()">Clear</button>
                  {' '}
                  <button className="btn primary" onClick={(event) => { window.capSubmit() }} data-onclick="capSubmit()">
                    Save & send confirmation link
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
        {' '}
        {/*  ════ BULK UPLOAD ════  */}
        {' '}
        <div id="cap-bulk" style={{ display: "none" }}>
          <div className="g23">
            <div>
              <div className="card" style={{ marginBottom: "16px" }}>
                <div className="card-h">
                  <div>
                    <div className="card-h-title">Bulk upload workers</div>
                    {' '}
                    <div className="card-h-sub">Import a batch of direct or contract workers from a spreadsheet</div>
                  </div>
                  {' '}
                  <button className="btn" onClick={(event) => { window.capDownloadTemplate() }} data-onclick="capDownloadTemplate()">
                    Download template
                  </button>
                </div>
                {' '}
                <div className="field" style={{ marginBottom: "12px" }}>
                  <label className="field-l">Contractor / employer for this batch</label>
                  {' '}
                  <select className="sel" id="cap-bulk-contractor" />
                  {' '}
                  <div className="cap-hint">Contractor login is locked to your own firm; HR can pick any firm or import direct employees.</div>
                </div>
                {' '}
                <div className="cap-drop" id="cap-drop" onClick={(event) => { document.getElementById('cap-bulk-input').click() }} data-onclick="document.getElementById('cap-bulk-input').click()">
                  <div className="cap-drop-ico">⬆</div>
                  {' '}
                  <div className="cap-drop-t">Drop your Excel (.xlsx) or CSV here, or click to browse</div>
                  {' '}
                  <div className="cap-drop-s">
                    Columns: name, type, mobile, aadhaar, pan, gender, route, shift, language, category, contractor, uniform, shoe — one worker per row. Aadhaar stays a 12-digit whole number.
                  </div>
                  {' '}
                  <div className="pill green" id="cap-drop-file" style={{ display: "none", marginTop: "10px" }} />
                  {' '}
                  <input type="file" id="cap-bulk-input" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={(event) => { window.capBulkFile(event) }} />
                </div>
                {' '}
                <div className="cap-drop-or">
                  <span>or</span>
                </div>
                {' '}
                <button className="btn" style={{ width: "100%" }} onClick={(event) => { window.capBulkSample() }} data-onclick="capBulkSample()">
                  Load a 6-worker sample batch
                </button>
              </div>
              {' '}
              <div className="card" id="cap-bulk-preview-card" style={{ display: "none" }}>
                <div className="card-h">
                  <div>
                    <div className="card-h-title">Parsed preview</div>
                    {' '}
                    <div className="card-h-sub" id="cap-bulk-sub">—</div>
                  </div>
                  {' '}
                  <span className="pill blue" id="cap-bulk-count">—</span>
                </div>
                {' '}
                <div className="row-between" style={{ margin: "4px 0 10px", flexWrap: "wrap", gap: "8px" }}>
                  <span className="pill outline" style={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" }}>
                    📄 <span id="cap-bulk-file">—</span>
                  </span>
                  {' '}
                  <button className="btn" onClick={(event) => { window.capBulkReset() }} data-onclick="capBulkReset()">Reset</button>
                </div>
                {' '}
                <div id="cap-bulk-consent" className="note amber" style={{ display: "none", marginBottom: "10px" }} />
                {' '}
                <div style={{ overflowX: "auto" }}>
                  <table className="t">
                    <thead>
                      <tr>
                        <th>Worker</th>
                        <th>Mobile</th>
                        <th>Aadhaar</th>
                        <th>Gender</th>
                        <th>Route</th>
                        <th>Shift</th>
                        <th>Row check</th>
                      </tr>
                    </thead>
                    <tbody id="cap-bulk-body" />
                  </table>
                </div>
                {' '}
                <div className="cap-action" style={{ marginTop: "14px", borderTop: "1px solid var(--line)", paddingTop: "14px" }}>
                  <div className="tiny" style={{ color: "var(--ink-2)" }}>
                    Ready rows are imported into onboarding and appear in All Employee Track.
                  </div>
                  {' '}
                  <button className="btn primary" id="cap-bulk-send" onClick={(event) => { window.capBulkSend() }} data-onclick="capBulkSend()">
                    Start onboarding
                  </button>
                </div>
              </div>
            </div>
            {' '}
            <div>
              <div className="card sunken" style={{ marginBottom: "14px" }}>
                <div className="card-h-title" style={{ fontSize: "0.95rem" }}>How bulk upload works</div>
                {' '}
                <hr className="div" />
                {' '}
                <div className="cap-flow">
                  <span className="cap-flow-i">1</span>
                  <span>Download the .xlsx template (or load the sample) — Aadhaar stays a 12-digit whole number.</span>
                </div>
                {' '}
                <div className="cap-flow">
                  <span className="cap-flow-i">2</span>
                  <span>Upload the file. Each row is validated; correct Gender, Route and Shift with the dropdowns.</span>
                </div>
                {' '}
                <div className="cap-flow">
                  <span className="cap-flow-i">3</span>
                  <span>Female night-shift workers need OSHC Rule 83 transport consent before onboarding.</span>
                </div>
                {' '}
                <div className="cap-flow">
                  <span className="cap-flow-i">4</span>
                  <span>Start onboarding — workers appear in All Employee Track. Verify PAN + Aadhaar → induction.</span>
                </div>
              </div>
              {' '}
              <div className="card">
                <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Batch status</div>
                {' '}
                <hr className="div" />
                {' '}
                <div id="cap-bulk-status">
                  <div className="tiny muted">No batch processed yet.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {' '}
        {/*  recently captured · shared across both modes  */}
        {' '}
        <div className="card" style={{ marginTop: "16px" }}>
          <div className="card-h">
            <div>
              <div className="card-h-title">Captured this session</div>
              {' '}
              <div className="card-h-sub">Profiles awaiting or completed worker confirmation</div>
            </div>
            {' '}
            <span className="pill outline" id="cap-recent-count">0 records</span>
          </div>
          {' '}
          <div id="cap-recent" className="cap-recent-list">
            <div className="tiny muted">No records captured in this session yet.</div>
          </div>
        </div>
      </div>
      {' '}
      <div id="ob-docs" className="subpane" style={{ display: "none" }}>
        <div className="card">
          <div className="card-h">
            <div>
              <div className="card-h-title">Shared document store</div>
              {' '}
              <div className="card-h-sub">
                Encrypted at rest with per-tenant keys · every action chained to audit trail · click a row to drill into instances, encryption, access & retention
              </div>
            </div>
            {' '}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span className="tiny muted" id="sd-count">— document types</span>
              {' '}
              <button className="dl-btn" onClick={(event) => { window.downloadSharedDocs() }} data-onclick="downloadSharedDocs()" title="Download as Excel">
                Excel
              </button>
            </div>
          </div>
          {' '}
          <table className="t" id="sd-grid">
            <thead>
              <tr>
                <th className="sortable" data-col="type">
                  Document type
                  <span className="sort-ind">↕</span>
                </th>
                <th className="sortable" data-col="scope">
                  Worker scope
                  <span className="sort-ind">↕</span>
                </th>
                <th className="sortable" data-col="enc">
                  Encryption
                  <span className="sort-ind">↕</span>
                </th>
                <th className="sortable" data-col="ret">
                  Retention
                  <span className="sort-ind">↕</span>
                </th>
                <th className="sortable" data-col="entries">
                  Audit entries
                  <span className="sort-ind">↕</span>
                </th>
              </tr>
            </thead>
            <tbody id="sd-grid-body" />
          </table>
        </div>
        {' '}
        {/*  ─── shared-doc drill-down ───  */}
        {' '}
        <div className="sd-drill" id="sd-drill">
          <div className="sd-drill-h">
            <div className="sd-drill-h-left">
              <span className="sd-drill-h-eye" id="sd-drill-eye">Document type detail</span>
              {' '}
              <span className="sd-drill-h-title" id="sd-drill-title">—</span>
              {' '}
              <span className="sd-drill-h-meta" id="sd-drill-meta">—</span>
            </div>
            {' '}
            <span className="modal-h-close" onClick={(event) => { window.closeSdDrill() }} data-onclick="closeSdDrill()">
              Close ✕
            </span>
          </div>
          {' '}
          <div className="sd-drill-tabs">
            <div className="sd-drill-tab on" onClick={(event) => { window.sdTab(event, 'instances') }} data-onclick="sdTab(event, 'instances')">
              Instances
            </div>
            {' '}
            <div className="sd-drill-tab" onClick={(event) => { window.sdTab(event, 'audit') }} data-onclick="sdTab(event, 'audit')">
              Recent audit entries
            </div>
            {' '}
            <div className="sd-drill-tab" onClick={(event) => { window.sdTab(event, 'crypto') }} data-onclick="sdTab(event, 'crypto')">
              Encryption & keys
            </div>
            {' '}
            <div className="sd-drill-tab" onClick={(event) => { window.sdTab(event, 'access') }} data-onclick="sdTab(event, 'access')">
              Access log · 30d
            </div>
            {' '}
            <div className="sd-drill-tab" onClick={(event) => { window.sdTab(event, 'retention') }} data-onclick="sdTab(event, 'retention')">
              Retention
            </div>
          </div>
          {' '}
          <div className="sd-drill-body">
            <div className="sd-pane on" id="sd-pane-instances" />
            {' '}
            <div className="sd-pane" id="sd-pane-audit" />
            {' '}
            <div className="sd-pane" id="sd-pane-crypto" />
            {' '}
            <div className="sd-pane" id="sd-pane-access" />
            {' '}
            <div className="sd-pane" id="sd-pane-retention" />
          </div>
        </div>
      </div>
    </section>
  );
}
