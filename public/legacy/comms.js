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

    /* send(to, message, lang, category) — `to` may be a string, number, or array.
       `category` (emergency|safety|welfare|transport|hr|spp) prepends a colour-
       coded emoji + *bold* header line to the free-form message. */
    send: function (to, message, lang, category) {
      var list = Array.isArray(to) ? to : [to];
      var recipients = list.map(cleanNumber).filter(function (n) { return n; });
      if (!recipients.length || !message) {
        return Promise.resolve({ ok: false, error: 'missing recipient or message' });
      }
      var body = message;
      if (category && typeof window.kvCatHeader === 'function') {
        var h = window.kvCatHeader(category); if (h) body = h + message;
      }
      var payload = { to: recipients, message: body };
      if (lang) payload.lang = lang;   /* per-language test-recipient routing */
      return post('/api/whatsapp/send', payload)
        .catch(function (err) { return { ok: false, error: String(err && err.message || err) }; });
    },

    /* sendTemplate(to, template, language, components) */
    sendTemplate: function (to, template, language, components) {
      var list = Array.isArray(to) ? to : [to];
      var recipients = list.map(cleanNumber).filter(function (n) { return n; });
      return post('/api/whatsapp/send-template', {
        to: recipients, template: template, language: language || 'en', components: components,
        /* per-language test-recipient routing (e.g. a Tamil template reaches the
           Tamil-opted test number) — derived from the template language */
        lang: String(language || '').slice(0, 2).toLowerCase()
      }).catch(function (err) { return { ok: false, error: String(err && err.message || err) }; });
    },

    /* push the ONE approved WhatsApp template ('trial' — the minimum-wage
       revision notice) with its five body variables, in order:
         [period, effectiveDate, location, payPeriod, contact]
       e.g. ['TE2026', '01 Aug 2026', 'Karya Vaani App', 'August 2026', 'Plant HR'].
       Required for business-initiated messages outside the 24h window. */
    sendApprovedTemplate: function (to, vars, templateName, language) {
      var params = (vars || []).map(function (v) {
        return { type: 'text', text: String(v == null ? '' : v) };
      });
      var components = [{ type: 'body', parameters: params }];
      return KVWhatsApp.sendTemplate(to, templateName || 'trial', language || 'te', components);
    },

    /* send the generic welcome VOICE NOTE chosen by LANGUAGE alone — no worker
       name is spoken, so the same clip is reused for every worker of that
       language (Tanglish / Telugu / Hinglish, voiced by Sarvam bulbul:v3).
       Deliverable only inside the worker's 24h window, so call this AFTER the
       worker taps Yes/No on the onboarding template. opts.register forces a
       specific register; opts.caption overrides the audio caption. */
    sendWelcomeVoice: function (to, lang, opts) {
      opts = opts || {};
      var list = Array.isArray(to) ? to : [to];
      var recipients = list.map(cleanNumber).filter(function (n) { return n; });
      if (!recipients.length) return Promise.resolve({ ok: false, error: 'missing recipient' });
      return post('/api/whatsapp/send-welcome-voice', {
        to: recipients, lang: lang || '', register: opts.register, caption: opts.caption
      }).catch(function (err) { return { ok: false, error: String(err && err.message || err) }; });
    },

    /* poll the message log (inbound + outbound + statuses + events) */
    messages: function (params) {
      var qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return fetch(base + '/api/whatsapp/messages' + qs)
        .then(function (r) { return r.json(); })
        .catch(function (err) { return { ok: false, error: String(err && err.message || err) }; });
    },

    /* lifetime gateway counters: inbound / outbound / delivery statuses */
    metrics: function () {
      return fetch(base + '/api/whatsapp/metrics')
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
            var live = h && h.ok && h.provider && h.provider !== 'mock';
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
