/* providers/mock.js — no-credentials provider.

   Used automatically when Meta credentials are absent so the whole stack
   works end-to-end in development/demo. It logs the message and returns a
   synthetic message id instead of calling WhatsApp. Same interface as meta. */
const config = require('./../config');
const logger = require('./../logger');

function normalize(to) {
  let n = String(to || '').replace(/[^\d]/g, '');
  if (n.length === 10) n = '91' + n;
  return n;
}

function fakeId() {
  return 'mock.' + Math.random().toString(36).slice(2, 12);
}

async function sendText({ to, body }) {
  logger.info(`[mock][whatsapp] -> ${normalize(to)} :: ${String(body || '').slice(0, 80)}`);
  return { id: fakeId(), status: 'sent', provider: 'mock', raw: { to: normalize(to), body } };
}

async function sendTemplate({ to, template, language = 'en', components }) {
  logger.info(`[mock][whatsapp][template:${template}/${language}] -> ${normalize(to)}`);
  return { id: fakeId(), status: 'sent', provider: 'mock', raw: { to: normalize(to), template, language, components } };
}

async function sendAudio({ to, link }) {
  logger.info(`[mock][whatsapp][audio] -> ${normalize(to)} :: ${String(link || '').slice(0, 120)}`);
  return { id: fakeId(), status: 'sent', provider: 'mock', raw: { to: normalize(to), link } };
}

function verifyWebhook({ mode, token, challenge }) {
  if (mode === 'subscribe' && token === config.meta.verifyToken) return challenge;
  return null;
}

function verifySignature() {
  return true;
}

/* Accept either Meta-shaped payloads or a simple { from, text } for testing. */
function parseWebhook(body) {
  if (body && Array.isArray(body.entry)) {
    return require('./meta').parseWebhook(body);
  }
  if (body && body.from) {
    return {
      messages: [
        {
          channel: 'whatsapp',
          direction: 'in',
          provider: 'mock',
          messageId: fakeId(),
          from: normalize(body.from),
          name: body.name || null,
          type: 'text',
          text: body.text || '',
          timestamp: String(Math.floor(Date.now() / 1000)),
          raw: body
        }
      ],
      statuses: []
    };
  }
  return { messages: [], statuses: [] };
}

logger.info('WhatsApp provider: mock (no live credentials — messages are logged, not sent)');

module.exports = {
  name: 'mock',
  sendText,
  sendAudio,
  sendTemplate,
  verifyWebhook,
  verifySignature,
  parseWebhook,
  normalize
};
