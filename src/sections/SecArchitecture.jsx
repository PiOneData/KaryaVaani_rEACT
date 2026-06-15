/* SecArchitecture — converted 1:1 from karya-vaani_v3.html · <section id="sec-architecture"> */
export default function SecArchitecture() {
  return (
    <section id="sec-architecture" className="section">
      <div className="crumbs">
        <span>Overview</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Architectural Blueprint</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Hybrid tenancy · §3 of PRD</div>
          {' '}
          <h1 className="page-title">
            {"Architectural "}
            <em>blueprint</em>
            {" — shared intelligence, private data"}
          </h1>
          {' '}
          <p className="page-sub">
            Multi-tenant assessment engine on Karya Vaani cloud. Single-tenant remediation deployed inside your perimeter. Cross-boundary flow is signed bundles down, aggregate signals up — never raw PII.
          </p>
        </div>
      </div>
      {' '}
      <div className="arch-row">
        {/*  SaaS layer  */}
        {' '}
        <div className="arch-band" style={{ borderTop: "3px solid var(--indigo)" }}>
          <div className="arch-band-h">
            <div>
              <div className="arch-band-title">Karya Vaani SaaS · multi-tenant · India region</div>
              {' '}
              <div className="tiny muted">Assessment intelligence · vendor-managed · continuous delivery</div>
            </div>
            {' '}
            <span className="pill blue">SaaS</span>
          </div>
          {' '}
          <div className="arch-tiles" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            <div className="arch-tile">
              <div className="arch-tile-h">
                <span className="ico" style={{ width: "24px", height: "24px", fontSize: "0.8rem" }}>⌖</span>
                Continuous Compliance Engine
              </div>
              <div className="arch-tile-d">7-question rubric · sector schedules · always-on</div>
            </div>
            {' '}
            <div className="arch-tile">
              <div className="arch-tile-h">
                <span className="ico" style={{ width: "24px", height: "24px", fontSize: "0.8rem" }}>⌒</span>
                Rule library
              </div>
              <div className="arch-tile-d">Statutory · signed · versioned</div>
            </div>
            {' '}
            <div className="arch-tile">
              <div className="arch-tile-h">
                <span className="ico amber" style={{ width: "24px", height: "24px", fontSize: "0.8rem" }}>⍟</span>
                Gazette monitor
              </div>
              <div className="arch-tile-d">NLP scan · central + state</div>
            </div>
            {' '}
            <div className="arch-tile">
              <div className="arch-tile-h">
                <span className="ico teal" style={{ width: "24px", height: "24px", fontSize: "0.8rem" }}>⊟</span>
                Benchmarking
              </div>
              <div className="arch-tile-d">Anonymised · opt-in</div>
            </div>
          </div>
        </div>
        {' '}
        {/*  Boundary  */}
        {' '}
        <div className="boundary">↓ Signed rule bundles  ·  ↑ Aggregate signals only · no PII ↓</div>
        {' '}
        {/*  Customer remediation  */}
        {' '}
        <div className="arch-band" style={{ borderTop: "3px solid var(--amber)" }}>
          <div className="arch-band-h">
            <div>
              <div className="arch-band-title">Customer remediation platform · single-tenant · Daikin Sricity</div>
              {' '}
              <div className="tiny muted">
                Worker PII · document store · audit trail · versioned releases via change management
              </div>
            </div>
            {' '}
            <span className="pill amber">Single-tenant</span>
          </div>
          {' '}
          <div className="arch-tiles" style={{ gridTemplateColumns: "repeat(5,1fr)" }}>
            <div className="arch-tile">
              <div className="arch-tile-h">Talent Acquisition & Progression</div>
              <div className="arch-tile-d">Position IDs · SLAs · ladder</div>
            </div>
            {' '}
            <div className="arch-tile">
              <div className="arch-tile-h">Onboarding</div>
              <div className="arch-tile-d">Direct + contract tracks</div>
            </div>
            {' '}
            <div className="arch-tile">
              <div className="arch-tile-h">Vendor compliance</div>
              <div className="arch-tile-d">Contractor self-serve · ESIC</div>
            </div>
            {' '}
            <div className="arch-tile">
              <div className="arch-tile-h">Workplace Safety & OHS Analytics</div>
              <div className="arch-tile-d">Incidents · CAPA · presence × pattern × time</div>
            </div>
            {' '}
            <div className="arch-tile">
              <div className="arch-tile-h">Compliance umbrella</div>
              <div className="arch-tile-d">Score · exposure · roadmap</div>
            </div>
          </div>
          {' '}
          <div className="arch-tiles" style={{ gridTemplateColumns: "repeat(4,1fr)", marginTop: "8px" }}>
            <div className="arch-tile" style={{ background: "var(--indigo-soft)", borderColor: "var(--indigo)" }}>
              <div className="arch-tile-h">VAANI translation</div>
              <div className="arch-tile-d">Sarvam Mayura + Bulbul v3</div>
            </div>
            {' '}
            <div className="arch-tile" style={{ background: "var(--indigo-soft)", borderColor: "var(--indigo)" }}>
              <div className="arch-tile-h">Knowledge Center</div>
              <div className="arch-tile-d">RAG assistant · learning · OHS · role qualifications</div>
            </div>
            {' '}
            <div className="arch-tile" style={{ background: "var(--indigo-soft)", borderColor: "var(--indigo)" }}>
              <div className="arch-tile-h">Broadcasting</div>
              <div className="arch-tile-d">WhatsApp + PA + PDF · yuniTalk</div>
            </div>
          </div>
          {' '}
          <div className="arch-tiles" style={{ gridTemplateColumns: "1fr 1fr", marginTop: "8px" }}>
            <div className="arch-tile" style={{ background: "var(--paper-3)" }}>
              <div className="arch-tile-h">⌗ Append-only audit trail</div>
              <div className="arch-tile-d">SHA-256 chained · WORM · statutory retention</div>
            </div>
            {' '}
            <div className="arch-tile" style={{ background: "var(--paper-3)" }}>
              <div className="arch-tile-h">🎌 Global Localization Engine</div>
              <div className="arch-tile-d">Japanese + multi-lingual · approval gate</div>
            </div>
          </div>
        </div>
        {' '}
        {/*  Boundary 2  */}
        {' '}
        <div className="boundary">↓ Event-driven API handoff  ·  HMAC-SHA256 + mTLS · idempotent ↓</div>
        {' '}
        {/*  Enterprise IT  */}
        {' '}
        <div className="arch-band" style={{ borderTop: "3px solid var(--ink-3)" }}>
          <div className="arch-band-h">
            <div>
              <div className="arch-band-title">Customer enterprise IT — Daikin systems of record</div>
              {' '}
              <div className="tiny muted">Karya Vaani's responsibility for intake formally ends here</div>
            </div>
            {' '}
            <span className="pill outline">Customer-owned</span>
          </div>
          {' '}
          <div className="arch-tiles" style={{ gridTemplateColumns: "repeat(4,1fr)" }}>
            <div className="arch-tile">
              <div className="arch-tile-h">HRIS</div>
              <div className="arch-tile-d">Workday / SAP / Darwinbox</div>
            </div>
            {' '}
            <div className="arch-tile">
              <div className="arch-tile-h">EHS system</div>
              <div className="arch-tile-d">Incident webhooks</div>
            </div>
            {' '}
            <div className="arch-tile">
              <div className="arch-tile-h">Payroll</div>
              <div className="arch-tile-d">Master record + statutory IDs</div>
            </div>
            {' '}
            <div className="arch-tile">
              <div className="arch-tile-h">IdP (SSO)</div>
              <div className="arch-tile-d">SAML 2.0 / OIDC + MFA</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
