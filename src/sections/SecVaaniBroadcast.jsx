/* SecVaaniBroadcast — converted 1:1 from karya-vaani_v3.html · <section id="sec-vaani-broadcast"> */
export default function SecVaaniBroadcast() {
  return (
    <section id="sec-vaani-broadcast" className="section">
      <div className="crumbs">
        <span>Localisation Engine</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">VAANI Translation & Broadcasting</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">
            Localisation Engine · Sarvam-powered · WhatsApp-native · yuniTalk-secured
          </div>
          {' '}
          <h1 className="page-title">
            {"Compose once, "}
            <em>localise</em>
            , broadcast — and prove it
          </h1>
          {' '}
          <p className="page-sub">
            Translation and broadcasting are one workflow: compose a message like an email, VAANI localises it — text and voice — into two Indian languages, and it goes out over WhatsApp with acknowledgement tracking. Target a department, a zone, the entire location, or any combination.
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <button className="btn" onClick={(event) => { window.vbReset() }} data-onclick="vbReset()">Reset demo</button>
          {' '}
          <button className="btn primary" onClick={(event) => { window.vbGoStep(2) }} data-onclick="vbGoStep(2)">
            Skip to broadcast
          </button>
        </div>
      </div>
      {' '}
      {/*  compact step bar  */}
      {' '}
      <div className="vb-steps" id="vb-steps">
        <div className="vb-step now" id="vb-nav-0" onClick={(event) => { window.vbGoStep(0) }} data-onclick="vbGoStep(0)">
          <span className="vb-step-n">1</span>
          {' '}
          <span className="vb-step-t">Compose & translate</span>
        </div>
        {' '}
        <span className="vb-step-sep">→</span>
        {' '}
        <div className="vb-step" id="vb-nav-1" onClick={(event) => { window.vbGoStep(1) }} data-onclick="vbGoStep(1)">
          <span className="vb-step-n">2</span>
          {' '}
          <span className="vb-step-t">Recipients & channel</span>
        </div>
        {' '}
        <span className="vb-step-sep">→</span>
        {' '}
        <div className="vb-step" id="vb-nav-2" onClick={(event) => { window.vbGoStep(2) }} data-onclick="vbGoStep(2)">
          <span className="vb-step-n">3</span>
          {' '}
          <span className="vb-step-t">Broadcast & acknowledge</span>
        </div>
        {' '}
        <span className="vb-step-sep">→</span>
        {' '}
        <div className="vb-step" id="vb-nav-3" onClick={(event) => { window.vbGoToChatAnalytics() }} data-onclick="vbGoToChatAnalytics()">
          <span className="vb-step-n">4</span>
          {' '}
          <span className="vb-step-t">Chat analytics</span>
        </div>
      </div>
      {' '}
      {/*  ═══ STEP 1 · COMPOSE & TRANSLATE ═══  */}
      {' '}
      <div className="vb-panel active" id="vb-panel-0">
        {/*  email-style compose window  */}
        {' '}
        <div className="vbm">
          <div className="vbm-bar">
            <div className="vbm-bar-title">
              <span className="vbm-bar-ico">✉</span>
              {" New broadcast message"}
            </div>
            {' '}
            <span className="vbm-bar-tag">VAANI · Safety-critical</span>
          </div>
          {' '}
          {/*  To: audience picker  */}
          {' '}
          <div className="vbm-row" style={{ position: "relative" }}>
            <span className="vbm-row-k">To</span>
            {' '}
            <div className="vbm-row-v">
              <div className="vbm-chips" id="vb-aud-chips" />
              {' '}
              <div id="vb-aud-pop" className="vbm-aud-pop" style={{ display: "none" }} />
            </div>
          </div>
          {' '}
          {/*  Translation engine: our model vs Sarvam AI  */}
          {' '}
          <div className="vbm-row">
            <span className="vbm-row-k">Engine</span>
            {' '}
            <div className="vbm-row-v">
              <select className="sel" id="vb-provider" defaultValue="sarvam" onChange={(event) => { window.vbSetProvider(event.target.value) }} data-onchange="vbSetProvider(this.value)">
                <option value="sarvam">Sarvam AI</option>
                <option value="local">Our model · IndicTrans2</option>
              </select>
              {' '}
              <div className="vbm-row-hint" id="vb-provider-hint">
                Sarvam AI · falls back to our model (IndicTrans2) if unavailable
              </div>
            </div>
          </div>
          {' '}
          {/*  Languages: pick exactly two  */}
          {' '}
          <div className="vbm-row">
            <span className="vbm-row-k">Languages</span>
            {' '}
            <div className="vbm-row-v">
              <div className="chips" id="vb-langs" />
              {' '}
              <div className="vbm-row-hint">
                Pick exactly two Indian languages — each worker is delivered text and voice in their own.
              </div>
            </div>
          </div>
          {' '}
          {/*  Subject  */}
          {' '}
          <div className="vbm-row">
            <span className="vbm-row-k">Subject</span>
            {' '}
            <div className="vbm-row-v">
              <input type="text" className="vbm-subject" id="vb-subject" placeholder="Subject line…" defaultValue="Heavy rain — suspend outdoor work" />
            </div>
          </div>
          {' '}
          {/*  Template + tone toolbar row  */}
          {' '}
          <div className="vbm-row" style={{ gap: "12px", alignItems: "flex-start" }}>
            <span className="vbm-row-k" style={{ paddingTop: "9px" }}>Template</span>
            {' '}
            <div className="vbm-row-v">
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <select className="sel" id="vb-preset" style={{ width: "auto", minWidth: "280px" }} onChange={(event) => { window.vbApplyPreset() }}>
                  <optgroup label="Safety & operations">
                    <option value="rain">Heavy rain — suspend outdoor work</option>
                    {' '}
                    <option value="evac">Evacuation drill — assembly points</option>
                    {' '}
                    <option value="ppe">PPE reminder — Compressor Line</option>
                    {' '}
                    <option value="heat">Heat advisory — summer shift</option>
                    {' '}
                    <option value="fire">Fire-safety reminder — all zones</option>
                  </optgroup>
                  {' '}
                  <optgroup label="HR & schedule">
                    <option value="roster">Shift roster change</option>
                    {' '}
                    <option value="wage">Minimum wage revision — 2026</option>
                    {' '}
                    <option value="holiday">Holiday — plant closed</option>
                    {' '}
                    <option value="induction">Induction training — new joiners</option>
                    {' '}
                    <option value="transport">Weekly transport schedule — routes & pickups</option>
                  </optgroup>
                  {' '}
                  <optgroup label="From Knowledge Center" id="vb-kc-optgroup" />
                  {' '}
                  <option value="custom">Custom message…</option>
                </select>
                {' '}
                <select className="sel" id="vb-tone" style={{ width: "auto" }} disabled title="Tone selection coming soon">
                  <option>Tone · Safety-critical</option>
                  <option>Tone · Formal</option>
                  {' '}
                  <option>Tone · Conversational</option>
                  <option>Tone · Welfare</option>
                </select>
                {' '}
                <button className="btn" id="vb-gpt-btn" onClick={(event) => { window.vbToggleGpt() }} data-onclick="vbToggleGpt()" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.9rem" }}>✦</span>
                  {" Ask Knowledge Center\n            "}
                </button>
                {' '}
                <button className="btn" id="vb-prewarm-btn" onClick={(event) => { window.vbPrewarmVoices() }} data-onclick="vbPrewarmVoices()" title="Generate & store the voice note for every template in every language, once — so playback is instant afterwards" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "0.9rem" }}>⚡</span>
                  Pre-generate voices
                </button>
              </div>
              {' '}
              <div className="vbm-row-hint" id="vb-template-hint">
                Pick a ready template, pull a Knowledge Center document, or ask the assistant to draft one.
              </div>
              {' '}
              {/*  Knowledge Center GPT — drafts a broadcast from a question  */}
              {' '}
              <div id="vb-gpt-panel" className="vb-gpt" style={{ display: "none" }}>
                <div className="vb-gpt-h">
                  <span className="vb-gpt-title">
                    <span className="vb-gpt-spark">✦</span>
                    {" Knowledge Center assistant"}
                  </span>
                  {' '}
                  <span className="vb-gpt-sub">
                    Ask a question — it drafts a worker-ready broadcast, cited to the knowledge base.
                  </span>
                </div>
                {' '}
                <div className="vb-gpt-in">
                  <input type="text" id="vb-gpt-q" className="input" placeholder="e.g. What should workers know about the evacuation drill?" onKeyDown={(event) => { if(event.key==='Enter'){event.preventDefault();window.vbGptAsk();} }} />
                  {' '}
                  <button className="btn primary" onClick={(event) => { window.vbGptAsk() }} data-onclick="vbGptAsk()">
                    Draft
                  </button>
                </div>
                {' '}
                <div className="vb-gpt-chips" id="vb-gpt-suggest" />
                {' '}
                <div id="vb-gpt-answer" style={{ display: "none" }} />
              </div>
            </div>
          </div>
          {' '}
          {/*  Body  */}
          {' '}
          <textarea className="vbm-body" id="vb-source" onInput={(event) => { window.vbMarkDirty() }} placeholder="Write your message in English. VAANI localises it for every recipient." defaultValue={"Heavy rain expected this afternoon. All outdoor work to be suspended from 14:00. Move to the nearest covered area when the hooter sounds. Supervisors, please confirm headcount on WhatsApp."} />
          {' '}
          {/*  Email recipient row  */}
          {' '}
          <div className="vbm-row" id="vb-email-row">
            <span className="vbm-row-k">Email to</span>
            {' '}
            <div className="vbm-row-v">
              <input type="email" className="vbm-subject" id="vb-email-to" multiple placeholder="recipient@company.com" defaultValue="karyavaani@pionedata.com" />
              {' '}
              <div className="vbm-row-hint">
                Sends translated broadcast + voice-note WAV attachments via the VAANI mailer (localhost:5050). Translate first.
              </div>
            </div>
          </div>
          {' '}
          <div className="vbm-foot">
            <div className="vbm-foot-left">
              <button className="btn primary" id="vb-translate-btn" onClick={(event) => { window.vbTranslate() }} data-onclick="vbTranslate()">
                Translate via VAANI
              </button>
              {' '}
              <button className="btn" onClick={(event) => { window.vbReset() }} data-onclick="vbReset()">Clear</button>
            </div>
            {' '}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button className="btn" id="vb-email-send-btn" onClick={(event) => { window.vbSendViaEmail() }} data-onclick="vbSendViaEmail()" title="Send broadcast email with voice-note attachments via VAANI mailer">
                {"\n            📧 Send via email\n          "}
              </button>
              {' '}
              <span className="vbm-foot-meta" id="vb-compose-meta">WhatsApp · text + Bulbul v3 voice note</span>
            </div>
          </div>
        </div>
        {' '}
        {/*  translation output  */}
        {' '}
        <div id="vb-translation-out" style={{ display: "none", marginTop: "18px" }}>
          <div className="card-h" style={{ marginBottom: "12px" }}>
            <div>
              <div className="card-h-title">VAANI output · text + voice</div>
              {' '}
              <div className="card-h-sub">Preview each localised rendering and play the voice note before sending</div>
            </div>
            {' '}
            <span className="pill green">Translated</span>
          </div>
          {' '}
          <div className="g2" id="vb-translation-cards" />
        </div>
        {' '}
        <div className="row-between" style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
          <span />
          {' '}
          <button className="btn primary" id="vb-step1-next" onClick={(event) => { window.vbGoStep(1) }} data-onclick="vbGoStep(1)" disabled>
            Recipients & channel →
          </button>
        </div>
      </div>
      {' '}
      {/*  ═══ STEP 2 · AUDIENCE & CHANNEL ═══  */}
      {' '}
      <div className="vb-panel" id="vb-panel-1">
        <div className="g23">
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">Resolved recipients</div>
                {' '}
                <div className="card-h-sub" id="vb-aud-summary">—</div>
              </div>
              {' '}
              <span className="pill blue" id="vb-recipient-count">—</span>
            </div>
            {' '}
            <table className="t">
              <thead>
                <tr>
                  <th style={{ width: "34px" }} />
                  <th>Worker</th>
                  <th>Role · zone</th>
                  <th>Type</th>
                  <th>Language</th>
                </tr>
              </thead>
              <tbody id="vb-recipient-rows" />
            </table>
            {' '}
            <div className="note" style={{ marginTop: "14px" }}>
              <strong>ACK escalation:</strong>
              {" T+4h WhatsApp reminder · T+8h supervisor flag · T+24h HR escalation. Each broadcast writes one audit entry carrying translation provenance, a content hash, the ACK list and the channel breakdown.\n        "}
            </div>
          </div>
          {' '}
          <div>
            <div className="card" style={{ marginBottom: "14px" }}>
              <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Audience</div>
              {' '}
              <hr className="div" />
              {' '}
              <div id="vb-aud-recap" style={{ fontSize: "0.78rem", color: "var(--ink-2)", lineHeight: "1.7" }} />
              {' '}
              <button className="btn" style={{ marginTop: "10px", width: "100%" }} onClick={(event) => { window.vbGoStep(0) }} data-onclick="vbGoStep(0)">
                Change audience
              </button>
            </div>
            {' '}
            <div className="card" style={{ marginBottom: "14px" }}>
              <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Channel · this demo</div>
              {' '}
              <hr className="div" />
              {' '}
              <div style={{ fontSize: "0.78rem", color: "var(--ink-2)", lineHeight: "1.95" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input type="checkbox" defaultChecked disabled />
                  {" WhatsApp · text + voice note"}
                </label>
                {' '}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ink-4)" }}>
                  <input type="checkbox" disabled />
                  {" PA system · zones"}
                </label>
                {' '}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ink-4)" }}>
                  <input type="checkbox" disabled />
                  {" Notice board PDF"}
                </label>
                {' '}
                <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ink-4)" }}>
                  <input type="checkbox" disabled />
                  {" SMS fallback"}
                </label>
              </div>
              {' '}
              <div className="tiny muted" style={{ marginTop: "8px" }}>
                Demo runs on WhatsApp only. Production orchestrates all six channels as fallbacks.
              </div>
            </div>
            {' '}
            <div className="card sunken">
              <div className="card-h-title" style={{ fontSize: "0.95rem" }}>yuniTalk pillars</div>
              {' '}
              <hr className="div" />
              {' '}
              <div style={{ fontSize: "0.74rem", color: "var(--ink-2)", lineHeight: "1.7" }}>
                <div className="row-between">
                  <span>Leakage control</span>
                  <span className="pill green tiny">forwarding off</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Data security</span>
                  <span className="pill green tiny">E2E + audit</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Data residency</span>
                  <span className="pill green tiny">India</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Remote wipe ready</span>
                  <span className="pill green tiny">enabled</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {' '}
        <div className="row-between" style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
          <button className="btn" onClick={(event) => { window.vbGoStep(0) }} data-onclick="vbGoStep(0)">← Back</button>
          {' '}
          <button className="btn amber" onClick={(event) => { window.vbGoStep(2) }} data-onclick="vbGoStep(2)">
            Broadcast & acknowledge →
          </button>
        </div>
      </div>
      {' '}
      {/*  ═══ STEP 3 · BROADCAST & ACKNOWLEDGE ═══  */}
      {' '}
      <div className="vb-panel" id="vb-panel-2">
        <div className="g4" style={{ marginBottom: "18px" }}>
          <div className="kpi">
            <div className="kpi-eye">Recipients</div>
            {' '}
            <div className="kpi-val" id="vb-kpi-recipients">5</div>
            {' '}
            <div className="kpi-sub">demo group · WhatsApp</div>
          </div>
          {' '}
          <div className="kpi">
            <div className="kpi-eye">Languages</div>
            {' '}
            <div className="kpi-val" id="vb-kpi-langs">2</div>
            {' '}
            <div className="kpi-sub" id="vb-kpi-langs-sub">—</div>
          </div>
          {' '}
          <div className="kpi">
            <div className="kpi-bar">
              <span id="vb-kpi-delivered-bar" style={{ width: "0%" }} />
            </div>
            {' '}
            <div className="kpi-eye">Delivered</div>
            {' '}
            <div className="kpi-val" id="vb-kpi-delivered">
              0
              <small>/5</small>
            </div>
            {' '}
            <div className="kpi-sub" id="vb-kpi-delivered-sub">not sent yet</div>
          </div>
          {' '}
          <div className="kpi">
            <div className="kpi-bar">
              <span id="vb-kpi-ack-bar" className="amber" style={{ width: "0%" }} />
            </div>
            {' '}
            <div className="kpi-eye">Acknowledged</div>
            {' '}
            <div className="kpi-val" id="vb-kpi-ack">
              0
              <small>/5</small>
            </div>
            {' '}
            <div className="kpi-sub" id="vb-kpi-ack-sub">awaiting send</div>
          </div>
        </div>
        {' '}
        <div className="g23">
          <div className="card">
            <div className="card-h">
              <div>
                <div className="card-h-title">
                  {"Live broadcast · "}
                  <span className="mono" id="vb-msg-id">—</span>
                </div>
                {' '}
                <div className="card-h-sub">Each worker's row shows their own language, delivery and acknowledgement</div>
              </div>
              {' '}
              <button className="btn primary" id="vb-send-btn" onClick={(event) => { window.vbSend() }} data-onclick="vbSend()">
                Send broadcast
              </button>
            </div>
            {' '}
            <div id="vb-broadcast-list" />
          </div>
          {' '}
          <div>
            <div className="card" style={{ marginBottom: "14px" }}>
              <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Message preview</div>
              {' '}
              <hr className="div" />
              {' '}
              <div className="field" style={{ marginBottom: "8px" }}>
                <label className="field-l" style={{ marginBottom: "4px" }}>Source · English</label>
                {' '}
                <div className="tiny" id="vb-preview-en" style={{ color: "var(--ink-2)", lineHeight: "1.6" }} />
              </div>
              {' '}
              <div id="vb-preview-langs" />
            </div>
            {' '}
            <div className="card sunken">
              <div className="card-h-title" style={{ fontSize: "0.95rem" }}>Audit entry</div>
              {' '}
              <hr className="div" />
              {' '}
              <div style={{ fontSize: "0.74rem", color: "var(--ink-2)", lineHeight: "1.7" }} id="vb-audit">
                <div className="row-between">
                  <span>Status</span>
                  <span className="pill tiny" id="vb-audit-status">not sent</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Content hash</span>
                  <span className="mono" id="vb-audit-hash">—</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Channel</span>
                  <span className="mono">WhatsApp</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Languages</span>
                  <span className="mono" id="vb-audit-langs">—</span>
                </div>
                {' '}
                <div className="row-between">
                  <span>Provenance</span>
                  <span className="mono">VAANI · Mayura v1</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {' '}
        <div className="row-between" style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
          <button className="btn" onClick={(event) => { window.vbGoStep(1) }} data-onclick="vbGoStep(1)">← Back</button>
          {' '}
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn" onClick={(event) => { window.vbReset() }} data-onclick="vbReset()">
              New broadcast
            </button>
            {' '}
            <button className="btn" id="vb-remind-btn" onClick={(event) => { window.vbRemind() }} data-onclick="vbRemind()" disabled>
              Send ACK reminder
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
