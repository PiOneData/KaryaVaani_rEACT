/* server.js — API serving the seeded Karya Vaani datasets from the file store. */
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { readStore } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

/* Gracefully handle malformed JSON bodies. Without this, body-parser's
   SyntaxError bubbles up to Express's default handler and dumps a full stack
   trace to the logs on every bad request. Instead, return a clean 400 and log
   a single line identifying the caller so the source can be traced. */
app.use((err, req, res, next) => {
  if (err && (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && 'body' in err))) {
    console.warn(`Malformed JSON body — ${req.method} ${req.originalUrl} from ${req.ip} (${err.message})`);
    return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
  }
  return next(err);
});

app.get('/api/health', (req, res) => {
  const s = readStore();
  res.json({ ok: !!s, seededAt: s ? s.seededAt : null, counts: s ? s.counts : null, sources: s ? s.sources : null });
});

/* full dataset bundle the frontend loads once at startup */
app.get('/api/bootstrap', (req, res) => {
  const s = readStore();
  if (!s) return res.status(503).json({ error: 'Not seeded. Run `npm run seed` first.' });
  res.json(s.data);
});

/* kept for compatibility — the OM roster card */
app.get('/api/om-mapping', (req, res) => {
  const s = readStore();
  if (!s) return res.status(503).json({ error: 'Not seeded. Run `npm run seed` first.' });
  res.json(s.data.omMapping || []);
});



/* ── VAANI mailer ─────────────────────────────────────────────────────────
   POST /api/send-email
   Body: { to: string[], subject: string, message: string, attachments: [{filename, data}] }
   ──────────────────────────────────────────────────────────────────────── */
app.post('/api/send-email', async (req, res) => {
  const { to, subject, message, attachments = [] } = req.body || {};
  if (!to || !subject || !message) {
    return res.status(400).json({ ok: false, error: 'to, subject and message are required' });
  }

  const transporter = nodemailer.createTransport({
    host:   process.env.MAIL_HOST  || 'smtp.office365.com',
    port:   parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: false,
    auth: {
      user: process.env.EMAIL_HOST_USER,
      pass: process.env.EMAIL_HOST_PASSWORD
    },
    tls: { ciphers: 'SSLv3' }
  });

  const mailAttachments = attachments.map(a => ({
    filename: a.filename,
    content:  Buffer.from(a.data, 'base64'),
    contentType: 'audio/wav'
  }));

  try {
    await transporter.sendMail({
      from:        process.env.EMAIL_HOST_USER,
      to:          Array.isArray(to) ? to.join(', ') : to,
      subject,
      text:        message,
      attachments: mailAttachments
    });
    res.json({ ok: true });
  } catch (err) {
    console.error('send-email error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── VAANI translation proxy ──────────────────────────────────────────────
   POST /api/translate
   Body: { text, source, target }  — NLLB-style codes, e.g. eng_Latn → tam_Taml
   Forwards to the VAANI translation service (FastAPI). Proxying server-side
   keeps the service address off the client and avoids browser mixed-content /
   CORS issues, mirroring the WhatsApp gateway and mailer endpoints.

   Configure via env:
     TRANSLATE_API_URL   default http://4.247.160.91:64573
   ──────────────────────────────────────────────────────────────────────── */
const TRANSLATE_API_URL = (process.env.TRANSLATE_API_URL || 'http://4.247.160.91:64573').replace(/\/$/, '');

app.post('/api/translate', async (req, res) => {
  const { text, source, target } = req.body || {};
  if (!text || !source || !target) {
    return res.status(400).json({ success: false, error: 'text, source and target are required' });
  }
  try {
    const resp = await fetch(TRANSLATE_API_URL + '/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source, target })
    });
    const body = await resp.text();
    let json;
    try { json = body ? JSON.parse(body) : {}; } catch { json = { raw: body }; }
    res.status(resp.status).json(json);
  } catch (err) {
    console.error('translate error:', err.message);
    res.status(502).json({ success: false, error: 'translation service unreachable: ' + err.message });
  }
});

/* --- WhatsApp gateway proxy -----------------------------------------------
   The browser never talks to the comms server directly -- it calls these
   endpoints, which forward to the standalone communication server using the
   server-side API key. This keeps the WhatsApp credentials/secret off the
   client and lets the comms server be shared by other applications too.

   Configure via env:
     COMMS_BASE_URL   default http://localhost:4100  (in Docker: http://comms-server:4100)
     COMMS_API_KEY    shared secret matching the comms server
   ------------------------------------------------------------------------- */
const COMMS_BASE_URL = (process.env.COMMS_BASE_URL || 'http://localhost:4100').replace(/\/$/, '');
const COMMS_API_KEY = process.env.COMMS_API_KEY || '';

async function commsFetch(path, options = {}) {
  const headers = Object.assign(
    { 'Content-Type': 'application/json' },
    COMMS_API_KEY ? { 'x-api-key': COMMS_API_KEY } : {},
    options.headers || {}
  );
  const resp = await fetch(COMMS_BASE_URL + path, { ...options, headers });
  const text = await resp.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { status: resp.status, json };
}

/* health passthrough -- handy to confirm the gateway is reachable */
app.get('/api/whatsapp/health', async (req, res) => {
  try {
    const { status, json } = await commsFetch('/health', { method: 'GET' });
    res.status(status).json(json);
  } catch (err) {
    res.status(502).json({ ok: false, error: 'comms server unreachable: ' + err.message });
  }
});

/* send a free-form text message to one or many recipients */
app.post('/api/whatsapp/send', async (req, res) => {
  try {
    const { status, json } = await commsFetch('/v1/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(req.body || {})
    });
    res.status(status).json(json);
  } catch (err) {
    res.status(502).json({ ok: false, error: 'comms server unreachable: ' + err.message });
  }
});

/* send an approved template message */
app.post('/api/whatsapp/send-template', async (req, res) => {
  try {
    const { status, json } = await commsFetch('/v1/whatsapp/send-template', {
      method: 'POST',
      body: JSON.stringify(req.body || {})
    });
    res.status(status).json(json);
  } catch (err) {
    res.status(502).json({ ok: false, error: 'comms server unreachable: ' + err.message });
  }
});

/* poll the inbound/outbound message log (for the two-way chat surface) */
app.get('/api/whatsapp/messages', async (req, res) => {
  try {
    const qs = new URLSearchParams(req.query).toString();
    const { status, json } = await commsFetch('/v1/whatsapp/messages' + (qs ? '?' + qs : ''), {
      method: 'GET'
    });
    res.status(status).json(json);
  } catch (err) {
    res.status(502).json({ ok: false, error: 'comms server unreachable: ' + err.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Karya Vaani backend listening on http://localhost:${PORT}`));
