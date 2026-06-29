/* SecAppointmentOrder — HR Documents · Appointment Order generator.
   React renders only the shell; public/legacy/app.js → initAppointmentOrder()
   injects the form, action buttons and live preview, and wires every handler
   (window.ao*). Mirrors the section/init pattern used across the app. */
export default function SecAppointmentOrder() {
  return (
    <section id="sec-appointment" className="section">
      <div className="crumbs">
        <span>HR Documents</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Appointment Order</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">HR Documents · letter generation</div>
          {' '}
          <h1 className="page-title">
            {"Generate a professional "}
            <em>Appointment Order</em>
          </h1>
          {' '}
          <p className="page-sub">
            Fill the employee details, then generate a corporate appointment letter on company
            letterhead as a print-ready A4 PDF — download, print or email it through the existing service.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          {/* roster prefill — populated from window.__KVDATA.omMapping by initAppointmentOrder() */}
          <select className="sel" id="ao-roster" style={{ minWidth: "240px" }} onChange={(event) => { window.aoLoadFromRoster && window.aoLoadFromRoster(event.target.value) }}>
            <option value="">Prefill from roster…</option>
          </select>
          {' '}
          <button className="btn" onClick={(event) => { window.aoReset && window.aoReset() }} data-onclick="aoReset()">Clear</button>
        </div>
      </div>
      {' '}
      {/* form injected here by initAppointmentOrder() */}
      <div id="ao-form" />
      {' '}
      {/* action buttons (Preview / Download / Print / Send Email / Save Draft / Edit / Regenerate) */}
      <div id="ao-actions" />
      {' '}
      {/* live HTML preview of the generated letter */}
      <div id="ao-preview" />
      {' '}
      {/* saved drafts / generated orders list */}
      <div id="ao-saved" />
    </section>
  );
}
