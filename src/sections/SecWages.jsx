/* SecWages — CR-7 · Overtime, Loss of Pay & variable allowances, monthly log.

   Two different things share this register and are labelled as such:
   · COMPLIANCE — overtime hours and the statutory overtime rate (125% of the
     ordinary wage rate), plus the ESIC ₹21,000 wage-ceiling effect that changes
     a worker's contribution status when overtime pushes them over it.
   · OPERATIONAL — Loss of Pay and variable allowances outside standard payroll.
     Payroll administration, not a Labour Code obligation; they live here only
     because the monthly register itself falls under the Code on Wages five-year
     retention window.
   Behaviour lives in public/legacy/app.js (PAY_STATE / pay*). */
export default function SecWages() {
  return (
    <section id="sec-wages" className="section">
      <div className="crumbs">
        <span>Operational Pillars</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Overtime &amp; wage register</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Attendance · reporting · monthly wage log</div>
          {' '}
          <h1 className="page-title">
            {"Overtime at the "}
            <em>statutory rate</em>
            {", and what it does to ESIC"}
          </h1>
          {' '}
          <p className="page-sub">
            Overtime hours are captured and the overtime rate is computed at 125% of the ordinary wage rate — never
            typed in, so the register cannot record an under-rate. When overtime takes a worker's monthly wages above
            the ₹21,000 ESIC ceiling their contribution status changes, and the engine surfaces that automatically.
            Loss of Pay and variable allowances are logged in the same monthly register as operational payroll.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <select id="pay-month-sel" className="sel" style={{ maxWidth: "170px" }}
            onChange={(event) => { window.paySetMonth(event.currentTarget.value) }} />
          {' '}
          <button className="btn" onClick={() => { window.payExport() }}>Export register (Excel)</button>
          {' '}
          <button className="btn primary" id="pay-add-btn" onClick={() => { window.payOpenEntry('') }}>
            Add / update entry
          </button>
        </div>
      </div>
      {' '}
      <div id="pay-hr-note" style={{ marginBottom: "12px" }} />
      {' '}
      <div id="pay-kpis" className="g4" style={{ marginBottom: "14px" }} />
      {' '}
      {/* the compliance signal the CR asks for: OT crossing the ESIC ceiling */}
      <div id="pay-ceiling-alert" style={{ marginBottom: "14px" }} />
      {' '}
      <div className="g2" style={{ marginBottom: "16px" }}>
        <div className="card">
          <div className="card-h-title" style={{ fontSize: "0.9rem", marginBottom: "6px" }}>
            Compliance · Code on Wages
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-2)", lineHeight: "1.7" }}>
            <div className="row-between">
              <span>Overtime rate</span>
              <span className="mono t-strong">125% of the ordinary rate</span>
            </div>
            <div className="row-between">
              <span>Ordinary rate basis</span>
              <span className="mono t-strong">base ÷ 26 days ÷ 8 hours</span>
            </div>
            <div className="row-between">
              <span>ESIC wage ceiling</span>
              <span className="mono t-strong">₹21,000 / month</span>
            </div>
            <div className="row-between">
              <span>Record retention</span>
              <span className="mono t-strong">5 years</span>
            </div>
            <hr className="div" />
            <div style={{ fontSize: "0.74rem", color: "var(--ink-3)" }}>
              Overtime capture and rate computation is a wage-compliance obligation. The ESIC effect is not
              cosmetic: coverage follows the wages actually payable for the month, so overtime can move a worker
              into or out of contribution — recalculated for the whole contribution period, not just the month.
            </div>
          </div>
        </div>
        {' '}
        <div className="card">
          <div className="card-h-title" style={{ fontSize: "0.9rem", marginBottom: "6px" }}>
            Operational payroll · not a Labour Code obligation
          </div>
          <div style={{ fontSize: "0.78rem", color: "var(--ink-2)", lineHeight: "1.7" }}>
            <div className="arch-tile" style={{ marginBottom: "8px" }}>
              <div className="arch-tile-h">Loss of Pay</div>
              <div className="arch-tile-d">
                Deduction for unpaid absence. Payroll administration — logged here for the register, not framed as
                a statutory requirement.
              </div>
            </div>
            <div className="arch-tile">
              <div className="arch-tile-h">Variable allowances outside standard payroll</div>
              <div className="arch-tile-d">
                Attendance incentive, night-shift allowance, production incentive, conveyance. Operational tooling
                that happens to satisfy the Code on Wages record-retention window.
              </div>
            </div>
          </div>
        </div>
      </div>
      {' '}
      <div className="card">
        <div className="card-h">
          <div>
            <div className="card-h-title">Monthly register</div>
            <div className="card-h-sub">
              One row per worker per month · click a row to edit · retained 5 years under the Code on Wages
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <label className="cap-check" style={{ display: "inline-flex", fontSize: "0.78rem" }}>
              <input type="checkbox" onChange={(event) => { window.payToggleCeiling(event.currentTarget) }} />
              {' '}Only workers crossing the ESIC ceiling
            </label>
            <span className="pill outline" id="pay-count">—</span>
          </div>
        </div>
        {' '}
        <div style={{ overflowX: "auto" }}>
          <table className="t">
            <thead>
              <tr>
                <th>Worker</th>
                {/*  the identifier the register is keyed to for statutory
                     returns and the worker-level ESIC upload  */}
                <th>Employee ID</th>
                <th>Employer</th>
                <th>Base wage</th>
                <th>OT hours</th>
                <th>OT rate</th>
                <th>OT amount</th>
                <th>Loss of Pay</th>
                <th>Allowances</th>
                <th>Gross wages</th>
                <th>ESIC</th>
              </tr>
            </thead>
            <tbody id="pay-body" />
          </table>
        </div>
        <div id="pay-pagination" className="om-pagination" />
      </div>
    </section>
  );
}
