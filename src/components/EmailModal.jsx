/* EmailModal — converted 1:1 from karya-vaani_v3.html */
export default function EmailModal() {
  return (
    <div className="modal-overlay" id="email-modal" onClick={(event) => { if(event.target===event.currentTarget) window.closeEmailModal() }} data-onclick="if(event.target===this) closeEmailModal()">
      <div className="modal">
        <div className="modal-h">
          <div className="modal-h-left">
            <span className="modal-h-eye" id="em-eye">Notify vendor</span>
            {' '}
            <span className="modal-h-title" id="em-title">—</span>
          </div>
          {' '}
          <span className="modal-h-close" onClick={(event) => { window.closeEmailModal() }} data-onclick="closeEmailModal()">
            Close ✕
          </span>
        </div>
        {' '}
        <div className="modal-body">
          <div className="compose-meta">
            <div className="compose-row">
              <span className="ck">To</span>
              <span className="cv" id="em-to">—</span>
            </div>
            {' '}
            <div className="compose-row">
              <span className="ck">Cc</span>
              <span className="cv" id="em-cc">—</span>
            </div>
            {' '}
            <div className="compose-row">
              <span className="ck">Worker</span>
              <span className="cv" id="em-worker">—</span>
            </div>
            {' '}
            <div className="compose-row">
              <span className="ck">Severity</span>
              <span className="cv" id="em-severity">—</span>
            </div>
          </div>
          {' '}
          <div className="compose-label">Subject</div>
          {' '}
          <input type="text" className="compose-input" id="em-subject" />
          {' '}
          <div className="compose-label">
            {"Body "}
            <span className="compose-cnt" id="em-cnt">—</span>
          </div>
          {' '}
          <textarea className="compose-textarea" id="em-body" onInput={(event) => { window.updateEmailCount() }} />
        </div>
        {' '}
        <div className="modal-footer">
          <div className="modal-footer-left">
            <span className="tiny">
              Sends via the VAANI mailer &amp; WhatsApp gateway · logs an audit entry · chains to worker record
            </span>
          </div>
          {' '}
          <div className="modal-footer-right">
            <button className="btn" onClick={(event) => { window.copyEmailBody() }} data-onclick="copyEmailBody()">
              Copy
            </button>
            {' '}
            <button className="btn" onClick={(event) => { window.waSendVendor() }} data-onclick="waSendVendor()">
              Send WhatsApp
            </button>
            {' '}
            <button className="btn primary" onClick={(event) => { window.sendEmail() }} data-onclick="sendEmail()">
              Send email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
