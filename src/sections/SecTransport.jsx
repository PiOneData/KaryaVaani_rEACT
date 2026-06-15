/* SecTransport — converted 1:1 from karya-vaani_v3.html · <section id="sec-transport"> */
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
            {"The weekly "}
            <em>transport schedule</em>
            {" — routes, pickups, two shifts"}
          </h1>
          {' '}
          <p className="page-sub">
            A published weekly plan for the worker bus fleet — five buses across five zone routes, serving the morning and general shifts. Each route lists its pickup points and timings. Publish the plan, then push it to workers as a localised broadcast in one click.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" onClick={(event) => { window.trPrint() }} data-onclick="trPrint()">
            Export plan
          </button>
          {' '}
          <button className="btn primary" onClick={(event) => { window.trBroadcast() }} data-onclick="trBroadcast()">
            Broadcast this schedule
          </button>
        </div>
      </div>
      {' '}
      <div className="g4" style={{ marginBottom: "18px" }}>
        <div className="kpi">
          <div className="kpi-eye">Buses in service</div>
          <div className="kpi-val" id="tr-kpi-buses">5</div>
          <div className="kpi-sub">one per zone route</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Shifts covered</div>
          <div className="kpi-val">2</div>
          <div className="kpi-sub">morning · general</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Pickup points</div>
          <div className="kpi-val" id="tr-kpi-pickups">—</div>
          <div className="kpi-sub">across all routes</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Plan status</div>
          <div className="kpi-val" style={{ fontSize: "1.3rem" }} id="tr-kpi-status">Published</div>
          <div className="kpi-sub" id="tr-kpi-week">—</div>
        </div>
      </div>
      {' '}
      {/*  shift switch  */}
      {' '}
      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="card-h">
          <div>
            <div className="card-h-title">Weekly plan</div>
            {' '}
            <div className="card-h-sub" id="tr-shift-sub">Which bus runs which route, by day</div>
          </div>
          {' '}
          <div className="tr-shift-toggle" id="tr-shift-toggle" />
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
        <span className="pill blue">5 routes</span>
      </div>
      {' '}
      <div className="g2" id="tr-route-cards" />
    </section>
  );
}
