/* SecOhs — converted 1:1 from karya-vaani_v3.html · <section id="sec-ohs"> */
export default function SecOhs() {
  return (
    <section id="sec-ohs" className="section">
      <div className="crumbs">
        <span>Operational Pillars</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Workplace Safety & OHS Analytics</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Module 5 · presence × pattern × time · incident ledger</div>
          {' '}
          <h1 className="page-title">
            {"Patterns are "}
            <em>louder</em>
            {" than incidents"}
          </h1>
          {' '}
          <p className="page-sub">
            Single safety ledger for incidents, near-misses and observations, cross-referenced with employee and contractor presence and time tracking. Same-zone, same-shift, same-contractor clusters surface as patterns and drive zone-specific refresher routing.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" disabled title="Coming soon">Voice incident (Saaras v3)</button>
          {' '}
          <button className="btn primary" disabled title="Coming soon">+ Log incident</button>
        </div>
      </div>
      {' '}
      <div className="g4" style={{ marginBottom: "18px" }}>
        <div className="kpi">
          <div className="kpi-eye">LTIFR (12 mo rolling)</div>
          <div className="kpi-val">0.42</div>
          <div className="kpi-sub">
            <span className="kpi-delta up">▲</span>
            {" seasonal uplift"}
          </div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Near-misses · 30d</div>
          <div className="kpi-val">17</div>
          <div className="kpi-sub">Paint Shop heaviest</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Open CAPAs</div>
          <div className="kpi-val">9</div>
          <div className="kpi-sub">2 overdue</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">PPE compliance (obs.)</div>
          <div className="kpi-val">
            91
            <small>%</small>
          </div>
          <div className="kpi-sub">Helmet 96% · shoes 97% · ear 78%</div>
        </div>
      </div>
      {' '}
      <div className="g23">
        <div>
          <div className="card" style={{ marginBottom: "16px" }}>
            <div className="card-h">
              <div className="card-h-title">Incident ledger · last 30 days</div>
              <span className="pill outline">19 entries</span>
            </div>
            {' '}
            <table className="t">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Zone</th>
                  <th>Worker</th>
                  <th>Shift</th>
                  <th>CAPA</th>
                  <th>Statutory</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="t-id">OHS-1148</td>
                  <td>
                    <span className="pill amber">Near-miss</span>
                  </td>
                  <td>Paint Shop · Zone 3</td>
                  <td>Contract · Sri Lakshmi</td>
                  <td>B (14:00)</td>
                  <td>
                    <span className="pill amber">Open · 4d</span>
                  </td>
                  <td>—</td>
                </tr>
                <tr>
                  <td className="t-id">OHS-1147</td>
                  <td>
                    <span className="pill amber">Near-miss</span>
                  </td>
                  <td>Paint Shop · Zone 3</td>
                  <td>Contract · Sri Lakshmi</td>
                  <td>B (16:30)</td>
                  <td>
                    <span className="pill amber">Open · 6d</span>
                  </td>
                  <td>—</td>
                </tr>
                <tr>
                  <td className="t-id">OHS-1145</td>
                  <td>
                    <span className="pill blue">Observation</span>
                  </td>
                  <td>Compressor Line</td>
                  <td>Direct</td>
                  <td>A</td>
                  <td>
                    <span className="pill green">Closed</span>
                  </td>
                  <td>—</td>
                </tr>
                <tr>
                  <td className="t-id">OHS-1142</td>
                  <td>
                    <span className="pill red">Injury (minor)</span>
                  </td>
                  <td>Packaging</td>
                  <td>Contract · Pavan</td>
                  <td>C</td>
                  <td>
                    <span className="pill green">Closed</span>
                  </td>
                  <td>Form 21 · filed 24h</td>
                </tr>
                <tr>
                  <td className="t-id">OHS-1138</td>
                  <td>
                    <span className="pill blue">Property damage</span>
                  </td>
                  <td>Warehouse</td>
                  <td>Contract · Bharat</td>
                  <td>A</td>
                  <td>
                    <span className="pill amber">Open · 8d</span>
                  </td>
                  <td>—</td>
                </tr>
              </tbody>
            </table>
          </div>
          {' '}
          <div className="card">
            <div className="card-h">
              <div className="card-h-title">CAPA closure tracking</div>
              <span className="pill outline">9 open</span>
            </div>
            {' '}
            <div style={{ fontSize: "0.8rem", color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: "10px" }}>
              <div className="row-between">
                <span>Owners assigned</span>
                <span className="t-strong">9 / 9</span>
              </div>
              {' '}
              <div className="row-between">
                <span>On-time (SLA 14 days)</span>
                <span className="t-strong" style={{ color: "var(--green-dk)" }}>7 / 9</span>
              </div>
              {' '}
              <div className="row-between">
                <span>Closure evidence pending</span>
                <span className="t-strong" style={{ color: "var(--amber-dk)" }}>2</span>
              </div>
              {' '}
              <div className="row-between">
                <span>Escalations to EHS lead</span>
                <span className="t-strong">2</span>
              </div>
            </div>
          </div>
        </div>
        {' '}
        <div>
          <div className="card" style={{ marginBottom: "16px" }}>
            <div className="card-h">
              <div className="card-h-title">Patterns detected</div>
            </div>
            {' '}
            <div className="note">
              <strong>Same-zone repeat:</strong>
              {" 4 near-misses in Paint Shop Zone 3 within 11 days. Routed to LMS for zone-specific refresher; Broadcasting cued to fire safety alert in TE/HI/EN.\n        "}
            </div>
            {' '}
            <hr className="div" />
            {' '}
            <div className="note red">
              <strong>Same-contractor cluster:</strong>
              {" 6 of 17 incidents in 30d involve Sri Lakshmi Engg workers (35% vs 11% headcount share). Contractor compliance score already flagged amber.\n        "}
            </div>
            {' '}
            <hr className="div" />
            {' '}
            <div className="note indigo">
              <strong>Time-of-day correlation:</strong>
              {" 11 of 17 near-misses cluster in the 13:00–16:00 post-meal window. Recommends supervisor briefing + ventilation check.\n        "}
            </div>
          </div>
          {' '}
          <div className="card">
            <div className="card-h-title" style={{ marginBottom: "10px", fontSize: "0.95rem" }}>
              Statutory reporting
            </div>
            {' '}
            <div style={{ fontSize: "0.8rem", color: "var(--ink-2)", lineHeight: "1.7" }}>
              <div className="row-between">
                <span>Form 21 (Factories Act)</span>
                <span className="pill green tiny">1 filed · 24h</span>
              </div>
              {' '}
              <div className="row-between">
                <span>OSH&WC equivalent</span>
                <span className="pill outline tiny">not yet notified · AP</span>
              </div>
              {' '}
              <div className="row-between">
                <span>ESIC Form 16</span>
                <span className="pill green tiny">1 filed · 7d</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
