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
const { licenceCeilingFor } = require('../licence-policy');
const { TENANT } = require('../tenant');

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
    /* CR-3 · routeNo is the unique, persistent identifier for the route. It is
       what boarding, attendance and night-shift consent records point at, so it
       is assigned once and never reused — the bus code (B1…) can be re-allocated
       to a different route, routeNo cannot. */
    return { bus: b, code: b, routeNo: 'RT-' + String(i + 1).padStart(2, '0'), colour: palette[i % palette.length],
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

  /* The real source spreadsheets are the customer's own export, so they carry
     the customer's site code and name the in-house trainee pool after the
     company itself. Karya Vaani ships single-tenant but the codebase must not
     be branded, so both are normalised on the way in — otherwise re-seeding
     silently undoes the de-branding and puts the client's name back on screen.

     The roster is single-site (every row shares one Location), so collapsing a
     non-empty code onto the tenant's own is lossless; set TENANT_LOCATION_CODE
     to carry a customer's real code through. The in-house vendor is the sole
     'Trainees' row — every other vendor is '3rd Party' — and is labelled
     'In-house', which vmCompliance() in the legacy bundle matches on. */
  (omMapping || []).forEach((r) => { if (r.location) r.location = TENANT.locationCode; });
  (vendors || []).forEach((v) => { if (/^trainees$/i.test(String(v.grade || '').trim())) v.company = 'In-house'; });

  /* CR-3 · guarantee a unique routeNo even when routes come from the committed
     seed file (which predates the field). */
  const usedRouteNos = {};
  (routes || []).forEach((r, i) => {
    let no = r.routeNo;
    if (!no || usedRouteNos[no]) {
      let n = i + 1;
      do { no = 'RT-' + String(n).padStart(2, '0'); n++; } while (usedRouteNos[no]);
    }
    usedRouteNos[no] = 1;
    r.routeNo = no;
  });

  /* CR-8 · the CLRA licence ceiling is a statutory limit and is tracked as its
     own field; commercialHeadcount is the customer's commercial supply agreement and
     is deliberately kept separate (advisory only, never a compliance block). */
  /* An agency applies for a licence with room to grow into, and how much room
     differs by agency — so the ceilings are spread across the bands the
     utilisation alert cares about (comfortable / approaching / critical)
     rather than all sitting just above the deployed headcount. Indexed, not
     random, so re-seeding produces the same picture. */
  const LICENCE_HEADROOM_CYCLE = [1.70, 1.55, 1.30, 1.85, 1.45, 1.12, 1.60, 1.05];
  (demo.contractors || []).forEach((c, i) => {
    const deployed = num(c.deployed);
    const factor = LICENCE_HEADROOM_CYCLE[i % LICENCE_HEADROOM_CYCLE.length];
    /* An agency whose real licensed headcount is known is pinned to it rather
       than left to the generic spread above — see LICENCE_CEILING_POLICY. */
    const pinned = licenceCeilingFor(c.name);
    c.clraLicence = Object.assign({
      number: 'CLRA/' + String(c.id || '').replace(/[^A-Z0-9]/gi, '') + '/2026',
      authority: TENANT.licensingAuthority,
      validTill: (c.clra && c.clra.expiresOn) || '',
      /* licences are applied for in round numbers, always above the headcount
         actually deployed under them */
      maxHeadcount: pinned != null ? pinned : Math.max(deployed + 1, Math.ceil((deployed * factor) / 10) * 10)
    }, c.clraLicence || {});
    if (pinned != null) c.clraLicence.maxHeadcount = pinned;
    if (c.commercialHeadcount == null) {
      c.commercialHeadcount = pinned != null ? pinned : Math.ceil((deployed + 1) / 10) * 10;
    }
  });

  const data = Object.assign({ omMapping, routes, vendors }, demo);
  const counts = Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Array.isArray(v) ? v.length : typeof v]));

  writeStore({ table: 'bootstrap', seededAt: new Date().toISOString(), sources, counts, data });
  console.log('Seeded bootstrap store -> ' + STORE_PATH);
  console.log('  sources:', JSON.stringify(sources, null, 0));
  console.log('  counts :', JSON.stringify(counts, null, 0));
}

main();
