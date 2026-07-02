/* db.js — PostgreSQL-backed store with in-memory cache.
   Falls back to the legacy JSON file store if DATABASE_URL is not set.
   readStore() / writeStore() remain synchronous for all callers in server.js. */

const fs   = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;
const STORE_PATH   = process.env.OM_STORE_PATH || path.join(__dirname, 'data', 'om.db.json');

// In-memory cache — keeps the public API synchronous.
let _cache = null;
let _pool  = null;

/* ── Postgres helpers ──────────────────────────────────────────────────── */

function getPool() {
  if (!_pool) {
    const { Pool } = require('pg');
    _pool = new Pool({
      connectionString: DATABASE_URL,
      // Retry connection for up to 30 s to handle postgres startup lag.
      connectionTimeoutMillis: 30000,
    });
    _pool.on('error', (err) => console.error('[db] idle client error:', err.message));
  }
  return _pool;
}

async function ensureTable() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS kv_store (
      id       TEXT PRIMARY KEY DEFAULT 'main',
      document JSONB NOT NULL
    )
  `);
}

async function pgRead() {
  const { rows } = await getPool().query(
    'SELECT document FROM kv_store WHERE id = $1',
    ['main']
  );
  return rows.length ? rows[0].document : null;
}

function pgWrite(obj) {
  getPool().query(
    `INSERT INTO kv_store(id, document) VALUES($1, $2)
     ON CONFLICT (id) DO UPDATE SET document = EXCLUDED.document`,
    ['main', obj]
  ).catch((err) => console.error('[db] postgres write error:', err.message));
}

/* ── File-backed helpers (fallback) ────────────────────────────────────── */

function fileRead() {
  if (!fs.existsSync(STORE_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
  catch { return null; }
}

function fileWrite(obj) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 1));
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * initDb() — call once at startup before app.listen().
 * Connects to postgres, creates the table, and warms the cache.
 * If the table is empty on first run, migrates existing om.db.json into it.
 * No-op (file-store mode) when DATABASE_URL is not set.
 */
async function initDb() {
  if (!DATABASE_URL) {
    console.log('[db] DATABASE_URL not set — using file store:', STORE_PATH);
    _cache = fileRead();
    return;
  }
  try {
    await ensureTable();
    _cache = await pgRead();

    if (!_cache) {
      // First run: migrate existing JSON file into postgres so no data is lost.
      const legacy = fileRead();
      if (legacy) {
        pgWrite(legacy);
        _cache = legacy;
        console.log('[db] Migrated existing om.db.json into postgres (kv_store).');
      }
    }
    console.log('[db] Connected to postgres. Store ready:', !!_cache);
  } catch (err) {
    console.error('[db] Postgres init failed, falling back to file store:', err.message);
    _cache = fileRead();
  }
}

/** Synchronous read — returns cached document (or null if not yet seeded). */
function readStore() {
  if (_cache !== null) return _cache;
  // Fallback: covers seed.js which calls writeStore before initDb runs.
  return fileRead();
}

/**
 * Synchronous write — updates the in-memory cache immediately, then persists
 * asynchronously to postgres (or synchronously to the file in fallback mode).
 */
function writeStore(obj) {
  _cache = obj;
  if (DATABASE_URL) {
    pgWrite(obj);
  } else {
    fileWrite(obj);
  }
}

module.exports = { STORE_PATH, readStore, writeStore, initDb };
