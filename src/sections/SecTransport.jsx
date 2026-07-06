/* SecTransport — weekly worker transport: address-based batching, targeted
   per-route communications, and ID-card attendance (provider API pending). */
export default function SecTransport() {
  return (
    <section id="sec-transport" className="section">
      <div className="crumbs">
        <span>Localisation Engine</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Transport Schedule</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Localisation Engine · weekly worker transport plan</div>
          {' '}
          <h1 className="page-title">
            {"Weekly "}
            <em>transport roster</em>
            {" — batched by route, notified per batch"}
          </h1>
          {' '}
          <p className="page-sub">
            Every worker is placed on their zone bus for the week — extrapolated from their home
            locality — with a pickup point and shift. Transport communications go to the specific
            route batch, not a blast to everyone. Boarding attendance is captured per trip from the
            ID-card provider (API integration pending).
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" onClick={(event) => { window.trPrint() }} data-onclick="trPrint()">
            Export plan
          </button>
          {' '}
          <button className="btn primary" onClick={(event) => { window.trNotifyAllBatches() }} data-onclick="trNotifyAllBatches()">
            Notify all route batches
          </button>
        </div>
      </div>
      {' '}
      <div className="g4" style={{ marginBottom: "18px" }}>
        <div className="kpi">
          <div className="kpi-eye">Buses in service</div>
          <div className="kpi-val" id="tr-kpi-buses">—</div>
          <div className="kpi-sub">one per zone route</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Workers batched</div>
          <div className="kpi-val" id="tr-kpi-batched" style={{ color: "var(--indigo)" }}>—</div>
          <div className="kpi-sub">across all routes</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Pickup points</div>
          <div className="kpi-val" id="tr-kpi-pickups">—</div>
          <div className="kpi-sub">across all routes</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Plan week</div>
          <div className="kpi-val" style={{ fontSize: "1.15rem" }} id="tr-kpi-status">Published</div>
          <div className="kpi-sub" id="tr-kpi-week">—</div>
        </div>
      </div>
      {' '}
      {/*  ── WEEKLY ROSTER · batches by route + targeted comms + attendance ──  */}
      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="card-h">
          <div>
            <div className="card-h-title">Weekly roster · workers batched by route</div>
            <div className="card-h-sub">
              Grouped onto their zone bus from home locality. Notify targets one batch (route + shift) —
              not everyone. Take attendance captures boarding for the selected date.
            </div>
          </div>
          <span className="pill outline" id="tr-batch-count">—</span>
        </div>
        {' '}
        <div className="dir-controls" style={{ gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className="tiny muted">Week</span>
            <select className="sel" id="tr-week-sel" style={{ width: "auto" }} onChange={(event) => { window.trSetWeek(event.currentTarget.value) }}>
              <option value="0">This week</option>
              <option value="1">Next week</option>
              <option value="-1">Last week</option>
            </select>
            <span className="t-strong" id="tr-roster-week">—</span>
            {' '}
            <span id="tr-roster-status" />
          </div>
          {' '}
          <div className="tr-shift-toggle" id="tr-shift-toggle" />
          {' '}
          <div style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            <button className="btn primary" onClick={(event) => { window.trPublishRoster() }} data-onclick="trPublishRoster()">
              Publish roster for the week
            </button>
          </div>
        </div>
        {' '}
        <div className="note amber" style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span>
            <strong>ID-card attendance.</strong> Boarding is captured from the ID-card provider’s turnstile
            scans — <em>API access requested, integration pending</em>. Until it’s live, “Take attendance”
            simulates a scan so the flow is complete end to end.
          </span>
          <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <span className="tiny muted">Trip date</span>
            <input type="date" className="input" id="tr-att-date" style={{ width: "auto" }} onChange={(event) => { window.trSetDate(event.currentTarget.value) }} />
          </span>
        </div>
        {' '}
        <div className="dir-controls" style={{ marginBottom: "10px" }}>
          <input type="text" className="input" id="tr-batch-search" autoComplete="off" placeholder="Search route, bus, town, zone…" style={{ maxWidth: "340px" }} />
        </div>
        {' '}
        <div style={{ overflowX: "auto" }}>
          <table className="t" id="tr-batch-table">
            <thead>
              <tr>
                <th>Route · zone</th>
                <th>Nearest town</th>
                <th style={{ textAlign: "center" }}>Batch (shift)</th>
                <th>Boards</th>
                <th style={{ textAlign: "center" }}>Attendance</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody id="tr-batch-body" />
          </table>
        </div>
        <div id="tr-batch-pagination" className="om-pagination" />
      </div>
      {' '}
      {/*  weekly plan (which bus runs which route, by day)  */}
      {' '}
      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="card-h">
          <div>
            <div className="card-h-title">Weekly plan</div>
            {' '}
            <div className="card-h-sub" id="tr-shift-sub">Which bus runs which route, by day</div>
          </div>
        </div>
        {' '}
        <div style={{ overflowX: "auto" }}>
          <table className="t" id="tr-week-table">
            <thead id="tr-week-head" />
            <tbody id="tr-week-body" />
          </table>
        </div>
        {' '}
        <div className="note indigo" style={{ marginTop: "14px" }} id="tr-shift-note" />
      </div>
      {' '}
      {/*  route detail cards  */}
      {' '}
      <div className="card-h" style={{ marginBottom: "12px" }}>
        <div>
          <div className="card-h-title">Route details & pickup points</div>
          {' '}
          <div className="card-h-sub">Every route, its bus, pickup stops and shift timings</div>
        </div>
        {' '}
        <span className="pill blue">routes & pickups</span>
      </div>
      {' '}
      <div className="g2" id="tr-route-cards" />
    </section>
  );
}
