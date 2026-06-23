/* providers/meta.js — Meta WhatsApp Cloud API (Graph API) provider.

   Implements the common provider interface:
     sendText({ to, body })
     sendTemplate({ to, template, language, components })
     parseWebhook(body)            -> { messages:[...], statuses:[...] }
     verifyWebhook({ mode, token, challenge }) -> challenge|null

   Docs: https://developers.facebook.com/docs/whatsapp/cloud-api */
const crypto = require('crypto');
const config = require('./../config');
const logger = require('./../logger');

const { apiVersion, phoneNumberId, accessToken, verifyToken, appSecret, graphBase } =
  config.meta;

function endpoint() {
  return `${graphBase}/${apiVersion}/${phoneNumberId}/messages`;
}

/* Normalise an Indian/free-form number to E.164 digits (no +). Meta wants
   the country code with no plus and no spaces, e.g. 919876543210. */
function normalize(to) {
  let n = String(to || '').replace(/[^\d]/g, '');
  if (n.length === 10) n = '91' + n; // default to India if a bare 10-digit
  return n;
}

async function post(payload) {
  const resp = await fetch(endpoint(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (json && json.error && json.error.message) || `HTTP ${resp.status}`;
    const err = new Error(msg);
    err.raw = json;
    throw err;
  }
  const id = json.messages && json.messages[0] && json.messages[0].id;
  return { id, status: 'sent', provider: 'meta', raw: json };
}

async function sendText({ to, body }) {
  return post({
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalize(to),
    type: 'text',
    text: { preview_url: false, body: String(body || '') }
  });
}

async function sendTemplate({ to, template, language = 'en', components }) {
  return post({
    messaging_product: 'whatsapp',
    to: normalize(to),
    type: 'template',
    template: {
      name: template,
      language: { code: language },
      ...(components ? { components } : {})
    }
  });
}

/* GET webhook verification handshake. */
function verifyWebhook({ mode, token, challenge }) {
  if (mode === 'subscribe' && token === verifyToken) return challenge;
  return null;
}

/* Validate X-Hub-Signature-256 header (optional, needs appSecret). */
function verifySignature(rawBody, signatureHeader) {
  if (!appSecret) return true; // not configured -> skip
  if (!signatureHeader) return false;
  const expected =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signatureHeader)
    );
  } catch {
    return false;
  }
}

/* Flatten Meta's nested webhook payload into simple message/status records. */
function parseWebhook(body) {
  const out = { messages: [], statuses: [] };
  const entries = (body && body.entry) || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const v = change.value || {};
      const contacts = v.contacts || [];
      const profileName =
        contacts[0] && contacts[0].profile && contacts[0].profile.name;
      for (const m of v.messages || []) {
        out.messages.push({
          channel: 'whatsapp',
          direction: 'in',
          provider: 'meta',
          messageId: m.id,
          from: m.from,
          name: profileName || null,
          type: m.type,
          text:
            (m.text && m.text.body) ||
            (m.button && m.button.text) ||
            (m.interactive &&
              ((m.interactive.button_reply &&
                m.interactive.button_reply.title) ||
                (m.interactive.list_reply &&
                  m.interactive.list_reply.title))) ||
            '',
          timestamp: m.timestamp,
          raw: m
        });
      }
      for (const s of v.statuses || []) {
        out.statuses.push({
          channel: 'whatsapp',
          direction: 'status',
          provider: 'meta',
          messageId: s.id,
          to: s.recipient_id,
          status: s.status, // sent | delivered | read | failed
          timestamp: s.timestamp,
          raw: s
        });
      }
    }
  }
  return out;
}

logger.info('WhatsApp provider: meta (phoneNumberId set:', !!phoneNumberId, ')');

module.exports = {
  name: 'meta',
  sendText,
  sendTemplate,
  verifyWebhook,
  verifySignature,
  parseWebhook,
  normalize
};
