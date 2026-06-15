/* db.js — minimal file-backed store. The seeded roster lives in data/om.db.json.
   No database server and no native modules required. */
const fs = require('fs');
const path = require('path');

const STORE_PATH = process.env.OM_STORE_PATH || path.join(__dirname, 'data', 'om.db.json');

function readStore() {
  if (!fs.existsSync(STORE_PATH)) return null;
  try { return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')); }
  catch { return null; }
}
function writeStore(obj) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(obj, null, 1));
}

module.exports = { STORE_PATH, readStore, writeStore };
