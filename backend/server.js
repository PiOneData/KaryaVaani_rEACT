/* server.js — API serving the seeded Karya Vaani datasets from the file store. */
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { readStore, writeStore, initDb, dbPut, dbDel, dbClear } = require('./db');
const { hashPassword, verifyPassword, DEMO_ACCOUNTS } = require('./auth');
const { licenceCeilingFor, licenceSetByHR } = require('./licence-policy');
const { TENANT } = require('./tenant');

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
  // worker-level ESIC grows by (employees x months) and is read per worker or
  // per agency on demand — /api/esic-contributions, /api/esic-uploads
  const { onboardingDocuments, contractorDocuments, communications, users, voiceCache, voiceWarm,
          transportRoster, transportAttendance, nightConsents, transportEvents,
          whatsappMessages, vendorWorkers, esicContributions, esicUploads,
          workerContributions, contributionUploads, ...rest } = s.data;
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

  /* CR-8 · CLRA licence ceiling — a hard block, enforced here as well as in the
     UI so no client path (single capture, bulk import, API) can deploy a
     contract worker beyond the contractor's licensed headcount. Only applies to
     a NEW contract worker; patches to an existing record pass through. */
  if (idx === -1 && (p.type === 'contract') && p.employment && p.employment.contractor) {
    const state = licenceState(store, p.employment.contractor);
    if (state && state.blocked) {
      return res.status(409).json({
        ok: false, code: 'CLRA_CEILING',
        error: 'CLRA licence ceiling reached for ' + state.contractorName + ' — ' + state.used +
               ' of ' + state.max + ' licensed workers already deployed. Onboarding beyond the licensed ' +
               'headcount is a Contract Labour violation and the principal employer carries joint liability. ' +
               'The agency must have its licence amended before this worker can be onboarded.',
        licence: state
      });
    }
  }
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
    /* CR-8a · this onboarding may have taken the agency past its licence
       warning threshold — raise or escalate the standing alert and hand the
       agency's current position back with the response. */
    let licence = null;
    if ((capture.type || 'direct') === 'contract' && (capture.employment || {}).contractor) {
      evaluateLicenceAlert(store, capture.employment.contractor, {
        trigger: 'onboarding', by: actorOf(req).name
      });
      licence = licenceState(store, capture.employment.contractor);
    }
    res.json({ ok: true, capture, licence });
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
  const removed = list[idx];
  list.splice(idx, 1);
  store.data.onboardingCaptures = list;
  try {
    dbDel('onboardingCaptures', req.params.id);
    /* the slot is back — the alert may no longer be true */
    if ((removed.employment || {}).contractor) {
      evaluateLicenceAlert(store, removed.employment.contractor, { trigger: 'worker-removed' });
    }
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
function voiceCachePut(hash, buf, contentType, pinned) {
  const s = readStore();
  if (!s || !s.data) return;
  s.data.voiceCache = s.data.voiceCache || [];
  const rec = { hash, audio: buf.toString('base64'), contentType: contentType || 'audio/wav', bytes: buf.length, createdAt: new Date().toISOString() };
  if (pinned) rec.pinned = true;
  s.data.voiceCache.push(rec);
  dbPut('voiceCache', hash, rec);
  // evict the OLDEST UNPINNED entry beyond the cap. Pinned entries (the language
  // welcome voices) are never evicted, so they never need re-synthesis.
  while (s.data.voiceCache.length > VOICE_CACHE_MAX) {
    const idx = s.data.voiceCache.findIndex((v) => !v.pinned);
    if (idx < 0) break;   // everything left is pinned — nothing to evict
    const old = s.data.voiceCache.splice(idx, 1)[0];
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
    /* Onboarding template (re)sent → clear the auto-welcome dedup for these
       recipients, so tapping Yes fires the welcome voice for THIS onboarding.
       The marker is otherwise permanent per number and would block every repeat
       onboarding / re-test after the first. */
    if (/onboard/i.test(String(body.template || ''))) {
      const store = readStore();
      const sent = store && store.data && store.data.autoWelcomeSent;
      if (sent) {
        recips.forEach((r) => {
          const d = String(r).replace(/\D/g, '').slice(-10);
          if (d && sent[d]) { delete sent[d]; try { dbDel('autoWelcomeSent', d); } catch (e) {} }
        });
      }
    }
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

/* ── Language-based welcome voice notes ─────────────────────────────────────
   A generic, name-LESS onboarding welcome voice note, one clip per language
   register. Because no worker name is spoken, each clip is synthesized ONCE,
   stored in the DB (voiceCache, keyed by a hash of its script text) and reused
   for every worker of that language — the send is chosen by LANGUAGE ALONE, so
   we never regenerate audio per individual.

   Registers are colloquial + code-mixed the way workers actually speak —
   Tanglish (Tamil-English), Hinglish (Hindi-English) and colloquial Telugu.
   They are voiced DIRECTLY by Sarvam bulbul:v3 with NO NLLB/translate step:
   translating would formalize them into pure native script and lose the
   code-mixing. Add more registers here as their scripts are approved. */
const WELCOME_VOICE_SCRIPTS = {
  tanglish: {
    sarvamLang: 'TA',
    label: 'Tanglish (Tamil-English)',
    text: 'வணக்கம்! Karya Vaani குடும்பத்துக்கு உங்களை அன்போட வரவேற்கிறோம். ' +
      'உங்க onboarding successful-ஆ complete ஆயிடுச்சு, confirm பண்ணதுக்கு ரொம்ப thanks. ' +
      'உங்க shift roster, induction schedule, மற்றும் safety details எல்லாம் Karya Vaani app-ல ready-ஆ இருக்கு. ' +
      'இனிமேல் எல்லா important updates-ஐயும் நாங்க இதே WhatsApp-ல உங்க language-ல voice message மூலமா அனுப்புவோம். ' +
      'Safe-ஆ work பண்ணுங்க, எந்த doubt இருந்தாலும் இங்கயே எங்களுக்கு message பண்ணுங்க. Nandri!'
  },
  telugu: {
    sarvamLang: 'TE',
    label: 'Telugu (colloquial)',
    text: 'నమస్కారం! Karya Vaani కుటుంబానికి మీకు స్వాగతం. ' +
      'మీ onboarding successful గా complete అయ్యింది, confirm చేసినందుకు చాలా thanks. ' +
      'మీ shift roster, induction schedule, safety details అన్నీ Karya Vaani app లో ready గా ఉన్నాయి. ' +
      'ఇక నుండి అన్ని important updates ను మేము ఇదే WhatsApp లో మీ భాషలో voice message ద్వారా పంపిస్తాము. ' +
      'జాగ్రత్తగా పని చేయండి, ఏదైనా doubt ఉంటే ఇక్కడే మాకు message చేయండి. ధన్యవాదాలు!'
  },
  hinglish: {
    sarvamLang: 'HI',
    label: 'Hinglish (Hindi-English)',
    text: 'नमस्ते! Karya Vaani parivaar mein aapka swagat hai. ' +
      'Aapka onboarding successfully complete ho gaya hai, confirm karne ke liye bahut dhanyavaad. ' +
      'Aapka shift roster, induction schedule aur safety details sab Karya Vaani app par ready hain. ' +
      'Ab se saari important updates hum isi WhatsApp par aapki bhasha mein voice message ke through bhejenge. ' +
      'Safe rehkar kaam kijiye, koi bhi doubt ho to yahin hamein message kijiye. Dhanyavaad!'
  }
};

/* Map a worker's stored language (rec.lang: 'Tamil' | 'ta' | 'te' | 'Hindi' …)
   to a welcome-voice register. Unknown → Hinglish (widely understood default). */
function welcomeRegisterFor(lang) {
  const s = String(lang || '').trim().toLowerCase();
  if (s === 'tanglish' || s.startsWith('ta') || s.includes('tamil')) return 'tanglish';
  if (s === 'telugu' || s.startsWith('te') || s.includes('telugu')) return 'telugu';
  if (s === 'hinglish' || s.startsWith('hi') || s.includes('hindi')) return 'hinglish';
  return 'hinglish';
}

/* Stable cache key for a register's welcome clip — derived from the script text,
   so editing a script regenerates its audio automatically on next request. */
function welcomeVoiceHash(script) { return ttsHash(script.text + '|welcome-voice|ogg'); }

/* Get (or synthesize-and-store ONCE) the OGG/Opus welcome voice for a register.
   Sarvam-only (bulbul:v3) — the local Vakyansh model can't voice code-mixed
   text. Returns { hash, register, ext, generated }. */
async function getOrCreateWelcomeVoice(registerKey) {
  const script = WELCOME_VOICE_SCRIPTS[registerKey];
  if (!script) throw new Error('unknown welcome register: ' + registerKey);
  const hash = welcomeVoiceHash(script);
  const hit = voiceCacheGet(hash);
  if (hit && hit.audio) {
    // pin any previously-cached clip too (idempotent, no re-synthesis)
    if (!hit.pinned) { hit.pinned = true; dbPut('voiceCache', hash, hit); }
    return { hash, register: registerKey, ext: String(hit.contentType || '').includes('ogg') ? 'ogg' : 'wav', generated: false };
  }
  if (!SARVAM_API_KEY) throw new Error('SARVAM_API_KEY not set — welcome voices require Sarvam bulbul:v3');
  const wav = await sarvamTts(script.text, script.sarvamLang);
  let audio = wav, contentType = 'audio/wav';
  try { audio = await transcodeToOpus(wav); contentType = 'audio/ogg'; }
  catch (e) { console.error('[welcome-voice] opus transcode failed, storing WAV (WhatsApp may reject):', e.message); }
  voiceCachePut(hash, audio, contentType, true);   // pin: welcome voices are never evicted
  return { hash, register: registerKey, ext: contentType === 'audio/ogg' ? 'ogg' : 'wav', generated: true };
}

/* Pre-generate every welcome register once, sequentially, into the DB so the
   first real send is instant. Skips any already cached; safe to re-run. */
async function prewarmWelcomeVoices() {
  if (!SARVAM_API_KEY) { console.warn('[welcome-voice] SARVAM_API_KEY not set — skipping welcome prewarm'); return; }
  for (const key of Object.keys(WELCOME_VOICE_SCRIPTS)) {
    try {
      const r = await getOrCreateWelcomeVoice(key);
      console.log('[welcome-voice] ' + key + ' · ' + (r.generated ? 'generated' : 'cached') + ' (' + r.hash.slice(0, 12) + '.' + r.ext + ')');
    } catch (e) { console.error('[welcome-voice] prewarm ' + key + ' failed:', e.message); }
  }
}

/* GET /api/whatsapp/welcome-voices — list registers + whether each is cached. */
app.get('/api/whatsapp/welcome-voices', (req, res) => {
  const list = Object.keys(WELCOME_VOICE_SCRIPTS).map((k) => {
    const s = WELCOME_VOICE_SCRIPTS[k];
    const hit = voiceCacheGet(welcomeVoiceHash(s));
    return { register: k, label: s.label, sarvamLang: s.sarvamLang, cached: !!(hit && hit.audio), pinned: !!(hit && hit.pinned) };
  });
  res.json({ ok: true, registers: list });
});

/* POST /api/whatsapp/send-welcome-voice  Body: { to, lang?, register?, caption? }
   Send the generic welcome voice note chosen by LANGUAGE ALONE (no per-worker
   synthesis). Deliverable only inside the recipient's 24h window (audio is a
   session message) — i.e. after the worker taps Yes/No on the onboarding
   template. `register` overrides the lang→register mapping when supplied. */
app.post('/api/whatsapp/send-welcome-voice', async (req, res) => {
  const { to, lang, register: regOverride, caption } = req.body || {};
  const recips = Array.isArray(to) ? to : (to ? [to] : []);
  if (!recips.length) return res.status(400).json({ ok: false, error: '`to` is required' });
  const register = (regOverride && WELCOME_VOICE_SCRIPTS[regOverride]) ? regOverride : welcomeRegisterFor(lang);
  try {
    const { hash, ext, generated } = await getOrCreateWelcomeVoice(register);
    const link = PUBLIC_BASE_URL + '/api/voice/' + hash + '.' + ext;
    const { status, json } = await commsFetch('/v1/whatsapp/send-audio', {
      method: 'POST',
      body: JSON.stringify({ to, link, lang, caption: caption || 'Welcome to Karya Vaani' })
    });
    logComm({ channel: 'whatsapp', kind: 'voice', to: recips, recipients: recips.length, preview: 'welcome voice · ' + register, status: waStatus(json), provider: json && json.provider });
    res.status(status).json({ ...json, register, link, generated });
  } catch (err) {
    console.error('send-welcome-voice error:', err.message);
    logComm({ channel: 'whatsapp', kind: 'voice', to: recips, recipients: recips.length, preview: 'welcome voice · ' + register, status: 'failed', error: err.message });
    res.status(502).json({ ok: false, error: 'welcome voice send failed: ' + err.message });
  }
});

/* ── Auto welcome-voice on the worker's "Yes" reply ─────────────────────────
   When a worker taps Yes on the karyavaani_onboard_en onboarding template, that
   reply opens their 24h window — the only time a session voice note can be
   delivered. This trigger detects the affirmative reply and sends the welcome
   voice in the worker's onboarding language, exactly once per number. Called
   fire-and-forget from /api/whatsapp/ingest; never blocks the webhook ack. */
const AUTO_WELCOME_AFFIRMATIVE = /^\s*(yes|yeah|yep|ok(ay)?|confirm(ed)?)\b/i;

/* Find an onboarded worker by WhatsApp number (match on the last 10 digits). */
function findWorkerByPhone(store, phone) {
  const d = String(phone || '').replace(/\D/g, '').slice(-10);
  if (d.length !== 10) return null;
  const list = (store.data && store.data.onboardingCaptures) || [];
  return list.find((c) => c.mobile && String(c.mobile).replace(/\D/g, '').slice(-10) === d) || null;
}

async function maybeAutoWelcomeVoice(rec) {
  try {
    if (!rec || rec.direction !== 'in' || rec.channel !== 'whatsapp') return;
    if (!AUTO_WELCOME_AFFIRMATIVE.test(String(rec.text || ''))) return;
    const store = readStore();
    if (!store || !store.data) return;
    const phone = rec.from;
    const digits = String(phone || '').replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) return;
    /* Only react to a Yes/No button-reply OR a typed "yes" from a KNOWN
       onboarded worker — so a stray "yes" in free chat never fires a welcome. */
    const t = String(rec.type || '').toLowerCase();
    const isButtonReply = t.includes('button') || t.includes('interactive');
    const worker = findWorkerByPhone(store, phone);
    if (!isButtonReply && !worker) return;
    /* Dedup: send the auto welcome voice at most once per number. */
    store.data.autoWelcomeSent = store.data.autoWelcomeSent || {};
    if (store.data.autoWelcomeSent[digits]) return;
    const lang = (worker && worker.lang) || '';
    const register = welcomeRegisterFor(lang);
    const label = (WELCOME_VOICE_SCRIPTS[register] && WELCOME_VOICE_SCRIPTS[register].label) || register;
    const { hash, ext } = await getOrCreateWelcomeVoice(register);   // served from DB cache (pinned) — never regenerated
    const link = PUBLIC_BASE_URL + '/api/voice/' + hash + '.' + ext;
    const { json } = await commsFetch('/v1/whatsapp/send-audio', {
      method: 'POST',
      body: JSON.stringify({ to: phone, link, lang, caption: 'Welcome to Karya Vaani · ' + label })
    });
    /* mark sent only after the gateway accepted it, so a transient failure can retry */
    if (json && json.ok !== false) {
      store.data.autoWelcomeSent[digits] = { register, worker: (worker && worker.id) || null, at: new Date().toISOString() };
      dbPut('autoWelcomeSent', digits, store.data.autoWelcomeSent[digits]);
    }
    logComm({ channel: 'whatsapp', kind: 'voice', to: [phone], recipients: 1, preview: 'auto welcome voice · ' + register + ' (Yes reply)', status: waStatus(json), provider: json && json.provider });
    console.log('[auto-welcome] ' + register + ' welcome voice → ' + digits + ' on affirmative reply');
  } catch (e) {
    console.error('[auto-welcome] failed:', e.message);
  }
}

/* Admin: clear the auto-welcome dedup marker for a number so tapping Yes again
   re-sends the welcome voice (handy for testing the flow end-to-end). */
app.post('/api/whatsapp/auto-welcome/reset', (req, res) => {
  const digits = String((req.body || {}).to || '').replace(/\D/g, '').slice(-10);
  if (digits.length !== 10) return res.status(400).json({ ok: false, error: 'valid `to` required' });
  const store = readStore();
  if (!store || !store.data) return res.status(503).json({ ok: false, error: 'store not ready' });
  const had = !!(store.data.autoWelcomeSent && store.data.autoWelcomeSent[digits]);
  if (store.data.autoWelcomeSent) delete store.data.autoWelcomeSent[digits];
  dbDel('autoWelcomeSent', digits);
  res.json({ ok: true, cleared: had });
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

/* WhatsApp status timestamps arrive as Unix epoch seconds (Meta/AOC) or already
   as an ISO string — normalise to ISO so read/delivered times log consistently. */
function waStatusTime(ts) {
  if (ts == null || ts === '') return null;
  if (typeof ts === 'number' || /^\d+$/.test(String(ts))) {
    const n = Number(ts);
    const d = new Date(n < 1e12 ? n * 1000 : n);   // seconds → ms
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(ts);
  return isNaN(d.getTime()) ? String(ts) : d.toISOString();
}

/* When a delivery status (sent/delivered/read/failed) arrives, stamp it onto the
   matching OUTBOUND message (by wamid / AOC messageId) so every sent message
   carries its own deliveredAt / readAt time — that's the WhatsApp "read time". */
function applyStatusToOutbound(store, status) {
  const wid = status.wamid || status.messageId;
  if (!wid) return;
  const norm = (x) => String(x || '').split(':')[0];   // AOC appends ':1' etc.
  const arr = store.data.whatsappMessages || [];
  const msg = arr.find((m) => m.direction === 'out' && (
    m.wamid === wid || m.messageId === wid || norm(m.messageId) === norm(wid) || norm(m.wamid) === norm(wid)
  ));
  if (!msg) return;
  const st = String(status.status || '').toLowerCase();
  const when = waStatusTime(status.timestamp) || new Date().toISOString();
  msg.status = st || msg.status;
  msg.lastStatusAt = when;
  if (st === 'delivered' && !msg.deliveredAt) msg.deliveredAt = when;
  if (st === 'read') { msg.readAt = when; if (!msg.deliveredAt) msg.deliveredAt = when; }
  if (st === 'failed' && !msg.failedAt) msg.failedAt = when;
  try { dbPut('whatsappMessages', msg.id || whatsappKey(msg), msg); } catch (e) { /* best-effort */ }
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
  /* Correlate a delivery/read status onto the sent message so it carries its
     deliveredAt / readAt time (the WhatsApp read receipt). */
  if (record.direction === 'status') {
    try { applyStatusToOutbound(store, record); } catch (e) { console.error('status correlate error:', e.message); }
  }
  /* Fire-and-forget: if this is a worker's "Yes" reply to the onboarding
     template, auto-send their language's welcome voice into the now-open 24h
     window. Never blocks or fails the webhook ack. */
  maybeAutoWelcomeVoice(record);
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

/* Read-receipt log: every sent WhatsApp message with its delivered/read time.
   Query: ?to=<number> (last-10-digit match), ?since=<ISO>, ?limit=<n>. */
app.get('/api/whatsapp/read-receipts', (req, res) => {
  const store = readStore();
  const all = (store && store.data && store.data.whatsappMessages) || [];
  const { to, since, limit } = req.query;
  let items = all.filter((m) => m.direction === 'out');
  if (to) {
    const d = String(to).replace(/\D/g, '').slice(-10);
    items = items.filter((m) => String(m.to || '').replace(/\D/g, '').slice(-10) === d);
  }
  if (since) items = items.filter((m) => String(m.readAt || m.deliveredAt || m.lastStatusAt || '') >= String(since));
  items = items.map((m) => ({
    messageId: m.messageId || m.wamid, to: m.to,
    text: String(m.text || '').slice(0, 120), template: (m.template && (m.template.name || m.template)) || null,
    status: m.status || 'sent',
    sentAt: m.timestamp || m.ingestedAt || m.at || null,
    deliveredAt: m.deliveredAt || null, readAt: m.readAt || null, failedAt: m.failedAt || null
  }));
  items.sort((a, b) => String(b.sentAt || '').localeCompare(String(a.sentAt || '')));
  const n = parseInt(limit, 10);
  if (n && items.length > n) items = items.slice(0, n);
  res.json({
    ok: true, count: items.length, receipts: items,
    summary: { sent: items.length, delivered: items.filter((x) => x.deliveredAt).length, read: items.filter((x) => x.readAt).length }
  });
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

/* ════════════════════════════════════════════════════════════════════════════
   COMPLIANCE CHANGE REQUESTS · CR-3 / CR-6 / CR-7 / CR-8 / CR-9
   Shared helpers first, then one block of endpoints per change request.

   Authorisation model: the demo login has no bearer token, so the caller states
   who it is (actorRole / actorName, or the x-kv-role header) and every action
   that a Labour-Code obligation reserves to the principal employer's HR is
   gated here as well as in the UI. Nothing an agency posts can write an HR-only
   field — an agency submits, HR verifies.
   ════════════════════════════════════════════════════════════════════════ */
function actorOf(req) {
  const b = req.body || {};
  return {
    role: String(b.actorRole || req.get('x-kv-role') || '').toLowerCase(),
    name: String(b.actorName || req.get('x-kv-actor') || '').trim() || 'Unknown user'
  };
}
function isHR(req) { const r = actorOf(req).role; return r === 'admin' || r === 'hr'; }
function requireHR(req, res) {
  if (isHR(req)) return true;
  res.status(403).json({
    ok: false, code: 'HR_ONLY',
    error: 'Only the principal employer’s HR can perform this action.'
  });
  return false;
}
function newId(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function storeOr503(res) {
  const store = readStore();
  if (!store || !store.data) { res.status(503).json({ ok: false, error: 'Service starting — try again in a moment.' }); return null; }
  return store;
}

/* HR inbox — an agency-raised item HR (and only HR) can action. */
function pushHrNotification(store, entry) {
  store.data.hrNotifications = store.data.hrNotifications || [];
  const rec = Object.assign({ id: newId('hrn'), at: new Date().toISOString(), read: false }, entry);
  store.data.hrNotifications.push(rec);
  dbPut('hrNotifications', rec.id, rec);
  while (store.data.hrNotifications.length > 500) {
    const old = store.data.hrNotifications.shift();
    if (old && old.id) dbDel('hrNotifications', old.id);
  }
  return rec;
}

app.get('/api/hr-notifications', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  let list = (store.data.hrNotifications || []).slice().reverse();
  if (req.query.unread === '1') list = list.filter((n) => !n.read);
  res.json({ ok: true, notifications: list.slice(0, 200) });
});
app.post('/api/hr-notifications/:id/read', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  if (!requireHR(req, res)) return;
  const n = (store.data.hrNotifications || []).find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ ok: false, error: 'notification not found' });
  n.read = true; n.readAt = new Date().toISOString(); n.readBy = actorOf(req).name;
  dbPut('hrNotifications', n.id, n);
  res.json({ ok: true, notification: n });
});

/* ── CR-8 · CLRA licence ceiling ────────────────────────────────────────────
   OSHC Rules 86-90: a contractor licence names a maximum authorised deployment
   headcount. That ceiling is a statutory limit and is enforced as a hard block.
   The customer's commercial "contracted headcount" is a SEPARATE, non-statutory
   number — it is tracked here too but only ever raises an advisory alert.
   ──────────────────────────────────────────────────────────────────────── */
function findContractor(store, idOrName) {
  const key = String(idOrName || '').trim().toLowerCase();
  if (!key) return null;
  return (store.data.contractors || []).find(
    (c) => String(c.id).toLowerCase() === key || String(c.name).trim().toLowerCase() === key
  ) || null;
}
/* Workers onboarded through the platform who still occupy a licence slot.
   Exited / inactive workers release their slot — the ceiling applies to the
   ACTUAL deployed headcount, not to everyone ever registered. */
function onboardedUnder(store, contractorName) {
  const key = String(contractorName || '').trim().toLowerCase();
  return (store.data.onboardingCaptures || []).filter((c) => {
    if ((c.type || 'direct') !== 'contract') return false;
    if (String((c.employment || {}).contractor || '').trim().toLowerCase() !== key) return false;
    const st = c.workStatus || 'active';
    return st !== 'exited' && st !== 'inactive';
  });
}
/* Utilisation thresholds. The ceiling itself is a hard block, but a ceiling
   that only speaks at 100% speaks too late: a licence amendment takes weeks,
   so the agency has to know while it still has room to act. 75% is the default
   warning point and 90% the critical one; HR can move the warning point per
   agency (clraLicence.alertThresholdPct) because a 40-worker licence and a
   4,000-worker licence do not need the same runway. */
const LICENCE_WARN_PCT = 75;
const LICENCE_CRITICAL_PCT = 90;
function licenceThresholdPct(lic) {
  const v = Number((lic || {}).alertThresholdPct);
  return Number.isFinite(v) && v > 0 && v <= 100 ? v : LICENCE_WARN_PCT;
}
/* ok → warn → critical → blocked. Ordered, so an alert can only escalate. */
const LICENCE_TIERS = ['ok', 'warn', 'critical', 'blocked'];
function licenceTier(pct, blocked, thresholdPct) {
  if (blocked) return 'blocked';
  if (pct === null) return 'ok';
  if (pct >= LICENCE_CRITICAL_PCT) return 'critical';
  if (pct >= thresholdPct) return 'warn';
  return 'ok';
}
function licenceState(store, idOrName) {
  const c = findContractor(store, idOrName);
  if (!c) return null;
  const lic = c.clraLicence || {};
  const base = Number(c.deployed || 0);              // roster already on site
  const onboarded = onboardedUnder(store, c.name).length;
  const used = base + onboarded;
  const max = Number(lic.maxHeadcount || 0) || null;
  const commercial = Number(c.commercialHeadcount || 0) || null;
  const blocked = max !== null && used >= max;
  const pct = max ? Math.round((used / max) * 1000) / 10 : null;
  const thresholdPct = licenceThresholdPct(lic);
  const tier = licenceTier(pct, blocked, thresholdPct);
  const alert = openLicenceAlert(store, c.id);
  return {
    contractorId: c.id, contractorName: c.name,
    licenceNo: lic.number || '', validTill: lic.validTill || '', authority: lic.authority || '',
    max, base, onboarded, used,
    headroom: max === null ? null : (max - used),
    blocked,
    pct, thresholdPct, tier,
    /* the headcount at which the warning fires — the number an agency planning
       a batch of onboardings actually needs */
    warnAt: max === null ? null : Math.ceil((max * thresholdPct) / 100),
    nearLimit: tier === 'warn' || tier === 'critical',
    alertId: alert ? alert.id : null,
    alertNotes: alert ? (alert.notes || []).length : 0,
    alertAcknowledged: alert ? !!(alert.acknowledged && alert.acknowledged.at) : false,
    commercial,
    commercialHeadroom: commercial === null ? null : (commercial - used),
    commercialExceeded: commercial !== null && used >= commercial
  };
}
app.get('/api/contractors/:id/licence', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  const state = licenceState(store, req.params.id);
  if (!state) return res.status(404).json({ ok: false, error: 'contractor not found' });
  res.json({ ok: true, licence: state });
});
app.get('/api/contractor-licences', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  const rows = (store.data.contractors || []).map((c) => licenceState(store, c.id)).filter(Boolean);
  res.json({ ok: true, licences: rows });
});
/* HR maintains the licence ceiling — an agency must never be able to raise the
   number that limits it. */
app.post('/api/contractors/:id/licence', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  if (!requireHR(req, res)) return;
  const c = findContractor(store, req.params.id);
  if (!c) return res.status(404).json({ ok: false, error: 'contractor not found' });
  const p = req.body || {};
  /* A partial post must not silently clear the ceiling — only an explicit
     maxHeadcount (including an explicit blank, meaning "no ceiling on record")
     changes it. Anything else leaves the statutory number alone. */
  let maxHeadcount = (c.clraLicence || {}).maxHeadcount;
  if (maxHeadcount === undefined) maxHeadcount = null;
  if (p.maxHeadcount !== undefined) {
    maxHeadcount = (p.maxHeadcount === '' || p.maxHeadcount === null) ? null : Number(p.maxHeadcount);
    if (maxHeadcount !== null && (!Number.isFinite(maxHeadcount) || maxHeadcount < 0)) {
      return res.status(400).json({ ok: false, error: 'maxHeadcount must be a non-negative number' });
    }
  }
  /* the point at which the platform starts warning, as a percentage of the
     licensed headcount — defaults to 75% when HR leaves it alone */
  let alertThresholdPct = (c.clraLicence || {}).alertThresholdPct;
  if (p.alertThresholdPct !== undefined) {
    if (p.alertThresholdPct === '' || p.alertThresholdPct === null) {
      alertThresholdPct = null;
    } else {
      const t = Number(p.alertThresholdPct);
      if (!Number.isFinite(t) || t <= 0 || t > 100) {
        return res.status(400).json({ ok: false, error: 'alertThresholdPct must be a percentage between 1 and 100' });
      }
      alertThresholdPct = t;
    }
  }
  c.clraLicence = Object.assign({}, c.clraLicence, {
    alertThresholdPct,
    number: p.number != null ? String(p.number) : (c.clraLicence || {}).number || '',
    authority: p.authority != null ? String(p.authority) : (c.clraLicence || {}).authority || '',
    validTill: p.validTill != null ? String(p.validTill) : (c.clraLicence || {}).validTill || '',
    maxHeadcount: maxHeadcount,
    updatedAt: new Date().toISOString(), updatedBy: actorOf(req).name
  });
  if (p.commercialHeadcount !== undefined) {
    const cm = p.commercialHeadcount === '' || p.commercialHeadcount == null ? null : Number(p.commercialHeadcount);
    c.commercialHeadcount = Number.isFinite(cm) ? cm : null;
  }
  dbPut('contractors', c.id, c);
  /* moving the ceiling moves the utilisation — re-evaluate immediately, since
     lowering a licensed max is itself a way of crossing the warning line */
  evaluateLicenceAlert(store, c.id, { trigger: 'licence-updated', by: actorOf(req).name });
  res.json({ ok: true, licence: licenceState(store, c.id) });
});

/* ── CR-8a · licence utilisation alerts + agency notes ─────────────────────
   The ceiling is enforced at 100%, but an agency that discovers it at 100% has
   already lost. Once deployment reaches the warning threshold (75% of the
   licensed headcount by default) the platform raises a standing alert on that
   agency: the agency sees it on its own portal, HR sees it in the inbox, and
   the agency records notes against it — what it is doing about the headroom,
   whether a licence amendment has been applied for, when it expects relief.

   The alert is a record, not a toast. It persists, it escalates (75% → 90% →
   at ceiling), it carries an append-only note thread, and it resolves itself
   when the headcount drops back under the threshold. Notes are what makes it
   auditable: at ceiling, the question a Labour officer asks is not "did you
   know" but "what did you do and when", and the thread answers it.
   ──────────────────────────────────────────────────────────────────────── */
const LICENCE_NOTE_KINDS = [
  { key: 'amendment',   label: 'Licence amendment applied for' },
  { key: 'planned',     label: 'Amendment planned / documents being prepared' },
  { key: 'demobilise',  label: 'Will demobilise to stay within the licence' },
  { key: 'no-action',   label: 'No further deployment planned under this licence' },
  { key: 'comment',     label: 'Comment' }
];
function openLicenceAlert(store, contractorId) {
  return (store.data.licenceAlerts || []).find(
    (a) => a.contractorId === contractorId && a.state === 'open'
  ) || null;
}
function licenceAlertSnapshot(state) {
  return {
    tier: state.tier, pct: state.pct, used: state.used, max: state.max,
    headroom: state.headroom, thresholdPct: state.thresholdPct, warnAt: state.warnAt
  };
}
function licenceAlertHeadline(state) {
  if (state.tier === 'blocked') {
    return state.contractorName + ' is at its CLRA licensed headcount (' + state.used + ' / ' + state.max +
           '). Onboarding is blocked until the licence is amended.';
  }
  return state.contractorName + ' has reached ' + state.pct + '% of its CLRA licensed headcount (' +
         state.used + ' of ' + state.max + ' · ' + state.headroom + ' remaining).';
}
/* Raise, escalate or resolve the standing alert for one agency. Called after
   anything that can move either side of the ratio — an onboarding, a status
   change, an exit, or HR editing the ceiling. Returns the alert, or null. */
function evaluateLicenceAlert(store, idOrName, ctx) {
  const c = findContractor(store, idOrName);
  if (!c) return null;
  store.data.licenceAlerts = store.data.licenceAlerts || [];
  const state = licenceState(store, c.id);
  if (!state || state.max === null) return null;
  const nowIso = new Date().toISOString();
  const by = (ctx && ctx.by) || 'System';
  const trigger = (ctx && ctx.trigger) || 'recheck';
  const existing = openLicenceAlert(store, c.id);

  /* back under the threshold — close the alert off, keeping it (and its notes)
     as history. A later crossing raises a fresh alert rather than reopening a
     stale one, so each episode reads as its own record. */
  if (state.tier === 'ok') {
    if (existing) {
      existing.state = 'resolved';
      existing.resolvedAt = nowIso;
      existing.resolvedBy = by;
      existing.current = licenceAlertSnapshot(state);
      existing.events = (existing.events || []).concat([{
        at: nowIso, by, kind: 'resolved', trigger,
        text: 'Deployment fell back to ' + state.pct + '% of the licensed headcount (' +
              state.used + ' / ' + state.max + ') — below the ' + state.thresholdPct + '% warning threshold.'
      }]);
      dbPut('licenceAlerts', existing.id, existing);
    }
    return null;
  }

  if (!existing) {
    const alert = {
      id: newId('lica'),
      contractorId: c.id, contractorName: c.name,
      licenceNo: state.licenceNo, validTill: state.validTill,
      state: 'open',
      tier: state.tier,
      raisedAt: nowIso, raisedBy: by, trigger,
      raisedAtSnapshot: licenceAlertSnapshot(state),
      current: licenceAlertSnapshot(state),
      acknowledged: null,
      notes: [],
      events: [{
        at: nowIso, by, kind: 'raised', trigger, tier: state.tier,
        text: licenceAlertHeadline(state)
      }]
    };
    store.data.licenceAlerts.push(alert);
    dbPut('licenceAlerts', alert.id, alert);
    pushHrNotification(store, {
      kind: 'licence-utilisation',
      severity: state.tier === 'warn' ? 'warn' : 'high',
      title: 'CLRA licence · ' + c.name + ' at ' + state.pct + '% of licensed headcount',
      body: licenceAlertHeadline(state) + ' The agency has been asked to record what it is doing about the headroom.',
      contractorId: c.id, ref: alert.id
    });
    while (store.data.licenceAlerts.length > 400) {
      const old = store.data.licenceAlerts.shift();
      if (old && old.id) dbDel('licenceAlerts', old.id);
    }
    return alert;
  }

  /* an open alert only ever escalates — it must not flap between 75% and 76% */
  existing.current = licenceAlertSnapshot(state);
  if (LICENCE_TIERS.indexOf(state.tier) > LICENCE_TIERS.indexOf(existing.tier)) {
    existing.tier = state.tier;
    existing.events = (existing.events || []).concat([{
      at: nowIso, by, kind: 'escalated', trigger, tier: state.tier,
      text: licenceAlertHeadline(state)
    }]);
    pushHrNotification(store, {
      kind: 'licence-utilisation',
      severity: state.tier === 'blocked' ? 'high' : 'warn',
      title: 'CLRA licence · ' + c.name + (state.tier === 'blocked'
        ? ' has reached its licensed ceiling'
        : ' now at ' + state.pct + '% of licensed headcount'),
      body: licenceAlertHeadline(state),
      contractorId: c.id, ref: existing.id
    });
  }
  dbPut('licenceAlerts', existing.id, existing);
  return existing;
}
/* Re-evaluate every agency. The alert has to be true of the data as it stands,
   not only of the moment a worker happened to be onboarded — seeded rosters
   and imports never pass through the capture path. */
/* a status change or an exit frees (or re-occupies) a licence slot */
function licenceRecheckForWorker(store, rec, trigger, by) {
  const name = (rec && rec.employment && rec.employment.contractor) || '';
  if (name) evaluateLicenceAlert(store, name, { trigger, by });
}
function evaluateAllLicenceAlerts(store, ctx) {
  return (store.data.contractors || [])
    .map((c) => evaluateLicenceAlert(store, c.id, ctx))
    .filter(Boolean);
}

app.get('/api/licence-alerts', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  let list = (store.data.licenceAlerts || []).slice().reverse();
  if (req.query.contractor) {
    const key = String(req.query.contractor).trim().toLowerCase();
    list = list.filter((a) => String(a.contractorId).toLowerCase() === key ||
                              String(a.contractorName).trim().toLowerCase() === key);
  }
  if (req.query.state) list = list.filter((a) => a.state === req.query.state);
  res.json({ ok: true, alerts: list.slice(0, 200), noteKinds: LICENCE_NOTE_KINDS });
});
/* Recompute on demand — the frontend calls this on load and after onboarding
   so the board reflects the real position without waiting for a write. */
app.post('/api/licence-alerts/recheck', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  const raised = evaluateAllLicenceAlerts(store, { trigger: 'recheck', by: actorOf(req).name });
  res.json({
    ok: true,
    open: (store.data.licenceAlerts || []).filter((a) => a.state === 'open'),
    raised: raised.length
  });
});
/* The agency's own note against the alert. This is the one thing on a licence
   record an agency writes — it is its account of what it is doing, not a
   compliance verdict, so it never changes the ceiling or the tier. HR can note
   too; every note carries who wrote it and in what role. */
app.post('/api/licence-alerts/:id/notes', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  const alert = (store.data.licenceAlerts || []).find((a) => a.id === req.params.id);
  if (!alert) return res.status(404).json({ ok: false, error: 'licence alert not found' });
  const p = req.body || {};
  const text = String(p.text || '').trim();
  if (!text) return res.status(400).json({ ok: false, error: 'A note needs some text.' });
  const kind = LICENCE_NOTE_KINDS.some((k) => k.key === p.kind) ? p.kind : 'comment';
  const actor = actorOf(req);
  const note = {
    id: newId('licn'), at: new Date().toISOString(),
    by: actor.name, role: actor.role || 'unknown',
    byAgency: !isHR(req),
    kind, text,
    expectedBy: p.expectedBy ? String(p.expectedBy) : '',
    /* the position at the moment the note was written, so the thread still
       makes sense after the headcount has moved on */
    atSnapshot: alert.current || alert.raisedAtSnapshot || null
  };
  alert.notes = (alert.notes || []).concat([note]);
  dbPut('licenceAlerts', alert.id, alert);
  /* an agency note is something HR has to see — that is the point of it */
  if (note.byAgency) {
    const kindLabel = (LICENCE_NOTE_KINDS.find((k) => k.key === kind) || {}).label || 'Note';
    pushHrNotification(store, {
      kind: 'licence-alert-note',
      severity: 'info',
      title: 'Licence headroom · note from ' + alert.contractorName,
      body: kindLabel + ' — ' + text.slice(0, 180) + (note.expectedBy ? ' (expected by ' + note.expectedBy + ')' : ''),
      contractorId: alert.contractorId, ref: alert.id
    });
  }
  res.json({ ok: true, alert });
});
/* HR acknowledging that it has seen the agency's position. Deliberately not a
   resolution: only the headcount coming down resolves the alert. */
app.post('/api/licence-alerts/:id/ack', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  if (!requireHR(req, res)) return;
  const alert = (store.data.licenceAlerts || []).find((a) => a.id === req.params.id);
  if (!alert) return res.status(404).json({ ok: false, error: 'licence alert not found' });
  const actor = actorOf(req);
  const nowIso = new Date().toISOString();
  alert.acknowledged = { by: actor.name, at: nowIso, note: String((req.body || {}).note || '').trim() };
  alert.events = (alert.events || []).concat([{
    at: nowIso, by: actor.name, kind: 'acknowledged',
    text: 'Plant HR acknowledged the licence-headroom position.'
  }]);
  dbPut('licenceAlerts', alert.id, alert);
  res.json({ ok: true, alert });
});

/* ── CR-6 · EPF / ESIC payment capture + HR verification ───────────────────
   The agency submits what it paid, for which month, against which challan and
   for how many workers. HR reconciles the challan headcount against the ACTUAL
   deployed headcount the platform knows about, and records the verification
   (Full Paid / Partially Paid / Not Paid). Only the verification block converts
   an administrative submission into a compliance record, so only HR writes it.
   ──────────────────────────────────────────────────────────────────────── */
const PAY_VERDICTS = ['full', 'partial', 'none'];

app.get('/api/statutory-payments', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  let list = (store.data.statutoryPayments || []).slice();
  if (req.query.contractor) {
    const k = String(req.query.contractor).trim().toLowerCase();
    list = list.filter((p) => String(p.contractorName || '').trim().toLowerCase() === k || String(p.contractorId || '').toLowerCase() === k);
  }
  if (req.query.month) list = list.filter((p) => p.month === req.query.month);
  list.sort((a, b) => String(b.month).localeCompare(String(a.month)));
  res.json({ ok: true, payments: list });
});

app.post('/api/statutory-payments', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  const p = req.body || {};
  const actor = actorOf(req);
  if (!p.contractor && !p.contractorId) return res.status(400).json({ ok: false, error: 'contractor is required' });
  if (!/^\d{4}-\d{2}$/.test(String(p.month || ''))) return res.status(400).json({ ok: false, error: 'month must be YYYY-MM' });
  const c = findContractor(store, p.contractorId || p.contractor);
  if (!c) return res.status(404).json({ ok: false, error: 'contractor not found' });
  /* an agency may only submit for itself */
  if (!isHR(req) && actor.role === 'contractor' && p.actorContractor &&
      String(p.actorContractor).trim().toLowerCase() !== String(c.name).trim().toLowerCase()) {
    return res.status(403).json({ ok: false, error: 'An agency can only submit its own EPF/ESIC payments.' });
  }
  store.data.statutoryPayments = store.data.statutoryPayments || [];
  const list = store.data.statutoryPayments;
  const nowIso = new Date().toISOString();
  const nnum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const idx = list.findIndex((x) => x.contractorId === c.id && x.month === p.month);
  const submission = {
    contractorId: c.id,
    contractorName: c.name,
    month: String(p.month),
    /* headcount the AGENCY says it paid for, and the headcount printed on the
       challan — these are deliberately separate fields from the platform's
       deployed headcount so the reconciliation has three independent numbers. */
    declaredHeadcount: nnum(p.declaredHeadcount),
    challanHeadcount: nnum(p.challanHeadcount),
    epfAmount: nnum(p.epfAmount),
    esicAmount: nnum(p.esicAmount),
    epfChallanNo: String(p.epfChallanNo || ''),
    epfTrrn: String(p.epfTrrn || ''),
    esicChallanNo: String(p.esicChallanNo || ''),
    esicCrn: String(p.esicCrn || ''),
    wageBill: nnum(p.wageBill),
    paidOn: String(p.paidOn || ''),
    note: String(p.note || ''),
    submittedBy: actor.name,
    submittedRole: actor.role || 'contractor',
    submittedAt: nowIso,
    /* the deployed headcount the platform itself observed at submission time —
       stamped here so the reconciliation can never be re-based later */
    platformDeployed: licenceState(store, c.id).used
  };
  let rec;
  if (idx !== -1) {
    /* a resubmission re-opens the verification: a changed amount must be
       re-verified, otherwise stale HR sign-off would cover new numbers. */
    const prev = list[idx];
    const changed = ['epfAmount', 'esicAmount', 'challanHeadcount', 'declaredHeadcount', 'epfChallanNo', 'esicChallanNo']
      .some((k) => String(prev[k] || '') !== String(submission[k] || ''));
    rec = Object.assign({}, prev, submission, {
      id: prev.id,
      verification: changed ? null : (prev.verification || null),
      reopenedAt: changed ? nowIso : prev.reopenedAt || null,
      history: (prev.history || []).concat([{ at: nowIso, by: actor.name, epfAmount: prev.epfAmount, esicAmount: prev.esicAmount, challanHeadcount: prev.challanHeadcount }])
    });
    list[idx] = rec;
  } else {
    rec = Object.assign({ id: newId('sp'), verification: null, history: [] }, submission);
    list.push(rec);
  }
  dbPut('statutoryPayments', rec.id, rec);
  if (!isHR(req)) {
    pushHrNotification(store, {
      kind: 'epf-esic-submission', severity: 'info',
      title: 'EPF/ESIC payment submitted · ' + c.name,
      body: c.name + ' submitted EPF ₹' + rec.epfAmount.toLocaleString('en-IN') + ' and ESIC ₹' +
            rec.esicAmount.toLocaleString('en-IN') + ' for ' + rec.month + ' against ' + rec.challanHeadcount +
            ' workers on the challan. Awaiting HR verification.',
      contractorId: c.id, contractorName: c.name, ref: rec.id, by: actor.name
    });
  }
  res.json({ ok: true, payment: rec });
});

app.post('/api/statutory-payments/:id/verify', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  if (!requireHR(req, res)) return;
  const rec = (store.data.statutoryPayments || []).find((x) => x.id === req.params.id);
  if (!rec) return res.status(404).json({ ok: false, error: 'payment record not found' });
  const p = req.body || {};
  if (PAY_VERDICTS.indexOf(String(p.status)) === -1) {
    return res.status(400).json({ ok: false, error: 'status must be one of full | partial | none' });
  }
  const actor = actorOf(req);
  const deployedNow = licenceState(store, rec.contractorId);
  rec.verification = {
    status: String(p.status),
    note: String(p.note || ''),
    /* the deployed headcount HR reconciled against — the element that makes
       this a compliance record rather than an administrative one */
    reconciledDeployed: Number(p.reconciledDeployed != null ? p.reconciledDeployed : (deployedNow ? deployedNow.used : rec.platformDeployed)) || 0,
    challanHeadcount: rec.challanHeadcount,
    shortfallWorkers: Math.max(0, (Number(p.reconciledDeployed != null ? p.reconciledDeployed : (deployedNow ? deployedNow.used : rec.platformDeployed)) || 0) - Number(rec.challanHeadcount || 0)),
    by: actor.name, at: new Date().toISOString()
  };
  rec.verifiedAt = rec.verification.at;
  dbPut('statutoryPayments', rec.id, rec);
  res.json({ ok: true, payment: rec });
});

/* ── Worker-level statutory contributions · ESIC and EPF ────────────────────
   The firm-month figures above prove an agency paid SOMETHING. They cannot
   answer the question a worker actually asks — "was my ESIC/PF paid this month,
   and against which challan?" — because one amount for 145 people says nothing
   about any one of them. So both schemes are also carried per employee,
   uploaded as the spreadsheets the agency already produces for the ESIC and
   EPFO portals.

   ESIC and EPF differ in exactly two things that matter here: the contribution
   rates, and what the wage ceiling MEANS. Everything else — the file-per-month
   shape, the per-employee rows, the reconciliation against wages, HR's
   verification — is identical, so it is written once and parameterised by
   scheme rather than duplicated.

   The file is parsed in the browser (SheetJS is already loaded there for the
   worker-onboarding template) and posted as rows. The FILE ITSELF is recorded
   too — name, size, row counts, who and when — because a worker-facing payment
   claim needs provenance: every contribution row carries the uploadId of the
   file it arrived on, so any figure can be traced back to its source document,
   and that document carries HR's verdict on whether it was actually paid.
   ──────────────────────────────────────────────────────────────────────── */

/* The wage ceilings are stated as literals rather than read from
   ESIC_WAGE_CEILING below, which is declared later in this file and would be in
   its temporal dead zone here. contribAssertCeilings() cross-checks them at
   boot so the two cannot drift apart unnoticed. */
const CONTRIB_SCHEMES = {
  esic: {
    key: 'esic', label: 'ESIC',
    employeeRate: 0.0075,          // 0.75% of wages
    employerRate: 0.0325,          // 3.25% of wages
    wageCeiling: 21000,
    /* ABOVE the ceiling an employee is out of ESIC's scope entirely — no
       contribution is due from either side. */
    ceilingMeans: 'exempt',
    memberIdLabel: 'ESIC number',
    challanLabel: 'challan'
  },
  epf: {
    key: 'epf', label: 'EPF',
    employeeRate: 0.12,            // 12% of wages
    employerRate: 0.13,            // 12% + 1% administration
    wageCeiling: 15000,
    /* EPF does not exempt a higher-paid worker; the contribution is simply
       COMPUTED on wages capped at the ceiling. */
    ceilingMeans: 'cap',
    memberIdLabel: 'UAN',
    challanLabel: 'TRRN / challan'
  }
};
function contribScheme(v) {
  const k = String(v || 'esic').trim().toLowerCase();
  return CONTRIB_SCHEMES[k] || null;
}
function contribAssertCeilings() {
  if (typeof ESIC_WAGE_CEILING === 'number' && ESIC_WAGE_CEILING !== CONTRIB_SCHEMES.esic.wageCeiling) {
    console.warn('[contrib] ESIC wage ceiling disagrees: payroll uses ' + ESIC_WAGE_CEILING +
                 ', contributions use ' + CONTRIB_SCHEMES.esic.wageCeiling);
  }
}

/* THE FORMULA · what the two sides should have contributed on these wages.
   Returned alongside every uploaded row so HR verifies against a computed
   figure rather than taking the agency's number on trust. Null when no wage was
   supplied — an unknown wage is not a variance, it is simply nothing to check
   against, and reporting it as a shortfall would be wrong. */
function contribExpected(schemeKey, wages) {
  const s = contribScheme(schemeKey);
  const w = Number(wages) || 0;
  if (!s || w <= 0) return null;
  if (s.ceilingMeans === 'exempt' && w > s.wageCeiling) {
    return { employee: 0, employer: 0, total: 0, base: 0, outOfScope: true };
  }
  const base = s.ceilingMeans === 'cap' ? Math.min(w, s.wageCeiling) : w;
  const employee = Math.round(base * s.employeeRate);
  const employer = Math.round(base * s.employerRate);
  return { employee, employer, total: employee + employer, base, outOfScope: false };
}

const CONTRIB_ROW_STATUSES = ['paid', 'pending', 'exempt'];
function contribNormStatus(v) {
  const s = String(v || '').trim().toLowerCase();
  if (!s) return 'paid';
  if (s === 'paid' || s === 'y' || s === 'yes' || s === 'done' || s === 'success') return 'paid';
  if (s === 'exempt' || s === 'exempted' || s === 'na' || s === 'n/a') return 'exempt';
  if (s === 'pending' || s === 'unpaid' || s === 'no' || s === 'n' || s === 'due') return 'pending';
  return CONTRIB_ROW_STATUSES.indexOf(s) === -1 ? 'paid' : s;
}
/* the employee key: whatever the agency put in the sheet, matched against the
   ids the platform already knows. Kept as a plain trimmed string — matching is
   done case-insensitively at read time rather than by rewriting what was
   uploaded, so the stored row always reflects the file. */
function contribKey(v) { return String(v == null ? '' : v).trim(); }
function contribNum(v) {
  const n = Number(String(v == null ? '' : v).replace(/[,\s₹]/g, ''));
  return Number.isFinite(n) ? n : 0;
}
/* a rupee or less apart is rounding, not a discrepancy worth a verdict */
const CONTRIB_VARIANCE_TOLERANCE = 1;

const CONTRIB_VERDICTS = ['full', 'partial', 'none'];

function contribList(store) {
  store.data.workerContributions = store.data.workerContributions || [];
  return store.data.workerContributions;
}
function contribUploadList(store) {
  store.data.contributionUploads = store.data.contributionUploads || [];
  return store.data.contributionUploads;
}

function contribGetContributions(req, res) {
  const store = storeOr503(res); if (!store) return;
  let list = contribList(store).slice();
  if (req.query.scheme) {
    const sk = String(req.query.scheme).trim().toLowerCase();
    list = list.filter((r) => String(r.scheme || 'esic') === sk);
  }
  if (req.query.worker) {
    const k = contribKey(req.query.worker).toLowerCase();
    /* a worker is identified by employee id, the platform worker code, or the
       scheme member number (ESIC insurance number / UAN) — whichever the
       agency's sheet carried */
    list = list.filter((r) =>
      String(r.employeeId || '').trim().toLowerCase() === k ||
      String(r.workerCode || '').trim().toLowerCase() === k ||
      String(r.memberId || '').trim().toLowerCase() === k);
  }
  if (req.query.contractor) {
    const k = String(req.query.contractor).trim().toLowerCase();
    list = list.filter((r) => String(r.contractorName || '').trim().toLowerCase() === k ||
                              String(r.contractorId || '').toLowerCase() === k);
  }
  if (req.query.month) list = list.filter((r) => r.month === req.query.month);
  /* ?upload=<id> — the employees in one uploaded file, for verifying it worker
     by worker rather than as a whole */
  if (req.query.upload) list = list.filter((r) => r.uploadId === req.query.upload);
  /* ?year=2026 — the worker view is a year at a time with the prior years kept */
  if (req.query.year) list = list.filter((r) => String(r.month || '').slice(0, 4) === String(req.query.year));
  list.sort((a, b) => String(b.month).localeCompare(String(a.month)));
  /* Each row carries its OWN verdict — verification is per worker, because
     "was this worker's PF paid?" is the question that has to be answerable, and
     a file-level tick cannot answer it for the one employee who was short.
     Verifying a whole file stamps every row in it (see contribPostVerify), so
     the two are the same act at different granularity rather than rival
     records. The file's own verdict rides along for context. */
  const ups = {};
  contribUploadList(store).forEach((u) => { ups[u.id] = u; });
  const out = list.map((r) => {
    const u = ups[r.uploadId];
    return Object.assign({}, r, {
      uploadFileName: u ? u.fileName : '',
      verification: r.verification || null,
      uploadVerification: u ? (u.verification || null) : null
    });
  });
  res.json({ ok: true, contributions: out });
}

/* HR's verdict on ONE worker's contribution. The per-file verdict below is a
   convenience for the common case; this is the record that actually answers a
   worker's question, and the one an inspector asks for. */
function contribPostRowVerify(req, res) {
  const store = storeOr503(res); if (!store) return;
  if (!requireHR(req, res)) return;
  const rec = contribList(store).find((x) => x.id === req.params.id);
  if (!rec) return res.status(404).json({ ok: false, error: 'contribution not found' });
  const p = req.body || {};
  if (CONTRIB_VERDICTS.indexOf(String(p.status)) === -1) {
    return res.status(400).json({ ok: false, error: 'status must be one of full | partial | none' });
  }
  const note = String(p.note || '').trim();
  if (String(p.status) !== 'full' && !note) {
    return res.status(400).json({ ok: false, error: 'a partial or not-paid verdict needs a note saying what was short' });
  }
  const actor = actorOf(req);
  rec.verification = contribRowVerdict(rec, String(p.status), note, actor.name, 'row');
  rec.verifiedAt = rec.verification.at;
  dbPut('workerContributions', rec.id, rec);
  res.json({ ok: true, contribution: rec });
}
/* the verdict block written onto a worker's row, whether stamped one at a time
   or by verifying the file it came in on */
function contribRowVerdict(rec, status, note, by, via) {
  return {
    status,
    note,
    /* the figures the verdict was reached against, frozen so a later correction
       to the row cannot silently re-base what HR signed off */
    declaredAmount: Number(rec.amount || 0),
    expectedAmount: rec.expectedTotal == null ? null : Number(rec.expectedTotal),
    /* 'row' — HR verified this worker specifically.
       'upload' — carried from verifying the whole file. */
    via: via || 'row',
    by, at: new Date().toISOString()
  };
}

function contribGetUploads(req, res) {
  const store = storeOr503(res); if (!store) return;
  let list = contribUploadList(store).slice();
  if (req.query.scheme) {
    const sk = String(req.query.scheme).trim().toLowerCase();
    list = list.filter((u) => String(u.scheme || 'esic') === sk);
  }
  if (req.query.contractor) {
    const k = String(req.query.contractor).trim().toLowerCase();
    list = list.filter((u) => String(u.contractorName || '').trim().toLowerCase() === k ||
                              String(u.contractorId || '').toLowerCase() === k);
  }
  list.sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));
  /* How many of this file's rows are STILL the ones in force. Re-uploading a
     month moves its rows onto the new file, which leaves the old one with none
     — superseded, not outstanding. Without this an obsolete file sits in HR's
     verification queue for ever, asking to be verified when the figures it
     carried are no longer the record. */
  const live = {};
  const verifiedRows = {};
  contribList(store).forEach((r) => {
    live[r.uploadId] = (live[r.uploadId] || 0) + 1;
    if (r.verification && r.verification.status) verifiedRows[r.uploadId] = (verifiedRows[r.uploadId] || 0) + 1;
  });
  const out = list.map((u) => Object.assign({}, u, {
    activeRows: live[u.id] || 0,
    superseded: (live[u.id] || 0) === 0,
    /* how far through the workers in this file HR has got — a file can be part
       verified when individual workers were checked one at a time */
    verifiedRows: verifiedRows[u.id] || 0
  }));
  res.json({ ok: true, uploads: out });
}

function contribPostUpload(req, res) {
  const store = storeOr503(res); if (!store) return;
  const p = req.body || {};
  const actor = actorOf(req);
  const s = contribScheme(p.scheme);
  if (!s) return res.status(400).json({ ok: false, error: 'scheme must be one of esic | epf' });
  if (!p.contractor && !p.contractorId) return res.status(400).json({ ok: false, error: 'contractor is required' });
  const c = findContractor(store, p.contractorId || p.contractor);
  if (!c) return res.status(404).json({ ok: false, error: 'contractor not found' });
  /* same self-scoping rule as the firm-level submission: an agency uploads only
     against itself, HR may upload for anyone */
  if (!isHR(req) && actor.role === 'contractor' && p.actorContractor &&
      String(p.actorContractor).trim().toLowerCase() !== String(c.name).trim().toLowerCase()) {
    return res.status(403).json({ ok: false, error: 'An agency can only upload its own ' + s.label + ' contributions.' });
  }
  const rows = Array.isArray(p.rows) ? p.rows : [];
  if (!rows.length) return res.status(400).json({ ok: false, error: 'the file contained no data rows' });
  if (rows.length > 5000) return res.status(413).json({ ok: false, error: 'too many rows in one upload (max 5000)' });

  const nowIso = new Date().toISOString();
  const uploadId = newId('cup');
  const all = contribList(store);
  const accepted = [];
  const rejected = [];

  rows.forEach((raw, i) => {
    const r = raw || {};
    const employeeId = contribKey(r.employeeId);
    const workerCode = contribKey(r.workerCode) || employeeId;
    const memberId = contribKey(r.memberId != null ? r.memberId : r.esiNumber);
    const month = String(r.month || p.month || '').trim();
    /* a row without an employee to attach to, or without a month, is not a
       contribution record — it is reported back rather than silently dropped */
    if (!employeeId && !workerCode && !memberId) {
      rejected.push({ row: i + 2, reason: 'no employee id, worker code or ' + s.memberIdLabel }); return;
    }
    if (!/^\d{4}-\d{2}$/.test(month)) {
      rejected.push({ row: i + 2, reason: 'month must be YYYY-MM (got "' + (r.month || p.month || '') + '")' }); return;
    }
    const wages = contribNum(r.wages);
    const employeeContribution = contribNum(r.employeeContribution);
    const employerContribution = contribNum(r.employerContribution);
    const declaredTotal = contribNum(r.amount) || (employeeContribution + employerContribution);
    const expected = contribExpected(s.key, wages);
    const contribution = {
      scheme: s.key,
      uploadId,
      contractorId: c.id,
      contractorName: c.name,
      month,
      employeeId,
      workerCode,
      workerName: contribKey(r.workerName),
      memberId,
      /* the three numbers on a contribution line: what the employee paid, what
         the employer paid, and the wages they were computed on */
      wages,
      employeeContribution,
      employerContribution,
      amount: declaredTotal,
      /* …and what the statutory formula says those should have been */
      expectedEmployee: expected ? expected.employee : null,
      expectedEmployer: expected ? expected.employer : null,
      expectedTotal: expected ? expected.total : null,
      outOfScope: expected ? !!expected.outOfScope : false,
      variance: expected ? Math.round((declaredTotal - expected.total) * 100) / 100 : null,
      challanNo: contribKey(r.challanNo),
      paidOn: contribKey(r.paidOn),
      status: contribNormStatus(r.status),
      note: contribKey(r.note)
    };
    /* one row per employee-month-scheme: a re-upload for the same month corrects
       the earlier figure rather than doubling it, and the row moves to the new
       upload so its provenance points at the file actually in force */
    const key = (contribution.employeeId || contribution.workerCode || contribution.memberId).toLowerCase();
    const idx = all.findIndex((x) =>
      String(x.scheme || 'esic') === s.key &&
      x.contractorId === c.id && x.month === month &&
      String(x.employeeId || x.workerCode || x.memberId || '').trim().toLowerCase() === key);
    let rec;
    if (idx !== -1) {
      rec = Object.assign(all[idx], contribution, { updatedAt: nowIso, updatedBy: actor.name });
    } else {
      rec = Object.assign({ id: newId('wc'), createdAt: nowIso }, contribution, { updatedAt: nowIso, updatedBy: actor.name });
      all.push(rec);
    }
    dbPut('workerContributions', rec.id, rec);
    accepted.push(rec);
  });

  const totalDeclared = accepted.reduce((n, r) => n + Number(r.amount || 0), 0);
  const checkable = accepted.filter((r) => r.expectedTotal !== null);
  const totalExpected = checkable.reduce((n, r) => n + Number(r.expectedTotal || 0), 0);
  const withVariance = checkable.filter((r) => Math.abs(Number(r.variance || 0)) > CONTRIB_VARIANCE_TOLERANCE);
  const upload = {
    id: uploadId,
    scheme: s.key,
    contractorId: c.id,
    contractorName: c.name,
    /* provenance — the file as submitted */
    fileName: contribKey(p.fileName) || (s.key + '-upload.xlsx'),
    fileSize: Number(p.fileSize) || 0,
    sheetName: contribKey(p.sheetName),
    month: /^\d{4}-\d{2}$/.test(String(p.month || '')) ? String(p.month) : (accepted[0] ? accepted[0].month : ''),
    months: Array.from(new Set(accepted.map((r) => r.month))).sort(),
    rowCount: rows.length,
    acceptedCount: accepted.length,
    rejectedCount: rejected.length,
    rejected: rejected.slice(0, 50),
    totalAmount: totalDeclared,
    /* the reconciliation HR verifies against */
    totalExpected,
    checkedRows: checkable.length,
    varianceRows: withVariance.length,
    totalVariance: Math.round((totalDeclared - totalExpected) * 100) / 100,
    /* HR's verdict — an upload is not evidence of payment until it is verified */
    verification: null,
    uploadedBy: actor.name,
    uploadedRole: actor.role || '',
    uploadedAt: nowIso
  };
  contribUploadList(store).push(upload);
  dbPut('contributionUploads', upload.id, upload);

  /* Every upload needs HR's verdict, including one HR did itself — the
     verification is a separate compliance act from the submission, and the
     principal employer's record must show who checked it, not merely who
     uploaded it. */
  pushHrNotification(store, {
    kind: 'contribution-upload', severity: withVariance.length ? 'warn' : 'info',
    title: s.label + ' worker-level upload awaiting verification · ' + c.name,
    body: (actor.name || 'Someone') + ' uploaded "' + upload.fileName + '" covering ' + upload.acceptedCount +
          ' employee' + (upload.acceptedCount === 1 ? '' : 's') +
          (upload.months.length ? ' for ' + upload.months.join(', ') : '') +
          ' · ₹' + totalDeclared.toLocaleString('en-IN') + ' declared' +
          (checkable.length ? ' against ₹' + totalExpected.toLocaleString('en-IN') + ' expected' : '') +
          (withVariance.length ? ' · ' + withVariance.length + ' row(s) differ from the statutory formula' : '') +
          (upload.rejectedCount ? ' · ' + upload.rejectedCount + ' row(s) rejected' : '') +
          '. Awaiting HR verification.',
    contractorId: c.id, contractorName: c.name, ref: upload.id, by: actor.name
  });
  res.json({ ok: true, upload, accepted: accepted.length, rejected });
}

/* HR's verdict on an uploaded file. Mirrors the firm-month verification: the
   upload is the agency's claim, this is the principal employer's record that it
   was checked — without which the joint liability stays undischarged. */
function contribPostVerify(req, res) {
  const store = storeOr503(res); if (!store) return;
  if (!requireHR(req, res)) return;
  const rec = contribUploadList(store).find((x) => x.id === req.params.id);
  if (!rec) return res.status(404).json({ ok: false, error: 'upload not found' });
  const p = req.body || {};
  if (CONTRIB_VERDICTS.indexOf(String(p.status)) === -1) {
    return res.status(400).json({ ok: false, error: 'status must be one of full | partial | none' });
  }
  const note = String(p.note || '').trim();
  if (String(p.status) !== 'full' && !note) {
    return res.status(400).json({ ok: false, error: 'a partial or not-paid verdict needs a note saying what was short' });
  }
  const actor = actorOf(req);
  const prior = rec.verification || null;
  rec.verification = {
    status: String(p.status),
    note,
    /* the figures the verdict was reached against, frozen at verification time
       so a later re-upload cannot silently re-base what HR signed off */
    declaredTotal: Number(rec.totalAmount || 0),
    expectedTotal: Number(rec.totalExpected || 0),
    varianceRows: Number(rec.varianceRows || 0),
    employeesCovered: Number(rec.acceptedCount || 0),
    by: actor.name, at: new Date().toISOString()
  };
  rec.verifiedAt = rec.verification.at;
  rec.verificationHistory = (rec.verificationHistory || []).concat(prior ? [prior] : []);
  dbPut('contributionUploads', rec.id, rec);
  /* Verifying the file IS verifying its workers — stamp every row it is still
     the record for, so a worker's own view can answer "was mine checked?"
     without HR having to click through a hundred employees. A row HR verified
     individually is left alone: a deliberate per-worker verdict outranks a
     blanket one, and silently overwriting it would lose the more specific
     finding. */
  let stamped = 0, kept = 0;
  contribList(store).forEach((r) => {
    if (r.uploadId !== rec.id) return;
    if (r.verification && r.verification.via === 'row') { kept++; return; }
    r.verification = contribRowVerdict(r, String(p.status), note, actor.name, 'upload');
    r.verifiedAt = r.verification.at;
    dbPut('workerContributions', r.id, r);
    stamped++;
  });
  res.json({ ok: true, upload: rec, workersStamped: stamped, workersKeptIndividual: kept });
}

/* HR-only correction path — a single contribution row can be re-stated without
   re-uploading the whole file (e.g. a challan number typed wrong). */
function contribPostRowEdit(req, res) {
  const store = storeOr503(res); if (!store) return;
  if (!requireHR(req, res)) return;
  const rec = contribList(store).find((x) => x.id === req.params.id);
  if (!rec) return res.status(404).json({ ok: false, error: 'contribution not found' });
  const p = req.body || {};
  const actor = actorOf(req);
  if (p.status !== undefined) rec.status = contribNormStatus(p.status);
  if (p.challanNo !== undefined) rec.challanNo = contribKey(p.challanNo);
  if (p.paidOn !== undefined) rec.paidOn = contribKey(p.paidOn);
  if (p.amount !== undefined) {
    rec.amount = Number(p.amount) || 0;
    /* re-derive the variance so a corrected amount is reconciled, not stale */
    if (rec.expectedTotal !== null && rec.expectedTotal !== undefined) {
      rec.variance = Math.round((rec.amount - rec.expectedTotal) * 100) / 100;
    }
  }
  if (p.note !== undefined) rec.note = contribKey(p.note);
  rec.updatedAt = new Date().toISOString();
  rec.updatedBy = actor.name;
  dbPut('workerContributions', rec.id, rec);
  res.json({ ok: true, contribution: rec });
}


/* route registrations — one implementation, mounted where each caller expects */
app.get('/api/contributions', contribGetContributions);
app.get('/api/contribution-uploads', contribGetUploads);
app.post('/api/contributions/upload', contribPostUpload);
app.post('/api/contribution-uploads/:id/verify', contribPostVerify);
/* per-worker verification — registered BEFORE the row-edit route so the more
   specific path wins; '/:id' would otherwise swallow '/:id/verify' */
app.post('/api/contributions/:id/verify', contribPostRowVerify);
app.post('/api/contributions/:id', contribPostRowEdit);

/* ── Compatibility · the ESIC-only routes this feature shipped with ─────────
   A browser tab opened before this change still calls these. They pin the
   scheme to esic and hand straight to the same handlers, so there is one
   implementation and the old paths cannot drift from the new ones. */
app.get('/api/esic-contributions', (req, res) => {
  req.query = Object.assign({}, req.query, { scheme: 'esic' });
  return contribGetContributions(req, res);
});
app.get('/api/esic-uploads', (req, res) => {
  req.query = Object.assign({}, req.query, { scheme: 'esic' });
  return contribGetUploads(req, res);
});
app.post('/api/esic-contributions/upload', (req, res) => {
  req.body = Object.assign({}, req.body, { scheme: 'esic' });
  return contribPostUpload(req, res);
});
app.post('/api/esic-contributions/:id', (req, res) => contribPostRowEdit(req, res));

/* ── Migration · the ESIC-only collections this feature shipped with ────────
   Rows written before the scheme discriminator existed live in esicUploads /
   esicContributions. They are copied across once, tagged scheme 'esic', so an
   agency that has already uploaded does not lose its record — and are matched
   by id, so a re-run cannot duplicate them. The originals are left in place
   rather than deleted: nothing reads them any more, and a one-way copy is the
   safer half of the trade. */
function migrateEsicContributions() {
  const store = readStore();
  if (!store || !store.data) return;
  const ups = contribUploadList(store);
  const rows = contribList(store);
  const haveUp = {}; ups.forEach((u) => { haveUp[u.id] = 1; });
  const haveRow = {}; rows.forEach((r) => { haveRow[r.id] = 1; });
  let moved = 0;
  (store.data.esicUploads || []).forEach((u) => {
    if (haveUp[u.id]) return;
    const next = Object.assign({}, u, {
      scheme: 'esic',
      totalExpected: 0, checkedRows: 0, varianceRows: 0, totalVariance: 0,
      verification: u.verification || null
    });
    ups.push(next); dbPut('contributionUploads', next.id, next); moved++;
  });
  (store.data.esicContributions || []).forEach((r) => {
    if (haveRow[r.id]) return;
    const expected = contribExpected('esic', r.wages);
    const next = Object.assign({}, r, {
      scheme: 'esic',
      memberId: r.memberId != null ? r.memberId : (r.esiNumber || ''),
      expectedEmployee: expected ? expected.employee : null,
      expectedEmployer: expected ? expected.employer : null,
      expectedTotal: expected ? expected.total : null,
      outOfScope: expected ? !!expected.outOfScope : false,
      variance: expected ? Math.round((Number(r.amount || 0) - expected.total) * 100) / 100 : null
    });
    rows.push(next); dbPut('workerContributions', next.id, next); moved++;
  });
  if (moved) console.log('[contrib] migrated ' + moved + ' ESIC record(s) into the scheme-aware tables');
}

/* ── Worker employment status (Active / Inactive / … / Exited) ──────────────
   The status drives access. An agency can REQUEST a change; only HR can make
   one, and every transition is appended to an immutable event log.
   ──────────────────────────────────────────────────────────────────────── */
const WORK_STATUSES = ['active', 'inactive', 'notice', 'suspended', 'exited'];

function findCapture(store, id) {
  const list = store.data.onboardingCaptures || [];
  return list.find((c) => c.id === id || c.workerId === id) || null;
}
function logStatusEvent(store, entry) {
  store.data.workerStatusEvents = store.data.workerStatusEvents || [];
  const rec = Object.assign({ id: newId('wse'), at: new Date().toISOString() }, entry);
  store.data.workerStatusEvents.push(rec);
  dbPut('workerStatusEvents', rec.id, rec);
  return rec;
}
app.get('/api/worker-status-events', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  let list = (store.data.workerStatusEvents || []).slice();
  if (req.query.workerId) list = list.filter((e) => e.workerId === req.query.workerId);
  res.json({ ok: true, events: list.reverse().slice(0, 500) });
});

app.post('/api/worker-status', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  if (!requireHR(req, res)) return;
  const p = req.body || {};
  const rec = findCapture(store, p.workerId);
  if (!rec) return res.status(404).json({ ok: false, error: 'worker not found' });
  if (WORK_STATUSES.indexOf(String(p.status)) === -1) {
    return res.status(400).json({ ok: false, error: 'status must be one of ' + WORK_STATUSES.join(' | ') });
  }
  if (String(p.status) === 'exited') {
    return res.status(400).json({ ok: false, code: 'USE_EXIT', error: 'Use the exit workflow (/api/worker-exit) so the access-revocation and data-disposition records are produced.' });
  }
  const actor = actorOf(req);
  const from = rec.workStatus || 'active';
  rec.workStatus = String(p.status);
  rec.workStatusReason = String(p.reason || '');
  rec.workStatusAt = new Date().toISOString();
  rec.workStatusBy = actor.name;
  rec.statusRequest = null;             // an HR decision closes any open request
  rec.updatedAt = rec.workStatusAt;
  dbPut('onboardingCaptures', rec.id, rec);
  const ev = logStatusEvent(store, {
    workerId: rec.id, workerName: rec.name, from, to: rec.workStatus,
    reason: rec.workStatusReason, by: actor.name, byRole: 'HR', source: 'hr-change'
  });
  licenceRecheckForWorker(store, rec, 'status-change', actor.name);
  res.json({ ok: true, capture: rec, event: ev });
});

/* An agency raises a request; HR is notified and decides. Nothing changes yet. */
app.post('/api/worker-status/request', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  const p = req.body || {};
  const rec = findCapture(store, p.workerId);
  if (!rec) return res.status(404).json({ ok: false, error: 'worker not found' });
  if (WORK_STATUSES.indexOf(String(p.status)) === -1) {
    return res.status(400).json({ ok: false, error: 'status must be one of ' + WORK_STATUSES.join(' | ') });
  }
  const actor = actorOf(req);
  const from = rec.workStatus || 'active';
  const request = {
    id: newId('sr'), from, to: String(p.status), reason: String(p.reason || ''),
    by: actor.name, byRole: actor.role || 'contractor', at: new Date().toISOString(), state: 'pending'
  };
  rec.statusRequest = request;
  rec.updatedAt = request.at;
  dbPut('onboardingCaptures', rec.id, rec);
  logStatusEvent(store, {
    workerId: rec.id, workerName: rec.name, from, to: request.to, reason: request.reason,
    by: actor.name, byRole: request.byRole, source: 'agency-request', requestId: request.id
  });
  pushHrNotification(store, {
    kind: 'status-change-request', severity: 'warn',
    title: 'Status change requested · ' + rec.name,
    body: (actor.name || 'The agency') + ' requested ' + rec.name + ' (' + rec.id + ') move from ' +
          from + ' to ' + request.to + (request.reason ? ' — ' + request.reason : '') +
          '. Only HR can apply this change.',
    workerId: rec.id, workerName: rec.name,
    contractorName: (rec.employment || {}).contractor || '', ref: request.id, by: actor.name
  });
  res.json({ ok: true, request, capture: rec });
});

/* HR approves or rejects an agency request. Approving applies the status. */
app.post('/api/worker-status/request/:id/resolve', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  if (!requireHR(req, res)) return;
  const list = store.data.onboardingCaptures || [];
  const rec = list.find((c) => c.statusRequest && c.statusRequest.id === req.params.id);
  if (!rec) return res.status(404).json({ ok: false, error: 'request not found or already resolved' });
  const decision = String((req.body || {}).decision || '').toLowerCase();
  if (decision !== 'approve' && decision !== 'reject') {
    return res.status(400).json({ ok: false, error: 'decision must be approve | reject' });
  }
  const actor = actorOf(req);
  const request = rec.statusRequest;
  const nowIso = new Date().toISOString();
  if (decision === 'approve' && request.to === 'exited') {
    return res.status(400).json({ ok: false, code: 'USE_EXIT', error: 'Approving an exit must go through the exit workflow so the DPDP disposition record is produced.' });
  }
  if (decision === 'approve') {
    rec.workStatus = request.to;
    rec.workStatusReason = request.reason;
    rec.workStatusAt = nowIso;
    rec.workStatusBy = actor.name;
  }
  rec.statusRequest = null;
  rec.updatedAt = nowIso;
  dbPut('onboardingCaptures', rec.id, rec);
  const ev = logStatusEvent(store, {
    workerId: rec.id, workerName: rec.name, from: request.from,
    to: decision === 'approve' ? request.to : request.from,
    reason: (decision === 'approve' ? 'Approved agency request' : 'Rejected agency request') +
            (req.body.note ? ' — ' + req.body.note : ''),
    by: actor.name, byRole: 'HR', source: 'hr-' + decision, requestId: request.id
  });
  /* close the matching HR-inbox item */
  (store.data.hrNotifications || []).forEach((n) => {
    if (n.ref === request.id && !n.read) { n.read = true; n.readAt = nowIso; n.readBy = actor.name; dbPut('hrNotifications', n.id, n); }
  });
  if (decision === 'approve') licenceRecheckForWorker(store, rec, 'status-change', actor.name);
  res.json({ ok: true, capture: rec, decision, event: ev });
});

/* ── CR-9 · exit = access revocation + statutory data disposition ───────────
   DPDP 2023 makes continued processing without a purpose unlawful, so exit
   produces TWO records: what access was cut and when, and what data is kept
   (under which statute, for how long) versus deleted / anonymised.
   ──────────────────────────────────────────────────────────────────────── */
const DISPOSITION_SCHEDULE = [
  { key: 'attendance',  label: 'Attendance & wage register',                 action: 'retain',    years: 5,
    basis: 'Code on Wages 2019 · s.50 r/w Rules — wage & attendance records retained 5 years' },
  { key: 'epfEsic',     label: 'EPF / ESIC contribution records & challans', action: 'retain',    years: 7,
    basis: 'EPF Scheme 1952 para 36 / ESIC Regulations — contribution records retained 7 years' },
  { key: 'appointment', label: 'Appointment letter & employment contract',   action: 'retain',    years: 5,
    basis: 'Code on Wages 2019 · appointment-letter mandate — retained for the statutory period' },
  { key: 'safety',      label: 'Induction, PPE issue & safety training records', action: 'retain', years: 3,
    basis: 'OSH & Working Conditions Code 2020 — training and accident records' },
  { key: 'idProof',     label: 'Identity documents (Aadhaar eKYC artefact, PAN scan)', action: 'delete', days: 30,
    basis: 'DPDP 2023 · s.8(7) — erase once the purpose (verification) is served' },
  { key: 'biometric',   label: 'Biometric templates & worker photograph',    action: 'delete',    days: 30,
    basis: 'DPDP 2023 · s.8(7) — no residual purpose after exit' },
  { key: 'health',      label: 'Medical fitness & health data',              action: 'delete',    days: 30,
    basis: 'DPDP 2023 · s.8(7) — sensitive data, no residual purpose' },
  { key: 'consent',     label: 'Consent-linked data (night-shift transport consent, boarding log)', action: 'anonymise', days: 30,
    basis: 'DPDP 2023 · purpose limitation — retained in aggregate for OSHC R.83 evidence, de-identified' },
  { key: 'contact',     label: 'WhatsApp / mobile number & chat threads',    action: 'delete',    days: 30,
    basis: 'DPDP 2023 · s.8(7) — communication channel closed with employment' }
];
function dispositionFor(lastWorkingDay) {
  const base = lastWorkingDay ? new Date(lastWorkingDay) : new Date();
  const anchor = isNaN(base.getTime()) ? new Date() : base;
  return DISPOSITION_SCHEDULE.map((d) => {
    const until = new Date(anchor);
    if (d.years) until.setFullYear(until.getFullYear() + d.years);
    else until.setDate(until.getDate() + (d.days || 30));
    return Object.assign({}, d, { until: until.toISOString().slice(0, 10) });
  });
}
app.get('/api/exit-records', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  let list = (store.data.exitRecords || []).slice().reverse();
  if (req.query.workerId) list = list.filter((r) => r.workerId === req.query.workerId);
  res.json({ ok: true, exits: list, schedule: DISPOSITION_SCHEDULE });
});
app.post('/api/worker-exit', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  if (!requireHR(req, res)) return;
  const p = req.body || {};
  const rec = findCapture(store, p.workerId);
  if (!rec) return res.status(404).json({ ok: false, error: 'worker not found' });
  const actor = actorOf(req);
  const nowIso = new Date().toISOString();
  const lastDay = String(p.lastWorkingDay || '').slice(0, 10) || nowIso.slice(0, 10);

  /* 1 · access revocation — immediate, and the login is actually disabled */
  const revocation = {
    at: nowIso, by: actor.name,
    channels: ['Karya Vaani worker login', 'WhatsApp worker broadcast list', 'Transport boarding roster', 'Plant gate ID card'],
    loginUsername: rec.loginUsername || null,
    loginDisabled: false
  };
  if (rec.loginUsername) {
    const u = (store.data.users || []).find((x) => x.username === rec.loginUsername);
    if (u) {
      u.disabled = true; u.disabledAt = nowIso; u.disabledBy = actor.name; u.disabledReason = 'Worker exit · DPDP access revocation';
      persistUser(store, u);
      revocation.loginDisabled = true;
    }
  }

  /* 2 · statutory data-disposition record — the artefact a Data Protection
     Board would ask for: what was kept, under which obligation, for how long. */
  const disposition = dispositionFor(lastDay);
  const exitRec = {
    id: newId('exit'),
    workerId: rec.id, workerName: rec.name, workerCode: rec.workerId || rec.id,
    type: rec.type || 'contract',
    contractor: (rec.employment || {}).contractor || (rec.type === 'direct' ? TENANT.directEmployer : ''),
    reason: String(p.reason || 'Not stated'),
    note: String(p.note || ''),
    lastWorkingDay: lastDay,
    revocation, disposition,
    createdAt: nowIso, createdBy: actor.name
  };
  store.data.exitRecords = store.data.exitRecords || [];
  store.data.exitRecords.push(exitRec);
  dbPut('exitRecords', exitRec.id, exitRec);

  const from = rec.workStatus || 'active';
  rec.workStatus = 'exited';
  rec.workStatusReason = exitRec.reason;
  rec.workStatusAt = nowIso;
  rec.workStatusBy = actor.name;
  rec.statusRequest = null;
  rec.accessRevokedAt = nowIso;
  rec.exitRecordId = exitRec.id;
  rec.lastWorkingDay = lastDay;
  rec.updatedAt = nowIso;
  dbPut('onboardingCaptures', rec.id, rec);
  logStatusEvent(store, {
    workerId: rec.id, workerName: rec.name, from, to: 'exited', reason: exitRec.reason,
    by: actor.name, byRole: 'HR', source: 'exit', exitRecordId: exitRec.id
  });
  /* an exit releases the licence slot — this is often what brings an agency
     back under its warning threshold */
  licenceRecheckForWorker(store, rec, 'exit', actor.name);
  res.json({ ok: true, exit: exitRec, capture: rec });
});

/* ── CR-3 · transport route assignment log (append-only) ────────────────────
   Route numbers are persistent identifiers, so a re-assignment must never
   overwrite history: a past boarding or night-shift consent record stays
   traceable to the route the worker was actually on at the time.
   ──────────────────────────────────────────────────────────────────────── */
app.get('/api/transport/route-assignments', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  let list = (store.data.routeAssignments || []).slice();
  if (req.query.worker) list = list.filter((r) => r.workerId === req.query.worker || r.workerCode === req.query.worker);
  if (req.query.routeNo) list = list.filter((r) => r.toRouteNo === req.query.routeNo || r.fromRouteNo === req.query.routeNo);
  res.json({ ok: true, assignments: list.slice(-500).reverse() });
});
app.post('/api/transport/route-assignment', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  const p = req.body || {};
  if (!p.workerId && !p.workerCode) return res.status(400).json({ ok: false, error: 'workerId or workerCode is required' });
  const actor = actorOf(req);
  const rec = {
    id: newId('ra'),
    workerId: p.workerId || p.workerCode, workerCode: p.workerCode || p.workerId, workerName: p.workerName || '',
    fromRouteNo: p.fromRouteNo || '', fromRoute: p.fromRoute || '',
    toRouteNo: p.toRouteNo || '', toRoute: p.toRoute || '',
    shift: p.shift || '', reason: p.reason || '',
    by: actor.name, byRole: actor.role || 'hr', at: new Date().toISOString()
  };
  store.data.routeAssignments = store.data.routeAssignments || [];
  store.data.routeAssignments.push(rec);
  dbPut('routeAssignments', rec.id, rec);
  res.json({ ok: true, assignment: rec });
});

/* ── CR-7 · monthly OT / LOP / variable-allowance log ───────────────────────
   Overtime at 125% of the ordinary wage rate is a Code on Wages obligation and
   is computed here (never free-typed). Loss of Pay and variable allowances are
   operational payroll administration — logged in the same monthly register
   because the Code on Wages 5-year retention window covers the register, not
   because either is itself a statutory obligation.
   ──────────────────────────────────────────────────────────────────────── */
const ESIC_WAGE_CEILING = 21000;      // ₹/month — ESIC coverage threshold
const OT_MULTIPLIER = 1.25;           // overtime paid at 125% of the ordinary wage rate
const STANDARD_DAYS = 26;
const STANDARD_HOURS = 8;

function computePayrollRow(p) {
  const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const baseWage = n(p.baseWage);
  const otHours = n(p.otHours);
  const lopDays = n(p.lopDays);
  const allowances = Array.isArray(p.allowances)
    ? p.allowances.filter((a) => a && a.label).map((a) => ({ label: String(a.label), amount: n(a.amount) }))
    : [];
  const dailyRate = baseWage / STANDARD_DAYS;
  const ordinaryHourly = dailyRate / STANDARD_HOURS;
  const otHourly = ordinaryHourly * OT_MULTIPLIER;
  const otAmount = Math.round(otHourly * otHours);
  const lopAmount = Math.round(dailyRate * lopDays);
  const allowanceTotal = allowances.reduce((s, a) => s + a.amount, 0);
  const grossWages = Math.round(baseWage + otAmount + allowanceTotal - lopAmount);
  /* ESIC coverage follows the monthly WAGES actually payable, so overtime can
     push a worker over the ceiling and change their contribution status. */
  const esicBefore = baseWage <= ESIC_WAGE_CEILING;
  const esicAfter = grossWages <= ESIC_WAGE_CEILING;
  return {
    baseWage, otHours, lopDays, allowances,
    dailyRate: Math.round(dailyRate * 100) / 100,
    ordinaryHourly: Math.round(ordinaryHourly * 100) / 100,
    otHourly: Math.round(otHourly * 100) / 100,
    otMultiplier: OT_MULTIPLIER,
    otAmount, lopAmount, allowanceTotal, grossWages,
    esicCeiling: ESIC_WAGE_CEILING,
    esicCoveredOnBase: esicBefore,
    esicCoveredOnGross: esicAfter,
    /* the flag HR must act on: covered on base pay, pushed over by OT */
    esicCeilingCrossed: esicBefore && !esicAfter,
    esicEmployee: esicAfter ? Math.round(grossWages * 0.0075) : 0,
    esicEmployer: esicAfter ? Math.round(grossWages * 0.0325) : 0,
    epfEmployee: Math.round(Math.min(baseWage, 15000) * 0.12),
    epfEmployer: Math.round(Math.min(baseWage, 15000) * 0.13)
  };
}

app.get('/api/payroll/monthly', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  let list = (store.data.payrollMonths || []).slice();
  if (req.query.month) list = list.filter((r) => r.month === req.query.month);
  if (req.query.worker) list = list.filter((r) => r.workerId === req.query.worker || r.workerCode === req.query.worker);
  if (req.query.contractor) {
    const k = String(req.query.contractor).trim().toLowerCase();
    list = list.filter((r) => String(r.contractor || '').trim().toLowerCase() === k);
  }
  const months = Array.from(new Set((store.data.payrollMonths || []).map((r) => r.month))).sort().reverse();
  res.json({ ok: true, rows: list, months, ceiling: ESIC_WAGE_CEILING, otMultiplier: OT_MULTIPLIER });
});

app.post('/api/payroll/monthly', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  if (!requireHR(req, res)) return;
  const p = req.body || {};
  if (!p.workerCode && !p.workerId) return res.status(400).json({ ok: false, error: 'workerCode is required' });
  if (!/^\d{4}-\d{2}$/.test(String(p.month || ''))) return res.status(400).json({ ok: false, error: 'month must be YYYY-MM' });
  const actor = actorOf(req);
  const nowIso = new Date().toISOString();
  const computed = computePayrollRow(p);
  store.data.payrollMonths = store.data.payrollMonths || [];
  const list = store.data.payrollMonths;
  const code = String(p.workerCode || p.workerId);
  const idx = list.findIndex((r) => String(r.workerCode) === code && r.month === p.month);
  const row = Object.assign({
    id: idx !== -1 ? list[idx].id : newId('pay'),
    month: String(p.month),
    workerCode: code, workerId: p.workerId || code, workerName: String(p.workerName || ''),
    /* the employee id this entry was filed under — the key the statutory
       returns and the worker-level ESIC upload are reconciled on. Preserved
       across edits so a later blank does not erase it. */
    employeeId: String(p.employeeId || (idx !== -1 ? list[idx].employeeId : '') || ''),
    workerType: p.workerType || 'contract',
    contractor: String(p.contractor || ''),
    department: String(p.department || ''),
    category: String(p.category || ''),
    note: String(p.note || ''),
    /* the register is a statutory record — keep who wrote each revision */
    updatedBy: actor.name, updatedAt: nowIso,
    createdAt: idx !== -1 ? list[idx].createdAt : nowIso,
    retainUntil: String(p.month) + ' + 5 years (Code on Wages record retention)'
  }, computed);
  if (idx !== -1) list[idx] = row; else list.push(row);
  dbPut('payrollMonths', row.id, row);
  res.json({ ok: true, row });
});

app.delete('/api/payroll/monthly/:id', (req, res) => {
  const store = storeOr503(res); if (!store) return;
  if (!requireHR(req, res)) return;
  const list = store.data.payrollMonths || [];
  const idx = list.findIndex((r) => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ ok: false, error: 'row not found' });
  list.splice(idx, 1);
  dbDel('payrollMonths', req.params.id);
  res.json({ ok: true });
});

/* Backfill the fields the compliance change requests introduced onto stores
   that were seeded before them, so an already-running deployment gets the
   licence ceiling and the persistent route numbers without a re-seed.
   Idempotent: only ever fills a missing value, never overwrites one HR set. */
function ensureComplianceDefaults() {
  const store = readStore();
  if (!store || !store.data) return;

  /* CR-8 · a CLRA licence ceiling per contractor, plus the separate commercial
     contracted headcount. The licence is applied for in round numbers above the
     deployment; the commercial number is the agreed supply level. */
  /* An agency applies for a licence with room to grow into, and how much room
     differs by agency — so the backfilled ceilings are spread across the bands
     the utilisation alert cares about (comfortable / approaching / critical)
     rather than all sitting just above the deployed headcount. The cycle is
     indexed, not random, so a re-boot before the first write is stable. */
  const LICENCE_HEADROOM_CYCLE = [1.70, 1.55, 1.30, 1.85, 1.45, 1.12, 1.60, 1.05];
  (store.data.contractors || []).forEach((c, i) => {
    let touched = false;
    /* An agency whose real licensed headcount is known by policy is pinned to
       it, correcting a ceiling an earlier boot invented. Unlike the backfill
       below this is NOT guarded on "missing" — a store seeded under the older
       formula already holds a number, and leaving it there is the whole problem.
       It is still guarded on HR: a licence HR has saved by hand is never
       re-pinned, so this can only ever overwrite a machine-generated value. */
    const pinned = licenceCeilingFor(c.name);
    if (pinned != null && !licenceSetByHR(c.clraLicence)) {
      if (!c.clraLicence || c.clraLicence.maxHeadcount !== pinned) {
        c.clraLicence = Object.assign({
          number: 'CLRA/' + String(c.id || '').replace(/[^A-Z0-9]/gi, '') + '/2026',
          authority: TENANT.licensingAuthority,
          validTill: (c.clra && c.clra.expiresOn) || ''
        }, c.clraLicence || {}, { maxHeadcount: pinned });
        touched = true;
      }
      /* keep the commercial supply number from sitting below the statutory
         ceiling, which would flag a permanent advisory breach the agency has
         no way to act on */
      if (c.commercialHeadcount == null || Number(c.commercialHeadcount) < pinned) {
        c.commercialHeadcount = pinned;
        touched = true;
      }
    }
    if (!c.clraLicence || c.clraLicence.maxHeadcount == null) {
      const deployed = Number(c.deployed || 0);
      const factor = LICENCE_HEADROOM_CYCLE[i % LICENCE_HEADROOM_CYCLE.length];
      /* licences are applied for in round numbers, and always above the
         headcount actually deployed under them */
      const applied = Math.ceil((deployed * factor) / 10) * 10;
      c.clraLicence = Object.assign({
        number: 'CLRA/' + String(c.id || '').replace(/[^A-Z0-9]/gi, '') + '/2026',
        authority: TENANT.licensingAuthority,
        validTill: (c.clra && c.clra.expiresOn) || '',
        maxHeadcount: Math.max(deployed + 1, applied)
      }, c.clraLicence || {});
      touched = true;
    }
    if (c.commercialHeadcount == null) {
      c.commercialHeadcount = Math.ceil((Number(c.deployed || 0) + 1) / 10) * 10;
      touched = true;
    }
    if (touched) dbPut('contractors', c.id, c);
  });

  /* CR-8a · evaluate the licence-utilisation alerts once on boot, so an agency
     that is already past its warning threshold on seeded data is flagged
     without waiting for the next onboarding to happen through the UI. */
  store.data.licenceAlerts = store.data.licenceAlerts || [];
  evaluateAllLicenceAlerts(store, { trigger: 'boot', by: 'System' });

  /* CR-3 · a unique, persistent route number on every transport route. */
  const routes = store.data.routes || [];
  const taken = {};
  routes.forEach((r) => { if (r.routeNo) taken[r.routeNo] = 1; });
  routes.forEach((r, i) => {
    if (r.routeNo) return;
    let n = i + 1, candidate;
    do { candidate = 'RT-' + String(n).padStart(2, '0'); n++; } while (taken[candidate]);
    taken[candidate] = 1;
    r.routeNo = candidate;
    r.routeNoAssignedAt = r.routeNoAssignedAt || new Date().toISOString();
    dbPut('routes', r.code || r.bus, r);
  });
}

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

  /* non-secret fingerprint of the seed password, so a credential change in
     DEMO_ACCOUNTS re-applies to already-seeded accounts on the next boot
     (without it, `ensureDemoUsers` only sets the password on first create). */
  const pwFp = (p) => crypto.createHash('sha256').update('kvseed:' + String(p)).digest('hex').slice(0, 16);

  DEMO_ACCOUNTS.forEach((a) => {
    let u = byName[a.username];
    let touched = false;
    if (!u) {
      u = {
        username: a.username, role: a.role, title: a.title, email: a.email || '',
        name: a.name, linkedType: a.linkedType, linkedId: '', linkedName: '',
        passwordHash: hashPassword(a.password), pwSeedFp: pwFp(a.password), createdAt: nowIso
      };
      store.data.users.push(u); byName[a.username] = u; seeded.push(a.username); touched = true;
    } else if (u.pwSeedFp !== pwFp(a.password)) {
      /* the seed credential changed — reset this account's password to match. */
      u.passwordHash = hashPassword(a.password); u.pwSeedFp = pwFp(a.password); touched = true;
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
  /* CR-9 · access revoked on exit. The account keeps existing (the statutory
     records behind it must survive) but it can no longer sign in. */
  if (u.disabled) {
    return res.status(403).json({
      ok: false, code: 'ACCESS_REVOKED',
      error: 'This account’s access was revoked on ' +
        (u.disabledAt ? new Date(u.disabledAt).toLocaleDateString('en-IN') : 'exit') +
        '. Contact Plant HR if this is an error.'
    });
  }
  res.json({ ok: true, user: publicUser(u) });
});

const PORT = process.env.PORT || 4000;
/* Connect to Postgres and warm the store cache (creates the table + migrates
   the file store on first run) before accepting requests. Falls back to the
   file store inside initDb() if the DB is unreachable, so this never blocks boot. */
Promise.resolve(initDb())
  .then(() => { try { ensureDemoUsers(); } catch (e) { console.error('[auth] demo user seed failed:', e.message); } })
  .then(() => { try { ensureComplianceDefaults(); } catch (e) { console.error('[compliance] default backfill failed:', e.message); } })
  /* carry ESIC rows written before the scheme discriminator into the shared
     tables, and check the two ESIC wage ceilings still agree */
  .then(() => { try { migrateEsicContributions(); contribAssertCeilings(); } catch (e) { console.error('[contrib] migration failed:', e.message); } })
  .catch((err) => console.error('Store init error:', err.message))
  .finally(() => {
    app.listen(PORT, () => console.log(`Karya Vaani backend listening on http://localhost:${PORT}`));
    // Pre-warm template voices into the DB, sequentially, in the background —
    // never blocks boot; skips anything already cached. Disable with VOICE_PREWARM=off.
    if (process.env.VOICE_PREWARM !== 'off') {
      setTimeout(() => { prewarmVoices().catch((e) => console.error('[voice] prewarm error:', e.message)); }, 4000);
      // Welcome voices use Sarvam (separate hosted service from the single-worker
      // local model), so they can warm in parallel with the template prewarm.
      setTimeout(() => { prewarmWelcomeVoices().catch((e) => console.error('[welcome-voice] prewarm error:', e.message)); }, 6000);
    }
  });
