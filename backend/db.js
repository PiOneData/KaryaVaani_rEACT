/* db.js — normalized PostgreSQL store (one table per collection).
   Each collection in the app's bootstrap document gets its own table:
     - array collections  -> rows of (row_id, data jsonb, seq, updated_at)
     - map collections     -> rows of (row_id = map key, data jsonb, …)
   The whole store is still assembled into an in-memory cache so the rest of the
   app keeps its simple synchronous readStore() API and the frontend is
   unchanged. Writes are row-level (dbPut/dbDel) so a single change never
   rewrites the entire dataset.

   Falls back to the legacy JSON file store when DATABASE_URL is not set (local
   dev). On first Postgres run it migrates any existing single-blob `kv_store`
   (or the file store) into the normalized tables, then drops kv_store.

   Configure via env (never hard-code the password):
     DATABASE_URL   postgres connection string
     PGSSL          "true" if the server requires SSL
   ──────────────────────────────────────────────────────────────────────── */
const fs   = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
const STORE_PATH   = process.env.OM_STORE_PATH || path.join(__dirname, 'data', 'om.db.json');

/* collection -> { table, kind, id }.  id(item) yields the stable primary key
   for array collections that the app writes row-by-row; null = insertion-order
   synthetic key (fine for read-only reference collections). */
const COLLECTIONS = {
  omMapping:           { table: 'om_mapping',            kind: 'array', id: (r) => r.code },
  contractors:         { table: 'contractors',           kind: 'array', id: (r) => r.id },
  vendors:             { table: 'vendors',               kind: 'array', id: (r) => String(r.sno) },
  contractWorkers:     { table: 'contract_workers',      kind: 'array', id: null },
  workers:             { table: 'workers',               kind: 'array', id: (r) => r.id },
  requisitions:        { table: 'requisitions',          kind: 'array', id: (r) => r.id },
  routes:              { table: 'routes',                kind: 'array', id: (r) => r.code || r.bus },
  sharedDocs:          { table: 'shared_docs',           kind: 'array', id: null },
  knowledgeCategories: { table: 'knowledge_categories',  kind: 'array', id: null },
  knowledgeDocs:       { table: 'knowledge_docs',        kind: 'array', id: (r) => r.id },
  knowledgeSample:     { table: 'knowledge_sample',      kind: 'array', id: null },
  broadcastWorkers:    { table: 'broadcast_workers',     kind: 'array', id: (r) => r.id },
  broadcastAudiences:  { table: 'broadcast_audiences',   kind: 'array', id: null },
  chatQueue:           { table: 'chat_queue',            kind: 'array', id: null },
  chatSentToday:       { table: 'chat_sent_today',       kind: 'array', id: null },
  ctQuick:             { table: 'ct_quick',              kind: 'array', id: null },
  ctTasks:             { table: 'ct_tasks',              kind: 'array', id: (r) => r.id },
  dashModules:         { table: 'dash_modules',          kind: 'array', id: (r) => r.id },
  capturePositions:    { table: 'capture_positions',     kind: 'array', id: (r) => r.id },
  captureWorkorders:   { table: 'capture_workorders',    kind: 'array', id: (r) => r.id },
  chatContacts:        { table: 'chat_contacts',         kind: 'array', id: (r) => r.id },
  onboardingCaptures:  { table: 'onboarding_captures',   kind: 'array', id: (r) => r.id },
  readinessSurveys:    { table: 'readiness_surveys',     kind: 'array', id: (r) => r.id },
  appointmentOrders:   { table: 'appointment_orders',    kind: 'array', id: (r) => r.id },
  communications:      { table: 'communications',        kind: 'array', id: (r) => r.id },
  chatThreads:         { table: 'chat_threads',          kind: 'map' },
  onboardingDocuments: { table: 'onboarding_documents',  kind: 'map' },
  workerCompliance:    { table: 'worker_compliance',     kind: 'map' }
};
const META_TABLE = 'store_meta';

let _cache = null;
let _pool  = null;

/* ── file store (fallback / build-time seed) ── */
function fileRead() {
  if (!fs.existsSync(STORE_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); } catch { return null; }
}
function fileWrite(obj) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 1));
}

function getPool() {
  if (!_pool) {
    const { Pool } = require('pg');
    _pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
      connectionTimeoutMillis: 30000
    });
    _pool.on('error', (err) => console.error('[db] idle client error:', err.message));
  }
  return _pool;
}

async function ensureSchema() {
  const pool = getPool();
  for (const meta of Object.values(COLLECTIONS)) {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS ${meta.table} (
         row_id     TEXT PRIMARY KEY,
         data       JSONB NOT NULL,
         seq        BIGSERIAL,
         updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
       )`
    );
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS ${META_TABLE} (id TEXT PRIMARY KEY, data JSONB NOT NULL)`);
  // a couple of helpful indexes for reporting on the transactional tables
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_onboarding_captures_status ON onboarding_captures ((data->>'status'))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_communications_channel ON communications ((data->>'channel'))`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_communications_status  ON communications ((data->>'status'))`);
}

/* Replace an entire collection's table with the given value (used by seed +
   migration). Runs in a transaction so a collection is never half-written. */
async function replaceCollection(name, value) {
  const meta = COLLECTIONS[name];
  if (!meta) return;
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM ${meta.table}`);
    if (meta.kind === 'array' && Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const rid = (meta.id && meta.id(value[i]) != null) ? String(meta.id(value[i])) : (name + '_' + i);
        await client.query(`INSERT INTO ${meta.table}(row_id, data) VALUES ($1, $2::jsonb)
                            ON CONFLICT (row_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [rid, JSON.stringify(value[i])]);
      }
    } else if (meta.kind === 'map' && value && typeof value === 'object') {
      for (const key of Object.keys(value)) {
        await client.query(`INSERT INTO ${meta.table}(row_id, data) VALUES ($1, $2::jsonb)
                            ON CONFLICT (row_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`, [key, JSON.stringify(value[key])]);
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK'); throw err;
  } finally {
    client.release();
  }
}

/* Full flush of the whole store into all tables (seed / migration). */
async function flushAll(store) {
  await ensureSchema();
  for (const name of Object.keys(COLLECTIONS)) {
    await replaceCollection(name, (store.data || {})[name]);
  }
  const { data, ...meta } = store;
  await getPool().query(`INSERT INTO ${META_TABLE}(id, data) VALUES ('main', $1::jsonb)
                         ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`, [JSON.stringify(meta)]);
}

/* Assemble the in-memory cache from the normalized tables. */
async function loadCache() {
  const pool = getPool();
  const metaRow = await pool.query(`SELECT data FROM ${META_TABLE} WHERE id = 'main'`);
  const store = Object.assign({ table: 'bootstrap' }, metaRow.rows[0] ? metaRow.rows[0].data : {}, { data: {} });
  for (const [name, meta] of Object.entries(COLLECTIONS)) {
    const rows = (await pool.query(`SELECT row_id, data FROM ${meta.table} ORDER BY seq`)).rows;
    if (meta.kind === 'array') store.data[name] = rows.map((r) => r.data);
    else store.data[name] = Object.fromEntries(rows.map((r) => [r.row_id, r.data]));
  }
  return store;
}

async function tablesEmpty() {
  const pool = getPool();
  for (const meta of Object.values(COLLECTIONS)) {
    const r = await pool.query(`SELECT 1 FROM ${meta.table} LIMIT 1`);
    if (r.rows.length) return false;
  }
  const m = await pool.query(`SELECT 1 FROM ${META_TABLE} LIMIT 1`);
  return m.rows.length === 0;
}

/* initDb() — call once at startup before app.listen(). */
async function initDb() {
  if (!DATABASE_URL) {
    console.log('[db] DATABASE_URL not set — using file store:', STORE_PATH);
    _cache = fileRead();
    return;
  }
  try {
    await ensureSchema();
    if (await tablesEmpty()) {
      // Migrate: prefer an existing single-blob kv_store, else the file store.
      let legacy = null;
      try {
        const kv = await getPool().query(`SELECT to_regclass('public.kv_store') AS t`);
        if (kv.rows[0].t) {
          const row = await getPool().query(`SELECT document FROM kv_store WHERE id = 'main'`);
          if (row.rows.length) legacy = row.rows[0].document;
        }
      } catch (e) { /* no kv_store */ }
      if (!legacy) legacy = fileRead();
      if (legacy) {
        await flushAll(legacy);
        console.log('[db] Migrated existing data into normalized tables.');
        try { await getPool().query(`DROP TABLE IF EXISTS kv_store`); } catch (e) {}
      }
    }
    _cache = await loadCache();
    console.log('[db] Postgres ready (normalized). Collections:', Object.keys(COLLECTIONS).length);
  } catch (err) {
    console.error('[db] Postgres init failed, falling back to file store:', err.message);
    _cache = fileRead();
  }
}

function readStore() {
  if (_cache !== null) return _cache;
  return fileRead(); // covers seed.js before initDb
}

/* Full-store write — used by the seed script (replaces every table). */
function writeStore(obj) {
  _cache = obj;
  if (!DATABASE_URL) { fileWrite(obj); return Promise.resolve(); }
  return flushAll(obj).catch((err) => {
    console.error('[db] flushAll failed — writing file fallback:', err.message);
    try { fileWrite(obj); } catch (e) {}
  });
}

/* ── row-level persistence (used by the API endpoints) ─────────────────────
   dbPut(collection, id, item)  upsert one row
   dbDel(collection, id)        delete one row
   The caller has already updated the in-memory cache; these persist the change
   to just that row. In file-store mode they persist the whole file. */
function dbPut(name, id, item) {
  if (!DATABASE_URL) { fileWrite(_cache); return Promise.resolve(); }
  const meta = COLLECTIONS[name];
  if (!meta) return Promise.resolve();
  return getPool().query(
    `INSERT INTO ${meta.table}(row_id, data, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (row_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [String(id), JSON.stringify(item)]
  ).catch((err) => { console.error(`[db] put ${name} failed:`, err.message); try { fileWrite(_cache); } catch (e) {} });
}
function dbDel(name, id) {
  if (!DATABASE_URL) { fileWrite(_cache); return Promise.resolve(); }
  const meta = COLLECTIONS[name];
  if (!meta) return Promise.resolve();
  return getPool().query(`DELETE FROM ${meta.table} WHERE row_id = $1`, [String(id)])
    .catch((err) => { console.error(`[db] del ${name} failed:`, err.message); try { fileWrite(_cache); } catch (e) {} });
}

module.exports = { STORE_PATH, readStore, writeStore, initDb, dbPut, dbDel };
