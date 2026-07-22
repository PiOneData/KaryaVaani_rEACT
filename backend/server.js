/* server.js — API serving the seeded Karya Vaani datasets from the file store. */
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { readStore, writeStore, initDb, dbPut, dbDel, dbClear } = require('./db');
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
  const { onboardingDocuments, contractorDocuments, communications, users, voiceCache, voiceWarm,
          transportRoster, transportAttendance, nightConsents, transportEvents,
          whatsappMessages, vendorWorkers, ...rest } = s.data;
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
    // Partial updates (verify/induction patches) may omit aadhaar — keep the
    // stored last-4 rather than nulling it when this request didn't carry one.
    const nextLast4 = aadhaarLast4 != null ? aadhaarLast4 : (list[idx].aadhaarLast4 || null);
    capture = { ...list[idx], ...p, aadhaarLast4: nextLast4, updatedAt: nowIso };
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

/* Provision (or fetch) a Karya Vaani worker login for an onboarded employee.
   One login per capture: if one already exists it is returned rather than
   duplicated. Returns the plaintext password once so HR can hand it over. */
app.post('/api/worker-login', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'store not ready' });
  const { captureId, name, mobile, lang } = req.body || {};
  if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
  store.data.users = store.data.users || [];
  const users = store.data.users;
  const existing = captureId ? users.find(u => u.linkedType === 'worker' && u.linkedId === captureId) : null;
  const slug = String(name).trim().toLowerCase().split(/\s+/)[0].replace(/[^a-z0-9]/g, '') || 'worker';
  const tail = String(mobile || '').replace(/\D/g, '').slice(-4) || String(Math.floor(1000 + Math.random() * 9000));
  let username = existing ? existing.username : (slug + tail);
  if (!existing) { let n = 1; while (users.some(u => u.username === username)) { username = slug + tail + '-' + (n++); } }
  const password = 'worker@' + tail;
  const nowIso = new Date().toISOString();
  const user = Object.assign({}, existing || {}, {
    username, role: 'employee', title: 'Worker / Labourer', name: String(name),
    linkedType: 'worker', linkedId: captureId || null, lang: lang || null,
    passwordHash: hashPassword(password), createdAt: existing ? existing.createdAt : nowIso, updatedAt: nowIso
  });
  const idx = users.findIndex(u => u.username === username);
  if (idx >= 0) users[idx] = user; else users.push(user);
  try {
    dbPut('users', username, user);
    res.json({ ok: true, username, password });
  } catch (err) {
    console.error('worker-login error:', err.message);
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

/* ── Contractor (agency) compliance documents ──────────────────────────────
   Agencies upload their statutory documents (CLRA, ESIC, PF, min-wage register,
   migrant cover, safety, WC insurance, service agreement, GST, PAN). Stored per
   contractor id; HR views them under the contractor. `complianceKey` links a doc
   to a compliance subscore so the score can reflect what's on file.
   POST   /api/contractor-documents             { contractorId, name, docType, complianceKey, dataUrl }
   GET    /api/contractor-documents/:contractorId
   DELETE /api/contractor-documents/:contractorId/:docId
   ──────────────────────────────────────────────────────────────────────── */
app.post('/api/contractor-documents', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded.' });
  const { contractorId, name, docType, complianceKey, dataUrl } = req.body || {};
  if (!contractorId || !dataUrl) return res.status(400).json({ ok: false, error: 'contractorId and dataUrl are required' });
  if (String(dataUrl).length > 5 * 1024 * 1024) return res.status(413).json({ ok: false, error: 'document too large (max ~3.5MB)' });
  store.data.contractorDocuments = store.data.contractorDocuments || {};
  const list = store.data.contractorDocuments[contractorId] = store.data.contractorDocuments[contractorId] || [];
  const doc = {
    id: 'ctd_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name: name || 'document', docType: docType || 'Other', complianceKey: complianceKey || null,
    dataUrl: dataUrl, uploadedAt: new Date().toISOString()
  };
  list.push(doc);
  try { dbPut('contractorDocuments', contractorId, list); res.json({ ok: true, doc: doc }); }
  catch (err) { res.status(500).json({ ok: false, error: err.message }); }
});
app.get('/api/contractor-documents/:contractorId', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded.' });
  const docs = (store.data.contractorDocuments || {})[req.params.contractorId] || [];
  res.json({ ok: true, documents: docs });
});
app.delete('/api/contractor-documents/:contractorId/:docId', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded.' });
  const map = store.data.contractorDocuments || {};
  const list = map[req.params.contractorId] || [];
  const idx = list.findIndex(d => d.id === req.params.docId);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'document not found' });
  list.splice(idx, 1);
  map[req.params.contractorId] = list;
  store.data.contractorDocuments = map;
  try { dbPut('contractorDocuments', req.params.contractorId, list); res.json({ ok: true }); }
  catch (err) { res.status(500).json({ ok: false, error: err.message }); }
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

/* ── number / time → English words ─────────────────────────────────────────
   The translation model keeps Latin digits as-is, and the regional TTS then
   won't speak them. Spelling numbers and times out in English BEFORE translation
   means they get translated into the target language and read aloud correctly —
   important for schedules where the times matter. */
const _ONES = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const _TENS = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function numToWords(n) {
  n = parseInt(n, 10); if (isNaN(n)) return '';
  if (n < 0) return 'minus ' + numToWords(-n);
  if (n < 20) return _ONES[n];
  if (n < 100) return _TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + _ONES[n % 10] : '');
  if (n < 1000) return _ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
  if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
  if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
  return String(n);
}
function timeToWords(h, m) {
  h = parseInt(h, 10); m = parseInt(m, 10);
  const period = h < 12 ? 'in the morning' : h < 17 ? 'in the afternoon' : h < 20 ? 'in the evening' : 'at night';
  let h12 = h % 12; if (h12 === 0) h12 = 12;
  const mw = m === 0 ? " o'clock" : (m < 10 ? ' oh ' + numToWords(m) : ' ' + numToWords(m));
  return numToWords(h12) + mw + ' ' + period;
}
function expandNumbers(text) {
  if (!text) return text;
  // times first (HH:MM), so their digits aren't caught by the number rule
  text = String(text).replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g, function (m, h, mn) { return timeToWords(h, mn); });
  // standalone numbers (optionally comma-grouped), not part of a token like "B1"
  text = text.replace(/(?<![A-Za-z0-9])(\d{1,3}(?:,\d{3})+|\d+)(?![A-Za-z0-9])/g, function (m) {
    const n = parseInt(m.replace(/,/g, ''), 10); return isNaN(n) ? m : numToWords(n);
  });
  return text;
}
/* one upstream translate call for a single sentence */
async function upstreamTranslate(text, srcNllb, tgtNllb) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600000);
  try {
    const resp = await fetch(TRANSLATE_API_URL + '/translate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, source: srcNllb, target: tgtNllb }), signal: controller.signal
    });
    const body = await resp.text();
    let json; try { json = body ? JSON.parse(body) : {}; } catch { json = { raw: body }; }
    if (!resp.ok) throw new Error('translate ' + resp.status + (body ? ': ' + body.slice(0, 120) : ''));
    return json.translation || json.translated_text || json.raw || '';
  } finally { clearTimeout(timer); }
}
function splitSentences(text) {
  const parts = String(text).match(/[^.!?।]+[.!?।]*/g);
  return (parts && parts.length) ? parts.map((s) => s.trim()).filter(Boolean) : [String(text)];
}
/* full-message translate: expand numbers, split into sentences (so long text is
   never truncated by the model's max length), translate each, and re-join. */
async function translateFull(text, srcNllb, tgtNllb) {
  const sentences = splitSentences(expandNumbers(text));
  const out = [];
  for (const s of sentences) {
    try { const t = await upstreamTranslate(s, srcNllb, tgtNllb); out.push((t && t.trim()) || s); }
    catch (e) { out.push(s); }   // keep the sentence rather than dropping the message
  }
  return out.join(' ');
}

/* ── Sarvam AI translation (optional alternative engine) ────────────────────
   Configure via env:
     SARVAM_API_KEY   Sarvam subscription key (sent as the api-subscription-key header)
     SARVAM_API_URL   default https://api.sarvam.ai
   output_script 'roman' produces English-mixed / romanised output
   (Tanglish / Hinglish / …). */
const SARVAM_API_URL = (process.env.SARVAM_API_URL || 'https://api.sarvam.ai').replace(/\/$/, '');
const SARVAM_API_KEY = process.env.SARVAM_API_KEY || '';
const SARVAM_LANG = { EN: 'en-IN', HI: 'hi-IN', TA: 'ta-IN', TE: 'te-IN', KN: 'kn-IN', ML: 'ml-IN', BN: 'bn-IN', GU: 'gu-IN', MR: 'mr-IN', OR: 'od-IN', OD: 'od-IN', PA: 'pa-IN' };
const toSarvam = (code) => SARVAM_LANG[String(code || '').toUpperCase()] || code;

async function sarvamTranslateOne(text, srcCode, tgtCode, script) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  try {
    const resp = await fetch(SARVAM_API_URL + '/translate', {
      method: 'POST',
      headers: { 'api-subscription-key': SARVAM_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(script === 'roman'
        ? { input: text, source_language_code: toSarvam(srcCode || 'EN'), target_language_code: toSarvam(tgtCode),
            model: 'mayura:v1', mode: 'code-mixed', output_script: 'roman', numerals_format: 'international' }
        : { input: text, source_language_code: toSarvam(srcCode || 'EN'), target_language_code: toSarvam(tgtCode),
            model: 'sarvam-translate:v1', numerals_format: 'international' }),
      signal: controller.signal
    });
    const body = await resp.text();
    let json; try { json = body ? JSON.parse(body) : {}; } catch { json = {}; }
    if (!resp.ok) throw new Error('sarvam ' + resp.status + (body ? ': ' + body.slice(0, 160) : ''));
    return json.translated_text || '';
  } finally { clearTimeout(timer); }
}
/* chunk by sentence (Sarvam caps input length) and translate each */
async function sarvamTranslateFull(text, srcCode, tgtCode, script) {
  const sentences = splitSentences(String(text));
  const out = [];
  for (const s of sentences) {
    try { const t = await sarvamTranslateOne(s, srcCode, tgtCode, script); out.push((t && t.trim()) || s); }
    catch (e) { out.push(s); }
  }
  return out.join(' ');
}

app.post('/api/translate', async (req, res) => {
  const { text, source, target, targets, provider, script } = req.body || {};
  const toTargets = Array.isArray(targets) && targets.length ? targets : (target ? [target] : null);
  if (!text || !toTargets) {
    return res.status(400).json({ success: false, error: 'text and targets (or target) are required' });
  }
  const useSarvam = provider === 'sarvam' && !!SARVAM_API_KEY;
  const src = toNllb(source || 'eng_Latn');
  try {
    const map = {};
    let fellBack = false;
    for (const tgt of toTargets) {
      if (useSarvam) {
        try {
          map[tgt] = await sarvamTranslateFull(text, source || 'EN', tgt, script);
        } catch (sErr) {
          /* Sarvam down / out of credits → fall back to our local model */
          console.warn('sarvam translate failed, falling back to local:', sErr.message);
          map[tgt] = await translateFull(text, src, toNllb(tgt));
          fellBack = true;
        }
      } else {
        map[tgt] = await translateFull(text, src, toNllb(tgt));
      }
    }
    const engine = (useSarvam && !fellBack) ? 'sarvam' : 'local';
    if (toTargets.length === 1) {
      return res.json({ success: true, translation: map[toTargets[0]], provider: engine });
    }
    res.json({ success: true, translations: map, provider: engine });
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

/* ── Local Vakyansh TTS contract ───────────────────────────────────────────
   POST {TTS_API_URL}/tts  { language, text, speaker? } -> audio/wav
   `language` is REQUIRED (ISO 639-1 short code); `speaker` is 'male'|'female'.
   The host currently serves Indic languages only (hi/ta/te/bn/mr/or/gu/pa);
   kn/ml return "Unsupported language". Speaker defaults to female. */
const TTS_SPEAKER = process.env.TTS_SPEAKER || 'female';
const TTS_LANG_MAP = { EN: 'en', HI: 'hi', TA: 'ta', TE: 'te', BN: 'bn', MR: 'mr', OR: 'or', OD: 'or', GU: 'gu', PA: 'pa', KN: 'kn', ML: 'ml' };
function toLocalTtsLang(code) {
  if (!code) return '';
  const up = String(code).trim().toUpperCase();
  return TTS_LANG_MAP[up] || String(code).trim().slice(0, 2).toLowerCase();
}
/* fall back to the Unicode script when no language code was supplied, so the
   Vakyansh model always receives the right `language` */
function detectTtsLang(text) {
  const s = String(text || '');
  if (/[ఀ-౿]/.test(s)) return 'te';   // Telugu
  if (/[஀-௿]/.test(s)) return 'ta';   // Tamil
  if (/[ঀ-৿]/.test(s)) return 'bn';   // Bengali
  if (/[଀-୿]/.test(s)) return 'or';   // Odia
  if (/[઀-૿]/.test(s)) return 'gu';   // Gujarati
  if (/[਀-੿]/.test(s)) return 'pa';   // Punjabi
  if (/[ऀ-ॿ]/.test(s)) return 'hi';   // Devanagari → Hindi/Marathi
  return 'en';
}
/* Call the local Vakyansh model with the current contract. Throws on non-2xx so
   callers can fall back to Sarvam. */
async function synthLocalTts(text, lang, signal) {
  const language = toLocalTtsLang(lang) || detectTtsLang(text);
  const resp = await fetch(TTS_API_URL + '/tts', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, text: String(text), speaker: TTS_SPEAKER }),
    signal
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error('local tts ' + resp.status + (detail ? ': ' + detail.slice(0, 160) : ''));
  }
  return Buffer.from(await resp.arrayBuffer());
}

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

/* ── Sarvam AI text-to-speech (optional voice engine) ──────────────────────
   bulbul:v2 caps each input string, so long text is chunked by sentence and
   the returned WAV chunks are concatenated into one clip. */
const SARVAM_TTS_MODEL = process.env.SARVAM_TTS_MODEL || 'bulbul:v3';
const SARVAM_TTS_SPEAKER = process.env.SARVAM_TTS_SPEAKER || 'aditya'; // male voice for bulbul:v3 (aditya/ashutosh/rahul male; ritu/priya/neha female)
const SARVAM_TTS_PACE = parseFloat(process.env.SARVAM_TTS_PACE || '1.0'); // normal speed (<1 slower, >1 faster)
function sarvamTtsChunks(text, max) {
  max = max || 450;
  const sents = splitSentences(String(text));
  const chunks = [];
  let cur = '';
  for (const s of sents) {
    if (s.length > max) {
      if (cur.trim()) { chunks.push(cur.trim()); cur = ''; }
      for (let i = 0; i < s.length; i += max) chunks.push(s.slice(i, i + max));
    } else if ((cur + ' ' + s).trim().length > max) {
      if (cur.trim()) chunks.push(cur.trim());
      cur = s;
    } else {
      cur = cur ? cur + ' ' + s : s;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [String(text).slice(0, max)];
}
/* concatenate standard 44-byte-header PCM WAV buffers into one clip */
function concatWavs(buffers) {
  buffers = buffers.filter(Boolean);
  if (buffers.length <= 1) return buffers[0] || Buffer.alloc(0);
  const data = buffers.map((b) => b.slice(44));
  const merged = Buffer.concat(data);
  const header = Buffer.from(buffers[0].slice(0, 44));
  header.writeUInt32LE(36 + merged.length, 4);   // RIFF chunk size
  header.writeUInt32LE(merged.length, 40);        // data sub-chunk size
  return Buffer.concat([header, merged]);
}
async function sarvamTtsOne(chunk, langCode) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const resp = await fetch(SARVAM_API_URL + '/text-to-speech', {
      method: 'POST',
      headers: { 'api-subscription-key': SARVAM_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: chunk,
        target_language_code: toSarvam(langCode),
        speaker: SARVAM_TTS_SPEAKER,
        model: SARVAM_TTS_MODEL,
        pace: SARVAM_TTS_PACE,
        speech_sample_rate: 22050,
        enable_preprocessing: true
      }),
      signal: controller.signal
    });
    const bodyText = await resp.text();
    let json; try { json = bodyText ? JSON.parse(bodyText) : {}; } catch { json = {}; }
    if (!resp.ok) throw new Error('sarvam tts ' + resp.status + (bodyText ? ': ' + bodyText.slice(0, 160) : ''));
    const b64 = (json.audios && json.audios[0]) || json.audio;
    if (!b64) throw new Error('sarvam tts: empty audio');
    return Buffer.from(b64, 'base64');
  } finally { clearTimeout(timer); }
}
async function sarvamTts(text, langCode) {
  const chunks = sarvamTtsChunks(text, 450);
  const bufs = [];
  for (const ch of chunks) bufs.push(await sarvamTtsOne(ch, langCode));
  return concatWavs(bufs);
}

/* POST /api/tts  { text, provider?, lang? }  → audio/wav bytes.
   Voice synthesis is slow (single-worker model), and a given (already-translated)
   text always yields the same audio — so the result is cached persistently by a
   hash of the text. A cache hit returns the stored WAV immediately with no call
   to the voice service; a miss synthesises once and stores it. Header
   X-KV-Cache: hit|miss lets the client tell them apart. */
app.post('/api/tts', async (req, res) => {
  const { text, provider, lang } = req.body || {};
  if (!text) {
    return res.status(400).json({ ok: false, error: 'text is required' });
  }
  const useSarvam = provider === 'sarvam' && !!SARVAM_API_KEY;
  /* cache per engine+language so the same text can hold a local and a Sarvam clip */
  const hash = ttsHash(text + '|' + (useSarvam ? 'sarvam:' + (lang || '') : 'local'));
  const hit = voiceCacheGet(hash);
  if (hit && hit.audio) {
    res.set('Content-Type', hit.contentType || 'audio/wav');
    res.set('X-KV-Cache', 'hit');
    return res.send(Buffer.from(hit.audio, 'base64'));
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 600000); // 10 min hard cap
  try {
    let buf, contentType = 'audio/wav';
    if (useSarvam) {
      /* Sarvam primary → fall back to the local Vakyansh model if Sarvam errors
         (e.g. out of credits) so voice never breaks. */
      try {
        buf = await sarvamTts(text, lang);
      } catch (sErr) {
        console.warn('sarvam tts failed, falling back to local:', sErr.message);
        buf = await synthLocalTts(text, lang, controller.signal);
      }
    } else {
      /* Local Vakyansh model is primary; if it errors (host down / a language
         model failed to load), fall back to Sarvam so voice never breaks. */
      try {
        buf = await synthLocalTts(text, lang, controller.signal);
      } catch (localErr) {
        if (SARVAM_API_KEY) {
          console.warn('local tts failed, falling back to Sarvam:', localErr.message);
          buf = await sarvamTts(text, lang);
        } else {
          return res.status(502).json({ ok: false, error: 'tts service ' + localErr.message });
        }
      }
    }
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

/* ── Boot-time voice pre-warm ───────────────────────────────────────────────
   Cache the voice for every broadcast template in every language into the DB on
   startup, SEQUENTIALLY (one after another — the TTS model is single-worker, so
   parallel requests fail). Each (template, language) whose voice is already in
   the cache is skipped, so it never re-generates and a restart resumes wherever
   it left off. Runs in the background so it never blocks boot. */
const VOICE_LANGS = ['TE', 'HI', 'TA', 'OR', 'BN', 'MR'];
const VOICE_TEMPLATES = [
  'Heavy rain expected this afternoon. All outdoor work to be suspended from 14:00. Move to the nearest covered area when the hooter sounds. Supervisors, please confirm headcount on WhatsApp.',
  'Evacuation drill at 15:30 today. Compressor Line proceed to Assembly Area-A near Gate 2. Paint Shop proceed to Area-C behind the canteen. Do not use the elevators. Report to your supervisor at the assembly point.',
  'PPE reminder for the Compressor Line. Class-B helmet, steel-toe shoes and cut-resistant gloves are mandatory before entering the shop floor. Lockout/Tagout applies whenever you service equipment. Acknowledge that you have read this.',
  'Heat advisory in effect for the summer shift. Drink water every 30 minutes from the marked stations. Take your rest break in the cooled rest area. Report any dizziness or cramps to your supervisor immediately. Acknowledge that you have read this.',
  'The shift roster changes from Monday. General shift moves to 07:00–15:30. Check your updated shift and team on the notice board or the Karya Vaani app. Supervisors will confirm your shift in person. Reply on WhatsApp if your shift is unclear.',
  'The 2026 minimum wage revision is now in effect. The revised rates and the VDA component are posted on the notice board and in the Karya Vaani app. Your next pay slip will reflect the new rate. Contact Plant HR if you have any questions.',
  'The plant will remain closed on the declared holiday. No shift will operate. Company transport will not run on that day. The full 2026 holiday list is posted on the notice board. Acknowledge that you have read this.',
  'New joiners must complete the general plant induction module before reaching the shop floor. The module is short and ends with a quiz. Passing all mandatory modules earns your safety certificate. Speak to your supervisor to schedule your session.',
  'Fire-safety reminder for all zones. Know the two nearest exits from your work area and keep them clear at all times. On the fire alarm, stop work, switch off your machine, and walk — do not run — to your assembly point. Do not use the lifts. Acknowledge that you have read this.',
  'The company transport schedule has been updated. Check your pickup point and timing on the notice board or the Karya Vaani app. Morning, general and late-shift buses each run on their own schedule. Be at your pickup point 5 minutes early — buses do not wait beyond the scheduled minute.'
];
/* already-translated native-script texts (the transport comms) — TTS directly,
   no translate step, so their audio is cached too. */
const VOICE_DIRECT = [
  'నేటి రాత్రి షిఫ్ట్ C కోసం రవాణా ఏర్పాటు చేయబడింది. "అవును" పంపండి.',
  'నైదుపేట రూట్ బస్సు 15 నిమిషాలు ఆలస్యంగా ఉంది. కొత్త రాక సమయం 06:15.',
  'మీరు సురక్షితంగా ఉన్నారా? 1800-XXX-XXXX కి కాల్ చేయండి.',
  'మీరు సురక్షితంగా ఇంటికి చేరుకున్నారు. 23:14. శుభ రాత్రి.'
];
const VOICE_PREWARM_TOTAL = VOICE_TEMPLATES.length * VOICE_LANGS.length + VOICE_DIRECT.length;
/* Bump when the translate/TTS pipeline changes (e.g. number expansion, sentence
   chunking) — on boot this invalidates every cached voice + warm marker so the
   next prewarm regenerates them with the new pipeline. */
const VOICE_PIPELINE_VERSION = '3-vakyansh-lang';
function srcKey(text, lang) { return lang + '|' + crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 12); }

async function prewarmTranslate(text, code) {
  // same pipeline as /api/translate — number expansion + sentence chunking —
  // so the prewarmed voices match exactly what a live translate produces.
  const out = await translateFull(text, toNllb('eng_Latn'), toNllb(code));
  return (out && out.trim()) || null;
}
async function prewarmTts(text, lang) {
  const hash = ttsHash(text);
  if (voiceCacheGet(hash)) return { hash, generated: false };   // already cached — never re-generate
  let buf;
  try {
    buf = await synthLocalTts(text, lang);
  } catch (localErr) {
    if (SARVAM_API_KEY) buf = await sarvamTts(text, lang);
    else throw localErr;
  }
  voiceCachePut(hash, buf, 'audio/wav');
  return { hash, generated: true };
}

let VOICE_PREWARM_RUNNING = false;
async function prewarmVoices() {
  if (VOICE_PREWARM_RUNNING) return;
  const store = readStore();
  if (!store || !store.data) return;
  VOICE_PREWARM_RUNNING = true;
  store.data.voiceWarm = store.data.voiceWarm || {};
  // Pipeline changed? Drop the stale cache so voices regenerate with the new
  // (number-expanded, sentence-chunked) translations instead of serving old ones.
  if (store.data.voiceWarm.__ver !== VOICE_PIPELINE_VERSION) {
    console.log('[voice] pipeline version changed (' + (store.data.voiceWarm.__ver || 'none') + ' → ' + VOICE_PIPELINE_VERSION + ') · clearing voice cache');
    try { await dbClear('voiceCache'); await dbClear('voiceWarm'); } catch (e) { console.error('[voice] cache clear failed:', e.message); }
    store.data.voiceWarm = { __ver: VOICE_PIPELINE_VERSION };
    dbPut('voiceWarm', '__ver', VOICE_PIPELINE_VERSION);
  }
  let generated = 0, cached = 0, failed = 0;
  console.log('[voice] prewarm starting · ' + VOICE_PREWARM_TOTAL + ' template voices (sequential)');
  for (let i = 0; i < VOICE_TEMPLATES.length; i++) {
    for (const lang of VOICE_LANGS) {
      const key = srcKey(VOICE_TEMPLATES[i], lang);
      const warm = store.data.voiceWarm[key];
      if (warm && warm.hash && voiceCacheGet(warm.hash)) { cached++; continue; }   // already done — skip
      try {
        const text = await prewarmTranslate(VOICE_TEMPLATES[i], lang);
        if (!text) throw new Error('no translation');
        const r = await prewarmTts(text, lang);
        store.data.voiceWarm[key] = { hash: r.hash, lang, at: new Date().toISOString() };
        dbPut('voiceWarm', key, store.data.voiceWarm[key]);
        if (r.generated) generated++; else cached++;
      } catch (e) { failed++; /* keep going; a later boot resumes the rest */ }
    }
  }
  // transport comms (already-translated) — TTS directly, no translate step
  for (const text of VOICE_DIRECT) {
    const key = 'direct|' + crypto.createHash('sha256').update(String(text)).digest('hex').slice(0, 12);
    const warm = store.data.voiceWarm[key];
    if (warm && warm.hash && voiceCacheGet(warm.hash)) { cached++; continue; }
    try {
      const r = await prewarmTts(text, 'te');   // the transport comms are Telugu
      store.data.voiceWarm[key] = { hash: r.hash, at: new Date().toISOString() };
      dbPut('voiceWarm', key, store.data.voiceWarm[key]);
      if (r.generated) generated++; else cached++;
    } catch (e) { failed++; }
  }
  VOICE_PREWARM_RUNNING = false;
  console.log('[voice] prewarm done · ' + (generated + cached) + '/' + VOICE_PREWARM_TOTAL + ' (' + generated + ' new, ' + cached + ' already cached, ' + failed + ' failed)');
}

/* Cache status — voices stored + how many template voices are warmed (drives
   whether the frontend still shows the pre-generate button). */
function voiceWarmDone() {
  const s = readStore();
  const list = (s && s.data && s.data.voiceCache) || [];
  const warm = (s && s.data && s.data.voiceWarm) || {};
  const have = new Set(list.map((v) => v.hash));
  let done = 0;
  Object.keys(warm).forEach((k) => { if (warm[k] && warm[k].hash && have.has(warm[k].hash)) done++; });
  return { count: list.length, done: done, total: VOICE_PREWARM_TOTAL };
}
app.get('/api/tts/cache-status', (req, res) => {
  const w = voiceWarmDone();
  res.json({ ok: true, count: w.count, max: VOICE_CACHE_MAX, templatesDone: w.done, templatesTotal: w.total, templatesWarmed: w.done >= w.total });
});
/* Manual kick (admin) — same sequential prewarm, useful if the services were
   down at boot. Returns immediately; work continues in the background. */
app.post('/api/tts/prewarm', (req, res) => {
  if (VOICE_PREWARM_RUNNING) return res.json({ ok: true, running: true });
  prewarmVoices().catch((e) => console.error('[voice] prewarm error:', e.message));
  res.json({ ok: true, started: true });
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
  if (json.provider === 'mock') return 'mock';   // no live gateway configured
  if (json.testMode) return 'test';              // real send, redirected to the test recipient(s)
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

/* ── WhatsApp voice notes (Vaani chat) ──────────────────────────────────────
   Send a synthesized voice note over WhatsApp. WhatsApp only accepts audio
   messages that it can fetch from a public HTTPS URL, and only in a supported
   format (WAV is rejected — a true voice note is OGG/Opus). So the pipeline is:
   translate → TTS (WAV) → transcode to OGG/Opus (ffmpeg) → cache + host at a
   public /api/voice/<hash> URL → hand that link to the comms /send-audio route.

   NOTE (WhatsApp policy): audio cannot be a template header, so a voice note is
   only deliverable inside the recipient's 24h customer-service window — i.e. the
   recipient must have messaged the business number in the last 24h. This is a
   CHAT feature; the Vaani broadcast channel uses email with voice attachments. */
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://karyavaani.pionedata.com').replace(/\/$/, '');

/* Transcode a PCM WAV buffer to mono OGG/Opus (the WhatsApp voice-note format)
   using the ffmpeg binary bundled in the backend image. */
function transcodeToOpus(wavBuf) {
  return new Promise((resolve, reject) => {
    let ff;
    try {
      ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-f', 'wav', '-i', 'pipe:0',
        '-ac', '1', '-c:a', 'libopus', '-b:a', '32k', '-application', 'voip', '-f', 'ogg', 'pipe:1']);
    } catch (e) { return reject(e); }
    const out = [], err = [];
    ff.stdout.on('data', (d) => out.push(d));
    ff.stderr.on('data', (d) => err.push(d));
    ff.on('error', reject);
    ff.on('close', (code) => code === 0
      ? resolve(Buffer.concat(out))
      : reject(new Error('ffmpeg exit ' + code + ': ' + Buffer.concat(err).toString().slice(0, 200))));
    ff.stdin.on('error', () => {});
    ff.stdin.write(wavBuf);
    ff.stdin.end();
  });
}

/* Synthesize a WAV clip for `text` in `lang` using the chosen engine, reusing
   the same translate + TTS pipeline as /api/translate and /api/tts. Returns the
   WAV buffer plus the final (native-script) text that was actually spoken. */
async function synthVoiceWav(text, lang, provider) {
  const useSarvam = provider === 'sarvam' && !!SARVAM_API_KEY;
  const code = String(lang || 'EN').toUpperCase();
  let finalText = String(text || '');
  if (code && code !== 'EN' && code !== 'ENG_LATN') {
    finalText = useSarvam
      ? await sarvamTranslateFull(text, 'EN', code)
      : await translateFull(text, toNllb('eng_Latn'), toNllb(code));
    if (!finalText || !finalText.trim()) finalText = String(text || '');
  }
  let wav;
  if (useSarvam) {
    wav = await sarvamTts(finalText, code);
  } else {
    /* reuse a pre-warmed / previously synthesized WAV for this exact text
       (the boot-time prewarm caches under ttsHash(translatedText)) — makes a
       voice note for a known broadcast template instant. */
    const cached = voiceCacheGet(ttsHash(finalText));
    if (cached && cached.audio && String(cached.contentType || '').includes('wav')) {
      wav = Buffer.from(cached.audio, 'base64');
    } else {
      /* local Vakyansh model primary, Sarvam fallback if the host errors */
      try {
        wav = await synthLocalTts(finalText, code);
      } catch (localErr) {
        if (SARVAM_API_KEY) wav = await sarvamTts(finalText, code);
        else throw localErr;
      }
    }
  }
  return { wav, finalText };
}

/* Public GET so WhatsApp/AOC can fetch a synthesized voice note by hash. No
   auth — the URL holds an opaque content hash and only serves cached audio. */
app.get('/api/voice/:id', (req, res) => {
  const hash = String(req.params.id || '').replace(/\.(ogg|opus|mp3|wav)$/i, '');
  const hit = voiceCacheGet(hash);
  if (!hit || !hit.audio) return res.status(404).json({ ok: false, error: 'voice not found' });
  res.set('Content-Type', hit.contentType || 'audio/ogg');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(Buffer.from(hit.audio, 'base64'));
});

/* POST /api/whatsapp/send-voice  Body: { to, text, lang?, provider?, caption? }
   Translate → synthesize → transcode → host → send over WhatsApp as audio. */
app.post('/api/whatsapp/send-voice', async (req, res) => {
  const { to, text, lang, provider: prov, caption } = req.body || {};
  const recips = Array.isArray(to) ? to : (to ? [to] : []);
  if (!recips.length || !text) {
    return res.status(400).json({ ok: false, error: '`to` and `text` are required' });
  }
  try {
    const { wav, finalText } = await synthVoiceWav(text, lang, prov);
    let audio, contentType;
    try {
      audio = await transcodeToOpus(wav);
      contentType = 'audio/ogg';
    } catch (e) {
      console.error('opus transcode failed, hosting WAV fallback:', e.message);
      audio = wav; contentType = 'audio/wav';   // still served; WhatsApp may reject WAV
    }
    const ext = contentType === 'audio/ogg' ? 'ogg' : 'wav';
    const hash = ttsHash(finalText + '|wa-voice|' + ext);
    voiceCachePut(hash, audio, contentType);
    const link = PUBLIC_BASE_URL + '/api/voice/' + hash + '.' + ext;
    const { status, json } = await commsFetch('/v1/whatsapp/send-audio', {
      method: 'POST',
      body: JSON.stringify({ to, link, lang, caption: caption || finalText.slice(0, 60) })
    });
    logComm({ channel: 'whatsapp', kind: 'voice', to: recips, recipients: recips.length, preview: finalText.slice(0, 140), status: waStatus(json), provider: json && json.provider });
    res.status(status).json({ ...json, link, text: finalText });
  } catch (err) {
    console.error('send-voice error:', err.message);
    logComm({ channel: 'whatsapp', kind: 'voice', to: recips, recipients: recips.length, preview: String(text).slice(0, 140), status: 'failed', error: err.message });
    res.status(502).json({ ok: false, error: 'voice send failed: ' + err.message });
  }
});

/* ── Vendor workers: imported per-contractor deployment rosters ──────────────
   The master worker roster has no contractor field, so the full list of workers
   deployed under a vendor is sourced from an explicit vendor-data import. Stored
   one row per worker in the vendorWorkers collection (Postgres-persisted). */
app.get('/api/vendor/workers', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting.' });
  const all = store.data.vendorWorkers || [];
  const contractor = (req.query.contractor || '').trim();
  const items = contractor
    ? all.filter((w) => String(w.contractor || '').toLowerCase() === contractor.toLowerCase())
    : all;
  res.json({ ok: true, contractor: contractor || null, count: items.length, workers: items });
});

/* Bulk-import workers for a contractor. Body: { contractor, workers:[...], replace }.
   Each worker: { code, name, mobile, category, designation, department, esic,
   clra, compliance, migrant }. `replace` clears this contractor's existing set. */
app.post('/api/vendor/workers/import', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting.' });
  const { contractor, workers, replace } = req.body || {};
  if (!contractor || !Array.isArray(workers) || !workers.length) {
    return res.status(400).json({ ok: false, error: 'contractor and workers[] are required' });
  }
  store.data.vendorWorkers = store.data.vendorWorkers || [];
  let arr = store.data.vendorWorkers;
  const same = (w) => String(w.contractor || '').toLowerCase() === String(contractor).toLowerCase();
  if (replace) {
    arr.filter(same).forEach((w) => dbDel('vendorWorkers', w.id));
    arr = store.data.vendorWorkers = arr.filter((w) => !same(w));
  }
  const clampPct = (v) => { const n = parseInt(v, 10); return isNaN(n) ? null : Math.max(0, Math.min(100, n)); };
  let imported = 0;
  workers.forEach((w, i) => {
    const code = String(w.code || w.uan || w.mobile || (i + 1)).trim();
    const id = 'VW|' + contractor + '|' + code;
    const rec = {
      id, contractor: String(contractor), code,
      name: String(w.name || '').trim(),
      mobile: String(w.mobile || '').trim(),
      language: String(w.language || '').trim(),
      category: String(w.category || '').trim(),
      designation: String(w.designation || '').trim(),
      department: String(w.department || '').trim(),
      esicStatus: String(w.esic != null ? w.esic : (w.esicStatus || '')).trim(),
      clraStatus: String(w.clra != null ? w.clra : (w.clraStatus || '')).trim(),
      compliancePct: clampPct(w.compliance != null ? w.compliance : w.compliancePct),
      migrant: /^(y|yes|true|1)$/i.test(String(w.migrant || '')),
      importedAt: new Date().toISOString()
    };
    const idx = arr.findIndex((x) => x.id === id);
    if (idx >= 0) arr[idx] = rec; else arr.push(rec);
    dbPut('vendorWorkers', id, rec);
    imported++;
  });
  res.json({ ok: true, contractor, imported, total: arr.filter(same).length });
});

/* clear imported workers for a contractor (or all, if no contractor given). */
app.delete('/api/vendor/workers', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting.' });
  const contractor = (req.query.contractor || '').trim();
  store.data.vendorWorkers = store.data.vendorWorkers || [];
  const same = (w) => !contractor || String(w.contractor || '').toLowerCase() === contractor.toLowerCase();
  const removed = store.data.vendorWorkers.filter(same);
  removed.forEach((w) => dbDel('vendorWorkers', w.id));
  store.data.vendorWorkers = store.data.vendorWorkers.filter((w) => !same(w));
  res.json({ ok: true, cleared: removed.length });
});

/* the logged communication history (drives the communication analytics) */
app.get('/api/communications', (req, res) => {
  const store = readStore();
  if (!store) return res.status(503).json({ ok: false, error: 'Not seeded. Run `npm run seed` first.' });
  res.json({ ok: true, communications: store.data.communications || [] });
});

/* lifetime gateway metrics: inbound / outbound / delivery statuses / events */
app.get('/api/whatsapp/metrics', async (req, res) => {
  try {
    const { status, json } = await commsFetch('/v1/whatsapp/metrics', { method: 'GET' });
    res.status(status).json(json);
  } catch (err) {
    res.status(502).json({ ok: false, error: 'comms server unreachable: ' + err.message });
  }
});

/* Stable natural key for a WhatsApp event so re-forwarded duplicates upsert
   instead of piling up. A message has one row; each delivery status (sent /
   delivered / read) for the same wamid is its own row. */
function whatsappKey(r) {
  const id = r.messageId || r.wamid || r.id || '';
  const dir = r.direction || '';
  const st = r.status || '';
  if (id) return [id, dir, st].join('|');
  return ['anon', dir, r.from || r.to || '', r.timestamp || r.at || '', String(r.text || '').slice(0, 24)].join('|');
}

/* ingest a forwarded message/status from the comms server and persist it to
   Postgres, so the chat history survives comms-server / deploy restarts. */
app.post('/api/whatsapp/ingest', (req, res) => {
  if (COMMS_API_KEY && req.get('x-api-key') !== COMMS_API_KEY) {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
  const rec = req.body || {};
  if (!rec || typeof rec !== 'object' || !rec.channel) {
    return res.status(400).json({ ok: false, error: 'invalid record' });
  }
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'store not ready' });
  store.data.whatsappMessages = store.data.whatsappMessages || [];
  const arr = store.data.whatsappMessages;
  const key = whatsappKey(rec);
  const record = { ...rec, id: key, ingestedAt: new Date().toISOString() };
  const idx = arr.findIndex((x) => (x.id || whatsappKey(x)) === key);
  if (idx >= 0) arr[idx] = record; else arr.push(record);
  while (arr.length > 5000) arr.shift();
  dbPut('whatsappMessages', key, record);
  res.json({ ok: true });
});

/* poll the inbound/outbound message log (for the two-way chat surface).
   Reads the persisted DB log; falls back to the comms-server in-memory log if
   the DB collection isn't available yet. */
app.get('/api/whatsapp/messages', async (req, res) => {
  const store = readStore();
  const persisted = store && store.data && Array.isArray(store.data.whatsappMessages)
    ? store.data.whatsappMessages : null;
  if (persisted) {
    const { direction, from, to, limit } = req.query;
    let items = persisted.slice();
    if (direction) items = items.filter((m) => m.direction === direction);
    if (from) items = items.filter((m) => m.from === from);
    if (to) items = items.filter((m) => m.to === to);
    items.sort((a, b) => String(a.ingestedAt || a.at || '').localeCompare(String(b.ingestedAt || b.at || '')));
    const n = parseInt(limit, 10);
    if (n && items.length > n) items = items.slice(-n);
    return res.json({ ok: true, source: 'db', count: items.length, items });
  }
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
  const { code, name, consented, method, by, comment } = req.body || {};
  if (!code) return res.status(400).json({ ok: false, error: 'worker code is required.' });
  store.data.nightConsents = store.data.nightConsents || {};
  const rec = {
    code: String(code), name: name || '', consented: !!consented,
    comment: comment || '',
    method: method || 'operator', by: by || 'HR', at: new Date().toISOString()
  };
  store.data.nightConsents[String(code)] = rec;
  dbPut('nightConsents', String(code), rec);
  res.json({ ok: true, consent: rec });
});

/* ── Transport events / incident log ────────────────────────────────────────
   Operational events on the buses — off-route drops, missed pickups, late
   departures, SOS, safe drops, consent collected. These form the audit trail
   and feed the transport operator's compliance score. */
app.get('/api/transport/events', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting.' });
  let events = (store.data.transportEvents || []);
  if (req.query.operator) events = events.filter((e) => e.operator === req.query.operator);
  res.json({ ok: true, events: events.slice(-500) });
});
app.post('/api/transport/event', (req, res) => {
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'Service starting.' });
  const { type, route, operator, code, name, note, severity, by } = req.body || {};
  if (!type) return res.status(400).json({ ok: false, error: 'event type is required.' });
  store.data.transportEvents = store.data.transportEvents || [];
  const ev = {
    id: 'tev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    type, route: route || '', operator: operator || '', code: code || '', name: name || '',
    note: note || '', severity: severity || 'medium', by: by || 'Operator', at: new Date().toISOString()
  };
  store.data.transportEvents.push(ev);
  dbPut('transportEvents', ev.id, ev);
  // cap the log
  while (store.data.transportEvents.length > 2000) {
    const old = store.data.transportEvents.shift();
    if (old && old.id) dbDel('transportEvents', old.id);
  }
  res.json({ ok: true, event: ev });
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

  /* the worker demo account must map to a REAL person in the OM manpower roster
     (the employee details table) — prefer a Telugu associate — so the login
     worker, the profile name, and the roster row all refer to the same person.
     (The old chatContacts[0] "Mohan Das" is not in that roster → inconsistency.) */
  const roster = store.data.omMapping || [];
  const rosterWorker = roster.find((r) => String(r.language || '').toLowerCase() === 'telugu') || roster[0];
  const worker = rosterWorker
    ? { id: rosterWorker.code, name: rosterWorker.name }
    : ((store.data.chatContacts || [])[0] || (store.data.broadcastWorkers || [])[0] || null);
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
      store.data.users.push(u); byName[a.username] = u; seeded.push(a.username); touched = true;
    }
    /* (re)sync the persona linkage on every startup so an updated worker/firm
       mapping takes effect for already-created users too. */
    if (a.linkedType === 'employee' && worker && (u.linkedId !== worker.id || u.name !== worker.name)) {
      u.linkedId = worker.id; u.linkedName = worker.name; u.name = worker.name; touched = true;
    } else if (a.linkedType === 'contractor' && firm && (u.linkedId !== firm.id || u.name !== firm.name)) {
      u.linkedId = firm.id; u.linkedName = firm.name; u.name = firm.name; touched = true;
    }
    if (!u.email && a.email) { u.email = a.email; touched = true; } // backfill for older seeds
    if (a.title && u.title !== a.title) { u.title = a.title; touched = true; } // keep the role label current (e.g. Agency)
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
    // Pre-warm template voices into the DB, sequentially, in the background —
    // never blocks boot; skips anything already cached. Disable with VOICE_PREWARM=off.
    if (process.env.VOICE_PREWARM !== 'off') {
      setTimeout(() => { prewarmVoices().catch((e) => console.error('[voice] prewarm error:', e.message)); }, 4000);
    }
  });
