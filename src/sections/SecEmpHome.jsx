/* SecEmpHome — converted 1:1 from karya-vaani_v3.html · <section id="sec-emp-home"> */
export default function SecEmpHome() {
  return (
    <section id="sec-emp-home" className="section">
      <div className="crumbs">
        <span>Employee</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">My home</span>
      </div>
      {' '}
      {/*  worker picker — switch between employees in the demo  */}
      {' '}
      <div className="emp-picker">
        <span className="emp-picker-l">Signed in as</span>
        {' '}
        <select id="emp-picker-sel" className="sel" onChange={(event) => { window.empSetWorker(event.currentTarget.value) }} style={{ minWidth: "240px" }} />
        {' '}
        <span className="tiny muted">demo · switch employee to preview their personal home</span>
      </div>
      {' '}
      {/*  ── HERO · identity + compliance hero ──  */}
      {' '}
      <div className="emp-hero">
        <div className="emp-hero-bg" />
        {' '}
        <div className="emp-hero-l">
          <div className="emp-hero-ava" id="emp-hero-ava">—</div>
          {' '}
          <div>
            <div className="emp-hero-greet" id="emp-hero-greet">Hello —</div>
            {' '}
            <div className="emp-hero-name" id="emp-hero-name">—</div>
            {' '}
            <div className="emp-hero-meta" id="emp-hero-meta">—</div>
            {' '}
            <div className="emp-hero-chips" id="emp-hero-chips" />
          </div>
        </div>
        {' '}
        <div className="emp-hero-r">
          <div className="emp-hero-num-eye">YOUR READ-RECEIPT COMPLIANCE</div>
          {' '}
          <div className="emp-hero-num">
            <span id="emp-hero-num">—</span>
            <span className="emp-hero-pct">%</span>
          </div>
          {' '}
          <div className="emp-hero-num-sub" id="emp-hero-num-sub">—</div>
          {' '}
          <button className="btn" id="emp-hero-act" onClick={(event) => { window.empAckAll() }} data-onclick="empAckAll()">
            Acknowledge all pending
          </button>
        </div>
      </div>
      {' '}
      {/*  ── ACTION-NEEDED BANNER · only renders when something is pending ──  */}
      {' '}
      <div className="emp-action" id="emp-action" style={{ display: "none" }} />
      {' '}
      {/*  ── KPI strip · today's snapshot ──  */}
      {' '}
      <div className="g4" style={{ marginBottom: "14px" }}>
        <div className="kpi">
          <div className="kpi-eye">Messages today</div>
          {' '}
          <div className="kpi-val" id="emp-k-today">—</div>
          {' '}
          <div className="kpi-sub" id="emp-k-today-s">across all subjects</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Read</div>
          {' '}
          <div className="kpi-val" id="emp-k-read" style={{ color: "var(--indigo)" }}>—</div>
          {' '}
          <div className="kpi-sub" id="emp-k-read-s">delivered → read</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Acknowledged</div>
          {' '}
          <div className="kpi-val" id="emp-k-ack" style={{ color: "var(--green-dk)" }}>—</div>
          {' '}
          <div className="kpi-sub" id="emp-k-ack-s">read-receipts confirmed</div>
        </div>
        {' '}
        <div className="kpi kpi-pend">
          <div className="kpi-eye">Awaiting your reply</div>
          {' '}
          <div className="kpi-val" id="emp-k-pend" style={{ color: "var(--amber-dk)" }}>—</div>
          {' '}
          <div className="kpi-sub" id="emp-k-pend-s">pending acknowledgement</div>
        </div>
      </div>
      {' '}
      {/*  ── two-column body ──  */}
      {' '}
      <div className="emp-body">
        {/*  LEFT · messages, schedule, tasks  */}
        {' '}
        <div>
          {/*  pending acknowledgements  */}
          {' '}
          <div className="card emp-msg-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Messages waiting on you</div>
                {' '}
                <div className="card-h-sub">
                  Safety alerts, OHS notices and compliance broadcasts that still need your acknowledgement
                </div>
              </div>
              {' '}
              <span className="pill outline tiny" id="emp-pending-cnt">—</span>
            </div>
            {' '}
            <div id="emp-pending-list" />
          </div>
          {' '}
          {/*  recent broadcasts (already-read history)  */}
          {' '}
          <div className="card emp-history-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Recent messages from Karya Vaani</div>
                {' '}
                <div className="card-h-sub">Your delivery log · what you've been sent, in your language</div>
              </div>
              {' '}
              <span className="pill outline tiny" id="emp-hist-cnt">—</span>
            </div>
            {' '}
            <div id="emp-history-list" />
          </div>
          {' '}
          {/*  today's transport / schedule snippet, if applicable  */}
          {' '}
          <div className="card emp-schedule-card" id="emp-schedule-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Today & tomorrow · your schedule</div>
                {' '}
                <div className="card-h-sub">Shift, pickup, and induction reminders pulled from your roster</div>
              </div>
            </div>
            {' '}
            <div id="emp-schedule-list" />
          </div>
        </div>
        {' '}
        {/*  RIGHT · personal analytics + identity + actions  */}
        {' '}
        <div>
          {/*  personal analytics  */}
          {' '}
          <div className="card emp-an-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Your personal analytics</div>
                {' '}
                <div className="card-h-sub">How quickly you respond & how you compare to your dept average</div>
              </div>
            </div>
            {' '}
            <div className="emp-an-block">
              <div className="emp-an-eye">Time to read · your last 5 messages</div>
              {' '}
              <div className="emp-an-ttr" id="emp-an-ttr" />
              {' '}
              <div className="emp-an-sub" id="emp-an-ttr-sub">—</div>
            </div>
            {' '}
            <div className="emp-an-block">
              <div className="emp-an-eye">Compared to your department</div>
              {' '}
              <div className="emp-an-compare" id="emp-an-compare" />
            </div>
            {' '}
            <div className="emp-an-block">
              <div className="emp-an-eye">Engagement streak</div>
              {' '}
              <div className="emp-an-streak" id="emp-an-streak">—</div>
            </div>
          </div>
          {' '}
          {/*  identity & documents  */}
          {' '}
          <div className="card emp-id-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Your record at Daikin Sricity</div>
                {' '}
                <div className="card-h-sub">What HR has on file · last refreshed today</div>
              </div>
            </div>
            {' '}
            <div id="emp-id-list" />
          </div>
          {' '}
          {/*  quick actions  */}
          {' '}
          <div className="card emp-qa-card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Quick actions</div>
                {' '}
                <div className="card-h-sub">Things you can do from this screen</div>
              </div>
            </div>
            {' '}
            <div className="emp-qa">
              <button className="emp-qa-btn" onClick={(event) => { window.empAckAll() }} data-onclick="empAckAll()">
                <span className="emp-qa-ico" style={{ background: "var(--green-dk)" }}>✓</span>
                {' '}
                <span className="emp-qa-l">
                  <strong>Acknowledge all pending</strong>
                  <span>One tap to confirm every awaiting message</span>
                </span>
              </button>
              {' '}
              <button className="emp-qa-btn" onClick={(event) => { window.empOpenChat() }} data-onclick="empOpenChat()">
                <span className="emp-qa-ico" style={{ background: "var(--indigo)" }}>✆</span>
                {' '}
                <span className="emp-qa-l">
                  <strong>Open my chat</strong>
                  <span>Talk to the Karya Vaani assistant</span>
                </span>
              </button>
              {' '}
              <button className="emp-qa-btn" onClick={(event) => { window.empToast('A supervisor will reach out shortly') }} data-onclick="empToast('A supervisor will reach out shortly')">
                <span className="emp-qa-ico" style={{ background: "var(--amber-dk)" }}>!</span>
                {' '}
                <span className="emp-qa-l">
                  <strong>Report a safety concern</strong>
                  <span>Escalate to your supervisor & EHS</span>
                </span>
              </button>
              {' '}
              <button className="emp-qa-btn" onClick={(event) => { window.empToast('Language preference saved in your profile') }} data-onclick="empToast('Language preference saved in your profile')">
                <span className="emp-qa-ico" style={{ background: "var(--ink-3)" }}>⌘</span>
                {' '}
                <span className="emp-qa-l">
                  <strong>Change my language</strong>
                  <span>Karya Vaani will deliver in your new choice</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {' '}
      {/*  ── FLOATING CHAT FAB · pinned bottom-right when emp-home is active ──  */}
      {' '}
      <button className="emp-chat-fab" id="emp-chat-fab" onClick={(event) => { window.empChatToggle() }} data-onclick="empChatToggle()" aria-label="Open chat with Karya Vaani">
        <span className="emp-chat-fab-ico">✆</span>
        {' '}
        <span className="emp-chat-fab-badge" id="emp-chat-fab-badge" style={{ display: "none" }}>0</span>
      </button>
      {' '}
      {/*  ── POP-UP CHAT PANEL · hidden by default, slides up from FAB ──  */}
      {' '}
      <div className="emp-chat-pop" id="emp-chat-pop" aria-hidden="true">
        <div className="emp-chat-pop-h">
          <span className="cv-conv-h-ava" style={{ background: "var(--indigo)", width: "36px", height: "36px", fontSize: "0.8rem" }}>
            PM
          </span>
          {' '}
          <div className="emp-chat-pop-h-main">
            <div className="emp-chat-pop-h-name">Karya Vaani · Plant HR</div>
            {' '}
            <div className="emp-chat-pop-h-sub" id="emp-chat-pop-h-sub">— · safety, shift & compliance</div>
          </div>
          {' '}
          <button className="emp-chat-pop-min" onClick={(event) => { window.empChatToggle() }} data-onclick="empChatToggle()" title="Close">
            ✕
          </button>
        </div>
        {' '}
        {/*  the existing empchat-* DOM ids — body + foot. Header replaced by the pop header above.  */}
        {' '}
        <div className="emp-chat-pop-canvas">
          <div className="cv-conv-h" id="empchat-h" style={{ display: "none" }} />
          {' '}
          <div className="cv-conv-body" id="empchat-body" />
          {' '}
          <div className="cv-conv-foot" id="empchat-foot" />
        </div>
      </div>
    </section>
  );
}
