/* NavBar — converted 1:1 from karya-vaani_v3.html */
export default function NavBar() {
  return (
    <nav className="navbar">
      <div className="nb-current">
        <div style={{ display: "flex", flexDirection: "column", lineHeight: "1.1" }}>
          <span className="nb-current-eyebrow">Now viewing</span>
          {' '}
          <span className="nb-current-label" id="current-label">Executive dashboard</span>
        </div>
      </div>
      {' '}
      {/*  ─── group: Overview ───  */}
      {' '}
      <div className="nb-group has-active" id="grp-overview">
        <span className="nb-group-label">
          {"Overview "}
          <span className="nb-caret">▾</span>
        </span>
        {' '}
        <div className="nb-panel">
          <div className="nb-panel-title">Overview</div>
          {' '}
          <div className="sb-item active" onClick={(event) => { window.nav('dashboard', event.currentTarget) }} data-onclick="nav('dashboard', this)">
            <span className="sb-icon">◈</span>
            <span className="sb-label">Executive dashboard</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('diagnostic', event.currentTarget) }} data-onclick="nav('diagnostic', this)">
            <span className="sb-icon">⌖</span>
            <span className="sb-label">Labour Code Readiness Survey</span>
          </div>
          {' '}
          {/*  Architectural Blueprint — hidden for demo; remove style="display:none" to re-enable  */}
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('architecture', event.currentTarget) }} data-onclick="nav('architecture', this)" style={{ display: "none" }}>
            <span className="sb-icon">⌂</span>
            <span className="sb-label">Architectural Blueprint</span>
          </div>
        </div>
      </div>
      {' '}
      {/*  ─── group: Operational Pillars ───  */}
      {' '}
      <div className="nb-group" id="grp-verticals">
        <span className="nb-group-label">
          {"Operational Pillars "}
          <span className="nb-caret">▾</span>
        </span>
        {' '}
        <div className="nb-panel">
          <div className="nb-panel-title">Operational Pillars · decision builder + 6 assessment pillars</div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('karya-nirnay', event.currentTarget) }} data-onclick="nav('karya-nirnay', this)">
            <span className="sb-icon">⚖</span>
            <span className="sb-label">Karya Nirṇay decision builder</span>
            {' '}
            <span className="sb-badge amber">new</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('recruitment', event.currentTarget) }} data-onclick="nav('recruitment', this)">
            <span className="sb-icon">⛬</span>
            <span className="sb-label">Talent Acquisition & Progression</span>
            {' '}
            <span className="sb-badge">14</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('onboarding', event.currentTarget) }} data-onclick="nav('onboarding', this)">
            <span className="sb-icon">⛫</span>
            <span className="sb-label">Onboarding</span>
            {' '}
            <span className="sb-badge amber">9</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('induction', event.currentTarget) }} data-onclick="nav('induction', this)">
            <span className="sb-icon">⌖</span>
            <span className="sb-label">Induction training</span>
            {' '}
            <span className="sb-badge amber">3</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('vendor', event.currentTarget) }} data-onclick="nav('vendor', this)">
            <span className="sb-icon">⌬</span>
            <span className="sb-label">Vendor compliance</span>
            {' '}
            <span className="sb-badge red">3</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('ohs', event.currentTarget) }} data-onclick="nav('ohs', this)">
            <span className="sb-icon">⚠</span>
            <span className="sb-label">Workplace Safety & OHS Analytics</span>
            {' '}
            <span className="sb-badge amber">2</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('compliance', event.currentTarget) }} data-onclick="nav('compliance', this)">
            <span className="sb-icon">§</span>
            <span className="sb-label">Statutory posture</span>
          </div>
        </div>
      </div>
      {' '}
      {/*  ─── group: HR Documents ───  */}
      {' '}
      <div className="nb-group" id="grp-hrdocs">
        <span className="nb-group-label">
          {"HR Documents "}
          <span className="nb-caret">▾</span>
        </span>
        {' '}
        <div className="nb-panel">
          <div className="nb-panel-title">HR Documents · generated letters & orders</div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('appointment', event.currentTarget) }} data-onclick="nav('appointment', this)">
            <span className="sb-icon">✒</span>
            <span className="sb-label">Appointment Order</span>
            {' '}
            <span className="sb-badge amber">new</span>
          </div>
        </div>
      </div>
      {' '}
      {/*  ─── group: Localisation Engine ───  */}
      {' '}
      <div className="nb-group" id="grp-engines">
        <span className="nb-group-label">
          {"Localisation Engine "}
          <span className="nb-caret">▾</span>
        </span>
        {' '}
        <div className="nb-panel">
          <div className="nb-panel-title">Localisation Engine · the shared layers</div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('vaani-broadcast', event.currentTarget) }} data-onclick="nav('vaani-broadcast', this)">
            <span className="sb-icon">⌘</span>
            <span className="sb-label">VAANI Translation & Broadcasting</span>
            {' '}
            <span className="sb-badge blue">live</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('chat', event.currentTarget) }} data-onclick="nav('chat', this)">
            <span className="sb-icon">✆</span>
            <span className="sb-label">Karya Vaani Chat</span>
            {' '}
            <span className="sb-badge amber">new</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('transport', event.currentTarget) }} data-onclick="nav('transport', this)">
            <span className="sb-icon">⤧</span>
            <span className="sb-label">Transport Schedule</span>
            {' '}
            <span className="sb-badge amber">new</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('lms', event.currentTarget) }} data-onclick="nav('lms', this)">
            <span className="sb-icon">⌭</span>
            <span className="sb-label">Knowledge Center</span>
          </div>
        </div>
      </div>
      {' '}
      {/*  ─── group: Governance ───  */}
      {' '}
      <div className="nb-group" id="grp-governance">
        <span className="nb-group-label">
          {"Governance "}
          <span className="nb-caret">▾</span>
        </span>
        {' '}
        <div className="nb-panel">
          <div className="nb-panel-title">Governance · transparency & control</div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('rules', event.currentTarget) }} data-onclick="nav('rules', this)">
            <span className="sb-icon">⌒</span>
            <span className="sb-label">Rule library</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('locale', event.currentTarget) }} data-onclick="nav('locale', this)">
            <span className="sb-icon">🎌</span>
            <span className="sb-label">Global Localization Engine</span>
            {' '}
            <span className="sb-badge amber">4</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('audit', event.currentTarget) }} data-onclick="nav('audit', this)">
            <span className="sb-icon">⌗</span>
            <span className="sb-label">Audit trail</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('handoff', event.currentTarget) }} data-onclick="nav('handoff', this)">
            <span className="sb-icon">⇄</span>
            <span className="sb-label">API handoff</span>
          </div>
        </div>
      </div>
      {' '}
      {/*  ─── group: Directory ───  */}
      {' '}
      <div className="nb-group" id="grp-directory">
        <span className="nb-group-label">
          {"Directory "}
          <span className="nb-caret">▾</span>
        </span>
        {' '}
        <div className="nb-panel">
          <div className="nb-panel-title">Directory · workers & contractors, searchable</div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('directory', event.currentTarget) }} data-onclick="nav('directory', this)">
            <span className="sb-icon">☷</span>
            <span className="sb-label">Worker directory</span>
            {' '}
            <span className="sb-badge amber">new</span>
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('ctdirectory', event.currentTarget) }} data-onclick="nav('ctdirectory', this)">
            <span className="sb-icon">⌬</span>
            <span className="sb-label">Contractor directory</span>
            {' '}
            <span className="sb-badge amber">new</span>
          </div>
        </div>
      </div>
      {' '}
      <div className="nb-group" id="grp-employee">
        <span className="nb-group-label">
          {"Employee "}
          <span className="nb-caret">▾</span>
        </span>
        {' '}
        <div className="nb-panel">
          <div className="nb-panel-title">Employee surface · what a worker sees when they sign in</div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('emp-home', event.currentTarget) }} data-onclick="nav('emp-home', this)">
            <span className="sb-icon">⌂</span>
            <span className="sb-label">My home</span>
            {' '}
            <span className="sb-badge amber">new</span>
          </div>
        </div>
      </div>
      {' '}
      <div className="nb-group" id="grp-contractor">
        <span className="nb-group-label">
          {"Contractor "}
          <span className="nb-caret">▾</span>
        </span>
        {' '}
        <div className="nb-panel">
          <div className="nb-panel-title">
            Contractor surface · what a labour-supplier firm sees when they sign in
          </div>
          {' '}
          <div className="sb-item" onClick={(event) => { window.nav('ct-home', event.currentTarget) }} data-onclick="nav('ct-home', this)">
            <span className="sb-icon">⎈</span>
            <span className="sb-label">Contractor home</span>
            {' '}
            <span className="sb-badge amber">new</span>
          </div>
        </div>
      </div>
      {' '}
      <div className="nb-stats">
        <div className="nb-stat">
          <span className="nb-stat-k">Workers</span>
          {' '}
          <span className="nb-stat-v">3,526</span>
        </div>
        {' '}
        <div className="nb-stat">
          <span className="nb-stat-k">Direct / Contract</span>
          {' '}
          <span className="nb-stat-v">769 / 2,757</span>
        </div>
        {' '}
        <div className="nb-stat">
          <span className="nb-stat-k">Rule bundle</span>
          {' '}
          <span className="nb-stat-v">v2026.05.2</span>
        </div>
      </div>
    </nav>
  );
}
