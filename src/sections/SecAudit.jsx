/* SecAudit — converted 1:1 from karya-vaani_v3.html · <section id="sec-audit"> */
export default function SecAudit() {
  return (
    <section id="sec-audit" className="section">
      <div className="crumbs">
        <span>Governance</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Audit trail</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Append-only · SHA-256 chained · WORM</div>
          {' '}
          <h1 className="page-title">
            {"The "}
            <em>evidence of record</em>
          </h1>
          {' '}
          <p className="page-sub">
            Every action on the platform — translation, broadcast, ack, document upload, rule activation — is captured as an immutable, chained entry. Retained per statutory floor on your remediation platform; Karya Vaani SaaS does not store it.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn">Verify chain integrity</button>
          {' '}
          <button className="btn primary">Open inspector mode</button>
        </div>
      </div>
      {' '}
      <div className="g4" style={{ marginBottom: "18px" }}>
        <div className="kpi">
          <div className="kpi-eye">Entries (lifetime)</div>
          <div className="kpi-val">
            128
            <small>k</small>
          </div>
          <div className="kpi-sub">since 14 Jan 2026</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Chain integrity</div>
          <div className="kpi-val" style={{ color: "var(--green-dk)" }}>
            100
            <small>%</small>
          </div>
          <div className="kpi-sub">last verified 09:18 today</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Retention policy</div>
          <div className="kpi-val">
            7y
            <small>+</small>
          </div>
          <div className="kpi-sub">statutory floor enforced</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Inspector sessions</div>
          <div className="kpi-val">2</div>
          <div className="kpi-sub">time-bounded · PII-scoped</div>
        </div>
      </div>
      {' '}
      <div className="g23">
        <div className="card">
          <div className="card-h">
            <div className="card-h-title">Recent entries</div>
            <div className="card-h-action">Export · range</div>
          </div>
          {' '}
          <table className="t">
            <thead>
              <tr>
                <th>Time (IST)</th>
                <th>Event</th>
                <th>Actor</th>
                <th>Provenance</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="mono tiny">14:02:11</td>
                <td className="t-strong">broadcast.sent</td>
                <td>Priya M. (CHRO)</td>
                <td className="tiny muted">MSG-87412 · Mayura v1 · Bulbul v3 · DK-2026.04</td>
                <td>
                  <span className="mono tiny">a3f7…d290</span>
                </td>
              </tr>
              <tr>
                <td className="mono tiny">14:02:09</td>
                <td className="t-strong">broadcast.approved</td>
                <td>Priya M. (CHRO)</td>
                <td className="tiny muted">approval chain · 1 step</td>
                <td>
                  <span className="mono tiny">a3f7…c812</span>
                </td>
              </tr>
              <tr>
                <td className="mono tiny">11:47:02</td>
                <td className="t-strong">contractor.licence.expiring</td>
                <td>system</td>
                <td className="tiny muted">Sri Lakshmi · CLRA · 21d</td>
                <td>
                  <span className="mono tiny">b9e1…44ac</span>
                </td>
              </tr>
              <tr>
                <td className="mono tiny">11:43:18</td>
                <td className="t-strong">localisation.review.approved</td>
                <td>Sato-san (Daikin JP)</td>
                <td className="tiny muted">90-day roadmap board pack · JP</td>
                <td>
                  <span className="mono tiny">d104…8821</span>
                </td>
              </tr>
              <tr>
                <td className="mono tiny">09:18:55</td>
                <td className="t-strong">rules.bundle.activated</td>
                <td>Rakesh K. (IT Admin)</td>
                <td className="tiny muted">v2026.05.2 · pv-rule-signer-prod</td>
                <td>
                  <span className="mono tiny">7c22…1f08</span>
                </td>
              </tr>
              <tr>
                <td className="mono tiny">08:32:04</td>
                <td className="t-strong">handoff.event.delivered</td>
                <td>system</td>
                <td className="tiny muted">worker.master · HRIS · ack 24s</td>
                <td>
                  <span className="mono tiny">52aa…0b41</span>
                </td>
              </tr>
              <tr>
                <td className="mono tiny">17:42:30 (-1d)</td>
                <td className="t-strong">contractor.esic.mismatch</td>
                <td>system</td>
                <td className="tiny muted">Sri Lakshmi · −4 May challan</td>
                <td>
                  <span className="mono tiny">10ed…ab44</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {' '}
        <div>
          <div className="card sunken" style={{ marginBottom: "14px" }}>
            <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Typical entry · what it captures</div>
            {' '}
            <hr className="div" />
            {' '}
            <div style={{ fontSize: "0.74rem", color: "var(--ink-2)", lineHeight: "1.7" }}>
              <div className="row-between">
                <span>Event ID + type</span>
                <span className="mono">MSG-87412</span>
              </div>
              {' '}
              <div className="row-between">
                <span>Actor identity</span>
                <span className="mono">Priya M. (CHRO)</span>
              </div>
              {' '}
              <div className="row-between">
                <span>Approval chain</span>
                <span className="mono">1 step</span>
              </div>
              {' '}
              <div className="row-between">
                <span>Translation provenance</span>
                <span className="mono">Mayura + Bulbul</span>
              </div>
              {' '}
              <div className="row-between">
                <span>Reviewer (if any)</span>
                <span className="mono">—</span>
              </div>
              {' '}
              <div className="row-between">
                <span>Channels + audience</span>
                <span className="mono">5 · 3526</span>
              </div>
              {' '}
              <div className="row-between">
                <span>Content hash</span>
                <span className="mono">a3f7…d290</span>
              </div>
              {' '}
              <div className="row-between">
                <span>Prev-hash link</span>
                <span className="mono">a3f7…c812</span>
              </div>
            </div>
          </div>
          {' '}
          <div className="card">
            <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Inspector mode</div>
            {' '}
            <hr className="div" />
            {' '}
            <div className="tiny" style={{ lineHeight: "1.55", color: "var(--ink-2)" }}>
              {"\n          Time-bounded, read-only access for a third party (inspector, auditor, parent-company reviewer). PII is scoped to the inspection's stated scope; the inspector's session is itself audited.\n        "}
            </div>
            {' '}
            <button className="btn" style={{ marginTop: "10px", width: "100%" }}>Grant inspector access →</button>
          </div>
        </div>
      </div>
    </section>
  );
}
