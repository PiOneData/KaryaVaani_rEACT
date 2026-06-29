import { useEffect } from 'react';

/*
  Loads the original application logic as a classic script after the React tree
  is in the DOM, so its top-level functions become window globals (exactly as in
  the original single-file HTML version). React only renders empty section
  shells; this script fills them and wires every onClick handler (window.*).

  Datasets no longer live in the frontend: we first fetch /api/bootstrap from the
  backend into window.__KVDATA, THEN inject app.js, which reads its data from
  window.__KVDATA. If the backend is unreachable, __KVDATA is left empty and the
  data-driven sections render their offline state instead of crashing.

  On a remount / hot update the script is already loaded, so we just re-run the
  init functions to repopulate the freshly-rendered (empty) containers.
*/
function runLegacyInits() {
  if (!window.__kvLegacyReady) return;
  const seen = new Set();
  Object.keys(window).forEach((k) => {
    if (/^init[A-Z]/.test(k) && typeof window[k] === 'function' && !seen.has(k)) {
      seen.add(k);
      try { window[k](); } catch (e) { /* keep other sections rendering */ }
    }
  });
  ['renderReqLadder', 'renderReqGrid'].forEach((f) => {
    if (typeof window[f] === 'function') {
      try { window[f]({}); } catch (e) { /* ignore */ }
    }
  });
}

function injectLegacy() {
  const s = document.createElement('script');
  // Cache-bust per build: /legacy/app.js is an unversioned URL, so without a
  // changing query string browsers can serve a stale copy after a deploy.
  const v = (typeof __KV_BUILD_ID__ !== 'undefined') ? __KV_BUILD_ID__ : 'dev';
  s.src = `${import.meta.env.BASE_URL}legacy/app.js?v=${v}`;
  s.onload = () => { window.__kvLegacyReady = true; };
  document.body.appendChild(s);
}

export function useLegacyApp() {
  useEffect(() => {
    if (window.__kvLegacyReady) { runLegacyInits(); return; }
    if (window.__kvLegacyLoading) return;
    window.__kvLegacyLoading = true;

    const base = window.__KV_API_BASE || '';
    fetch(base + '/api/bootstrap')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((data) => { window.__KVDATA = data; })
      .catch(() => { window.__KVDATA = window.__KVDATA || {}; })
      .finally(injectLegacy);
  }, []);
}
