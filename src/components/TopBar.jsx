/* TopBar — converted 1:1 from karya-vaani_v3.html */
export default function TopBar() {
  return (
    <div className="topbar">
      <div className="tb-brand">
        <span className="tb-mark">Karya Vaani</span>
        {' '}
        <span className="tb-tag">Workforce Compliance Assessment</span>
      </div>
      {' '}
      <div className="tb-right">
        <a className="tb-walkthrough" href="https://walkthru.pionedata.com/" target="_blank" rel="noopener" title="Open the product walkthrough">
          <span className="tb-walkthrough-ico">▶</span>
          {' '}
          <span className="tb-walkthrough-l">
            <span className="tb-walkthrough-eye">DEMO</span>
            {' '}
            <span className="tb-walkthrough-name">Walkthrough</span>
          </span>
        </a>
        {' '}
        <div className="tb-customer">
          <span className="tb-customer-dot" />
          {' '}
          <span className="tb-customer-label">Tenant</span>
          {' '}
          <span className="tb-customer-name">Daikin Sricity · AP</span>
        </div>
        {' '}
        <div className="tb-action">日本語</div>
        {' '}
        <div className="tb-user" title="Priya Menon · CHRO">PM</div>
      </div>
    </div>
  );
}
