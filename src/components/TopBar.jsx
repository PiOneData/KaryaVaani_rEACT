/* TopBar — converted 1:1 from karya-vaani_v3.html, plus the signed-in user
   chip + logout for the role-based session. */
function initials(name) {
  return String(name || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export default function TopBar({ user, onLogout }) {
  const name = (user && user.name) || 'Priya Menon';
  const title = (user && user.title) || 'CHRO';
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
        <div className="tb-user" title={name + ' · ' + title}>{initials(name)}</div>
        {' '}
        <div className="tb-userinfo">
          <span className="tb-userinfo-name">{name}</span>
          <span className="tb-userinfo-title">{title}</span>
        </div>
        {' '}
        <button className="tb-logout" onClick={() => { if (onLogout) onLogout(); }} title="Sign out">
          Sign out
        </button>
      </div>
    </div>
  );
}
