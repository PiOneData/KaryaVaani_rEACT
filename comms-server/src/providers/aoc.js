/* providers/aoc.js — AOC portal ("BOT API") WhatsApp provider.

   Implements the common provider interface:
     sendText({ to, body })
     sendTemplate({ to, template, language, components })
     parseWebhook(body)            -> { messages:[...], statuses:[...], events:[...] }
     verifyWebhook({ mode, token, challenge }) -> challenge|null
     verifyInbound(req)            -> boolean (header-token check)

   Docs: https://developers.aoc-portal.com/whatsapp/webhook

   Sending: the AOC API is Meta-Cloud-API-shaped. Messages are POSTed to
   `${AOC_BASE_URL}/v1/whatsapp` with the account API key in an `apikey`
   header. Because one AOC account can own several sender numbers, every
   payload carries an explicit `from` (AOC_FROM_ID, digits only —
   e.g. 918220099940).

   Receiving: the portal's webhook configuration (Whatsapp → Utility &
   Template → Webhook → Add Configuration, Provider "Generic") POSTs every
   subscribed event — inbound messages, outbound delivery reports and other
   metrics — to ONE endpoint URL as JSON, with whatever custom headers you
   added in the "Add Headers" dialog. There is no Meta-style hub.challenge
   handshake and no HMAC signature; authenticity is established by a shared
   secret header (AOC_WEBHOOK_TOKEN, checked by verifyInbound). Payloads are
   Meta-wrapper-shaped for message traffic, so the parser handles the Meta
   envelope first and falls back to flat/array event shapes so no event type
   is ever dropped. */
const config = require('./../config');
const logger = require('./../logger');

const { baseUrl, apiKey, fromId, webhookTokenHeader, webhookToken } = config.aoc;

/* Normalise an Indian/free-form number to E.164 digits (no +), same policy
   as the Meta provider so callers can pass 10-digit local numbers. */
function normalize(to) {
  let n = String(to || '').replace(/[^\d]/g, '');
  if (n.length === 10) n = '91' + n;
  return n;
}

async function post(payload) {
  const resp = await fetch(`${baseUrl}/v1/whatsapp`, {
    method: 'POST',
    headers: {
      apikey: apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg =
      (json && (json.message || json.error && (json.error.message || json.error))) ||
      `HTTP ${resp.status}`;
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.raw = json;
    throw err;
  }
  /* Accept the id wherever the portal puts it (meta-style messages[0].id,
     or a flat messageId / id / requestId). */
  const id =
    (json.messages && json.messages[0] && json.messages[0].id) ||
    json.messageId ||
    json.id ||
    json.requestId ||
    null;
  return { id, status: 'sent', provider: 'aoc', raw: json };
}

async function sendText({ to, body }) {
  return post({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    from: normalize(fromId),
    to: normalize(to),
    type: 'text',
    text: { preview_url: false, body: String(body || '') }
  });
}

async function sendTemplate({ to, template, language = 'en', components }) {
  return post({
    messaging_product: 'whatsapp',
    from: normalize(fromId),
    to: normalize(to),
    type: 'template',
    template: {
      name: template,
      language: { code: language },
      ...(components ? { components } : {})
    }
  });
}

/* The AOC portal has no Meta-style GET verification handshake; some portals
   probe the endpoint with a GET when you save the configuration, so the
   channel layer answers 200 when this returns null-but-not-forbidden. Kept
   for interface compatibility: honour a Meta-style probe if one arrives. */
function verifyWebhook({ mode, token, challenge }) {
  if (mode === 'subscribe' && token && challenge) return challenge;
  return null;
}

/* Authenticate an inbound webhook call by shared-secret header. In the
   portal's "Add Headers" dialog add the same header/value pair configured
   here (default header: x-webhook-token). With no token configured every
   call is accepted (dev mode). */
function verifyInbound(req) {
  if (!webhookToken) return true;
  const provided = req.get(webhookTokenHeader) || req.get('authorization') || '';
  return provided === webhookToken || provided === `Bearer ${webhookToken}`;
}

/* Not HMAC-signed; verifyInbound above is the auth mechanism. */
function verifySignature() {
  return true;
}

function pushMessage(out, m, extra = {}) {
  out.messages.push({
    channel: 'whatsapp',
    direction: 'in',
    provider: 'aoc',
    messageId: m.id || m.messageId || m.msgId || null,
    wamid: m.id || m.wamid || m.messageId || null,
    from: normalize(m.from || m.mobile || m.sender || ''),
    name: extra.name || m.name || m.profileName || null,
    conversationId:
      (m.conversation && m.conversation.id) || m.conversationId || m.conversation_id || null,
    type: m.type || 'text',
    text:
      (m.text && (m.text.body != null ? m.text.body : m.text)) ||
      (m.button && m.button.text) ||
      (m.interactive &&
        ((m.interactive.button_reply && m.interactive.button_reply.title) ||
          (m.interactive.list_reply && m.interactive.list_reply.title))) ||
      m.message ||
      m.body ||
      '',
    timestamp: m.timestamp || m.time || null,
    raw: m
  });
}

function pushStatus(out, s) {
  out.statuses.push({
    channel: 'whatsapp',
    direction: 'status',
    provider: 'aoc',
    messageId: s.id || s.messageId || s.msgId || null,
    wamid: s.id || s.wamid || s.messageId || null,
    to: normalize(s.recipient_id || s.to || s.mobile || ''),
    status: String(s.status || s.event || '').toLowerCase(), // sent | delivered | read | failed
    conversationId:
      (s.conversation && s.conversation.id) || s.conversationId || s.conversation_id || null,
    category: (s.pricing && s.pricing.category) || s.category || null,
    error:
      (Array.isArray(s.errors) && s.errors[0] && (s.errors[0].title || s.errors[0].message)) ||
      s.reason ||
      undefined,
    timestamp: s.timestamp || s.time || null,
    raw: s
  });
}

const STATUS_WORDS = ['sent', 'submitted', 'delivered', 'read', 'failed', 'undelivered', 'expired'];

/* One flat event object -> message, status, or generic event record. */
function classifyFlat(evt, out) {
  const kind = String(evt.event || evt.eventType || evt.type || '').toLowerCase();
  const status = String(evt.status || '').toLowerCase();
  if (kind.includes('inbound') || kind.includes('incoming') || kind.includes('received') ||
      (evt.from && (evt.text || evt.message || evt.body) && !status)) {
    pushMessage(out, evt);
    return;
  }
  if (kind.includes('status') || kind.includes('outbound') || kind.includes('dlr') ||
      kind.includes('report') || STATUS_WORDS.includes(status) || STATUS_WORDS.includes(kind)) {
    pushStatus(out, { ...evt, status: status || kind });
    return;
  }
  /* Anything else (template approvals, quality/metric updates, account
     events…) is preserved verbatim so the log/metrics endpoint shows it. */
  out.events.push({
    channel: 'whatsapp',
    direction: 'event',
    provider: 'aoc',
    event: kind || 'unknown',
    timestamp: evt.timestamp || evt.time || null,
    raw: evt
  });
}

/* Flatten whatever the portal POSTs into simple message/status/event records.
   Handles: the Meta envelope (object/entry/changes/value), a bare `value`
   object, a single flat event, or an array of any of those. */
function parseWebhook(body) {
  const out = { messages: [], statuses: [], events: [] };
  const items = Array.isArray(body) ? body : [body];
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;

    /* Meta-style envelope */
    if (Array.isArray(item.entry)) {
      for (const entry of item.entry) {
        for (const change of entry.changes || []) {
          parseValue(change.value || {}, change.field, out);
        }
      }
      continue;
    }
    /* Bare `value` object (some relays strip the envelope) */
    if (Array.isArray(item.messages) || Array.isArray(item.statuses)) {
      parseValue(item, null, out);
      continue;
    }
    /* Flat single event */
    classifyFlat(item, out);
  }
  return out;
}

function parseValue(v, field, out) {
  const contacts = v.contacts || [];
  const profileName = contacts[0] && contacts[0].profile && contacts[0].profile.name;
  for (const m of v.messages || []) pushMessage(out, m, { name: profileName });
  for (const s of v.statuses || []) pushStatus(out, s);
  if (!(v.messages || []).length && !(v.statuses || []).length) {
    out.events.push({
      channel: 'whatsapp',
      direction: 'event',
      provider: 'aoc',
      event: field || 'unknown',
      timestamp: null,
      raw: v
    });
  }
}

logger.info(
  `WhatsApp provider: aoc (base: ${baseUrl}, from: ${fromId || 'unset'}, apikey set: ${!!apiKey})`
);

module.exports = {
  name: 'aoc',
  sendText,
  sendTemplate,
  verifyWebhook,
  verifyInbound,
  verifySignature,
  parseWebhook,
  normalize
};
