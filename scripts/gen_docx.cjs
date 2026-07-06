/* gen_docx.js — generate a .docx for every Knowledge Center document.
   Reads public/legacy/knowledge-docs.json and writes public/legacy/docs/<id>.docx,
   so each document is downloadable as a real Word file. Regenerate after editing
   the documents:  npm run docs:docx   (or: node scripts/gen_docx.js)          */
const fs = require('fs');
const path = require('path');
const HTMLtoDOCX = require('html-to-docx');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public', 'legacy', 'knowledge-docs.json');
const OUT = path.join(ROOT, 'public', 'legacy', 'docs');

const CAT = { policies: 'Policies', training: 'Training materials', notices: 'Notices', transport: 'Transport' };

function fmtDate(iso) {
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const p = String(iso || '').split('-'); if (p.length !== 3) return iso || '';
  return parseInt(p[2], 10) + ' ' + M[parseInt(p[1], 10) - 1] + ' ' + p[0];
}

function docHtml(d) {
  const meta = [CAT[d.cat] || d.cat, d.dept, 'Owner: ' + (d.owner || '—'), fmtDate(d.created), d.version, (d.langs || []).join('/')].filter(Boolean).join('  ·  ');
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1b1b17;line-height:1.5;}' +
    'h1{font-size:18pt;color:#1F2B5C;margin:0 0 4pt;}' +
    'h4{font-size:12pt;color:#1F2B5C;margin:12pt 0 4pt;}' +
    'p{margin:0 0 8pt;}' +
    'table{border-collapse:collapse;width:100%;margin:6pt 0;}' +
    'th,td{border:1px solid #c9c6bd;padding:5pt 8pt;font-size:10.5pt;text-align:left;}' +
    'th{background:#F0EEE7;}' +
    '.meta{font-size:9pt;color:#6b6b63;margin:0 0 10pt;}' +
    '.summary{font-size:11pt;color:#3a3a34;border-left:3px solid #1F2B5C;padding-left:10pt;margin:0 0 12pt;}' +
    '.foot{font-size:8pt;color:#8a8a80;margin-top:16pt;border-top:1px solid #d9d6cd;padding-top:6pt;}' +
    '</style></head><body>' +
    '<h1>' + d.title + '</h1>' +
    '<p class="meta">' + meta + '</p>' +
    (d.summary ? '<p class="summary">' + d.summary + '</p>' : '') +
    (d.body || '<p>(No content.)</p>') +
    '<p class="foot">Karya Vaani · Knowledge Center · Daikin Sricity · AP — controlled document, ' + (d.version || 'v1.0') + '</p>' +
    '</body></html>';
}

(async function () {
  const docs = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });
  const opts = { orientation: 'portrait', margins: { top: 1000, right: 1000, bottom: 1000, left: 1000 }, table: { row: { cantSplit: true } }, footer: false, pageNumber: false };
  let n = 0;
  for (const d of docs) {
    const buffer = await HTMLtoDOCX(docHtml(d), null, opts);
    fs.writeFileSync(path.join(OUT, d.id + '.docx'), buffer);
    n++;
  }
  console.log('[docx] wrote ' + n + ' documents to public/legacy/docs/');
})().catch((e) => { console.error('[docx] failed:', e.message); process.exit(1); });
