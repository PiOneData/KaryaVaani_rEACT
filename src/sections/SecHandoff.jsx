/* SecHandoff — converted 1:1 from karya-vaani_v3.html · <section id="sec-handoff"> */
export default function SecHandoff() {
  return (
    <section id="sec-handoff" className="section">
      <div className="crumbs">
        <span>Governance</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">API handoff</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Event-driven · mTLS + HMAC-SHA256 · idempotent</div>
          {' '}
          <h1 className="page-title">
            {"Where intake formally "}
            <em>ends</em>
          </h1>
          {' '}
          <p className="page-sub">
            On successful onboarding, the worker master record pushes to Daikin HRIS, EHS and payroll over signed webhooks. Ongoing events (incidents, ack records, licence states) keep flowing in near-real time. Customer-side reconciliation endpoint available on demand.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" disabled title="Coming soon">Schema registry</button>
          {' '}
          <button className="btn primary" disabled title="Coming soon">Replay event</button>
        </div>
      </div>
      {' '}
      <div className="g4" style={{ marginBottom: "18px" }}>
        <div className="kpi">
          <div className="kpi-eye">Events · 24h</div>
          <div className="kpi-val">1,842</div>
          <div className="kpi-sub">p95 delivery 24s</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Delivery success</div>
          <div className="kpi-val">
            99.92
            <small>%</small>
          </div>
          <div className="kpi-sub">2 in DLQ · resolved</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Schema conformance</div>
          <div className="kpi-val">
            100
            <small>%</small>
          </div>
          <div className="kpi-sub">non-conform blocked at gateway</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Active endpoints</div>
          <div className="kpi-val">7</div>
          <div className="kpi-sub">HRIS · EHS · Payroll · IdP · …</div>
        </div>
      </div>
      {' '}
      <div className="g23">
        <div className="card">
          <div className="card-h">
            <div className="card-h-title">Endpoint health · Daikin IT</div>
          </div>
          {' '}
          <table className="t">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>System</th>
                <th>p95</th>
                <th>Last delivery</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="mono">/workers/master</span>
                </td>
                <td className="t-strong">Workday HRIS</td>
                <td>24s</td>
                <td>32 min ago</td>
                <td>
                  <span className="pill green">healthy</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="mono">/training/certificates</span>
                </td>
                <td className="t-strong">Workday HRIS</td>
                <td>18s</td>
                <td>1h ago</td>
                <td>
                  <span className="pill green">healthy</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="mono">/ohs/incidents</span>
                </td>
                <td className="t-strong">Daikin EHS</td>
                <td>22s</td>
                <td>4h ago</td>
                <td>
                  <span className="pill green">healthy</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="mono">/contractors/state</span>
                </td>
                <td className="t-strong">Daikin EHS</td>
                <td>26s</td>
                <td>11h ago</td>
                <td>
                  <span className="pill green">healthy</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="mono">/payroll/master</span>
                </td>
                <td className="t-strong">SAP Payroll</td>
                <td>29s</td>
                <td>2h ago</td>
                <td>
                  <span className="pill amber">retry · 1</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="mono">/positions/closed</span>
                </td>
                <td className="t-strong">Workday HRIS</td>
                <td>20s</td>
                <td>3h ago</td>
                <td>
                  <span className="pill green">healthy</span>
                </td>
              </tr>
              <tr>
                <td>
                  <span className="mono">/reconcile</span>
                </td>
                <td className="t-strong">Daikin IT (on-demand)</td>
                <td>—</td>
                <td>1d ago</td>
                <td>
                  <span className="pill blue">pull</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {' '}
        <div>
          <div className="card sunken" style={{ marginBottom: "14px" }}>
            <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Recent payload · /workers/master</div>
            {' '}
            <hr className="div" />
            {' '}
            <div style={{ background: "var(--paper-2)", padding: "10px", borderRadius: "var(--r-md)", fontFamily: "var(--mono)", fontSize: "0.7rem", color: "var(--ink-2)", lineHeight: "1.5", overflowX: "auto", whiteSpace: "pre" }}>
              {"{\n  \"event_id\": \"evt_8f4c…\",\n  \"event_type\": \"worker.onboarded\",\n  \"schema_version\": \"1.4.0\",\n  \"occurred_at\": \"2026-05-20T08:32:04Z\",\n  \"worker\": {\n    \"id\": \"wrk_010823\",\n    \"worker_type\": \"direct\",\n    \"position_id\": \"POS-2026-0148\",\n    \"statutory_ids\": { \"uan\": \"…\", \"esic\": null, \"pan\": \"…\" },\n    \"documents\": [ { \"type\": \"aadhaar\", \"hash\": \"…\", \"ts\": \"…\" } ],\n    \"training\": { \"certificates\": [ \"cert_77a1\" ] }\n  },\n  \"signature\": \"hmac-sha256:…\"\n}"}
            </div>
          </div>
          {' '}
          <div className="card">
            <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Retry & reconciliation contract</div>
            {' '}
            <hr className="div" />
            {' '}
            <div style={{ fontSize: "0.78rem", color: "var(--ink-2)", lineHeight: "1.7" }}>
              <div className="row-between">
                <span>Retry policy</span>
                <span className="mono">exp · 24h</span>
              </div>
              {' '}
              <div className="row-between">
                <span>Idempotency key</span>
                <span className="mono">event_id</span>
              </div>
              {' '}
              <div className="row-between">
                <span>DLQ alerting</span>
                <span className="mono">SRE pager</span>
              </div>
              {' '}
              <div className="row-between">
                <span>Reconciliation endpoint</span>
                <span className="mono">/reconcile</span>
              </div>
              {' '}
              <div className="row-between">
                <span>Schema evolution</span>
                <span className="mono">backward-compat</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
