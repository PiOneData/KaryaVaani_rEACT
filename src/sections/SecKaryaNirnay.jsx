/* SecKaryaNirnay — converted 1:1 from karya-vaani_v3.html · <section id="sec-karya-nirnay"> */
export default function SecKaryaNirnay() {
  return (
    <section id="sec-karya-nirnay" className="section">
      <div className="crumbs">
        <span>Operational Pillars</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Karya Nirṇay decision builder</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Guided builder · 4 Labour Codes · 5 workforce structures</div>
          {' '}
          <h1 className="page-title">
            {"Structure the hire "}
            <em>before</em>
            {" it becomes a liability"}
          </h1>
          {' '}
          <p className="page-sub">
            Define a workforce requirement, layer the business constraints, and the engine maps it against the Code on Wages, Industrial Relations, Social Security and OSHC codes — surfacing threshold crossings and recommending the commercially optimal, compliant structure.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" onClick={(event) => { window.knReset() }} data-onclick="knReset()">
            New scenario
          </button>
          {' '}
          <button className="btn primary" onClick={(event) => { window.knGoStep(2) }} data-onclick="knGoStep(2)">
            Run compliance check
          </button>
        </div>
      </div>
      {' '}
      {/*  step ladder  */}
      {' '}
      <div className="ladder kn-ladder">
        <div className="lstep now" id="kn-nav-0" onClick={(event) => { window.knGoStep(0) }} data-onclick="knGoStep(0)">
          <div className="lstep-n">1</div>
          {' '}
          <div className="lstep-t">Workforce requirement</div>
          {' '}
          <div className="lstep-c">Role · volume · duration</div>
        </div>
        {' '}
        <div className="lstep" id="kn-nav-1" onClick={(event) => { window.knGoStep(1) }} data-onclick="knGoStep(1)">
          <div className="lstep-n">2</div>
          {' '}
          <div className="lstep-t">Business context</div>
          {' '}
          <div className="lstep-c">Urgency · budget · work nature</div>
        </div>
        {' '}
        <div className="lstep" id="kn-nav-2" onClick={(event) => { window.knGoStep(2) }} data-onclick="knGoStep(2)">
          <div className="lstep-n">3</div>
          {' '}
          <div className="lstep-t">Compliance check</div>
          {' '}
          <div className="lstep-c">All 4 Labour Codes</div>
        </div>
        {' '}
        <div className="lstep" id="kn-nav-3" onClick={(event) => { window.knGoStep(3) }} data-onclick="knGoStep(3)">
          <div className="lstep-n">4</div>
          {' '}
          <div className="lstep-t">Recommendation</div>
          {' '}
          <div className="lstep-c">Optimal structure + cost</div>
        </div>
      </div>
      {' '}
      {/*  ═══ STEP 1 · WORKFORCE REQUIREMENT ═══  */}
      {' '}
      <div className="kn-panel active" id="kn-panel-0">
        <div className="g2" style={{ marginBottom: "16px" }}>
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Role & volume</div>
                {' '}
                <div className="card-h-sub">Drives threshold checks at 10 · 20 · 100 · 300 worker marks</div>
              </div>
            </div>
            {' '}
            <div className="field">
              <label className="field-l">Trade / role</label>
              {' '}
              <select className="sel" id="kn-f-role" onChange={(event) => { window.knSyncState() }}>
                <option>Welder</option>
                <option>Electrician</option>
                <option>Fitter</option>
                {' '}
                <option>Operator</option>
                <option>Helper</option>
                <option>Driver</option>
                {' '}
                <option>Security</option>
                <option>Supervisor</option>
                <option>Engineer</option>
                <option>IT Support</option>
              </select>
            </div>
            {' '}
            <div className="field">
              <label className="field-l">Number of workers required</label>
              {' '}
              <input type="number" className="input" id="kn-f-count" min="1" max="500" defaultValue="40" onInput={(event) => { window.knSyncState() }} />
            </div>
            {' '}
            <div className="field" style={{ marginBottom: "0" }}>
              <label className="field-l">Duration required (months)</label>
              {' '}
              <input type="number" className="input" id="kn-f-dur" min="1" max="60" defaultValue="3" onInput={(event) => { window.knSyncState() }} />
            </div>
          </div>
          {' '}
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Plant context</div>
                {' '}
                <div className="card-h-sub">State rules & gazette wages applied to the scenario</div>
              </div>
            </div>
            {' '}
            <div className="field">
              <label className="field-l">Skill level required</label>
              {' '}
              <select className="sel" id="kn-f-skill" onChange={(event) => { window.knSyncState() }} defaultValue="Semi-skilled">
                <option>Unskilled</option>
                <option>Semi-skilled</option>
                {' '}
                <option>Skilled</option>
                <option>Highly skilled</option>
              </select>
            </div>
            {' '}
            <div className="field" style={{ marginBottom: "0" }}>
              <label className="field-l">Deployment state</label>
              {' '}
              <select className="sel" id="kn-f-state" onChange={(event) => { window.knSyncState() }} defaultValue="Chhattisgarh">
                <option>Chhattisgarh</option>
                <option>Maharashtra</option>
                {' '}
                <option>Andhra Pradesh</option>
                <option>Telangana</option>
                {' '}
                <option>Jharkhand</option>
                <option>Gujarat</option>
                {' '}
                <option>Tamil Nadu</option>
                <option>Karnataka</option>
                {' '}
                <option>Rajasthan</option>
                <option>Odisha</option>
                {' '}
                <option>Haryana</option>
                <option>Uttar Pradesh</option>
                <option>West Bengal</option>
              </select>
              {' '}
              <div className="card-h-sub" style={{ marginTop: "5px" }}>
                State-specific minimum wages & gazette rules applied
              </div>
            </div>
          </div>
        </div>
        {' '}
        <div className="card" style={{ marginBottom: "0" }}>
          <div className="card-h">
            <div>
              <div className="card-h-title">Current plant workforce</div>
              {' '}
              <div className="card-h-sub">Used to calculate threshold crossings and contractor-ratio limits</div>
            </div>
          </div>
          {' '}
          <div className="kn-slider-row">
            <span className="kn-slider-label">Direct employees on rolls</span>
            {' '}
            <input type="range" className="kn-range" min="10" max="1000" step="10" defaultValue="320" id="kn-f-phc" onInput={(event) => { window.knSyncState() }} />
            {' '}
            <span className="kn-slider-val" id="kn-sv-phc">320</span>
          </div>
          {' '}
          <div className="kn-slider-row">
            <span className="kn-slider-label">Contract workers (current)</span>
            {' '}
            <input type="range" className="kn-range" min="0" max="800" step="10" defaultValue="180" id="kn-f-chc" onInput={(event) => { window.knSyncState() }} />
            {' '}
            <span className="kn-slider-val" id="kn-sv-chc">180</span>
          </div>
        </div>
        {' '}
        <div className="row-between" style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
          <span />
          {' '}
          <button className="btn primary" onClick={(event) => { window.knGoStep(1) }} data-onclick="knGoStep(1)">
            Business context →
          </button>
        </div>
      </div>
      {' '}
      {/*  ═══ STEP 2 · BUSINESS CONTEXT ═══  */}
      {' '}
      <div className="kn-panel" id="kn-panel-1">
        <div className="g2" style={{ marginBottom: "16px" }}>
          <div className="card">
            <div className="card-h">
              <div className="card-h-title">Operational constraints</div>
            </div>
            {' '}
            <div className="field">
              <label className="field-l">Hiring urgency</label>
              {' '}
              <select className="sel" id="kn-f-urgency" onChange={(event) => { window.knSyncState() }} defaultValue="Normal — 30 days">
                <option>Urgent — under 7 days</option>
                {' '}
                <option>Fast — 7 to 15 days</option>
                {' '}
                <option>Normal — 30 days</option>
                {' '}
                <option>Planned — 60+ days</option>
              </select>
            </div>
            {' '}
            <div className="field">
              <label className="field-l">Budget stance</label>
              {' '}
              <select className="sel" id="kn-f-budget" onChange={(event) => { window.knSyncState() }} defaultValue="Moderate">
                <option>Tight — minimise cost</option>
                {' '}
                <option>Moderate</option>
                {' '}
                <option>Flexible — quality priority</option>
              </select>
            </div>
            {' '}
            <div className="field">
              <label className="field-l">Financial budget for the hiring need</label>
              {' '}
              <div className="kn-budget-row">
                <select className="sel" id="kn-f-budget-basis" onChange={(event) => { window.knSyncState() }} style={{ width: "auto", minWidth: "130px" }} defaultValue="monthly">
                  <option value="monthly">Per month</option>
                  {' '}
                  <option value="annual">Per annum</option>
                </select>
                {' '}
                <div className="kn-budget-amt">
                  <span className="kn-budget-cur">₹</span>
                  {' '}
                  <input type="text" className="input" id="kn-f-budget-amt" defaultValue="3,20,000" placeholder="Sanctioned amount" onInput={(event) => { window.knSyncState() }} />
                </div>
              </div>
              {' '}
              <div className="kn-budget-hint" id="kn-budget-hint">
                Total sanctioned cost-to-company for this hiring need — wages, statutory contributions and overheads.
              </div>
            </div>
            {' '}
            <div className="field" style={{ marginBottom: "0" }}>
              <label className="field-l">Work continuity</label>
              {' '}
              <select className="sel" id="kn-f-cont" onChange={(event) => { window.knSyncState() }} defaultValue="Project-based">
                <option>Core permanent function</option>
                {' '}
                <option>Project-based</option>
                {' '}
                <option>Seasonal peak</option>
                {' '}
                <option>Trial before permanent hire</option>
              </select>
            </div>
          </div>
          {' '}
          <div className="card">
            <div className="card-h">
              <div className="card-h-title">Work nature — select all that apply</div>
            </div>
            {' '}
            <div className="kn-toggles" id="kn-toggles">
              <div className="kn-tog" data-key="safety" onClick={(event) => { window.knToggle('safety',event.currentTarget) }} data-onclick="knToggle('safety',this)">
                Safety-critical process
              </div>
              {' '}
              <div className="kn-tog on" data-key="fluctuating" onClick={(event) => { window.knToggle('fluctuating',event.currentTarget) }} data-onclick="knToggle('fluctuating',this)">
                Demand fluctuates
              </div>
              {' '}
              <div className="kn-tog" data-key="seasonal" onClick={(event) => { window.knToggle('seasonal',event.currentTarget) }} data-onclick="knToggle('seasonal',this)">
                Seasonal peak only
              </div>
              {' '}
              <div className="kn-tog" data-key="core" onClick={(event) => { window.knToggle('core',event.currentTarget) }} data-onclick="knToggle('core',this)">
                Core process — must retain
              </div>
              {' '}
              <div className="kn-tog on" data-key="proprietary" onClick={(event) => { window.knToggle('proprietary',event.currentTarget) }} data-onclick="knToggle('proprietary',this)">
                Proprietary / IP risk
              </div>
              {' '}
              <div className="kn-tog" data-key="costpressure" onClick={(event) => { window.knToggle('costpressure',event.currentTarget) }} data-onclick="knToggle('costpressure',this)">
                Cost reduction pressure
              </div>
              {' '}
              <div className="kn-tog" data-key="trial" onClick={(event) => { window.knToggle('trial',event.currentTarget) }} data-onclick="knToggle('trial',this)">
                Evaluate for permanent hire
              </div>
            </div>
            {' '}
            <hr className="div" />
            {' '}
            <div className="note indigo">
              <strong>How this is used.</strong>
              {" These constraints layer over the statutory rules — the engine balances commercial fit against compliance exposure to pick the optimal structure.\n        "}
            </div>
          </div>
        </div>
        {' '}
        <div className="row-between" style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
          <button className="btn" onClick={(event) => { window.knGoStep(0) }} data-onclick="knGoStep(0)">← Back</button>
          {' '}
          <button className="btn primary" onClick={(event) => { window.knGoStep(2) }} data-onclick="knGoStep(2)">
            Run compliance check →
          </button>
        </div>
      </div>
      {' '}
      {/*  ═══ STEP 3 · COMPLIANCE CHECK ═══  */}
      {' '}
      <div className="kn-panel" id="kn-panel-2">
        <div className="card">
          <div className="card-h">
            <div>
              <div className="card-h-title">Compliance impact analysis</div>
              {' '}
              <div className="card-h-sub">
                All 4 Labour Codes checked — threshold crossings, liability triggers and state obligations surfaced
              </div>
            </div>
            {' '}
            <div className="kn-scenario" id="kn-scenario-2" />
          </div>
          {' '}
          <div id="kn-check-list" />
        </div>
        {' '}
        <div className="row-between" style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
          <button className="btn" onClick={(event) => { window.knGoStep(1) }} data-onclick="knGoStep(1)">← Back</button>
          {' '}
          <button className="btn amber" onClick={(event) => { window.knGoStep(3) }} data-onclick="knGoStep(3)">
            View recommendation →
          </button>
        </div>
      </div>
      {' '}
      {/*  ═══ STEP 4 · RECOMMENDATION ═══  */}
      {' '}
      <div className="kn-panel" id="kn-panel-3">
        <div style={{ marginBottom: "24px" }}>
          <div className="page-eyebrow" id="kn-rec-eyebrow">Recommendation</div>
          {' '}
          <h2 className="page-title" style={{ fontSize: "1.7rem", marginBottom: "6px" }} id="kn-rec-title">
            Workforce decision
          </h2>
          {' '}
          <p className="page-sub" id="kn-rec-sub" />
        </div>
        {' '}
        <div className="g4" id="kn-kpi-strip" style={{ marginBottom: "20px" }} />
        {' '}
        <div className="kn-mix-wrap">
          <div className="kn-mix-labels">
            <span>Workforce composition after hire</span>
            {' '}
            <span id="kn-mix-right" />
          </div>
          {' '}
          <div className="kn-mix-bar" id="kn-mix-bar" />
        </div>
        {' '}
        <div id="kn-ai-block" />
        {' '}
        <div className="kn-wf-cards" id="kn-wf-cards" />
        {' '}
        <div className="row-between" style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
          <button className="btn" onClick={(event) => { window.knGoStep(2) }} data-onclick="knGoStep(2)">← Back</button>
          {' '}
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn" onClick={(event) => { window.knReset() }} data-onclick="knReset()">
              New scenario
            </button>
            {' '}
            <button className="btn primary" onClick={(event) => { window.knExport() }} data-onclick="knExport()">
              Export decision memo
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
