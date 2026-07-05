/* server.js — API serving the seeded Karya Vaani datasets from the file store. */
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const { readStore, writeStore, initDb, dbPut, dbDel } = require('./db');
const { hashPassword, verifyPassword, DEMO_ACCOUNTS } = require('./auth');

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
  // Exclude the big/growing collections from the bundle every client loads —
  // documents are fetched per worker (/api/onboarding-documents) and the
  // communication log via /api/communications.
  // never ship documents (base64), the comms log, or the users table (password
  // hashes) to the browser — those are fetched via their own guarded routes.
  const { onboardingDocuments, communications, users, ...rest } = s.data;
  res.json(rest);
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
/* ── Communication log ─────────────────────────────────────────────────────
   Every email / WhatsApp send (real OR mocked) is appended to
   data.communications so the communication analytics reflect real usage,
   persisted like the rest of the store (Postgres). Capped to the last 2000. */
function logComm(entry) {
  const store = readStore();
  if (!store || !store.data) return;
  store.data.communications = store.data.communications || [];
  const rec = Object.assign(
    { id: 'cm_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: new Date().toISOString() },
    entry
  );
  store.data.communications.push(rec);
  dbPut('communications', rec.id, rec);
  if (store.data.communications.length > 2000) {
    const removed = store.data.communications.shift();
    if (removed && removed.id) dbDel('communications', removed.id);
  }
}

app.post('/api/send-email', async (req, res) => {
  const { to, cc, subject, message, attachments = [] } = req.body || {};
  if (!to || !subject || !message) {
    return res.status(400).json({ ok: false, error: 'to, subject and message are required' });
  }
  const recipients = Array.isArray(to) ? to : [to];

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

  // contentType is per-attachment so non-audio payloads (e.g. appointment-order
  // PDFs) attach correctly; older callers that omit it keep the WAV default.
  const mailAttachments = attachments.map(a => ({
    filename: a.filename,
    content:  Buffer.from(a.data, 'base64'),
    contentType: a.contentType || 'audio/wav'
  }));

  try {
    await transporter.sendMail({
      from:        process.env.EMAIL_HOST_USER,
      to:          Array.isArray(to) ? to.join(', ') : to,
      cc:          cc ? (Array.isArray(cc) ? cc.join(', ') : cc) : undefined,
      subject,
      text:        message,
      attachments: mailAttachments
    });
    logComm({ channel: 'email', to: recipients, recipients: recipients.length, subject: subject, preview: String(message).slice(0, 140), attachments: mailAttachments.length, status: 'sent' });
    res.json({ ok: true });
  } catch (err) {
    console.error('send-email error:', err.message);
    logComm({ channel: 'email', to: recipients, recipients: recipients.length, subject: subject, attachments: mailAttachments.length, status: 'failed', error: err.message });
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── Appointment orders ────────────────────────────────────────────────────
   Persisted in the same file-backed store under data.appointmentOrders, so
   saved drafts and generated orders survive reloads and ship via /api/bootstrap.
   POST   /api/appointment-orders        save (draft|final) → { ok, order }
   GET    /api/appointment-orders        list all → { ok, orders }
   GET    /api/appointment-orders/:id    fetch one → { ok, order }
   DELETE /api/appointment-orders/:id    remove one → { ok }
   ──────────────────────────────────────────────────────────────────────── */

/* Generate a human-friendly reference number: AO/<FY>/<zero-padded seq>. */
function nextOrderRef(existing) {
  const now = new Date();
  // Indian financial year (Apr–Mar), e.g. 2026-27.
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  const fy = `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  const seq = String((existing ? existing.length : 0) + 1).padStart(4, '0');
  return `AO/${fy}/${seq}`;
}

app.post('/api/appointment-orders', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });

  const payload = req.body || {};
  if (!payload.name) {
    return res.status(400).json({ ok: false, error: 'employee name is required' });
  }
  // Privacy gate: never persist an Aadhaar number without explicit consent.
  if (!payload.aadhaarConsent) payload.aadhaar = '';

  store.data.appointmentOrders = store.data.appointmentOrders || [];
  const orders = store.data.appointmentOrders;
  const nowIso = new Date().toISOString();

  let order;
  if (payload.id) {
    // Update an existing draft/order in place.
    const idx = orders.findIndex(o => o.id === payload.id);
    if (idx === -1) return res.status(404).json({ ok: false, error: 'order not found' });
    order = { ...orders[idx], ...payload, updatedAt: nowIso };
    orders[idx] = order;
  } else {
    order = {
      ...payload,
      id: 'ao_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      refNo: payload.refNo || nextOrderRef(orders),
      status: payload.status || 'draft',
      createdAt: nowIso,
      updatedAt: nowIso
    };
    orders.push(order);
  }

  try {
    dbPut('appointmentOrders', order.id, order);
    res.json({ ok: true, order });
  } catch (err) {
    console.error('appointment-order save error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/appointment-orders', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  res.json({ ok: true, orders: store.data.appointmentOrders || [] });
});

app.get('/api/appointment-orders/:id', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  const order = (store.data.appointmentOrders || []).find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ ok: false, error: 'order not found' });
  res.json({ ok: true, order });
});

app.delete('/api/appointment-orders/:id', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  const orders = store.data.appointmentOrders || [];
  const idx = orders.findIndex(o => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'order not found' });
  orders.splice(idx, 1);
  store.data.appointmentOrders = orders;
  try {
    dbDel('appointmentOrders', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('appointment-order delete error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── Labour Code readiness surveys ─────────────────────────────────────────
   Each completed survey is appended to data.readinessSurveys with the date it
   was taken and the score on that day, so readiness can be tracked day-by-day /
   month-by-month in the Analytics hub.
   POST /api/readiness-surveys   save a result → { ok, survey }
   GET  /api/readiness-surveys   list (oldest→newest) → { ok, surveys }
   ──────────────────────────────────────────────────────────────────────── */
app.post('/api/readiness-surveys', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });

  const p = req.body || {};
  const score = Number(p.score);
  if (!Number.isFinite(score)) {
    return res.status(400).json({ ok: false, error: 'score is required' });
  }
  store.data.readinessSurveys = store.data.readinessSurveys || [];
  const survey = {
    id: 'rs_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    score: Math.round(score),
    sector: p.sector || null,
    headcount: p.headcount || null,
    contractorRatio: p.contractorRatio || null,
    gaps: Number.isFinite(Number(p.gaps)) ? Number(p.gaps) : null,
    benchmarkAvg: Number.isFinite(Number(p.benchmarkAvg)) ? Number(p.benchmarkAvg) : null,
    benchmarkTop: Number.isFinite(Number(p.benchmarkTop)) ? Number(p.benchmarkTop) : null,
    takenAt: new Date().toISOString()
  };
  store.data.readinessSurveys.push(survey);
  try {
    dbPut('readinessSurveys', survey.id, survey);
    res.json({ ok: true, survey });
  } catch (err) {
    console.error('readiness-survey save error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/readiness-surveys', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  res.json({ ok: true, surveys: store.data.readinessSurveys || [] });
});

/* ── Worker compliance overrides ───────────────────────────────────────────
   Per-worker (OM Manpower roster) state that must persist: Aadhaar eKYC
   verification and the last notification sent. Base compliance is computed
   deterministically on the client from the roster; these overrides are merged
   on top (e.g. a verified Aadhaar flips that item to OK).
   GET  /api/worker-compliance              → { ok, overrides: { code: {...} } }
   POST /api/worker-compliance  { code, ... } merge → { ok, override }
   ──────────────────────────────────────────────────────────────────────── */
app.get('/api/worker-compliance', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  res.json({ ok: true, overrides: store.data.workerCompliance || {} });
});

app.post('/api/worker-compliance', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  const p = req.body || {};
  if (!p.code) return res.status(400).json({ ok: false, error: 'worker code is required' });

  store.data.workerCompliance = store.data.workerCompliance || {};
  const prev = store.data.workerCompliance[p.code] || {};
  const merged = { ...prev };
  if (typeof p.aadhaarVerified === 'boolean') merged.aadhaarVerified = p.aadhaarVerified;
  if (p.aadhaarLast4) merged.aadhaarLast4 = String(p.aadhaarLast4).slice(-4);
  if (p.notifiedAt) merged.notifiedAt = p.notifiedAt;
  if (Array.isArray(p.channels)) merged.channels = p.channels;
  merged.updatedAt = new Date().toISOString();
  store.data.workerCompliance[p.code] = merged;
  try {
    dbPut('workerCompliance', p.code, merged);
    res.json({ ok: true, override: merged });
  } catch (err) {
    console.error('worker-compliance save error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── Onboarding captures ───────────────────────────────────────────────────
   Persists every onboarding profile captured in the Onboarding module, so the
   full details (personal, employment, PPE, Aadhaar-verification status) survive
   reloads and surface in the drilldown with compliance checks. Aadhaar is
   privacy-gated — only the last 4 digits + a verified flag are stored.
   POST /api/onboarding-captures   save → { ok, capture }
   GET  /api/onboarding-captures   list → { ok, captures }
   ──────────────────────────────────────────────────────────────────────── */
app.post('/api/onboarding-captures', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  const p = req.body || {};
  if (!p.name) return res.status(400).json({ ok: false, error: 'name is required' });

  // privacy: never persist the full Aadhaar — keep only last-4 + verified flag
  const aadhaarLast4 = p.aadhaar ? String(p.aadhaar).replace(/\D/g, '').slice(-4) : (p.aadhaarLast4 || null);
  delete p.aadhaar;

  store.data.onboardingCaptures = store.data.onboardingCaptures || [];
  const list = store.data.onboardingCaptures;

  // Reject duplicate mobile / WhatsApp numbers — one number, one worker. Compare
  // on the last 10 digits so formatting differences don't slip a duplicate past.
  if (p.mobile) {
    const md = String(p.mobile).replace(/\D/g, '').slice(-10);
    if (md.length === 10) {
      const clash = list.find(c => c.id !== p.id && c.mobile &&
        String(c.mobile).replace(/\D/g, '').slice(-10) === md);
      if (clash) {
        return res.status(409).json({
          ok: false, code: 'DUP_MOBILE',
          error: 'This mobile / WhatsApp number is already onboarded to ' + clash.name + ' (' + clash.id + '). Numbers must be unique.'
        });
      }
    }
  }

  const nowIso = new Date().toISOString();
  // Upsert by id: the frontend supplies its own worker id (WRK-/CWK-…). If it
  // already exists, update in place; otherwise create it (with the given id, or
  // a generated one if none was supplied). This is what persists onboarding.
  let capture;
  const idx = p.id ? list.findIndex(c => c.id === p.id) : -1;
  if (idx !== -1) {
    capture = { ...list[idx], ...p, aadhaarLast4: aadhaarLast4, updatedAt: nowIso };
    list[idx] = capture;
  } else {
    capture = {
      ...p,
      id: p.id || ('ob_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)),
      aadhaarLast4: aadhaarLast4,
      status: p.status || 'sent',
      createdAt: nowIso,
      updatedAt: nowIso
    };
    list.push(capture);
  }
  try {
    dbPut('onboardingCaptures', capture.id, capture);
    res.json({ ok: true, capture });
  } catch (err) {
    console.error('onboarding-capture save error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/onboarding-captures', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  res.json({ ok: true, captures: store.data.onboardingCaptures || [] });
});

app.delete('/api/onboarding-captures/:id', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  const list = store.data.onboardingCaptures || [];
  const idx = list.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'capture not found' });
  list.splice(idx, 1);
  store.data.onboardingCaptures = list;
  try {
    dbDel('onboardingCaptures', req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('onboarding-capture delete error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ── Onboarding documents ──────────────────────────────────────────────────
   Per-worker uploaded documents (PAN, bank proof, education, prior employment,
   …) stored as data-URLs keyed by worker id, so they can be retrieved and
   viewed later from the worker drilldown. Kept OUT of /api/bootstrap (fetched on
   demand) so the base64 blobs are not shipped to every client.
   POST   /api/onboarding-documents              { workerId, name, docType, dataUrl } → { ok, doc }
   GET    /api/onboarding-documents/:workerId     → { ok, documents }
   DELETE /api/onboarding-documents/:workerId/:docId → { ok }
   ──────────────────────────────────────────────────────────────────────── */
app.post('/api/onboarding-documents', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  const { workerId, name, docType, dataUrl } = req.body || {};
  if (!workerId || !dataUrl) return res.status(400).json({ ok: false, error: 'workerId and dataUrl are required' });
  if (String(dataUrl).length > 5 * 1024 * 1024) return res.status(413).json({ ok: false, error: 'document too large (max ~3.5MB)' });

  store.data.onboardingDocuments = store.data.onboardingDocuments || {};
  const list = store.data.onboardingDocuments[workerId] = store.data.onboardingDocuments[workerId] || [];
  const doc = {
    id: 'doc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: name || 'document', docType: docType || 'Other', dataUrl: dataUrl,
    uploadedAt: new Date().toISOString()
  };
  list.push(doc);
  try {
    dbPut('onboardingDocuments', workerId, list);
    res.json({ ok: true, doc: doc });
  } catch (err) {
    console.error('onboarding-document save error:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/onboarding-documents/:workerId', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  const docs = (store.data.onboardingDocuments || {})[req.params.workerId] || [];
  res.json({ ok: true, documents: docs });
});

app.delete('/api/onboarding-documents/:workerId/:docId', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  const map = store.data.onboardingDocuments || {};
  const list = map[req.params.workerId] || [];
  const idx = list.findIndex(d => d.id === req.params.docId);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'document not found' });
  list.splice(idx, 1);
  map[req.params.workerId] = list;
  store.data.onboardingDocuments = map;
  try {
    dbPut('onboardingDocuments', req.params.workerId, list);
    res.json({ ok: true });
  } catch (err) {
    console.error('onboarding-document delete error:', err.message);
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

/* ISO-639-1 / short code → NLLB tag used by the FastAPI translation service */
const NLLB_MAP = {
  EN: 'eng_Latn', TA: 'tam_Taml', HI: 'hin_Deva', TE: 'tel_Telu',
  KN: 'kan_Knda', ML: 'mal_Mlym', BN: 'ben_Beng', GU: 'guj_Gujr',
  MR: 'mar_Deva', PA: 'pan_Guru', UR: 'urd_Arab', OR: 'ory_Orya',
  AS: 'asm_Beng', NE: 'npi_Deva', SA: 'san_Deva',
};
const toNllb = (code) => NLLB_MAP[String(code).toUpperCase()] || code;

app.post('/api/translate', async (req, res) => {
  const { text, source, target, targets } = req.body || {};
  // Accept either frontend-style { text, targets: ["TE","HI"] }
  // or legacy { text, source, target } for single-target callers.
  const toTargets = Array.isArray(targets) && targets.length ? targets : (target ? [target] : null);
  if (!text || !toTargets) {
    return res.status(400).json({ success: false, error: 'text and targets (or target) are required' });
  }
  try {
    // The upstream FastAPI requires { text, source, target } — all required, target is a single
    // string (not an array). Fan out one request per target language and aggregate.
    const src = toNllb(source || 'eng_Latn');
    const results = await Promise.all(
      toTargets.map(async (tgt) => {
        const nllbTgt = toNllb(tgt);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 600_000); // 10 min hard cap
        let resp;
        try {
          resp = await fetch(TRANSLATE_API_URL + '/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, source: src, target: nllbTgt }),
            signal: controller.signal
          });
        } finally {
          clearTimeout(timer);
        }
        const body = await resp.text();
        let json;
        try { json = body ? JSON.parse(body) : {}; } catch { json = { raw: body }; }
        return { target: tgt, httpStatus: resp.status, ...json };
      })
    );
    // Single-target callers get the original flat response shape for backward compat.
    if (toTargets.length === 1) {
      const { httpStatus, ...data } = results[0];
      return res.status(httpStatus).json(data);
    }
    res.json({ results });
  } catch (err) {
    console.error('translate error:', err.message);
    res.status(502).json({ success: false, error: 'translation service unreachable: ' + err.message });
  }
});

/* ── VAANI voice (TTS) proxy ───────────────────────────────────────────────
   POST /api/tts   Body: { text }  → audio/wav bytes
   Forwards to the MMS-TTS voice service. Proxying server-side keeps the service
   address off the client and avoids browser mixed-content (https page → http
   service) / CORS issues, mirroring the translation proxy. The model takes the
   already-translated text and returns synthesised speech for it.

   Configure via env:
     TTS_API_URL   default http://4.247.160.91:64574
   ──────────────────────────────────────────────────────────────────────── */
const TTS_API_URL = (process.env.TTS_API_URL || 'http://4.247.160.91:64574').replace(/\/$/, '');

app.post('/api/tts', async (req, res) => {
  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({ ok: false, error: 'text is required' });
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600000); // 10 min hard cap
  try {
    const resp = await fetch(TTS_API_URL + '/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal
    });
    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      return res.status(resp.status).json({ ok: false, error: 'tts service ' + resp.status + (detail ? ': ' + detail.slice(0, 200) : '') });
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    res.set('Content-Type', resp.headers.get('content-type') || 'audio/wav');
    res.send(buf);
  } catch (err) {
    console.error('tts error:', err.message);
    res.status(502).json({ ok: false, error: 'tts service unreachable: ' + err.message });
  } finally {
    clearTimeout(timer);
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

/* classify a comms-server result into sent / mock / failed for the log */
function waStatus(json) {
  if (!json || json.ok === false) return 'failed';
  if (json.testMode || json.provider === 'mock') return 'mock';
  return 'sent';
}

/* send a free-form text message to one or many recipients */
app.post('/api/whatsapp/send', async (req, res) => {
  const body = req.body || {};
  const recips = Array.isArray(body.to) ? body.to : (body.to ? [body.to] : []);
  try {
    const { status, json } = await commsFetch('/v1/whatsapp/send', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    logComm({ channel: 'whatsapp', kind: 'message', to: recips, recipients: recips.length, preview: String(body.message || '').slice(0, 140), status: waStatus(json), provider: json && json.provider });
    res.status(status).json(json);
  } catch (err) {
    logComm({ channel: 'whatsapp', kind: 'message', to: recips, recipients: recips.length, preview: String(body.message || '').slice(0, 140), status: 'failed', error: err.message });
    res.status(502).json({ ok: false, error: 'comms server unreachable: ' + err.message });
  }
});

/* send an approved template message */
app.post('/api/whatsapp/send-template', async (req, res) => {
  const body = req.body || {};
  const recips = Array.isArray(body.to) ? body.to : (body.to ? [body.to] : []);
  try {
    const { status, json } = await commsFetch('/v1/whatsapp/send-template', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    logComm({ channel: 'whatsapp', kind: 'template', to: recips, recipients: recips.length, template: body.template, status: waStatus(json), provider: json && json.provider });
    res.status(status).json(json);
  } catch (err) {
    logComm({ channel: 'whatsapp', kind: 'template', to: recips, recipients: recips.length, template: body.template, status: 'failed', error: err.message });
    res.status(502).json({ ok: false, error: 'comms server unreachable: ' + err.message });
  }
});

/* the logged communication history (drives the communication analytics) */
app.get('/api/communications', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  res.json({ ok: true, communications: store.data.communications || [] });
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

/* ── Role-based login ──────────────────────────────────────────────────────
   Three demo accounts (HR/site manager · contractor · worker). Seeded into the
   `users` collection on boot, with each non-admin account linked to a real
   entity (a worker for the labourer, a contractor firm for the vendor) so their
   home page shows genuine data. Passwords are scrypt-hashed; never stored plain.
   ──────────────────────────────────────────────────────────────────────── */
function publicUser(u) {
  if (!u) return null;
  return {
    username: u.username, role: u.role, name: u.name, title: u.title,
    linkedType: u.linkedType, linkedId: u.linkedId || '', linkedName: u.linkedName || ''
  };
}

/* Create the demo accounts if none exist yet (idempotent, runs each boot). */
function ensureDemoUsers() {
  const store = readStore();
  if (!store || !store.data) return;
  store.data.users = store.data.users || [];
  if (store.data.users.length) return; // already seeded

  const worker = (store.data.chatContacts || [])[0] || (store.data.broadcastWorkers || [])[0] || null;
  const firm   = (store.data.contractors || [])[0] || null;
  const nowIso = new Date().toISOString();

  DEMO_ACCOUNTS.forEach((a) => {
    const u = {
      username: a.username, role: a.role, title: a.title,
      name: a.name, linkedType: a.linkedType, linkedId: '', linkedName: '',
      passwordHash: hashPassword(a.password), createdAt: nowIso
    };
    if (a.linkedType === 'employee' && worker) {
      u.linkedId = worker.id; u.linkedName = worker.name; u.name = worker.name;
    } else if (a.linkedType === 'contractor' && firm) {
      u.linkedId = firm.id; u.linkedName = firm.name; u.name = firm.name;
    }
    store.data.users.push(u);
    dbPut('users', u.username, u);
  });
  console.log('[auth] Seeded demo accounts: ' + DEMO_ACCOUNTS.map((a) => a.username).join(', '));
}

app.post('/api/login', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting — try again in a moment.' });
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ ok: false, error: 'Username and password are required.' });
  const u = (store.data.users || []).find((x) => x.username.toLowerCase() === String(username).trim().toLowerCase());
  if (!u || !verifyPassword(password, u.passwordHash)) {
    return res.status(401).json({ ok: false, error: 'Invalid username or password.' });
  }
  res.json({ ok: true, user: publicUser(u) });
});

const PORT = process.env.PORT || 4000;
/* Connect to Postgres and warm the store cache (creates the table + migrates
   the file store on first run) before accepting requests. Falls back to the
   file store inside initDb() if the DB is unreachable, so this never blocks boot. */
Promise.resolve(initDb())
  .then(() => { try { ensureDemoUsers(); } catch (e) { console.error('[auth] demo user seed failed:', e.message); } })
  .catch((err) => console.error('Store init error:', err.message))
  .finally(() => {
    app.listen(PORT, () => console.log(`Karya Vaani backend listening on http://localhost:${PORT}`));
  });
