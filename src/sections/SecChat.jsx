/* SecChat — converted 1:1 from karya-vaani_v3.html · <section id="sec-chat"> */
export default function SecChat() {
  return (
    <section id="sec-chat" className="section">
      <div className="crumbs">
        <span>Localisation Engine</span>
        {' '}
        <span className="crumb-sep">/</span>
        {' '}
        <span className="crumb-here">Karya Vaani Chat</span>
      </div>
      {' '}
      <div className="page-h">
        <div className="page-h-left">
          <div className="page-eyebrow">
            Conversational delivery · the worker-facing side of the Vaani Localisation engine
          </div>
          {' '}
          <h1 className="page-title">
            {"Every alert, in "}
            <em>their</em>
            {" language"}
          </h1>
          {' '}
          <p className="page-sub">
            {"A WhatsApp-style chatbot — the "}
            <strong>Karya Vaani</strong>
            {" assistant appears to each worker as a regular contact. Today's queued broadcasts sit above the chat — click any box to preview, send, or jump to the workers in its audience."}
          </p>
        </div>
        {' '}
        <div className="page-h-right">
          <span id="kv-wa-status" className="kv-wa-badge off" style={{ marginRight: "10px" }}>WhatsApp gateway: checking...</span>
          {' '}
          <button className="btn" onClick={(event) => { window.vbGoToChatAnalytics() }} data-onclick="vbGoToChatAnalytics()">
            View analytics
          </button>
          {' '}
          <button className="btn primary" onClick={(event) => { window.chatSendNextBroadcast() }} data-onclick="chatSendNextBroadcast()" style={{ marginLeft: "8px" }}>
            Send next broadcast
          </button>
        </div>
      </div>
      {' '}
      {/*  ─── queue boxes · today's broadcasts in a single horizontal strip ───  */}
      {' '}
      <div className="cv-qstrip-wrap">
        <div className="cv-qstrip-h">
          <div className="cv-qstrip-h-l">
            <div className="cv-qstrip-eye">Today's broadcasts · queue</div>
            {' '}
            <div className="cv-qstrip-sub" id="cv-qstrip-sub">— queued · click a box to expand</div>
          </div>
          {' '}
          <span className="pill outline tiny" id="cv-qstrip-count">—</span>
        </div>
        {' '}
        <div className="cv-qstrip" id="cv-qstrip" />
        {' '}
        {/*  expanded detail of the selected box  */}
        {' '}
        <div className="cv-qstrip-detail" id="cv-qstrip-detail" style={{ display: "none" }} />
      </div>
      {' '}
      {/*  WhatsApp-style two-pane chat · full-page  */}
      {' '}
      <div className="cv-chat cv-chat-fullpage">
        {/*  LEFT · chat list  */}
        {' '}
        <div className="cv-chat-left">
          <div className="cv-chat-left-h">
            <div className="cv-chat-left-h-l">
              <span className="cv-chat-me-ava">PM</span>
              {' '}
              <span className="cv-chat-me-name">Karya Vaani · Plant HR</span>
            </div>
            {' '}
            <div className="cv-chat-left-h-r">⌕</div>
          </div>
          {' '}
          <div className="cv-chat-search">
            <span className="cv-chat-search-ico">⌕</span>
            {' '}
            <input type="text" id="chat-search" className="cv-chat-search-in" autoComplete="off" placeholder="Search or start new chat" onInput={(event) => { window.chatRenderList() }} />
          </div>
          {' '}
          <div className="cv-chat-list" id="chat-list" />
        </div>
        {' '}
        {/*  RIGHT · conversation  */}
        {' '}
        <div className="cv-chat-right" id="chat-right">
          {/*  header bar (filled in by JS)  */}
          {' '}
          <div className="cv-conv-h" id="chat-conv-h" />
          {' '}
          {/*  message canvas  */}
          {' '}
          <div className="cv-conv-body" id="chat-conv-body" />
          {' '}
          {/*  composer area · shows the next bot move + quick-reply suggestions  */}
          {' '}
          <div className="cv-conv-foot" id="chat-conv-foot" />
        </div>
      </div>
    </section>
  );
}
