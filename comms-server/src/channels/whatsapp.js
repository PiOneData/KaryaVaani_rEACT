/* channels/whatsapp.js -- HTTP routes for the WhatsApp channel.

   Mounted at /v1/whatsapp. All routes are channel-only and app-agnostic:
     GET    /webhook            Meta verification handshake
     POST   /webhook            inbound messages + delivery statuses
     POST   /send               send a text message to one or many recipients
     POST   /send-template      send an approved template message
     GET    /messages           poll the in-memory message/status log
*/
const express = require('express');
const provider = require('./../providers');
const config = require('./../config');
const store = require('./../store');
const logger = require('./../logger');
const { requireApiKey } = require('./../auth');

const router = express.Router();

/* TEST SAFETY VALVE: if config.testRecipient is set, every outbound message
   is redirected to that single number so nothing reaches real recipients.
   Returns the number actually used; logs when a redirect happens. */
function resolveRecipient(requested) {
  if (config.testRecipient) {
    const forced = provider.normalize(config.testRecipient);
    if (provider.normalize(requested) !== forced) {
      logger.warn(`[test-mode] redirecting ${requested} -> ${forced}`);
    }
    return forced;
  }
  return requested;
}

/* ---- inbound webhook --------------------------------------------------- */

/* GET: Meta calls this once to verify the callback URL. */
router.get('/webhook', (req, res) => {
  const challenge = provider.verifyWebhook({
    mode: req.query['hub.mode'],
    token: req.query['hub.verify_token'],
    challenge: req.query['hub.challenge']
  });
  if (challenge) return res.status(200).send(challenge);
  return res.sendStatus(403);
});

/* POST: inbound messages and delivery status callbacks. */
router.post('/webhook', (req, res) => {
  if (provider.verifySignature && req.rawBody) {
    const ok = provider.verifySignature(req.rawBody, req.get('x-hub-signature-256'));
    if (!ok) {
      logger.warn('webhook signature verification failed');
      return res.sendStatus(401);
    }
  }
  let parsed = { messages: [], statuses: [] };
  try {
    parsed = provider.parseWebhook(req.body || {});
  } catch (err) {
    logger.error('parseWebhook error:', err.message);
  }
  parsed.messages.forEach((m) => store.add(m));
  parsed.statuses.forEach((s) => store.add(s));
  if (parsed.messages.length || parsed.statuses.length) {
    logger.info(`webhook: ${parsed.messages.length} message(s), ${parsed.statuses.length} status(es)`);
  }
  res.sendStatus(200);
});

/* ---- outbound ---------------------------------------------------------- */

/* POST /send  Body: { to: string|string[], message: string } */
router.post('/send', requireApiKey, async (req, res) => {
  const { to, message, body } = req.body || {};
  const text = message != null ? message : body;
  const recipients = Array.isArray(to) ? to : to != null ? [to] : [];
  if (!recipients.length || !text) {
    return res.status(400).json({ ok: false, error: '`to` and `message` are required' });
  }

  const results = [];
  for (const requested of recipients) {
    const recipient = resolveRecipient(requested);
    try {
      const r = await provider.sendText({ to: recipient, body: text });
      store.add({
        channel: 'whatsapp',
        direction: 'out',
        provider: r.provider,
        messageId: r.id,
        to: provider.normalize(recipient),
        intendedFor: config.testRecipient ? provider.normalize(requested) : undefined,
        text,
        status: r.status
      });
      results.push({ to: recipient, intendedFor: requested, ok: true, id: r.id, provider: r.provider });
    } catch (err) {
      logger.error('send error:', err.message);
      results.push({ to: recipient, intendedFor: requested, ok: false, error: err.message });
    }
  }

  const okCount = results.filter((r) => r.ok).length;
  res.status(okCount ? 200 : 502).json({
    ok: okCount > 0,
    provider: provider.name,
    testMode: !!config.testRecipient,
    sent: okCount,
    failed: results.length - okCount,
    results
  });
});

/* POST /send-template  Body: { to, template, language?, components? } */
router.post('/send-template', requireApiKey, async (req, res) => {
  const { to, template, language = 'en', components } = req.body || {};
  const recipients = Array.isArray(to) ? to : to != null ? [to] : [];
  if (!recipients.length || !template) {
    return res.status(400).json({ ok: false, error: '`to` and `template` are required' });
  }
  const results = [];
  for (const requested of recipients) {
    const recipient = resolveRecipient(requested);
    try {
      const r = await provider.sendTemplate({ to: recipient, template, language, components });
      store.add({
        channel: 'whatsapp',
        direction: 'out',
        provider: r.provider,
        messageId: r.id,
        to: provider.normalize(recipient),
        intendedFor: config.testRecipient ? provider.normalize(requested) : undefined,
        text: `[template:${template}]`,
        status: r.status
      });
      results.push({ to: recipient, intendedFor: requested, ok: true, id: r.id, provider: r.provider });
    } catch (err) {
      logger.error('send-template error:', err.message);
      results.push({ to: recipient, intendedFor: requested, ok: false, error: err.message });
    }
  }
  const okCount = results.filter((r) => r.ok).length;
  res.status(okCount ? 200 : 502).json({
    ok: okCount > 0,
    provider: provider.name,
    testMode: !!config.testRecipient,
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

module.exports = router;
