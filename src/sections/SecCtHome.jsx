/* SecCtHome — converted 1:1 from karya-vaani_v3.html · <section id="sec-ct-home"> */
export default function SecCtHome() {
  return (
    <section id="sec-ct-home" className="section">
      <div className="crumbs">
        <span>Contractor</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Firm home</span>
      </div>
      {' '}
      {/*  contractor picker — switch between firms in the demo  */}
      {' '}
      <div className="emp-picker">
        <span className="emp-picker-l">Signed in as</span>
        {' '}
        <select id="ct-picker-sel" className="sel" onChange={(event) => { window.ctSetActive(event.currentTarget.value) }} style={{ minWidth: "320px" }} />
        {' '}
        <span className="tiny muted">demo · switch contractor to preview their firm home</span>
        {' '}
        <button className="btn" style={{ marginLeft: "auto" }} onClick={() => { window.exitPersona() }} data-onclick="exitPersona()">
          ← Exit contractor view
        </button>
      </div>
      {' '}
      {/*  ── HERO · firm identity + compliance score ──  */}
      {' '}
      <div className="emp-hero ct-hero">
        <div className="emp-hero-bg" />
        {' '}
        <div className="emp-hero-l">
          <div className="emp-hero-ava ct-hero-ava" id="ct-hero-ava">—</div>
          {' '}
          <div>
            <div className="emp-hero-greet" id="ct-hero-greet">Good morning ·</div>
            {' '}
            <div className="emp-hero-name" id="ct-hero-name">—</div>
            {' '}
            <div className="emp-hero-meta" id="ct-hero-meta">—</div>
            {' '}
            <div className="emp-hero-chips" id="ct-hero-chips" />
          </div>
        </div>
        {' '}
        <div className="emp-hero-r">
          <div className="emp-hero-num-eye">YOUR COMPLIANCE SCORE</div>
          {' '}
          <div className="emp-hero-num">
            <span id="ct-hero-num">—</span>
            <span className="emp-hero-pct">/100</span>
          </div>
          {' '}
          <div className="emp-hero-num-sub" id="ct-hero-num-sub">—</div>
          {' '}
          <button className="btn" id="ct-hero-act" onClick={(event) => { window.ctResolveAll() }} data-onclick="ctResolveAll()">
            Resolve all open actions
          </button>
        </div>
      </div>
      {' '}
      {/*  ── ACTION-NEEDED BANNER · open compliance actions ──  */}
      {' '}
      <div className="emp-action" id="ct-action" style={{ display: "none" }} />
      {' '}
      {/*  ── KPI strip · firm snapshot ──  */}
      {' '}
      <div className="g4" style={{ marginBottom: "14px" }}>
        <div className="kpi">
          <div className="kpi-eye">Workers deployed</div>
          {' '}
          <div className="kpi-val" id="ct-k-dep">—</div>
          {' '}
          <div className="kpi-sub" id="ct-k-dep-s">across the plant</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">CLRA licence</div>
          {' '}
          <div className="kpi-val" id="ct-k-clra" style={{ color: "var(--indigo)" }}>—</div>
          {' '}
          <div className="kpi-sub" id="ct-k-clra-s">contract labour rules</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">ESIC state</div>
          {' '}
          <div className="kpi-val" id="ct-k-esic" style={{ color: "var(--green-dk)" }}>—</div>
          {' '}
          <div className="kpi-sub" id="ct-k-esic-s">monthly challan</div>
        </div>
        {' '}
        <div className="kpi kpi-pend">
          <div className="kpi-eye">Open actions</div>
          {' '}
          <div className="kpi-val" id="ct-k-open" style={{ color: "var(--amber-dk)" }}>—</div>
          {' '}
          <div className="kpi-sub" id="ct-k-open-s">items awaiting your reply</div>
        </div>
      </div>
      {' '}
      {/*  ── two-column body ──  */}
      {' '}
      <div className="emp-body">
        {/*  LEFT · alerts, workforce, liability  */}
        {' '}
        <div>
          {/*  pending actions  */}
          {' '}
          <div className="card ct-msg-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Open compliance actions</div>
                {' '}
                <div className="card-h-sub">
                  Requests from Plant HR & compliance you need to action — challans, audits, document refreshes
                </div>
              </div>
              {' '}
              <span className="pill outline tiny" id="ct-pending-cnt">—</span>
            </div>
            {' '}
            <div id="ct-pending-list" />
          </div>
          {' '}
          {/*  workforce compliance summary  */}
          {' '}
          <div className="card ct-wk-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Your workforce on this plant</div>
                {' '}
                <div className="card-h-sub">
                  How your deployed workers' statutory states are tracking — ESIC, PF, CLRA, induction
                </div>
              </div>
              {' '}
              <span className="pill outline tiny" id="ct-wk-cnt">—</span>
            </div>
            {' '}
            <div id="ct-wk-list" />
          </div>
          {' '}
          {/*  full deployed-worker roster (same table + detail as vendor compliance)  */}
          {' '}
          <div className="card ct-wk-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Workers you have deployed</div>
                {' '}
                <div className="card-h-sub">Your full deployed roster · search, sort by column, click a worker for full details</div>
              </div>
              {' '}
              <span className="pill outline tiny" id="ct-wkroster-cnt">—</span>
            </div>
            {' '}
            <input id="ctwk-search" placeholder="Search workers…" className="sel" style={{ marginBottom: "10px", maxWidth: "220px" }} />
            {' '}
            <div style={{ overflowX: "auto" }}>
              <table className="t">
                <thead>
                  <tr><th>Worker</th><th>Code</th><th>Category</th><th>Designation</th><th>ESIC</th><th>CLRA</th><th>Compliance</th><th>Details</th></tr>
                </thead>
                <tbody id="ctwk-body" />
              </table>
            </div>
            {' '}
            <div id="ctwk-pagination" className="om-pg" />
          </div>
          {' '}
          {/*  liability exposure  */}
          {' '}
          <div className="card ct-liab-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Liability exposure · today</div>
                {' '}
                <div className="card-h-sub">Estimated principal-employer liability if open issues stay unresolved</div>
              </div>
            </div>
            {' '}
            <div id="ct-liab-list" />
          </div>
        </div>
        {' '}
        {/*  RIGHT · subscores, identity, quick actions  */}
        {' '}
        <div>
          {/*  compliance subscores breakdown  */}
          {' '}
          <div className="card ct-an-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Compliance subscores</div>
                {' '}
                <div className="card-h-sub">The six dimensions that make up your overall score · 6-month trend</div>
              </div>
            </div>
            {' '}
            <div id="ct-subscores" />
            {' '}
            <div className="emp-an-block">
              <div className="emp-an-eye">6-month score trend</div>
              {' '}
              <div className="ct-trend" id="ct-trend" />
              {' '}
              <div className="emp-an-sub" id="ct-trend-sub">—</div>
            </div>
          </div>
          {' '}
          {/*  firm identity / record  */}
          {' '}
          <div className="card ct-id-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Your firm record</div>
                {' '}
                <div className="card-h-sub">What Daikin Sricity has on file · last refreshed today</div>
              </div>
            </div>
            {' '}
            <div id="ct-id-list" />
          </div>
          {' '}
          {/*  quick actions  */}
          {' '}
          <div className="card emp-qa-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Quick actions</div>
                {' '}
                <div className="card-h-sub">Things you can do from this screen</div>
              </div>
            </div>
            {' '}
            <div className="emp-qa">
              <button className="emp-qa-btn" onClick={(event) => { window.ctOnboardOpen() }} data-onclick="ctOnboardOpen()">
                <span className="emp-qa-ico" style={{ background: "var(--indigo)" }}>+</span>
                {' '}
                <span className="emp-qa-l">
                  <strong>Onboard employees</strong>
                  <span>Add workers, verify PAN &amp; Aadhaar, bulk import</span>
                </span>
              </button>
              {' '}
              <button className="emp-qa-btn" onClick={(event) => { window.ctResolveAll() }} data-onclick="ctResolveAll()">
                <span className="emp-qa-ico" style={{ background: "var(--green-dk)" }}>✓</span>
                {' '}
                <span className="emp-qa-l">
                  <strong>Resolve all open actions</strong>
                  <span>Mark every action acknowledged</span>
                </span>
              </button>
              {' '}
              <button className="emp-qa-btn" onClick={(event) => { window.ctChatToggle() }} data-onclick="ctChatToggle()">
                <span className="emp-qa-ico" style={{ background: "var(--indigo)" }}>✆</span>
                {' '}
                <span className="emp-qa-l">
                  <strong>Message Plant HR</strong>
                  <span>Open the conversation thread</span>
                </span>
              </button>
              {' '}
              <button className="emp-qa-btn" onClick={(event) => { window.empToast('ESIC challan upload — coming next sprint') }} data-onclick="empToast('ESIC challan upload — coming next sprint')">
                <span className="emp-qa-ico" style={{ background: "var(--amber-dk)" }}>↑</span>
                {' '}
                <span className="emp-qa-l">
                  <strong>Upload ESIC challan</strong>
                  <span>Reconcile your monthly contribution</span>
                </span>
              </button>
              {' '}
              <button className="emp-qa-btn" onClick={(event) => { window.empToast('CLRA renewal initiated — Plant HR notified') }} data-onclick="empToast('CLRA renewal initiated — Plant HR notified')">
                <span className="emp-qa-ico" style={{ background: "var(--ink-3)" }}>⌘</span>
                {' '}
                <span className="emp-qa-l">
                  <strong>Renew CLRA licence</strong>
                  <span>Start the renewal workflow</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {' '}
      {/*  ── FLOATING CHAT FAB · pinned bottom-right when ct-home is active ──  */}
      {' '}
      <button className="ct-chat-fab" id="ct-chat-fab" onClick={(event) => { window.ctChatToggle() }} data-onclick="ctChatToggle()" aria-label="Open chat with Plant HR">
        <span className="emp-chat-fab-ico">✆</span>
        {' '}
        <span className="emp-chat-fab-badge" id="ct-chat-fab-badge" style={{ display: "none" }}>0</span>
      </button>
      {' '}
      {/*  ── POP-UP CHAT PANEL · with Plant HR / compliance ──  */}
      {' '}
      <div className="ct-chat-pop" id="ct-chat-pop" aria-hidden="true">
        <div className="emp-chat-pop-h">
          <span className="cv-conv-h-ava" style={{ background: "var(--amber)", width: "36px", height: "36px", fontSize: "0.8rem" }}>
            HR
          </span>
          {' '}
          <div className="emp-chat-pop-h-main">
            <div className="emp-chat-pop-h-name">Plant HR · Daikin Sricity</div>
            {' '}
            <div className="emp-chat-pop-h-sub" id="ct-chat-pop-h-sub">
              — · compliance, challans & audit coordination
            </div>
          </div>
          {' '}
          <button className="emp-chat-pop-min" onClick={(event) => { window.ctChatToggle() }} data-onclick="ctChatToggle()" title="Close">
            ✕
          </button>
        </div>
        {' '}
        <div className="emp-chat-pop-canvas">
          <div className="cv-conv-body" id="ct-chat-body" />
          {' '}
          <div className="cv-conv-foot" id="ct-chat-foot" />
        </div>
      </div>
    </section>
  );
}
