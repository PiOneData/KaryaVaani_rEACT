/* SecLocale — converted 1:1 from karya-vaani_v3.html · <section id="sec-locale"> */
export default function SecLocale() {
  return (
    <section id="sec-locale" className="section">
      <div className="crumbs">
        <span>Governance</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Global Localization Engine</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Dedicated Japanese + multi-lingual deployment · gated publishing</div>
          {' '}
          <h1 className="page-title">
            {"No "}
            <span className="lang-jp" style={{ fontStyle: "normal" }}>日本語</span>
            {" reaches an exec "}
            <em>without</em>
            {" sign-off"}
          </h1>
          {' '}
          <p className="page-sub">
            Purpose-built engine for Japanese-led customers and multi-state Indian deployment. Non-native-language artefacts (executive summaries, statutory notices, safety briefings) route to the customer's appointed language expert for inline edit, terminology capture and approval. Reviewer identity and timestamp are written to the audit trail; content is then locked for distribution.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" disabled title="Coming soon">Glossary editor</button>
          {' '}
          <button className="btn primary" disabled title="Coming soon">+ Send draft</button>
        </div>
      </div>
      {' '}
      <div className="g4" style={{ marginBottom: "18px" }}>
        <div className="kpi">
          <div className="kpi-eye">Awaiting review</div>
          <div className="kpi-val" style={{ color: "var(--amber-dk)" }}>4</div>
          <div className="kpi-sub">Japanese · executive bound</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Approved · 30d</div>
          <div className="kpi-val">38</div>
          <div className="kpi-sub">Daikin · Sato-san</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Terminology entries</div>
          <div className="kpi-val">214</div>
          <div className="kpi-sub">DK glossary v2026.04</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Avg review turnaround</div>
          <div className="kpi-val">
            3.2
            <small>h</small>
          </div>
          <div className="kpi-sub">SLA · 8h</div>
        </div>
      </div>
      {' '}
      <div className="card" style={{ marginBottom: "16px" }}>
        <div className="card-h">
          <div className="card-h-title">Review queue</div>
          <span className="pill outline">Reviewer · Sato-san · Daikin Japan</span>
        </div>
        {' '}
        <table className="t">
          <thead>
            <tr>
              <th>Artefact</th>
              <th>Audience</th>
              <th>Source</th>
              <th>Status</th>
              <th>Glossary</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="t-strong">
                {"Q1 OHS exec summary "}
                <span className="lang-jp" style={{ color: "var(--ink-3)", fontWeight: "400" }}>(四半期OHS要旨)</span>
              </td>
              <td>Daikin Japan HQ</td>
              <td>EN → JP</td>
              <td>
                <span className="locale-status review">Awaiting review</span>
              </td>
              <td className="mono">DK-2026.04</td>
              <td>2h ago</td>
            </tr>
            <tr>
              <td className="t-strong">Offer letter · Plant Manager</td>
              <td>Candidate · Sato-san</td>
              <td>EN → JP</td>
              <td>
                <span className="locale-status review">Awaiting review</span>
              </td>
              <td className="mono">DK-2026.04</td>
              <td>4h ago</td>
            </tr>
            <tr>
              <td className="t-strong">Compressor zone safety briefing</td>
              <td>Visiting JP managers</td>
              <td>EN → JP</td>
              <td>
                <span className="locale-status review">Awaiting review</span>
              </td>
              <td className="mono">DK-2026.04</td>
              <td>5h ago</td>
            </tr>
            <tr>
              <td className="t-strong">Kaizen observation · visitor input</td>
              <td>Plant EHS</td>
              <td>JP → EN</td>
              <td>
                <span className="locale-status review">Awaiting review</span>
              </td>
              <td className="mono">DK-2026.04</td>
              <td>1h ago</td>
            </tr>
            <tr>
              <td className="t-strong">90-day roadmap (board pack)</td>
              <td>Daikin Japan HQ</td>
              <td>EN → JP</td>
              <td>
                <span className="locale-status approved">Approved</span>
              </td>
              <td className="mono">DK-2026.04</td>
              <td>1d ago</td>
            </tr>
          </tbody>
        </table>
      </div>
      {' '}
      <div className="g23">
        <div className="card">
          <div className="card-h">
            <div className="card-h-title">Reviewer interface · Q1 OHS exec summary</div>
            <span className="locale-status review">Awaiting review</span>
          </div>
          {' '}
          <div className="g2" style={{ gap: "14px" }}>
            <div>
              <div className="field-l">Source (English)</div>
              {' '}
              <div style={{ fontSize: "0.85rem", color: "var(--ink-2)", lineHeight: "1.6", padding: "10px", background: "var(--paper-2)", borderRadius: "var(--r-md)", minHeight: "140px" }}>
                {"\n            In Q1, the plant logged 1 minor injury and 17 near-misses. The Paint Shop accounts for 5 of those near-misses, concentrated in the afternoon shift. CAPA closure rate is 78%, on target.\n          "}
              </div>
            </div>
            {' '}
            <div>
              <div className="field-l">
                {"Draft Japanese "}
                <span className="pill amber tiny" style={{ marginLeft: "6px" }}>VAANI draft</span>
              </div>
              {' '}
              <div className="lang-jp" style={{ fontSize: "0.92rem", color: "var(--ink)", lineHeight: "1.7", padding: "10px", background: "var(--amber-soft)", border: "1px dashed var(--amber)", borderRadius: "var(--r-md)", minHeight: "140px" }}>
                {"\n            第一四半期、工場では軽傷1件およびヒヤリハット17件が記録されました。塗装工場ではこのうち5件が午後シフトに集中しています。CAPA完了率は78%で目標を達成しています。\n          "}
              </div>
            </div>
          </div>
          {' '}
          <div style={{ marginTop: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div className="tiny muted">
              Terminology suggestions · 「ヒヤリハット」 (near-miss), 「軽傷」 (minor injury) added to glossary
            </div>
            {' '}
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn" disabled title="Coming soon">Edit inline</button>
              {' '}
              <button className="btn" disabled title="Coming soon">Reject & comment</button>
              {' '}
              <button className="btn primary" disabled title="Coming soon">Approve & lock</button>
            </div>
          </div>
        </div>
        {' '}
        <div className="card sunken">
          <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Cultural format conventions</div>
          {' '}
          <hr className="div" />
          {' '}
          <div style={{ fontSize: "0.78rem", color: "var(--ink-2)", lineHeight: "1.7" }}>
            <div className="row-between">
              <span>Date format</span>
              <span className="mono">YYYY年MM月DD日</span>
            </div>
            {' '}
            <div className="row-between">
              <span>Name order</span>
              <span className="mono">last-first (Sato Hiroshi)</span>
            </div>
            {' '}
            <div className="row-between">
              <span>Register · executive</span>
              <span className="mono">敬語 (keigo)</span>
            </div>
            {' '}
            <div className="row-between">
              <span>Register · operational</span>
              <span className="mono">plain</span>
            </div>
            {' '}
            <div className="row-between">
              <span>Hierarchy presentation</span>
              <span className="mono">parent-line first</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
