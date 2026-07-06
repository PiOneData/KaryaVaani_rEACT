/* SecLms — converted 1:1 from karya-vaani_v3.html · <section id="sec-lms"> */
export default function SecLms() {
  return (
    <section id="sec-lms" className="section">
      <div className="crumbs">
        <span>Localisation Engine</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Knowledge Center</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">Localisation Engine · factory-floor readiness</div>
          {' '}
          <h1 className="page-title">
            {"A "}
            <em>Knowledge Center</em>
            {" for the shop floor"}
          </h1>
          {' '}
          <p className="page-sub">
            Unified learning modules, OHS guidelines, and role-specific qualifications — authored once by the customer, localised by VAANI, delivered via WhatsApp or in-app, and tracked at module, section, and quiz-question level with evidence-grade certificates.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" onClick={(event) => { window.kcDownloadAllDocx() }} data-onclick="kcDownloadAllDocx()" title="Download every Knowledge Center document as Word files in one ZIP">
            ⤓ All documents (.zip)
          </button>
          {' '}
          <button className="btn">SCORM upload</button>
          {' '}
          <button className="btn primary">+ New track</button>
        </div>
      </div>
      {' '}
      <div className="g4" style={{ marginBottom: "18px" }}>
        <div className="kpi">
          <div className="kpi-eye">Active tracks</div>
          <div className="kpi-val">11</div>
          <div className="kpi-sub">6 direct · 5 contract</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Inductions · 30d</div>
          <div className="kpi-val">142</div>
          <div className="kpi-sub">94 contract · 48 direct</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Avg completion time</div>
          <div className="kpi-val">
            3.4
            <small>h</small>
          </div>
          <div className="kpi-sub">target 4h</div>
        </div>
        {' '}
        <div className="kpi">
          <div className="kpi-eye">Certificate validity</div>
          <div className="kpi-val">
            100
            <small>%</small>
          </div>
          <div className="kpi-sub">signed · evidence-grade</div>
        </div>
      </div>
      {' '}
      <div className="card" style={{ marginBottom: "18px" }}>
        <div className="card-h">
          <div className="card-h-title">Refresher schedule · next 14 days</div>
        </div>
        {' '}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginTop: "4px" }}>
          <div className="arch-tile">
            <div className="arch-tile-h">
              <span className="dot amber" />
              Paint Shop Zone 3 — zone-specific refresher
            </div>
            {' '}
            <div className="arch-tile-d">
              Auto-triggered by OHS pattern detection. 38 workers (24 direct · 14 contract). WhatsApp + in-app delivery in TE/HI/EN.
            </div>
          </div>
          {' '}
          <div className="arch-tile">
            <div className="arch-tile-h">
              <span className="dot blue" />
              Compressor Line · 6-monthly
            </div>
            {' '}
            <div className="arch-tile-d">142 workers · scheduled 28 May 14:00–16:00 across shifts</div>
          </div>
          {' '}
          <div className="arch-tile">
            <div className="arch-tile-h">
              <span className="dot blue" />
              Hot work permit · annual
            </div>
            {' '}
            <div className="arch-tile-d">22 authorised holders · scheduled first week of June</div>
          </div>
        </div>
      </div>
      {' '}
      {/*  ─── GPT view · ask the Knowledge Center ───  */}
      {' '}
      <div style={{ margin: "28px 0 16px" }}>
        <div style={{ fontFamily: "var(--display)", fontWeight: "600", fontSize: "1.4rem", color: "var(--ink)", letterSpacing: "-0.01em", lineHeight: "1.2" }}>
          {"Ask the "}
          <em style={{ fontStyle: "italic", color: "var(--indigo)" }}>Knowledge Center</em>
        </div>
        {' '}
        <div style={{ fontSize: "0.86rem", color: "var(--ink-3)", marginTop: "6px", maxWidth: "800px", lineHeight: "1.55" }}>
          Pick a category to browse its documents — each is shown as a card with department, owner, date and available languages. Select a document to load it into the chat, then prompt and expand on it. Queries default to English; every answer can be translated for worker distribution.
        </div>
      </div>
      {' '}
      {/*  Compact category tiles  */}
      {' '}
      <div className="kc-cats" id="kc-cats" />
      {' '}
      {/*  Drill-down document browser (hidden until a category is picked)  */}
      {' '}
      <div className="kc-doc-browser" id="kc-doc-browser" style={{ display: "none" }} />
      {' '}
      {/*  Chat surface  */}
      {' '}
      <div className="kc-chat">
        <div className="kc-chat-h">
          <div className="kc-chat-h-mid">
            <div className="kc-chat-h-eye">VAANI Knowledge Assistant</div>
            {' '}
            <div className="kc-chat-h-title">
              {"Ask anything · "}
              <em>cite everything</em>
            </div>
          </div>
          {' '}
          <span className="kc-input-mode">English input</span>
          {' '}
          <span className="kc-icon-btn" title="Read responses aloud" onClick={(event) => { window.kcToggleTts(event.currentTarget) }} data-onclick="kcToggleTts(this)">
            🔊
          </span>
          {' '}
          <span className="kc-icon-btn" title="New chat" onClick={(event) => { window.kcNewChat() }} data-onclick="kcNewChat()">
            ＋
          </span>
        </div>
        {' '}
        <div className="kc-chat-body" id="kc-chat-body" />
        {' '}
        {/*  working-document context bar  */}
        {' '}
        <div id="kc-context" className="kc-context" style={{ display: "none" }} />
        {' '}
        <div className="kc-input-wrap">
          <div className="kc-input">
            <textarea id="kc-input" placeholder="Ask anything — about a selected document, or the knowledge base…" rows="1" onInput={(event) => { window.kcAutoGrow(event.currentTarget) }} onKeyDown={(event) => { if (event.key==='Enter' && !event.shiftKey) { event.preventDefault(); window.kcSend(); } }} />
            {' '}
            <span className="kc-icon-btn" id="kc-mic" title="Dictate (English · Whisper)" onClick={(event) => { window.kcToggleVoice(event.currentTarget) }} data-onclick="kcToggleVoice(this)">
              🎙
            </span>
            {' '}
            <button className="kc-send" onClick={(event) => { window.kcSend() }} data-onclick="kcSend()" title="Send">
              ↑
            </button>
          </div>
          {' '}
          <div className="kc-input-foot">
            <div className="kc-input-suggestions" id="kc-suggestions" />
            {' '}
            <span style={{ whiteSpace: "nowrap" }}>English in · translate any result for workers · audited</span>
          </div>
        </div>
      </div>
    </section>
  );
}
