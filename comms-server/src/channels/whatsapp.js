/* channels/whatsapp.js -- HTTP routes for the WhatsApp channel.

   Mounted at /v1/whatsapp. All routes are channel-only and app-agnostic:
     GET    /webhook            provider verification/probe (Meta handshake or AOC ping)
     POST   /webhook            ONE endpoint for every provider event: inbound
                                messages, outbound delivery statuses and any
                                other metric/account events
     POST   /send               send a text message to one or many recipients
     POST   /send-template      send an approved template message
     GET    /messages           poll the in-memory message/status/event log
     GET    /metrics            lifetime counters (inbound/outbound/statuses)
*/
const express = require('express');
const provider = require('./../providers');
const config = require('./../config');
const store = require('./../store');
const logger = require('./../logger');
const { requireApiKey } = require('./../auth');

const router = express.Router();

/* TEST SAFETY VALVE: if config.testRecipients is set, every outbound message is
   sent to ALL of those numbers so nothing reaches real recipients.
   Returns the array of numbers to actually send to. */
function testActive() { return !!(config.testRecipients && config.testRecipients.length); }
function resolveRecipients(requested, lang) {
  if (!testActive()) return [requested];
  const want = String(lang || '').toLowerCase();
  /* untagged numbers always receive; a language-opted number receives only when
     the message language matches (or when no language is supplied, e.g. a
     transactional send → everyone gets it). Never send to nobody. */
  let list = config.testRecipients.filter((r) => !r.lang || !want || r.lang === want);
  if (!list.length) list = config.testRecipients;
  const forced = list.map((r) => provider.normalize(r.number));
  if (!forced.includes(provider.normalize(requested))) {
    logger.warn(`[test-mode] redirecting ${requested}${want ? ' (' + want + ')' : ''} -> ${forced.join(', ')}`);
  }
  return forced;
}

/* Human-readable log line for a template send: the template name followed by
   its body variable values, so the message log/chat shows the actual content
   instead of an opaque "[template:trial]". */
function templateLogText(template, components) {
  const params = [];
  (components || []).forEach((c) => {
    (c.parameters || []).forEach((p) => {
      if (p && p.text != null) params.push(String(p.text));
    });
  });
  return params.length ? `[${template}] ${params.join(' · ')}` : `[template:${template}]`;
}

/* ---- inbound webhook --------------------------------------------------- */

/* GET: verification probe. Meta sends the hub.challenge handshake; the AOC
   portal (and similar "Generic" webhook providers) may just ping the URL when
   the configuration is saved, so anything without Meta params gets a 200. */
router.get('/webhook', (req, res) => {
  if (req.query['hub.mode']) {
    const challenge = provider.verifyWebhook({
      mode: req.query['hub.mode'],
      token: req.query['hub.verify_token'],
      challenge: req.query['hub.challenge']
    });
    if (challenge) return res.status(200).send(challenge);
    return res.sendStatus(403);
  }
  return res.status(200).json({ ok: true, service: 'comms-server', channel: 'whatsapp' });
});

/* POST: the single event endpoint — inbound messages, delivery statuses and
   any other provider events all land here and go into the same log. */
router.post('/webhook', (req, res) => {
  /* Provider-specific authenticity checks: header token (AOC) and/or
     HMAC signature (Meta). */
  if (provider.verifyInbound && !provider.verifyInbound(req)) {
    logger.warn('webhook token verification failed');
    return res.sendStatus(401);
  }
  if (provider.verifySignature && req.rawBody) {
    const ok = provider.verifySignature(req.rawBody, req.get('x-hub-signature-256'));
    if (!ok) {
      logger.warn('webhook signature verification failed');
      return res.sendStatus(401);
    }
  }
  let parsed = { messages: [], statuses: [], events: [] };
  try {
    parsed = provider.parseWebhook(req.body || {});
  } catch (err) {
    logger.error('parseWebhook error:', err.message);
  }
  parsed.messages.forEach((m) => store.add(m));
  parsed.statuses.forEach((s) => store.add(s));
  (parsed.events || []).forEach((e) => store.add(e));
  const nEvents = (parsed.events || []).length;
  if (parsed.messages.length || parsed.statuses.length || nEvents) {
    logger.info(
      `webhook: ${parsed.messages.length} message(s), ${parsed.statuses.length} status(es), ${nEvents} event(s)`
    );
  }
  res.sendStatus(200);
});

/* ---- outbound ---------------------------------------------------------- */

/* POST /send  Body: { to: string|string[], message: string } */
router.post('/send', requireApiKey, async (req, res) => {
  const { to, message, body, lang } = req.body || {};
  const text = message != null ? message : body;
  const recipients = Array.isArray(to) ? to : to != null ? [to] : [];
  if (!recipients.length || !text) {
    return res.status(400).json({ ok: false, error: '`to` and `message` are required' });
  }

  const results = [];
  for (const requested of recipients) {
    for (const recipient of resolveRecipients(requested, lang)) {
      try {
        const r = await provider.sendText({ to: recipient, body: text });
        store.add({
          channel: 'whatsapp',
          direction: 'out',
          provider: r.provider,
          messageId: r.id,
          to: provider.normalize(recipient),
          intendedFor: testActive() ? provider.normalize(requested) : undefined,
          text,
          status: r.status
        });
        results.push({ to: recipient, intendedFor: requested, ok: true, id: r.id, provider: r.provider });
      } catch (err) {
        logger.error('send error:', err.message);
        results.push({ to: recipient, intendedFor: requested, ok: false, error: err.message });
      }
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  res.status(okCount ? 200 : 502).json({
    ok: okCount > 0,
    provider: provider.name,
    testMode: testActive(),
    sent: okCount,
    failed: results.length - okCount,
    results
  });
});

/* POST /send-template  Body: { to, template, language?, components? } */
router.post('/send-template', requireApiKey, async (req, res) => {
  const { to, template, language = 'en', components, lang } = req.body || {};
  const recipients = Array.isArray(to) ? to : to != null ? [to] : [];
  if (!recipients.length || !template) {
    return res.status(400).json({ ok: false, error: '`to` and `template` are required' });
  }
  const results = [];
  for (const requested of recipients) {
    for (const recipient of resolveRecipients(requested, lang)) {
      try {
        const r = await provider.sendTemplate({ to: recipient, template, language, components });
        store.add({
          channel: 'whatsapp',
          direction: 'out',
          provider: r.provider,
          messageId: r.id,
          to: provider.normalize(recipient),
          intendedFor: testActive() ? provider.normalize(requested) : undefined,
          text: templateLogText(template, components),
          status: r.status
        });
        results.push({ to: recipient, intendedFor: requested, ok: true, id: r.id, provider: r.provider });
      } catch (err) {
        logger.error('send-template error:', err.message);
        results.push({ to: recipient, intendedFor: requested, ok: false, error: err.message });
      }
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  res.status(okCount ? 200 : 502).json({
    ok: okCount > 0,
    provider: provider.name,
    testMode: testActive(),
    sent: okCount,
    failed: results.length - okCount,
    results
  });
});

/* ---- read log ---------------------------------------------------------- */

/* GET /messages?since=&direction=&to=&from=&limit= */
router.get('/messages', (req, res) => {
  const { since, direction, to, from, limit } = req.query;
  const items = store.list({ since, direction, to, from, channel: 'whatsapp', limit });
  res.json({ ok: true, provider: provider.name, count: items.length, items });
});

/* GET /metrics — lifetime counters (inbound / outbound / delivery statuses /
   other events) accumulated from everything that hit the webhook or was sent
   through this gateway since boot. */
router.get('/metrics', (req, res) => {
  res.json({ ok: true, provider: provider.name, metrics: store.metrics() });
});

module.exports = router;
