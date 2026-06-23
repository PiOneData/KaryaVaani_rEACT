/* comms.js — thin browser client for the Karya Vaani WhatsApp gateway.

   Exposes window.KVWhatsApp. The browser only talks to the app backend
   (/api/whatsapp/*), which forwards to the standalone comms server using the
   server-side API key — so no WhatsApp credentials ever reach the client.

   Every send is fire-and-forget from the UI's perspective: failures are
   surfaced via toast() but never break the existing on-screen simulation. */
(function () {
  var base = window.__KV_API_BASE || '';

  /* Demo rosters store masked numbers like "••• ••• 2231". When a real number
     isn't available we fall back to a configured test recipient if present,
     otherwise the send still goes through to the gateway (mock provider logs
     it) so the flow is demonstrable end-to-end. */
  var fallbackRecipient = window.__KV_WHATSAPP_TEST_TO || '';

  function digits(p) { return String(p == null ? '' : p).replace(/[^\d]/g, ''); }

  function cleanNumber(p) {
    var d = digits(p);
    if (d.length >= 10) return d;            // usable number
    if (fallbackRecipient) return digits(fallbackRecipient);
    return d;                                 // masked/short — gateway will log it
  }

  function post(path, body) {
    return fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'bad response' }; });
    });
  }

  var KVWhatsApp = {
    base: base,
    setFallbackRecipient: function (n) { fallbackRecipient = n || ''; },
    cleanNumber: cleanNumber,

    /* send(to, message)  — `to` may be a string, a number, or an array of either */
    send: function (to, message) {
      var list = Array.isArray(to) ? to : [to];
      var recipients = list.map(cleanNumber).filter(function (n) { return n; });
      if (!recipients.length || !message) {
        return Promise.resolve({ ok: false, error: 'missing recipient or message' });
      }
      return post('/api/whatsapp/send', { to: recipients, message: message })
        .catch(function (err) { return { ok: false, error: String(err && err.message || err) }; });
    },

    /* sendTemplate(to, template, language, components) */
    sendTemplate: function (to, template, language, components) {
      var list = Array.isArray(to) ? to : [to];
      var recipients = list.map(cleanNumber).filter(function (n) { return n; });
      return post('/api/whatsapp/send-template', {
        to: recipients, template: template, language: language || 'en', components: components
      }).catch(function (err) { return { ok: false, error: String(err && err.message || err) }; });
    },

    /* poll the message log (inbound + outbound + statuses) */
    messages: function (params) {
      var qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return fetch(base + '/api/whatsapp/messages' + qs)
        .then(function (r) { return r.json(); })
        .catch(function (err) { return { ok: false, error: String(err && err.message || err) }; });
    },

    /* send + toast feedback. opts.silent suppresses the success toast. */
    notify: function (to, message, opts) {
      opts = opts || {};
      return KVWhatsApp.send(to, message).then(function (res) {
        if (typeof toast !== 'function') return res;
        if (res && res.ok) {
          if (!opts.silent) {
            var via = res.provider === 'mock' ? ' (mock)' : '';
            toast((opts.label || 'WhatsApp message sent') + via, 'green');
          }
        } else {
          toast('WhatsApp send failed: ' + ((res && res.error) || 'unknown'), 'red');
        }
        return res;
      });
    },

    /* check gateway health and paint the connection badge if present */
    refreshStatus: function () {
      return fetch(base + '/api/whatsapp/health')
        .then(function (r) { return r.json(); })
        .then(function (h) {
          var el = document.getElementById('kv-wa-status');
          if (el) {
            var live = h && h.ok && h.provider === 'meta';
            el.textContent = live
              ? '● WhatsApp Business · connected'
              : (h && h.ok ? '● WhatsApp gateway · mock mode' : '● WhatsApp gateway · offline');
            el.className = 'kv-wa-badge ' + (live ? 'live' : (h && h.ok ? 'mock' : 'off'));
            el.title = h && h.ok
              ? ('Provider: ' + h.provider + (h.authEnabled ? ' · secured' : ''))
              : 'Communication server unreachable';
          }
          return h;
        })
        .catch(function () {
          var el = document.getElementById('kv-wa-status');
          if (el) { el.textContent = '● WhatsApp gateway · offline'; el.className = 'kv-wa-badge off'; }
        });
    }
  };

  window.KVWhatsApp = KVWhatsApp;

  /* paint status once the DOM is ready, then keep it fresh */
  function boot() { KVWhatsApp.refreshStatus(); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  setInterval(function () {
    if (document.getElementById('kv-wa-status')) KVWhatsApp.refreshStatus();
  }, 30000);
})();
