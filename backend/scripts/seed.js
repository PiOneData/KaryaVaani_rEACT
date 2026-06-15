/**
 * seed.js — builds the Karya Vaani data store consumed by /api/bootstrap.
 * Real data is parsed live from the source files in the parent folder:
 *   - "OM Manpower_Attendance_Mapping Data.ods"     -> omMapping (181 associates)
 *   - "Headcount_ Trainee & Contract.xlsx"          -> routes (14) + vendors (17)
 * The remaining UI demo collections come from data/demo_seed.json.
 * Each real source falls back to its committed *_seed.json if the file is absent.
 * Run: npm run seed
 */
const path = require('path');
const fs = require('fs');
const { writeStore, STORE_PATH } = require('../db');

const PARENT = path.join(__dirname, '..', '..');
const ODS_PATH = path.join(PARENT, 'OM Manpower_Attendance_Mapping Data.ods');
const XLSX_PATH = path.join(PARENT, 'Headcount_ Trainee & Contract.xlsx');
const DATA = path.join(__dirname, '..', 'data');

const isNum = (v) => /^\d+(\.\d+)?$/.test(String(v).trim());
const cell = (v) => (v === null || v === undefined) ? '' : (typeof v === 'number' ? String(v) : String(v).trim());
const num = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 0 : n; };
const readJson = (f) => JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'));

function getXLSX() { try { return require('xlsx'); } catch { return null; } }

/* ---- OM Manpower roster (.ods) ---- */
function parseOm(XLSX) {
  if (!XLSX || !fs.existsSync(ODS_PATH)) return null;
  const wb = XLSX.readFile(ODS_PATH);
  const ws = wb.Sheets['Manager_Mapping'] || wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const out = rows.map((r) => {
    const c6 = cell(r['Manager Code']), c7 = cell(r['Manager Name']);
    let managerName, managerCode;
    if (isNum(c6) && !isNum(c7)) { managerCode = c6; managerName = c7; }
    else { managerName = c6; managerCode = c7; }
    return { code: cell(r['Associate Code']), name: cell(r['Name']), location: cell(r['Location']),
      designation: cell(r['Designation']), department: cell(r['Department']),
      managerName, managerCode, uan: cell(r['UAN No']), esi: cell(r['ESI NO']), language: cell(r['Language']) };
  }).filter((x) => x.code || x.name);
  return out.length ? out : null;
}

/* ---- Transport routes (.xlsx names -> auto-detailed plan) ---- */
function buildRoutes(names) {
  const palette = ['var(--indigo)','var(--green)','var(--amber)','var(--blue)','#7A5BA8','#3F8C7A','#8C6D3F','#B4476B','#4F8C3F','#3F6D8C','#8C3F6B','#6B8C3F','#8C5B3F','#5B3F8C'];
  const zones = ['Compressor Line','Paint Shop','Warehouse','Quality & QC','Logistics & dispatch','Assembly Line','Press Shop','Utilities','Tool Room','Dispatch Bay','Receiving Dock','Sub-assembly','Maintenance','General Admin'];
  const mins = (t) => String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  return names.map((nm, i) => {
    const b = 'B' + (i + 1), base = 5 * 60 + 40 + (i % 6) * 5, gate = (i % 3) + 1;
    return { bus: b, code: b, colour: palette[i % palette.length],
      route: 'Route ' + (i + 1) + ' · ' + nm, zone: zones[i % zones.length],
      morning: { board: mins(base), plant: '06:45' }, general: { board: mins(base + 120), plant: '08:45' }, drop: '15:45',
      stops: [ { name: nm + ' Bus Stand', t: mins(base) }, { name: nm + ' Junction', t: mins(base + 13) },
               { name: nm + ' Cross', t: mins(base + 26) }, { name: 'Plant Gate ' + gate, t: '06:45' } ] };
  });
}
function parseRoutes(XLSX) {
  if (!XLSX || !fs.existsSync(XLSX_PATH)) return null;
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets['List Of Route Name']; if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const names = rows.map((r) => cell(r['Route Name'])).filter(Boolean);
  return names.length ? buildRoutes(names) : null;
}

/* ---- Vendors (.xlsx) ---- */
function parseVendors(XLSX) {
  if (!XLSX || !fs.existsSync(XLSX_PATH)) return null;
  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets['List Of Vendors']; if (!ws) return null;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const out = [];
  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if ((r[0] === '' || r[0] == null) && (r[1] === '' || r[1] == null)) continue;
    out.push({ sno: num(r[0]), company: cell(r[1]), grade: cell(r[2]),
      fgUnskilled: num(r[3]), fgSemiSkilled: num(r[4]), fgSkilled: num(r[5]),
      deviceUnskilled: num(r[6]), deviceSemiSkilled: num(r[7]), deviceSkilled: num(r[8]),
      clTotal: num(r[9]), traineeHeadcount: num(r[10]) });
  }
  return out.length ? out : null;
}

function main() {
  const XLSX = getXLSX();
  const sources = {};
  let omMapping, routes, vendors;

  try { omMapping = parseOm(XLSX); } catch (e) { console.warn('  om parse:', e.message); }
  if (omMapping) sources.omMapping = 'OM Manpower_Attendance_Mapping Data.ods';
  else { omMapping = readJson('om_mapping_seed.json'); sources.omMapping = 'data/om_mapping_seed.json'; }

  try { routes = parseRoutes(XLSX); } catch (e) { console.warn('  routes parse:', e.message); }
  if (routes) sources.routes = 'Headcount_ Trainee & Contract.xlsx (List Of Route Name)';
  else { routes = readJson('routes_seed.json'); sources.routes = 'data/routes_seed.json'; }

  try { vendors = parseVendors(XLSX); } catch (e) { console.warn('  vendors parse:', e.message); }
  if (vendors) sources.vendors = 'Headcount_ Trainee & Contract.xlsx (List Of Vendors)';
  else { vendors = readJson('vendors_seed.json'); sources.vendors = 'data/vendors_seed.json'; }

  const demo = readJson('demo_seed.json');
  sources.demo = 'data/demo_seed.json';

  const data = Object.assign({ omMapping, routes, vendors }, demo);
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v]));

  writeStore({ table: 'bootstrap', seededAt: new Date().toISOString(), sources, counts, data });
  console.log('Seeded bootstrap store -> ' + STORE_PATH);
  console.log('  sources:', JSON.stringify(sources, null, 0));
  console.log('  counts :', JSON.stringify(counts, null, 0));
}

main();
