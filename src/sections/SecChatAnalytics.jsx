/* SecChatAnalytics — chat engagement analytics. Originally its own
   <section id="sec-chat-analytics">, now rendered inside the Analytics hub's
   "Chat engagement" tab (SecAnalytics). The outer wrapper is a plain <div> so
   it is not toggled by the SPA .section nav; every inner element id is kept
   unchanged so the legacy renderers (chatRenderAnalytics, cvaRefreshAll, …)
   keep working as-is. */
export default function SecChatAnalytics() {
  return (
    <div className="an-chat-inner">
      <div className="crumbs">
        <span>Analytics</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Chat engagement analytics</span>
      </div>
      {' '}
      {/*  ── MODERN HERO ──  */}
      {' '}
      <div className="cva-hero">
        <div className="cva-hero-bg" />
        {' '}
        <div className="cva-hero-left">
          <div className="cva-hero-status">
            <span className="cva-hero-dot" />
            {' '}
            <span className="cva-hero-status-l">LIVE · Broadcast impact analysis</span>
            {' '}
            <span className="cva-hero-status-r" id="cva-hero-clock">—</span>
          </div>
          {' '}
          <h1 className="cva-hero-h cva-hero-h-objective">
            <span className="cva-hero-h-cap-top">YOUR EFFECTIVE BROADCAST WINDOW</span>
            {' '}
            <span className="cva-hero-h-num" id="cva-hero-bignum">—</span>
            <span className="cva-hero-h-pct" id="cva-hero-bigunit">min</span>
            {' '}
            <span className="cva-hero-h-cap">
              {"to reach "}
              <em>90%</em>
              {" of your workforce"}
            </span>
          </h1>
          {' '}
          <p className="cva-hero-sub" id="cva-hero-sub">
            Minimise this window. Maximise reach in the shortest time. The cuts below show where time is being lost.
          </p>
          {' '}
          <div className="cva-hero-mini">
            <div className="cva-mini">
              <div className="cva-mini-v" id="cva-mini-t50">—</div>
              {' '}
              <div className="cva-mini-k">to 50% read</div>
            </div>
            {' '}
            <div className="cva-mini">
              <div className="cva-mini-v" id="cva-mini-t90">—</div>
              {' '}
              <div className="cva-mini-k">to 90% read</div>
            </div>
            {' '}
            <div className="cva-mini">
              <div className="cva-mini-v" id="cva-mini-tack">—</div>
              {' '}
              <div className="cva-mini-k">to 80% ack</div>
            </div>
            {' '}
            <div className="cva-mini">
              <div className="cva-mini-v" id="cva-mini-sent">—</div>
              {' '}
              <div className="cva-mini-k">broadcasts today</div>
            </div>
          </div>
        </div>
        {' '}
        <div className="cva-hero-right">
          <button className="btn primary" onClick={(event) => { window.nav('chat', document.querySelector('[onclick*=\u0027chat\u0027]')) }} data-onclick={"nav('chat', document.querySelector('[onclick*=\\u0027chat\\u0027]'))"}>
            ↗ Open chat
          </button>
          {' '}
          <button className="btn" onClick={(event) => { window.cvaRefreshAll() }} data-onclick="cvaRefreshAll()" style={{ marginTop: "8px" }}>
            ↻ Refresh
          </button>
        </div>
      </div>
      {' '}
      {/*  ── INTERACTIVE FILTER BAR ──  */}
      {' '}
      <div className="cva-filter">
        <div className="cva-filter-grp">
          <span className="cva-filter-l">Filter</span>
          {' '}
          <span className="cva-chip on" data-tier="all" onClick={(event) => { window.cvaSetFilter(event.currentTarget,'tier','all') }} data-onclick="cvaSetFilter(this,'tier','all')">
            All tiers
          </span>
          {' '}
          <span className="cva-chip critical" data-tier="critical" onClick={(event) => { window.cvaSetFilter(event.currentTarget,'tier','critical') }} data-onclick="cvaSetFilter(this,'tier','critical')">
            ⬤ Critical
          </span>
          {' '}
          <span className="cva-chip urgent" data-tier="urgent" onClick={(event) => { window.cvaSetFilter(event.currentTarget,'tier','urgent') }} data-onclick="cvaSetFilter(this,'tier','urgent')">
            ⬤ Urgent
          </span>
          {' '}
          <span className="cva-chip advisory" data-tier="advisory" onClick={(event) => { window.cvaSetFilter(event.currentTarget,'tier','advisory') }} data-onclick="cvaSetFilter(this,'tier','advisory')">
            ⬤ Advisory
          </span>
          {' '}
          <span className="cva-chip info" data-tier="info" onClick={(event) => { window.cvaSetFilter(event.currentTarget,'tier','info') }} data-onclick="cvaSetFilter(this,'tier','info')">
            ⬤ Info
          </span>
        </div>
        {' '}
        <div className="cva-filter-grp">
          <span className="cva-filter-l">Show</span>
          {' '}
          <span className="cva-chip on" data-show="all" onClick={(event) => { window.cvaSetFilter(event.currentTarget,'show','all') }} data-onclick="cvaSetFilter(this,'show','all')">
            All
          </span>
          {' '}
          <span className="cva-chip" data-show="pending" onClick={(event) => { window.cvaSetFilter(event.currentTarget,'show','pending') }} data-onclick="cvaSetFilter(this,'show','pending')">
            Pending only
          </span>
          {' '}
          <span className="cva-chip" data-show="response" onClick={(event) => { window.cvaSetFilter(event.currentTarget,'show','response') }} data-onclick="cvaSetFilter(this,'show','response')">
            Response required
          </span>
        </div>
      </div>
      {' '}
      {/*  filter drill-down — only visible when a non-default filter chip is active  */}
      {' '}
      <div id="cva-filter-drill" style={{ display: "none" }} />
      {' '}
      {/*  ════════════════════════════════════════════════════════════════
       OBJECTIVE-LED ANALYTICS  ·  Minimise the broadcast time window,
       maximise communication impact at the quickest possible time.
       ════════════════════════════════════════════════════════════════  */}
      {' '}
      <div className="cv-analytics-stack">
        {/*  ── BROADCAST WINDOW ANALYSIS · the headline decision card ──  */}
        {' '}
        <div className="card cvw-card">
          <div className="card-h">
            <div>
              <div className="card-h-eyebrow">OBJECTIVE 1 · TIME TO READ & RESPOND</div>
              {' '}
              <div className="card-h-title">Broadcast impact window · cumulative reach over time</div>
              {' '}
              <div className="card-h-sub">
                From the moment a broadcast is dispatched, how long until 50% / 80% / 90% of the workforce have read it & acknowledged? The annotated curve below is the broadcast window you need to minimise.
              </div>
            </div>
          </div>
          {' '}
          <div className="cvw-grid">
            {/*  KEY-NUMBER COLUMN  */}
            {' '}
            <div className="cvw-stats">
              <div className="cvw-stat cvw-stat-amber">
                <div className="cvw-stat-eye">Time to 50% read</div>
                {' '}
                <div className="cvw-stat-v" id="cvw-t50">—</div>
                {' '}
                <div className="cvw-stat-s">half your workforce reaches this point in</div>
              </div>
              {' '}
              <div className="cvw-stat cvw-stat-indigo">
                <div className="cvw-stat-eye">Time to 90% read</div>
                {' '}
                <div className="cvw-stat-v" id="cvw-t90">—</div>
                {' '}
                <div className="cvw-stat-s">the long-tail close — your effective window</div>
              </div>
              {' '}
              <div className="cvw-stat cvw-stat-green">
                <div className="cvw-stat-eye">Time to 80% ack</div>
                {' '}
                <div className="cvw-stat-v" id="cvw-tack">—</div>
                {' '}
                <div className="cvw-stat-s">response-receipt compliance window</div>
              </div>
              {' '}
              <div className="cvw-stat cvw-stat-red">
                <div className="cvw-stat-eye">Slowest cohort drag</div>
                {' '}
                <div className="cvw-stat-v" id="cvw-drag">—</div>
                {' '}
                <div className="cvw-stat-s" id="cvw-drag-s">slowest slice vs plant average</div>
              </div>
            </div>
            {' '}
            {/*  CURVE COLUMN  */}
            {' '}
            <div className="cvw-chart-wrap">
              <div className="cvw-chart-eye">Cumulative reach · % of recipients</div>
              {' '}
              <div className="cvw-chart" id="cvw-chart" />
              {' '}
              <div className="cvw-chart-foot" id="cvw-chart-foot">—</div>
            </div>
          </div>
        </div>
        {' '}
        {/*  ── DEMOGRAPHIC &amp; DEPARTMENT SLICING · where time is lost ──  */}
        {' '}
        <div className="card cvs-card">
          <div className="card-h">
            <div>
              <div className="card-h-eyebrow">OBJECTIVE 2 & 3 · DEMOGRAPHIC + DEPARTMENT CUTS</div>
              {' '}
              <div className="card-h-title">Where the broadcast window is being lost</div>
              {' '}
              <div className="card-h-sub">
                Time to read, sliced six ways. Look for the rows that drag the plant average — those are the levers for the broadcaster to pull (different timing, different language, different escalation).
              </div>
            </div>
            {' '}
            <div className="cvs-dim-tabs" id="cvs-dim-tabs">
              <span className="cvs-dim-tab on" data-d="department" onClick={(event) => { window.cvsSetDim(event.currentTarget,'department') }} data-onclick="cvsSetDim(this,'department')">
                Department
              </span>
              {' '}
              <span className="cvs-dim-tab" data-d="contractor" onClick={(event) => { window.cvsSetDim(event.currentTarget,'contractor') }} data-onclick="cvsSetDim(this,'contractor')">
                Contractor
              </span>
              {' '}
              <span className="cvs-dim-tab" data-d="type" onClick={(event) => { window.cvsSetDim(event.currentTarget,'type') }} data-onclick="cvsSetDim(this,'type')">
                Direct / Contract
              </span>
              {' '}
              <span className="cvs-dim-tab" data-d="language" onClick={(event) => { window.cvsSetDim(event.currentTarget,'language') }} data-onclick="cvsSetDim(this,'language')">
                Language
              </span>
              {' '}
              <span className="cvs-dim-tab" data-d="shift" onClick={(event) => { window.cvsSetDim(event.currentTarget,'shift') }} data-onclick="cvsSetDim(this,'shift')">
                Shift
              </span>
              {' '}
              <span className="cvs-dim-tab" data-d="tenure" onClick={(event) => { window.cvsSetDim(event.currentTarget,'tenure') }} data-onclick="cvsSetDim(this,'tenure')">
                Tenure
              </span>
              {' '}
              <span className="cvs-dim-tab" data-d="age" onClick={(event) => { window.cvsSetDim(event.currentTarget,'age') }} data-onclick="cvsSetDim(this,'age')">
                Age band
              </span>
            </div>
          </div>
          {' '}
          <div className="cvs-grid" id="cvs-grid" />
          {' '}
          <div className="cvs-foot" id="cvs-foot" />
        </div>
        {' '}
        {/*  ── BY MESSAGE TYPE · TTR vs critical/urgent/advisory/info ──  */}
        {' '}
        <div className="card cvm-card">
          <div className="card-h">
            <div>
              <div className="card-h-eyebrow">OBJECTIVE 4 · BY MESSAGE TYPE</div>
              {' '}
              <div className="card-h-title">Time to read by message criticality</div>
              {' '}
              <div className="card-h-sub">
                Workers respond fast to critical safety alerts and slow to advisory notices — exactly as designed. But the spread tells you where to invest: shrink the advisory window with better timing, escalate critical breaches faster.
              </div>
            </div>
          </div>
          {' '}
          <div className="cvm-grid" id="cvm-grid" />
        </div>
        {' '}
        {/*  ── ACTION RECOMMENDATIONS · what to do about it ──  */}
        {' '}
        <div className="card cvr-card">
          <div className="card-h">
            <div>
              <div className="card-h-eyebrow">DECISION SUPPORT · WHAT TO CHANGE</div>
              {' '}
              <div className="card-h-title">Recommendations to minimise the broadcast window</div>
              {' '}
              <div className="card-h-sub">
                Auto-generated from the cuts above. Each card is a specific, dated change the broadcaster can make to shrink the window or lift the response rate.
              </div>
            </div>
          </div>
          {' '}
          <div className="cvr-list" id="cvr-list" />
        </div>
        {' '}
        {/*  TOP · KPI strip (full width)  */}
        {' '}
        <div className="card cv-kpi-card">
          <div className="card-h">
            <div>
              <div className="card-h-title">Today's engagement</div>
              {' '}
              <div className="card-h-sub">
                Live counts across every broadcast subject — the headline numbers driving the rest of the page
              </div>
            </div>
            {' '}
            <span className="pill outline" id="cv-an-total">—</span>
          </div>
          {' '}
          <div className="g4" style={{ margin: "14px 0 6px" }}>
            <div className="kpi">
              <div className="kpi-eye">Messages sent</div>
              <div className="kpi-val" id="cv-an-kpi-sent">—</div>
              <div className="kpi-sub" id="cv-an-kpi-sent-sub">across all subjects</div>
            </div>
            {' '}
            <div className="kpi">
              <div className="kpi-eye">Read rate</div>
              <div className="kpi-val" id="cv-an-kpi-read" style={{ color: "var(--indigo)" }}>—</div>
              <div className="kpi-sub" id="cv-an-kpi-read-sub">delivered → read</div>
            </div>
            {' '}
            <div className="kpi">
              <div className="kpi-eye">Ack rate</div>
              <div className="kpi-val" id="cv-an-kpi-ack" style={{ color: "var(--green-dk)" }}>—</div>
              <div className="kpi-sub" id="cv-an-kpi-ack-sub">read-receipt compliance</div>
            </div>
            {' '}
            <div className="kpi kpi-pend">
              <div className="kpi-eye">Pending response</div>
              <div className="kpi-val" id="cv-an-kpi-pend" style={{ color: "var(--amber-dk)" }}>—</div>
              <div className="kpi-sub" id="cv-an-kpi-pend-sub">acknowledgement overdue</div>
            </div>
          </div>
        </div>
        {' '}
        {/*  NEXT TO PENDING RESPONSE · the broadcast queue + pipeline  */}
        {' '}
        <div className="card cv-pipeline-card">
          <div className="card-h">
            <div>
              <div className="card-h-title">Broadcast queue & live pipeline</div>
              {' '}
              <div className="card-h-sub">
                A timeline view of what's queued, sending now, and what's already been delivered — the journey from Vaani Broadcasting to a worker's WhatsApp
              </div>
            </div>
            {' '}
            <span className="pill outline" id="cv-pipe-total">—</span>
          </div>
          {' '}
          {/*  key insight callout (top-most pressing item)  */}
          {' '}
          <div className="cv-insight" id="cv-insight" />
          {' '}
          {/*  5-stage pipeline funnel  */}
          {' '}
          <div className="cv-pipe-stages" id="cv-pipe-stages" />
          {' '}
          {/*  HORIZONTAL TIMELINE of queued broadcasts  */}
          {' '}
          <div className="cv-tl-wrap">
            <div className="cv-tl-head">
              <div className="cv-tl-eye">Today's broadcast timeline · 09:00 — 21:00</div>
              {' '}
              <div className="cv-tl-legend">
                <span className="cv-tl-lg">
                  <span className="cv-tl-lg-dot critical" />
                  Critical
                </span>
                {' '}
                <span className="cv-tl-lg">
                  <span className="cv-tl-lg-dot urgent" />
                  Urgent
                </span>
                {' '}
                <span className="cv-tl-lg">
                  <span className="cv-tl-lg-dot advisory" />
                  Advisory
                </span>
                {' '}
                <span className="cv-tl-lg">
                  <span className="cv-tl-lg-dot info" />
                  Info
                </span>
                {' '}
                <span className="cv-tl-lg-sep">|</span>
                {' '}
                <span className="cv-tl-lg">
                  <span className="cv-tl-lg-tick">✓</span>
                  sent
                </span>
                {' '}
                <span className="cv-tl-lg">
                  <span className="cv-tl-lg-num">1</span>
                  queued
                </span>
              </div>
            </div>
            {' '}
            {/*  period band labels  */}
            {' '}
            <div className="cv-tl-periods" id="cv-tl-periods" />
            {' '}
            {/*  main scale  */}
            {' '}
            <div className="cv-tl">
              <div className="cv-tl-bands" id="cv-tl-bands" />
              {' '}
              <div className="cv-tl-track" id="cv-tl-track" />
              {' '}
              <div className="cv-tl-now" id="cv-tl-now" />
            </div>
            {' '}
            <div className="cv-tl-axis" id="cv-tl-axis" />
          </div>
          {' '}
          {/*  timeline peg drill-down host (filled in by JS)  */}
          {' '}
          <div id="cv-tl-detail" style={{ display: "none" }} />
          {' '}
          {/*  queue + recent rows  */}
          {' '}
          <div className="cv-pipe-up">
            <div>
              <div className="cv-pipe-up-eye">Queued · upcoming broadcasts</div>
              {' '}
              <div className="cv-pipe-up-row" id="cv-pipe-up-list" />
            </div>
            {' '}
            <div>
              <div className="cv-pipe-up-eye">Recently sent</div>
              {' '}
              <div className="cv-pipe-up-row" id="cv-pipe-sent-list" />
            </div>
          </div>
        </div>
        {' '}
        {/*  RESPONSE ANALYTICS · grouped by employee / dept / type / contractor  */}
        {' '}
        <div className="card cv-grp-card">
          <div className="card-h">
            <div>
              <div className="card-h-title">Response analytics · how each cohort is responding</div>
              {' '}
              <div className="card-h-sub">
                Group read-receipt compliance by employee, department, employment type, or contractor — switch the lens with the tabs below
              </div>
            </div>
            {' '}
            <span className="pill outline" id="cv-grp-total">—</span>
          </div>
          {' '}
          {/*  tabs  */}
          {' '}
          <div className="cv-grp-tabs" id="cv-grp-tabs">
            <span className="cv-grp-tab on" data-grp="employee" onClick={(event) => { window.cvGrpSet(event.currentTarget,'employee') }} data-onclick="cvGrpSet(this,'employee')">
              By employee
            </span>
            {' '}
            <span className="cv-grp-tab" data-grp="department" onClick={(event) => { window.cvGrpSet(event.currentTarget,'department') }} data-onclick="cvGrpSet(this,'department')">
              By department
            </span>
            {' '}
            <span className="cv-grp-tab" data-grp="type" onClick={(event) => { window.cvGrpSet(event.currentTarget,'type') }} data-onclick="cvGrpSet(this,'type')">
              Direct vs Contract
            </span>
            {' '}
            <span className="cv-grp-tab" data-grp="contractor" onClick={(event) => { window.cvGrpSet(event.currentTarget,'contractor') }} data-onclick="cvGrpSet(this,'contractor')">
              By contractor
            </span>
          </div>
          {' '}
          {/*  grouped grid  */}
          {' '}
          <table className="t" id="cv-grp-grid" style={{ marginTop: "6px" }}>
            <thead id="cv-grp-grid-head" />
            <tbody id="cv-grp-grid-body" />
          </table>
        </div>
        {' '}
        {/*  DELIVERY TRENDS · hourly trajectory of the day  */}
        {' '}
        <div className="card cv-trends-card">
          <div className="card-h">
            <div>
              <div className="card-h-title">Delivery trends · hour by hour</div>
              {' '}
              <div className="card-h-sub">
                How dispatch volume, reads, and acknowledgements have moved through the day — the curve tells you where engagement spiked or slipped
              </div>
            </div>
            {' '}
            <div className="cv-trends-toggle" id="cv-trends-toggle">
              <span className="cv-trends-tab on" data-view="hourly" onClick={(event) => { window.cvTrendsSet(event.currentTarget,'hourly') }} data-onclick="cvTrendsSet(this,'hourly')">
                Hourly volume
              </span>
              {' '}
              <span className="cv-trends-tab" data-view="rate" onClick={(event) => { window.cvTrendsSet(event.currentTarget,'rate') }} data-onclick="cvTrendsSet(this,'rate')">
                Read & ack rate
              </span>
              {' '}
              <span className="cv-trends-tab" data-view="ttr" onClick={(event) => { window.cvTrendsSet(event.currentTarget,'ttr') }} data-onclick="cvTrendsSet(this,'ttr')">
                Time to read
              </span>
            </div>
          </div>
          {' '}
          <div className="cv-trends-legend" id="cv-trends-legend" />
          {' '}
          <div className="cv-trends-chart" id="cv-trends-chart" />
          {' '}
          <div className="cv-trends-foot" id="cv-trends-foot" />
        </div>
        {' '}
        {/*  BELOW · engagement by language (full width)  */}
        {' '}
        <div className="card cv-analytics-card">
          <div className="card-h">
            <div>
              <div className="card-h-title">Message analytics · grouped by subject</div>
              {' '}
              <div className="card-h-sub">
                Engagement and read-receipt compliance for every broadcast subject across the active worker base
              </div>
            </div>
          </div>
          {' '}
          {/*  per-language engagement strip  */}
          {' '}
          <div className="cv-lang-strip-eye">Engagement by language</div>
          {' '}
          <div className="cv-lang-strip" id="cv-lang-strip" />
          {' '}
          {/*  subject-grouped table  */}
          {' '}
          <div className="cv-an-grid-eye">Subject performance · sorted by attention needed</div>
          {' '}
          <table className="t" id="cv-an-grid">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Tier</th>
                <th>Sent</th>
                <th>Languages</th>
                <th>Read</th>
                <th>Acknowledged</th>
                <th>Pending</th>
              </tr>
            </thead>
            <tbody id="cv-an-grid-body" />
          </table>
        </div>
      </div>
    </div>
  );
}
