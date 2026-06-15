/* SecDiagnostic — converted 1:1 from karya-vaani_v3.html · <section id="sec-diagnostic"> */
export default function SecDiagnostic() {
  return (
    <section id="sec-diagnostic" className="section">
      <div className="crumbs">
        <span>Overview</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Labour Code Readiness Survey</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">SME Pulse Survey 2026 · anonymous · under 5 minutes</div>
          {' '}
          <h1 className="page-title">
            {"What does compliance "}
            <em>actually cost</em>
            {" your organisation?"}
          </h1>
          {' '}
          <p className="page-sub">
            India's 4 Labour Codes came into force on 21 November 2025. This 9-question pulse survey maps how manufacturing, construction and logistics organisations are responding — and returns a scored readiness benchmark against sector peers, a prioritised gap report and a peer penalty-exposure profile. No company names. No sales call.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" onClick={(event) => { window.csReset() }} data-onclick="csReset()">Restart</button>
          {' '}
          <button className="btn primary" onClick={(event) => { window.csSubmit() }} data-onclick="csSubmit()">
            See my benchmark
          </button>
        </div>
      </div>
      {' '}
      {/*  ═══ SURVEY FORM ═══  */}
      {' '}
      <div id="cs-form">
        {/*  progress + value strip  */}
        {' '}
        <div className="g4" style={{ marginBottom: "18px" }}>
          <div className="kpi" style={{ gridColumn: "span 1" }}>
            <div className="kpi-bar">
              <span id="cs-progress-bar" style={{ width: "0%" }} />
            </div>
            {' '}
            <div className="kpi-eye">Progress</div>
            {' '}
            <div className="kpi-val" id="cs-progress-val">
              0
              <small>/9</small>
            </div>
            {' '}
            <div className="kpi-sub" id="cs-progress-sub">questions answered</div>
          </div>
          {' '}
          <div className="card sunken" style={{ gridColumn: "span 3", padding: "16px 18px" }}>
            <div className="row-gap" style={{ alignItems: "flex-start", gap: "12px" }}>
              <span className="ico amber" style={{ flexShrink: "0" }}>★</span>
              {' '}
              <div>
                <div className="card-h-title" style={{ fontSize: "0.95rem", marginBottom: "3px" }}>
                  What you get in return — instantly
                </div>
                {' '}
                <div className="tiny" style={{ color: "var(--ink-2)", lineHeight: "1.6" }}>
                  On completion you see your organisation benchmarked against sector peers — readiness score, top compliance gaps by code, and the estimated penalty-exposure profile for your workforce size.
                </div>
                {' '}
                <div className="chips" style={{ marginTop: "8px" }}>
                  <span className="pill">Sector benchmark</span>
                  {' '}
                  <span className="pill">Gap heatmap</span>
                  {' '}
                  <span className="pill">Peer penalty exposure</span>
                  {' '}
                  <span className="pill">Priority action list</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {' '}
        {/*  ── SECTION A ──  */}
        {' '}
        <div className="card" style={{ marginBottom: "16px" }}>
          <div className="cs-section-h">
            <span className="cs-section-n">A</span>
            {' '}
            <div>
              <div className="card-h-title">Your organisation's profile</div>
              {' '}
              <div className="card-h-sub">Shapes which compliance obligations apply — used only for benchmarking</div>
            </div>
          </div>
          {' '}
          {/*  Q1  */}
          {' '}
          <div className="cs-q" data-q="q1">
            <div className="cs-q-label">Q1. Which sector best describes your primary operations?</div>
            {' '}
            <div className="cs-q-hint">
              If you span multiple sectors, choose where the majority of your workforce is deployed.
            </div>
            {' '}
            <div className="cs-radio-grid g2">
              <div className="cs-radio" onClick={(event) => { window.csRadio('q1',event.currentTarget,'manufacturing') }} data-onclick="csRadio('q1',this,'manufacturing')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Manufacturing</span>
                  <span className="cs-radio-s">Steel, auto, pharma, textiles, FMCG</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q1',event.currentTarget,'construction') }} data-onclick="csRadio('q1',this,'construction')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Construction & infrastructure</span>
                  <span className="cs-radio-s">EPC, real estate, roads, power</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q1',event.currentTarget,'logistics') }} data-onclick="csRadio('q1',this,'logistics')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Logistics & warehousing</span>
                  <span className="cs-radio-s">3PL, transport, cold chain</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q1',event.currentTarget,'mining') }} data-onclick="csRadio('q1',this,'mining')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Mining & natural resources</span>
                  <span className="cs-radio-s">Coal, quarrying, O&G</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q1',event.currentTarget,'engineering') }} data-onclick="csRadio('q1',this,'engineering')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Engineering services</span>
                  <span className="cs-radio-s">Heavy fabrication, project services</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q1',event.currentTarget,'other') }} data-onclick="csRadio('q1',this,'other')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Other non-IT sector</span>
                  <span className="cs-radio-s">Utilities, trade, healthcare</span>
                </span>
              </div>
            </div>
            {' '}
            <div className="cs-err">Please select your sector to continue.</div>
          </div>
          {' '}
          {/*  Q2  */}
          {' '}
          <div className="cs-q" data-q="q2">
            <div className="cs-q-label">Q2. Total workforce size — direct employees + contract workers combined</div>
            {' '}
            <div className="cs-q-hint">
              Approximate is fine. This determines which Labour Code thresholds apply to you.
            </div>
            {' '}
            <div className="cs-radio-grid g3">
              <div className="cs-radio" onClick={(event) => { window.csRadio('q2',event.currentTarget,'u50') }} data-onclick="csRadio('q2',this,'u50')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Under 50</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q2',event.currentTarget,'50to99') }} data-onclick="csRadio('q2',this,'50to99')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">50 – 99</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q2',event.currentTarget,'100to299') }} data-onclick="csRadio('q2',this,'100to299')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">100 – 299</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q2',event.currentTarget,'300to999') }} data-onclick="csRadio('q2',this,'300to999')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">300 – 999</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q2',event.currentTarget,'1000to4999') }} data-onclick="csRadio('q2',this,'1000to4999')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">1,000 – 4,999</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q2',event.currentTarget,'5000plus') }} data-onclick="csRadio('q2',this,'5000plus')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">5,000 +</span>
                </span>
              </div>
            </div>
            {' '}
            <div className="cs-err">Please select your workforce size.</div>
          </div>
          {' '}
          {/*  Q3  */}
          {' '}
          <div className="cs-q" data-q="q3" style={{ marginBottom: "0" }}>
            <div className="cs-q-label">
              Q3. What proportion of your workforce are contract workers engaged through third-party contractors?
            </div>
            {' '}
            <div className="cs-radio-grid g2">
              <div className="cs-radio" onClick={(event) => { window.csRadio('q3',event.currentTarget,'none') }} data-onclick="csRadio('q3',this,'none')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">None — direct employees only</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q3',event.currentTarget,'u25') }} data-onclick="csRadio('q3',this,'u25')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Under 25% contract workers</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q3',event.currentTarget,'25to50') }} data-onclick="csRadio('q3',this,'25to50')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">25% – 50% contract workers</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q3',event.currentTarget,'over50') }} data-onclick="csRadio('q3',this,'over50')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">More than 50% contract workers</span>
                </span>
              </div>
            </div>
            {' '}
            <div className="cs-err">Please select your contractor proportion.</div>
          </div>
        </div>
        {' '}
        {/*  ── SECTION B ──  */}
        {' '}
        <div className="card" style={{ marginBottom: "16px" }}>
          <div className="cs-section-h">
            <span className="cs-section-n green">B</span>
            {' '}
            <div>
              <div className="card-h-title">Compliance reality — where you actually are</div>
              {' '}
              <div className="card-h-sub">
                No right or wrong answers. Honest responses produce the most useful benchmark.
              </div>
            </div>
          </div>
          {' '}
          <div className="note indigo" style={{ marginBottom: "20px" }}>
            <strong>Why this matters.</strong>
            {" In preliminary conversations across 40 manufacturing organisations, less than 1 in 5 had verified their contractors' ESIC challan coverage in the last 30 days — yet principal-employer liability for this gap is immediate under the new Social Security Code.\n      "}
          </div>
          {' '}
          {/*  Q4  */}
          {' '}
          <div className="cs-q" data-q="q4">
            <div className="cs-q-label">
              Q4. How confident are you that all your contract workers are correctly enrolled in EPFO and ESIC — including those engaged through sub-contractors?
            </div>
            {' '}
            <div className="cs-q-hint">Rate your actual confidence, not your aspirational position.</div>
            {' '}
            <div className="cs-scale-labels">
              <span>No visibility at all</span>
              <span>Fully verified monthly</span>
            </div>
            {' '}
            <div className="cs-scale" id="cs-q4-scale">
              <button className="cs-scale-btn" onClick={(event) => { window.csScale('q4',1,event.currentTarget) }} data-onclick="csScale('q4',1,this)">
                1
              </button>
              {' '}
              <button className="cs-scale-btn" onClick={(event) => { window.csScale('q4',2,event.currentTarget) }} data-onclick="csScale('q4',2,this)">
                2
              </button>
              {' '}
              <button className="cs-scale-btn" onClick={(event) => { window.csScale('q4',3,event.currentTarget) }} data-onclick="csScale('q4',3,this)">
                3
              </button>
              {' '}
              <button className="cs-scale-btn" onClick={(event) => { window.csScale('q4',4,event.currentTarget) }} data-onclick="csScale('q4',4,this)">
                4
              </button>
              {' '}
              <button className="cs-scale-btn" onClick={(event) => { window.csScale('q4',5,event.currentTarget) }} data-onclick="csScale('q4',5,this)">
                5
              </button>
            </div>
            {' '}
            <div className="cs-err">Please rate your confidence level.</div>
          </div>
          {' '}
          {/*  Q5  */}
          {' '}
          <div className="cs-q" data-q="q5">
            <div className="cs-q-label">
              Q5. Which compliance activities do you currently perform manually — without a dedicated system or tool? Select all that apply.
            </div>
            {' '}
            <div className="cs-q-hint">Manual = spreadsheets, email, physical registers, or direct portal logins.</div>
            {' '}
            <div className="chips" id="cs-q5-chips">
              <span className="cs-chip" onClick={(event) => { window.csChip(event.currentTarget,'q5') }} data-onclick="csChip(this,'q5')">
                EPFO challan verification
              </span>
              {' '}
              <span className="cs-chip" onClick={(event) => { window.csChip(event.currentTarget,'q5') }} data-onclick="csChip(this,'q5')">
                ESIC coverage tracking
              </span>
              {' '}
              <span className="cs-chip" onClick={(event) => { window.csChip(event.currentTarget,'q5') }} data-onclick="csChip(this,'q5')">
                Contractor licence monitoring
              </span>
              {' '}
              <span className="cs-chip" onClick={(event) => { window.csChip(event.currentTarget,'q5') }} data-onclick="csChip(this,'q5')">
                Minimum wage compliance check
              </span>
              {' '}
              <span className="cs-chip" onClick={(event) => { window.csChip(event.currentTarget,'q5') }} data-onclick="csChip(this,'q5')">
                Compliance calendar / due dates
              </span>
              {' '}
              <span className="cs-chip" onClick={(event) => { window.csChip(event.currentTarget,'q5') }} data-onclick="csChip(this,'q5')">
                Muster roll reconciliation
              </span>
              {' '}
              <span className="cs-chip" onClick={(event) => { window.csChip(event.currentTarget,'q5') }} data-onclick="csChip(this,'q5')">
                State gazette monitoring
              </span>
              {' '}
              <span className="cs-chip" onClick={(event) => { window.csChip(event.currentTarget,'q5') }} data-onclick="csChip(this,'q5')">
                Inspection readiness documentation
              </span>
              {' '}
              <span className="cs-chip" onClick={(event) => { window.csChip(event.currentTarget,'q5') }} data-onclick="csChip(this,'q5')">
                Standing orders management
              </span>
            </div>
            {' '}
            <div className="cs-err">Please select at least one area.</div>
          </div>
          {' '}
          {/*  Q6  */}
          {' '}
          <div className="cs-q" data-q="q6" style={{ marginBottom: "0" }}>
            <div className="cs-q-label">
              Q6. In the last 12 months, what was your most significant consequence from a labour compliance gap?
            </div>
            {' '}
            <div className="cs-q-hint">
              This is the data point most useful to the sector. Answers are fully anonymised and aggregated.
            </div>
            {' '}
            <div className="cs-radio-grid">
              <div className="cs-radio" onClick={(event) => { window.csRadio('q6',event.currentTarget,'none') }} data-onclick="csRadio('q6',this,'none')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">No significant consequence — fully compliant</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q6',event.currentTarget,'notice') }} data-onclick="csRadio('q6',this,'notice')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Show-cause notice or inspection letter received</span>
                  <span className="cs-radio-s">From labour department, EPFO, ESIC, or factory inspector</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q6',event.currentTarget,'penalty') }} data-onclick="csRadio('q6',this,'penalty')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Financial penalty or interest charged</span>
                  <span className="cs-radio-s">Compounding demand, short-remittance penalty, or damages</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q6',event.currentTarget,'dispute') }} data-onclick="csRadio('q6',this,'dispute')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Worker dispute or IR complaint filed</span>
                  <span className="cs-radio-s">Related to wages, benefits, or contract terms</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q6',event.currentTarget,'tender') }} data-onclick="csRadio('q6',this,'tender')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Lost a tender or contract due to a compliance certificate</span>
                  <span className="cs-radio-s">Government or large-client procurement requirement</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q6',event.currentTarget,'other') }} data-onclick="csRadio('q6',this,'other')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Other consequence</span>
                </span>
              </div>
            </div>
            {' '}
            <div className="cs-err">Please select one option.</div>
          </div>
        </div>
        {' '}
        {/*  ── SECTION C ──  */}
        {' '}
        <div className="card" style={{ marginBottom: "16px" }}>
          <div className="cs-section-h">
            <span className="cs-section-n amber">C</span>
            {' '}
            <div>
              <div className="card-h-title">Decision-making & tools</div>
              {' '}
              <div className="card-h-sub">
                Understanding how compliance decisions actually get made in your organisation
              </div>
            </div>
          </div>
          {' '}
          {/*  Q7  */}
          {' '}
          <div className="cs-q" data-q="q7">
            <div className="cs-q-label">
              Q7. When a plant or site manager needs to hire additional workers — permanent, contract or fixed-term — how is the compliance impact of that decision evaluated?
            </div>
            {' '}
            <div className="cs-radio-grid">
              <div className="cs-radio" onClick={(event) => { window.csRadio('q7',event.currentTarget,'nocheck') }} data-onclick="csRadio('q7',this,'nocheck')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">It usually isn't — compliance is checked after the hire</span>
                  <span className="cs-radio-s">Reactive review once workers are already deployed</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q7',event.currentTarget,'hr') }} data-onclick="csRadio('q7',this,'hr')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">HR or compliance team is consulted — informally</span>
                  <span className="cs-radio-s">Phone call or email, no structured process</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q7',event.currentTarget,'process') }} data-onclick="csRadio('q7',this,'process')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Structured process — approval workflow with compliance check</span>
                  <span className="cs-radio-s">Formal gate before the hiring decision is made</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q7',event.currentTarget,'system') }} data-onclick="csRadio('q7',this,'system')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">System-driven — our platform flags compliance implications automatically</span>
                  <span className="cs-radio-s">Integrated with HRMS or workforce management tool</span>
                </span>
              </div>
            </div>
            {' '}
            <div className="cs-err">Please select one option.</div>
          </div>
          {' '}
          {/*  Q8 — open, optional  */}
          {' '}
          <div className="cs-q">
            <div className="cs-q-label">
              {"Q8. In your own words — what is the single biggest compliance headache your team is carrying right now? "}
              <span className="pill outline" style={{ marginLeft: "4px" }}>Optional</span>
            </div>
            {' '}
            <div className="cs-q-hint">
              The most valuable input in the survey. Even one sentence helps — read by the research team, not a sales algorithm.
            </div>
            {' '}
            <textarea className="ta" id="cs-q8" placeholder="E.g. We have 12 contractors and no reliable way to verify their ESIC coverage before the inspector arrives…" style={{ minHeight: "90px" }} />
          </div>
          {' '}
          {/*  Q9  */}
          {' '}
          <div className="cs-q" data-q="q9" style={{ marginBottom: "0" }}>
            <div className="cs-q-label">
              Q9. Has your organisation assessed its obligations under the Digital Personal Data Protection (DPDP) Act 2023 in relation to your worker data?
            </div>
            {' '}
            <div className="cs-q-hint">
              Worker names, Aadhaar numbers, UAN, ESIC IDs, wage data and biometric attendance records are all personal data under DPDP Act 2023. Maximum breach penalty: ₹250 crore.
            </div>
            {' '}
            <div className="cs-radio-grid">
              <div className="cs-radio" onClick={(event) => { window.csRadio('q9',event.currentTarget,'assessed') }} data-onclick="csRadio('q9',this,'assessed')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Yes — we have a formal DPDP assessment underway or complete</span>
                  <span className="cs-radio-s">DPA signed with vendors, consent process documented</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q9',event.currentTarget,'aware') }} data-onclick="csRadio('q9',this,'aware')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Aware of it — but no formal assessment yet</span>
                  <span className="cs-radio-s">We know it applies; haven't actioned it</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q9',event.currentTarget,'partial') }} data-onclick="csRadio('q9',this,'partial')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Partially — IT/legal has looked at it but worker data isn't mapped</span>
                  <span className="cs-radio-s">DPDP assessed for customer data, not worker data</span>
                </span>
              </div>
              {' '}
              <div className="cs-radio" onClick={(event) => { window.csRadio('q9',event.currentTarget,'notaware') }} data-onclick="csRadio('q9',this,'notaware')">
                <span className="cs-radio-dot" />
                <span className="cs-radio-text">
                  <span className="cs-radio-l">Not aware this applies to us</span>
                  <span className="cs-radio-s">First time hearing that worker data is covered</span>
                </span>
              </div>
            </div>
            {' '}
            <div className="cs-err">Please select one option.</div>
          </div>
        </div>
        {' '}
        {/*  submit  */}
        {' '}
        <div className="card sunken" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "18px", flexWrap: "wrap" }}>
          <div className="tiny" style={{ color: "var(--ink-2)", lineHeight: "1.6", maxWidth: "620px" }}>
            <strong style={{ color: "var(--ink)" }}>Privacy commitment.</strong>
            {" This survey collects no name, email or company name. Responses are stored in aggregated, anonymised form. The benchmark is computed entirely in your browser from sector-level aggregates.\n      "}
          </div>
          {' '}
          <button className="btn primary" onClick={(event) => { window.csSubmit() }} data-onclick="csSubmit()">
            See my compliance benchmark →
          </button>
        </div>
      </div>
      {' '}
      {/*  ═══ RESULT SCREEN ═══  */}
      {' '}
      <div id="cs-result" style={{ display: "none" }}>
        <div className="note green" style={{ marginBottom: "18px", display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="ico green" style={{ flexShrink: "0" }}>✓</span>
          {' '}
          <div>
            <div className="card-h-title" id="cs-r-title" style={{ fontSize: "1.05rem" }}>
              Your readiness benchmark
            </div>
            {' '}
            <div className="tiny" id="cs-r-sub" style={{ color: "var(--ink-2)", marginTop: "2px" }}>
              Based on your responses and sector aggregate data from 40+ organisations.
            </div>
          </div>
        </div>
        {' '}
        <div className="g4" style={{ marginBottom: "18px" }}>
          <div className="kpi">
            <div className="kpi-bar">
              <span id="cs-br-you" style={{ width: "0%" }} />
            </div>
            {' '}
            <div className="kpi-eye">Your readiness score</div>
            {' '}
            <div className="kpi-val" id="cs-br-you-pct">—</div>
            {' '}
            <div className="kpi-sub" id="cs-r-sector-label">—</div>
          </div>
          {' '}
          <div className="kpi">
            <div className="kpi-bar">
              <span id="cs-br-avg" className="amber" style={{ width: "0%" }} />
            </div>
            {' '}
            <div className="kpi-eye">Sector average</div>
            {' '}
            <div className="kpi-val muted" id="cs-br-avg-pct">—</div>
            {' '}
            <div className="kpi-sub">peer organisations</div>
          </div>
          {' '}
          <div className="kpi">
            <div className="kpi-bar">
              <span id="cs-br-top" className="green" style={{ width: "0%" }} />
            </div>
            {' '}
            <div className="kpi-eye">Top quartile in sector</div>
            {' '}
            <div className="kpi-val muted" id="cs-br-top-pct">—</div>
            {' '}
            <div className="kpi-sub">best-in-class peers</div>
          </div>
          {' '}
          <div className="kpi">
            <div className="kpi-eye">Your gap to top quartile</div>
            {' '}
            <div className="kpi-val" id="cs-br-gap">—</div>
            {' '}
            <div className="kpi-sub" id="cs-br-gap-sub">points to close</div>
          </div>
        </div>
        {' '}
        <div className="g23">
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Your top Labour Code gaps — by priority</div>
                {' '}
                <div className="card-h-sub">Mapped from your answers against the 2026 Central Rules</div>
              </div>
              {' '}
              <span className="pill amber" id="cs-gap-count">—</span>
            </div>
            {' '}
            <div id="cs-r-gaps" />
          </div>
          {' '}
          <div>
            <div className="card" style={{ marginBottom: "14px" }}>
              <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Research finding relevant to you</div>
              {' '}
              <hr className="div" />
              {' '}
              <div className="tiny" id="cs-r-insight" style={{ color: "var(--ink-2)", lineHeight: "1.65" }}>—</div>
            </div>
            {' '}
            <div className="card sunken">
              <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Your next steps</div>
              {' '}
              <hr className="div" />
              {' '}
              <div className="cs-step">
                <span className="cs-step-n">1</span>
                <span>
                  {"Request a "}
                  <strong>Karya Niyam gap report</strong>
                  {" — every applicable 2026 Central Rule obligation mapped against your answers, priority-ordered with statutory citations."}
                </span>
              </div>
              {' '}
              <div className="cs-step">
                <span className="cs-step-n">2</span>
                <span>
                  {"Try "}
                  <strong>Karya Nirṇay — Workforce Decision Builder</strong>
                  {" — enter a live hiring scenario and see which workforce type is legally compliant and cost-optimal."}
                </span>
              </div>
              {' '}
              <div className="cs-step">
                <span className="cs-step-n">3</span>
                <span>
                  {"Assess your "}
                  <strong>DPDP worker-data exposure</strong>
                  {" — map which worker data streams are covered, generate vernacular consent notices, maintain the 5-year audit log."}
                </span>
              </div>
            </div>
          </div>
        </div>
        {' '}
        <div className="row-between" style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
          <span className="tiny muted">Results computed locally · no responses transmitted · DPDP compliant</span>
          {' '}
          <button className="btn" onClick={(event) => { window.csReset() }} data-onclick="csReset()">
            ↩ Retake survey
          </button>
        </div>
      </div>
    </section>
  );
}
