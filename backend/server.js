/* server.js — API serving the seeded Karya Vaani datasets from the file store. */
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
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
  // never ship documents / voice audio (base64), the comms log, the users table
  // (password hashes), or the per-week transport roster/attendance to the
  // browser — those are fetched via their own routes.
  const { onboardingDocuments, communications, users, voiceCache,
          transportRoster, transportAttendance, nightConsents, ...rest } = s.data;
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
const VOICE_CACHE_MAX = parseInt(process.env.VOICE_CACHE_MAX || '600', 10);

function ttsHash(text) { return crypto.createHash('sha256').update(String(text)).digest('hex'); }
function voiceCacheGet(hash) {
  const s = readStore();
  const list = (s && s.data && s.data.voiceCache) || [];
  return list.find((v) => v.hash === hash) || null;
}
function voiceCachePut(hash, buf, contentType) {
  const s = readStore();
  if (!s || !s.data) return;
  s.data.voiceCache = s.data.voiceCache || [];
  const rec = { hash, audio: buf.toString('base64'), contentType: contentType || 'audio/wav', bytes: buf.length, createdAt: new Date().toISOString() };
  s.data.voiceCache.push(rec);
  dbPut('voiceCache', hash, rec);
  // evict oldest beyond the cap so the cache can't grow without bound
  while (s.data.voiceCache.length > VOICE_CACHE_MAX) {
    const old = s.data.voiceCache.shift();
    if (old && old.hash) dbDel('voiceCache', old.hash);
  }
}

/* POST /api/tts  { text }  → audio/wav bytes.
   Voice synthesis is slow (single-worker model), and a given (already-translated)
   text always yields the same audio — so the result is cached persistently by a
   hash of the text. A cache hit returns the stored WAV immediately with no call
   to the voice service; a miss synthesises once and stores it. Header
   X-KV-Cache: hit|miss lets the client tell them apart. */
app.post('/api/tts', async (req, res) => {
  const { text } = req.body || {};
  if (!text) {
    return res.status(400).json({ ok: false, error: 'text is required' });
  }
  const hash = ttsHash(text);
  const hit = voiceCacheGet(hash);
  if (hit && hit.audio) {
    res.set('Content-Type', hit.contentType || 'audio/wav');
    res.set('X-KV-Cache', 'hit');
    return res.send(Buffer.from(hit.audio, 'base64'));
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
    const contentType = resp.headers.get('content-type') || 'audio/wav';
    try { voiceCachePut(hash, buf, contentType); } catch (e) { console.error('voice cache store failed:', e.message); }
    res.set('Content-Type', contentType);
    res.set('X-KV-Cache', 'miss');
    res.send(buf);
  } catch (err) {
    console.error('tts error:', err.message);
    res.status(502).json({ ok: false, error: 'tts service unreachable: ' + err.message });
  } finally {
    clearTimeout(timer);
  }
});

/* Lightweight cache status — how many voices are stored (for the pre-generate UI). */
app.get('/api/tts/cache-status', (req, res) => {
  const s = readStore();
  const list = (s && s.data && s.data.voiceCache) || [];
  res.json({ ok: true, count: list.length, max: VOICE_CACHE_MAX });
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

/* ── Transport: weekly roster · targeted batch comms · ID-card attendance ────
   Employees are batched by route (derived from their home locality) for a given
   week and shift. Transport communications go to the specific route batch — not
   a broadcast to everyone. Attendance is captured per trip; the live feed will
   come from the ID-card provider's API (access pending) — until then a scan can
   be simulated so the workflow is complete end to end.
   ──────────────────────────────────────────────────────────────────────── */
const IDCARD_API_URL = process.env.IDCARD_API_URL || ''; // set when the provider API is live

/* GET the published roster for a week (or null). */
app.get('/api/transport/roster/:week', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting.' });
  const roster = (store.data.transportRoster || {})[req.params.week] || null;
  res.json({ ok: true, week: req.params.week, roster });
});

/* Publish/replace the roster for a week. Body: { week, assignments:[...], generatedBy }.
   Each assignment: { code, name, dept, locality, route, routeName, pickup, shift, mobile }. */
app.post('/api/transport/roster', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting.' });
  const { week, assignments, generatedBy } = req.body || {};
  if (!week || !Array.isArray(assignments)) return res.status(400).json({ ok: false, error: 'week and assignments[] are required.' });
  store.data.transportRoster = store.data.transportRoster || {};
  const rec = { week, generatedBy: generatedBy || 'HR', generatedAt: new Date().toISOString(), count: assignments.length, assignments };
  store.data.transportRoster[week] = rec;
  dbPut('transportRoster', week, rec);
  res.json({ ok: true, week, count: assignments.length });
});

/* Send a transport communication to ONE route's batch (targeted, not everyone).
   Logs the send to the comms trail so analytics reflect the targeted delivery.
   Body: { week, route, routeName, shift, channel, recipients:[{name,mobile}], message } */
app.post('/api/transport/notify', (req, res) => {
  const { week, route, routeName, shift, channel, recipients, message, subject } = req.body || {};
  if (!route || !Array.isArray(recipients) || !recipients.length) {
    return res.status(400).json({ ok: false, error: 'route and recipients[] are required.' });
  }
  const ch = channel === 'email' ? 'email' : 'whatsapp';
  const to = recipients.slice(0, 50).map((r) => r.mobile || r.name).filter(Boolean);
  logComm({
    channel: ch, to, recipients: recipients.length,
    subject: subject || ('Transport · ' + (routeName || route) + ' · ' + (shift || '') + ' shift'),
    preview: String(message || '').slice(0, 140),
    status: 'mock', targeted: true, route, routeName, shift, week
  });
  res.json({ ok: true, channel: ch, route, shift, delivered: recipients.length });
});

/* Deterministic boarding simulation for the pending ID-card feed. */
function simulateBoarded(code, date) {
  const n = parseInt(crypto.createHash('md5').update(String(code) + '|' + String(date)).digest('hex').slice(0, 8), 16);
  return (n % 100) < 88; // ~88% board on any given day
}

/* Record attendance for a trip. With the ID-card provider API live this would be
   fed by their scan webhook; until then pass { simulate:true } to generate a
   realistic boarded/absent split from the batch. Body:
   { week, date, route, shift, codes:[...] , simulate } or { records:[{code,boarded}] } */
app.post('/api/transport/attendance/scan', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting.' });
  const { week, date, route, shift, codes, records, simulate } = req.body || {};
  if (!date || !route || !shift) return res.status(400).json({ ok: false, error: 'date, route and shift are required.' });
  const nowIso = new Date().toISOString();
  let recs;
  if (Array.isArray(records)) {
    recs = records.map((r) => ({ code: r.code, name: r.name, boarded: !!r.boarded, at: r.boarded ? nowIso : null }));
  } else if (simulate && Array.isArray(codes)) {
    recs = codes.map((c) => {
      const code = c.code || c;
      const boarded = simulateBoarded(code, date);
      return { code, name: c.name, boarded, at: boarded ? nowIso : null };
    });
  } else {
    return res.status(400).json({ ok: false, error: 'Provide records[] or simulate:true with codes[].' });
  }
  const key = [week || '', date, route, shift].join('|');
  const boarded = recs.filter((r) => r.boarded).length;
  const rec = { key, week, date, route, shift, source: IDCARD_API_URL ? 'id-card-api' : 'simulated', scannedAt: nowIso, total: recs.length, boarded, records: recs };
  store.data.transportAttendance = store.data.transportAttendance || {};
  store.data.transportAttendance[key] = rec;
  dbPut('transportAttendance', key, rec);
  res.json({ ok: true, key, total: recs.length, boarded, absent: recs.length - boarded, source: rec.source });
});

/* GET all attendance rows for a week+date (across routes/shifts). */
app.get('/api/transport/attendance/:week/:date', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting.' });
  const all = store.data.transportAttendance || {};
  const prefix = (req.params.week || '') + '|' + req.params.date + '|';
  const rows = Object.keys(all).filter((k) => k.indexOf(prefix) === 0).map((k) => all[k]);
  res.json({ ok: true, week: req.params.week, date: req.params.date, rows, idcardApiLive: !!IDCARD_API_URL });
});

/* ── Night-shift transport consent (OSHC Rule 83) ───────────────────────────
   Women (and any worker) rostered for night transport must have consented.
   Consent is captured at onboarding or collected by the transport operator;
   stored per worker code as the single source of truth, surfaced on the board
   and in the employee detail. */
app.get('/api/transport/consents', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting.' });
  res.json({ ok: true, consents: store.data.nightConsents || {} });
});
app.post('/api/transport/consent', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting.' });
  const { code, name, consented, method, by } = req.body || {};
  if (!code) return res.status(400).json({ ok: false, error: 'worker code is required.' });
  store.data.nightConsents = store.data.nightConsents || {};
  const rec = {
    code: String(code), name: name || '', consented: !!consented,
    method: method || 'operator', by: by || 'HR', at: new Date().toISOString()
  };
  store.data.nightConsents[String(code)] = rec;
  dbPut('nightConsents', String(code), rec);
  res.json({ ok: true, consent: rec });
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
    username: u.username, role: u.role, name: u.name, title: u.title, email: u.email || '',
    linkedType: u.linkedType, linkedId: u.linkedId || '', linkedName: u.linkedName || ''
  };
}

/* Create the demo accounts if missing (idempotent). Also backfills the email
   field onto already-seeded accounts without touching their password. */
function ensureDemoUsers() {
  const store = readStore();
  if (!store || !store.data) return;
  store.data.users = store.data.users || [];
  const byName = {};
  store.data.users.forEach((u) => { byName[u.username] = u; });

  const worker = (store.data.chatContacts || [])[0] || (store.data.broadcastWorkers || [])[0] || null;
  const firm   = (store.data.contractors || [])[0] || null;
  const nowIso = new Date().toISOString();
  const seeded = [];

  DEMO_ACCOUNTS.forEach((a) => {
    let u = byName[a.username];
    let touched = false;
    if (!u) {
      u = {
        username: a.username, role: a.role, title: a.title, email: a.email || '',
        name: a.name, linkedType: a.linkedType, linkedId: '', linkedName: '',
        passwordHash: hashPassword(a.password), createdAt: nowIso
      };
      if (a.linkedType === 'employee' && worker) { u.linkedId = worker.id; u.linkedName = worker.name; u.name = worker.name; }
      else if (a.linkedType === 'contractor' && firm) { u.linkedId = firm.id; u.linkedName = firm.name; u.name = firm.name; }
      store.data.users.push(u); byName[a.username] = u; seeded.push(a.username); touched = true;
    }
    if (!u.email && a.email) { u.email = a.email; touched = true; } // backfill for older seeds
    if (touched) dbPut('users', u.username, u);
  });
  if (seeded.length) console.log('[auth] Seeded demo accounts: ' + seeded.join(', '));
}

/* Send a plain-text email via the same Office365 transport as /api/send-email,
   logging it to the comms audit trail. Returns true on send, false on failure. */
function mailerConfigured() { return !!(process.env.EMAIL_HOST_USER && process.env.EMAIL_HOST_PASSWORD); }
async function sendMail(to, subject, message) {
  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || 'smtp.office365.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: false,
    auth: { user: process.env.EMAIL_HOST_USER, pass: process.env.EMAIL_HOST_PASSWORD },
    tls: { ciphers: 'SSLv3' }
  });
  try {
    await transporter.sendMail({ from: process.env.EMAIL_HOST_USER, to, subject, text: message });
    logComm({ channel: 'email', to: [to], recipients: 1, subject, preview: String(message).slice(0, 140), status: 'sent' });
    return true;
  } catch (err) {
    logComm({ channel: 'email', to: [to], recipients: 1, subject, status: 'failed', error: err.message });
    return false;
  }
}

const MIN_PW = 6;
function findUser(store, username) {
  return (store.data.users || []).find((x) => x.username.toLowerCase() === String(username || '').trim().toLowerCase());
}
function persistUser(store, u) {
  const list = store.data.users;
  const idx = list.findIndex((x) => x.username === u.username);
  if (idx !== -1) list[idx] = u;
  dbPut('users', u.username, u);
}

/* Change password for a signed-in user — requires the current password. */
app.post('/api/change-password', async (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting — try again shortly.' });
  const { username, currentPassword, newPassword } = req.body || {};
  if (!username || !currentPassword || !newPassword) return res.status(400).json({ ok: false, error: 'All fields are required.' });
  if (String(newPassword).length < MIN_PW) return res.status(400).json({ ok: false, error: `New password must be at least ${MIN_PW} characters.` });
  const u = findUser(store, username);
  if (!u || !verifyPassword(currentPassword, u.passwordHash)) return res.status(401).json({ ok: false, error: 'Current password is incorrect.' });
  u.passwordHash = hashPassword(newPassword);
  u.updatedAt = new Date().toISOString();
  persistUser(store, u);
  res.json({ ok: true });
});

/* Forgot password — email a short-lived reset code. To avoid account
   enumeration the response is always generic. The code is returned in the
   response ONLY when the mailer is unconfigured (demo/mock mode), so the demo
   remains usable; with real SMTP the code goes solely to the user's inbox. */
app.post('/api/forgot-password', async (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting — try again shortly.' });
  const { username } = req.body || {};
  if (!username) return res.status(400).json({ ok: false, error: 'Enter your username.' });
  const u = findUser(store, username);
  const generic = { ok: true, message: 'If that account exists, a reset code has been sent to its registered email.' };
  if (!u) return res.json(generic);

  const code = String(crypto.randomInt(100000, 1000000)); // 6-digit
  u.resetHash = hashPassword(code);
  u.resetExpires = Date.now() + 15 * 60 * 1000; // 15 minutes
  persistUser(store, u);

  if (u.email) {
    await sendMail(u.email, 'Karya Vaani — your password reset code',
      'Your password reset code is ' + code + '. It expires in 15 minutes. If you did not request this, ignore this email.');
  }
  // demo/mock convenience only
  if (!mailerConfigured()) return res.json({ ...generic, devCode: code, devNote: 'Mailer not configured — code shown for demo only.' });
  return res.json(generic);
});

/* Reset password using the emailed code. */
app.post('/api/reset-password', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting — try again shortly.' });
  const { username, code, newPassword } = req.body || {};
  if (!username || !code || !newPassword) return res.status(400).json({ ok: false, error: 'All fields are required.' });
  if (String(newPassword).length < MIN_PW) return res.status(400).json({ ok: false, error: `New password must be at least ${MIN_PW} characters.` });
  const u = findUser(store, username);
  if (!u || !u.resetHash || !u.resetExpires) return res.status(400).json({ ok: false, error: 'No reset was requested for this account.' });
  if (Date.now() > u.resetExpires) { delete u.resetHash; delete u.resetExpires; persistUser(store, u); return res.status(400).json({ ok: false, error: 'That code has expired. Please request a new one.' }); }
  if (!verifyPassword(code, u.resetHash)) return res.status(401).json({ ok: false, error: 'Incorrect reset code.' });
  u.passwordHash = hashPassword(newPassword);
  delete u.resetHash; delete u.resetExpires;
  u.updatedAt = new Date().toISOString();
  persistUser(store, u);
  res.json({ ok: true });
});

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
