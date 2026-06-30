/* ── Karya Vaani legacy application logic (extracted verbatim from karya-vaani_v3.html) ──
   Loaded as a classic script after React mounts, so top-level functions stay global
   (inline handlers converted to React onClick call them via window.*).
   __kvOnReady replaces DOMContentLoaded hooks: the DOM is already rendered by React
   when this script loads, so init functions run immediately. */
function __kvOnReady(fn) {
  /* Defer every init until the ENTIRE script body has executed, so all
     top-level `let`/`const` state (CS_STATE, renderWkGrid, ...) is initialized
     before any init runs. When this script is injected after load (the React
     path) readyState is already 'complete', so running fn() inline would fire
     inits mid-script and hit temporal-dead-zone errors. setTimeout(...,0) runs
     them as a macrotask after the script finishes, matching the original
     DOMContentLoaded timing. */
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', fn); }
  else { setTimeout(fn, 0); }
}
  /* ── group → items lookup, so the right group lights up when an item is active ── */
  const GROUP_OF = {
    dashboard:           'grp-overview',
    diagnostic:          'grp-overview',
    architecture:        'grp-overview',
    'karya-nirnay':      'grp-verticals',
    recruitment:         'grp-verticals',
    onboarding:          'grp-verticals',
    induction:           'grp-verticals',
    appointment:         'grp-hrdocs',
    vendor:              'grp-verticals',
    ohs:                 'grp-verticals',
    compliance:          'grp-verticals',
    'vaani-broadcast':   'grp-engines',
    chat:                'grp-engines',
    transport:           'grp-engines',
    lms:                 'grp-engines',
    analytics:           'grp-governance',
    rules:               'grp-governance',
    locale:              'grp-governance',
    audit:               'grp-governance',
    handoff:             'grp-governance',
    directory:           'grp-directory',
    ctdirectory:         'grp-directory',
    'emp-home':          'grp-employee',
    'ct-home':           'grp-contractor',
  };

  /* ── SPA-style section nav: hide all, show selected ── */
  function nav(id, el) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.nb-group').forEach(g => g.classList.remove('has-active'));

    const sec = document.getElementById('sec-' + id);
    if (sec) sec.classList.add('active');
    if (el) el.classList.add('active');

    /* light up the parent group in the top nav */
    const grpId = GROUP_OF[id];
    if (grpId) {
      const grp = document.getElementById(grpId);
      if (grp) grp.classList.add('has-active');
    }

    /* update the "Now viewing" label */
    const label = el ? el.querySelector('.sb-label') : null;
    const cur = document.getElementById('current-label');
    if (cur && label) cur.textContent = label.textContent;

    /* employee mode — when a worker is on their own home, every other
       module link is disabled so the worker can't wander into HR-only
       admin surfaces. Body class toggles the lock visually + with pointer-events. */
    document.body.classList.toggle('emp-mode', id === 'emp-home');
    /* contractor mode — same idea, but the contractor sees only their group */
    document.body.classList.toggle('ct-mode', id === 'ct-home');

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* ── inline tabs (used in onboarding) ── */
  function subTab(evt, group, name) {
    const tabs = evt.target.parentElement.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('on'));
    evt.target.classList.add('on');
    document.querySelectorAll('#' + group + '-direct, #' + group + '-contract, #' + group + '-capture, #' + group + '-docs')
      .forEach(p => p.style.display = 'none');
    const pane = document.getElementById(group + '-' + name);
    if (pane) pane.style.display = 'block';
  }

  /* ════════════════════════════════════════════════════════════════
     RECRUITMENT · OPEN REQUISITIONS · sortable grid ↔ ladder inspector
     ════════════════════════════════════════════════════════════════ */

  const STAGES = ['Raised', 'Approved', 'JD published', 'Sourcing', 'Screening', 'Interview', 'Offer', 'Joining'];

  /* SLA ranking for sort: breach (highest priority) > watch > on-track */
  const SLA_RANK = { breach: 3, watch: 2, ok: 1 };
  const SLA_LABEL = { breach: 'Breach', watch: 'Watch', ok: 'On track' };
  const SLA_PILL  = { breach: 'red',    watch: 'amber', ok: 'green' };

  /* Each requisition carries its own per-stage notes so the ladder above
     reflects the selected row's actual journey. `stage` is 0-indexed current step;
     `brkAt` (optional) is the step index where SLA broke (rendered with .brk).
     `notes` is an 8-element array — one per stage. Empty string = no caption. */
  let REQS = (window.__KVDATA && window.__KVDATA.requisitions) || [];

  let SORT_COL = 'days';
  let SORT_DIR = -1; /* -1 desc, 1 asc */
  let SELECTED_REQ = (REQS[0] || {}).id;  /* tolerate empty data (backend offline) */
  let REQ_QUERY = '';

  /* approval ranking for sort: approved > pending > rejected */
  const APPR_RANK  = { approved: 3, pending: 2, rejected: 1 };
  const APPR_LABEL = { approved: 'Approved', pending: 'Pending approval', rejected: 'Rejected' };
  const APPR_PILL  = { approved: 'green',    pending: 'amber',            rejected: 'red' };

  function rqValue(r, col) {
    if (col === 'slaRank')  return SLA_RANK[r.sla];
    if (col === 'apprRank') return APPR_RANK[r.approval] || 0;
    if (col === 'stageIdx') return r.stage;
    if (col === 'days')     return r.days;
    if (col === 'id')       return r.id;
    if (col === 'knRef')    return (r.knRef || '').toLowerCase();
    if (col === 'role')     return r.role.toLowerCase();
    if (col === 'fn')       return r.fn.toLowerCase();
    return r[col];
  }

  function sortReqs(col) {
    if (SORT_COL === col) {
      SORT_DIR = -SORT_DIR;
    } else {
      SORT_COL = col;
      /* numeric/ranked cols default to desc; text cols default to asc */
      SORT_DIR = (col === 'days' || col === 'slaRank' || col === 'stageIdx' || col === 'apprRank') ? -1 : 1;
    }
    renderReqGrid();
  }

  function resetReqSort() {
    SORT_COL = 'days';
    SORT_DIR = -1;
    REQ_QUERY = '';
    const inp = document.getElementById('req-search');
    if (inp) inp.value = '';
    const clr = document.getElementById('req-search-clear');
    if (clr) clr.classList.remove('on');
    renderReqGrid();
  }

  function selectReq(id, opts) {
    SELECTED_REQ = id;
    renderReqGrid();
    renderReqLadder(opts || {});
  }

  function renderReqLadder(opts) {
    const r = REQS.find(x => x.id === SELECTED_REQ);
    if (!r) return;
    document.getElementById('req-detail-title').textContent =
      r.id + ' · ' + r.role + ' · ' + r.fn;
    document.getElementById('req-detail-sub').textContent =
      'Hiring manager · ' + r.hm + ' · Approved ' + r.approved + ' · target close ' + r.target;
    const pill = document.getElementById('req-detail-pill');
    pill.className = 'pill ' + SLA_PILL[r.sla];
    pill.textContent = r.sla === 'breach' ? 'SLA breach · ' + (STAGES[r.brkAt] || STAGES[r.stage]).toLowerCase()
                     : r.sla === 'watch'  ? 'Watch · ' + STAGES[r.stage].toLowerCase()
                                          : 'On track · ' + STAGES[r.stage].toLowerCase();

    const ladder = document.getElementById('req-ladder');
    ladder.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const cls =
        (r.brkAt === i)        ? 'brk'
      : (i < r.stage)          ? 'done'
      : (i === r.stage)        ? 'now'
      :                          '';
      const step = document.createElement('div');
      step.className = 'lstep ' + cls + (opts.pulseAt === i ? ' pulse' : '');
      step.id = 'lstep-' + i;
      step.innerHTML =
        '<div class="lstep-n">' + (i + 1) + '</div>' +
        '<div class="lstep-t">' + STAGES[i] + '</div>' +
        '<div class="lstep-c">' + (r.notes[i] || '') + '</div>';
      ladder.appendChild(step);
    }

    const note = document.getElementById('req-detail-note');
    note.innerHTML = '<strong>Recommendation:</strong> ' + r.recco;
    note.className = 'note' + (r.sla === 'breach' ? ' alert' : '');

    /* decision-builder reference + approval gate */
    const refHost = document.getElementById('req-ref-host');
    if (refHost) {
      const cons = r.contractors || [];
      const conTxt = cons.length ? cons.join(', ') : 'Direct hire — no contractor assigned';
      const appOk = r.approval === 'approved';
      refHost.innerHTML =
        '<div class="req-ref-row">' +
          '<div class="req-ref-item">' +
            '<div class="req-ref-k">Decision builder reference</div>' +
            '<div class="req-ref-v">' +
              (r.knRef
                ? '<span class="req-kn-ref" onclick="openDecisionRef(\'' + r.knRef + '\')">' + r.knRef + '</span> · Karya Nirṇay scenario'
                : 'Not referenced to a decision scenario') +
            '</div>' +
          '</div>' +
          '<div class="req-ref-item">' +
            '<div class="req-ref-k">Contractor(s) assigned</div>' +
            '<div class="req-ref-v">' + conTxt + '</div>' +
          '</div>' +
          '<div class="req-ref-item">' +
            '<div class="req-ref-k">Approval status</div>' +
            '<div class="req-ref-v"><span class="pill ' + APPR_PILL[r.approval] + ' tiny">' +
              APPR_LABEL[r.approval] + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="note ' + (appOk ? 'green' : 'amber') + '" style="margin-top:12px">' +
          (appOk
            ? '<strong>Cleared for onboarding.</strong> This requisition is referenced to decision scenario ' +
              (r.knRef || '—') + ' and approved — hires against it can be captured in Onboarding.'
            : '<strong>Blocked from onboarding.</strong> This requisition is still pending approval. Hires cannot be onboarded until the requisition is approved against its decision-builder scenario.') +
        '</div>';
    }
  }

  /* open the referenced Karya Nirṇay decision scenario */
  function openDecisionRef(knRef) {
    const item = [].slice.call(document.querySelectorAll('.sb-item'))
      .find(function (s) { return (s.getAttribute('onclick') || s.getAttribute('data-onclick') || '').indexOf("'karya-nirnay'") > -1; });
    if (typeof nav === 'function') nav('karya-nirnay', item);
    if (typeof toast === 'function') {
      toast('Opened decision builder · requisition referenced to scenario ' + knRef, 'green');
    }
  }

  function renderReqGrid() {
    /* filter by search query (case-insensitive across id, role, function, stage, sla) */
    const q = REQ_QUERY.trim().toLowerCase();
    let rows = REQS.slice();
    if (q) {
      rows = rows.filter(r => {
        const hay = (
          r.id + ' ' + r.role + ' ' + r.fn + ' ' +
          STAGES[r.stage] + ' ' + SLA_LABEL[r.sla] + ' ' +
          r.hm + ' ' + (r.knRef || '') + ' ' +
          (APPR_LABEL[r.approval] || '') + ' ' +
          ((r.contractors || []).join(' '))
        ).toLowerCase();
        return hay.includes(q);
      });
    }

    /* sort */
    rows.sort((a, b) => {
      const va = rqValue(a, SORT_COL), vb = rqValue(b, SORT_COL);
      if (va < vb) return -1 * SORT_DIR;
      if (va > vb) return  1 * SORT_DIR;
      return 0;
    });

    /* sort indicator on headers */
    document.querySelectorAll('#req-grid th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      const ind = th.querySelector('.sort-ind');
      ind.textContent = '↕';
      if (th.dataset.col === SORT_COL) {
        th.classList.add(SORT_DIR === 1 ? 'sort-asc' : 'sort-desc');
        ind.textContent = SORT_DIR === 1 ? '↑' : '↓';
      }
    });

    /* sort-state caption */
    const colLabel = {
      id: 'Position ID', role: 'Role', fn: 'Function', knRef: 'Decision ref',
      apprRank: 'Approval', stageIdx: 'Stage', days: 'Days open', slaRank: 'SLA'
    };
    const matchTxt = q
      ? (rows.length + ' of ' + REQS.length + ' match "' + REQ_QUERY + '" · ')
      : '';
    document.getElementById('req-sort-state').textContent =
      matchTxt + 'Sorted by ' + colLabel[SORT_COL] + ' · ' + (SORT_DIR === 1 ? 'asc' : 'desc');

    /* body */
    const body = document.getElementById('req-grid-body');
    body.innerHTML = '';

    if (rows.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="9" class="search-empty">No requisitions match <span class="mono">"' + REQ_QUERY + '"</span> — try a Position ID, role keyword, or function.</td>';
      body.appendChild(tr);
      return;
    }

    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = 'req-row' + (r.id === SELECTED_REQ ? ' selected' : '');
      tr.onclick = () => selectReq(r.id, {});
      const stageBreached = (r.sla === 'breach' && r.brkAt === r.stage);
      /* contractor cell — all names when more than one is assigned */
      const cons = r.contractors || [];
      const conCell = cons.length
        ? cons.map(c => '<span class="req-con-chip">' + c + '</span>').join('')
        : '<span class="t-mute">Direct hire</span>';
      /* decision-builder reference */
      const knCell = r.knRef
        ? '<span class="req-kn-ref" onclick="event.stopPropagation();openDecisionRef(\'' + r.knRef + '\')" title="Open in Karya Nirṇay decision builder">' + r.knRef + '</span>'
        : '<span class="t-mute">—</span>';
      /* approval pill */
      const apprCell = '<span class="pill ' + APPR_PILL[r.approval] + ' tiny">' +
        APPR_LABEL[r.approval] + '</span>';
      tr.innerHTML =
        '<td><span class="t-id">' + r.id + '</span></td>' +
        '<td class="t-strong">' + r.role + '</td>' +
        '<td>' + r.fn + '</td>' +
        '<td><div class="req-con-cell">' + conCell + '</div></td>' +
        '<td>' + knCell + '</td>' +
        '<td>' + apprCell + '</td>' +
        '<td><span class="stage-link' + (stageBreached ? ' breach' : '') + '" ' +
          'onclick="event.stopPropagation(); jumpToStage(\'' + r.id + '\', ' + r.stage + ')">' +
          STAGES[r.stage] + '</span></td>' +
        '<td class="mono">' + r.days + '</td>' +
        '<td><span class="pill ' + SLA_PILL[r.sla] + '">' + SLA_LABEL[r.sla] + '</span></td>';
      body.appendChild(tr);
    });
  }

  function jumpToStage(id, idx) {
    selectReq(id, { pulseAt: idx });
    document.getElementById('req-detail-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* wire up sortable headers + search + initial render */
  __kvOnReady(() => {
    document.querySelectorAll('#req-grid th.sortable').forEach(th => {
      th.addEventListener('click', () => sortReqs(th.dataset.col));
    });

    const searchInp = document.getElementById('req-search');
    const searchClr = document.getElementById('req-search-clear');
    if (searchInp) {
      searchInp.addEventListener('input', e => {
        REQ_QUERY = e.target.value;
        searchClr.classList.toggle('on', REQ_QUERY.length > 0);
        renderReqGrid();
      });
      searchInp.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          searchInp.value = '';
          REQ_QUERY = '';
          searchClr.classList.remove('on');
          renderReqGrid();
        }
      });
    }
    if (searchClr) {
      searchClr.addEventListener('click', () => {
        searchInp.value = '';
        REQ_QUERY = '';
        searchClr.classList.remove('on');
        searchInp.focus();
        renderReqGrid();
      });
    }

    renderReqLadder({});
    renderReqGrid();
    initVerification();
  });

  /* ════════════════════════════════════════════════════════════════
     ONBOARDING · DIRECT EMPLOYEE VERIFICATION LEDGER
     ════════════════════════════════════════════════════════════════ */

  /* generic sortable-table helper.
     `cfg.dataFn()` returns the data array;
     `cfg.rowFn(item)` returns the <tr> HTML;
     `cfg.valueFn(item, col)` returns sort key for column;
     `cfg.defaults` = {col, dir(-1|1)};
     `cfg.textDefaultAsc` set true to make text cols default to asc on first click. */
  function makeSortable(tableId, bodyId, cfg) {
    const state = { col: cfg.defaults.col, dir: cfg.defaults.dir };
    function render() {
      const data = cfg.dataFn();
      data.sort((a, b) => {
        const va = cfg.valueFn(a, state.col), vb = cfg.valueFn(b, state.col);
        if (va < vb) return -1 * state.dir;
        if (va > vb) return  1 * state.dir;
        return 0;
      });
      const body = document.getElementById(bodyId);
      body.innerHTML = '';
      data.forEach(item => body.insertAdjacentHTML('beforeend', cfg.rowFn(item)));
      if (cfg.afterRender) cfg.afterRender(data);
      /* indicators */
      document.querySelectorAll('#' + tableId + ' th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        const ind = th.querySelector('.sort-ind');
        ind.textContent = '↕';
        if (th.dataset.col === state.col) {
          th.classList.add(state.dir === 1 ? 'sort-asc' : 'sort-desc');
          ind.textContent = state.dir === 1 ? '↑' : '↓';
        }
      });
    }
    document.querySelectorAll('#' + tableId + ' th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (state.col === col) state.dir = -state.dir;
        else {
          state.col = col;
          const txtCol = cfg.textCols && cfg.textCols.includes(col);
          state.dir = txtCol ? 1 : -1;
        }
        render();
      });
    });
    return render;
  }

  const STAGE_PILL = {
    'docs-pending'    : { cls: 'amber', label: 'Docs pending',       rank: 2 },
    'docs-rejected'   : { cls: 'red',   label: 'Docs rejected',      rank: 1 },
    'induction'       : { cls: 'blue',  label: 'Induction',          rank: 4 },
    'awaiting-prior'  : { cls: 'amber', label: 'Awaiting prior ec.', rank: 3 },
    'ready'           : { cls: 'green', label: 'Ready to push',      rank: 5 },
  };

  let WORKERS = (window.__KVDATA && window.__KVDATA.workers) || [];

  /* ── contract workers · ESIC, CLRA, migrant focus ── */
  const ESIC_RANK = { breach: 0, pending: 1, ok: 2 };
  const CAT_RANK  = { 'Unskilled': 1, 'Semi-skilled': 2, 'Skilled': 3, 'Highly skilled': 4 };
  const CLRA_RANK = { expired: 0, expiring: 1, valid: 2 };

  let CONTRACT_WORKERS = (window.__KVDATA && window.__KVDATA.contractWorkers) || [];

  /* ── shared document store rows ── */
  let SHARED_DOCS = (window.__KVDATA && window.__KVDATA.sharedDocs) || [];

  /* ════════════════════════════════════════════════════════════════
     PPE / UNIFORM SIZES + INDUCTION STATE
     ════════════════════════════════════════════════════════════════
     PPE/uniform sizing must be captured ≥ 3 working days before joining
     so safety stores can pre-pick + issue on day 1 (no PPE = no shop-floor
     entry per Factories Act s.41-B). Induction takes ~4 days; some modules
     are statutorily mandated and gate Ready-to-push to HRIS. */

  /* PPE state per worker — keyed by worker name (covers both direct + contract) */
  const PPE_STATE = {
    /* Direct employees */
    'Arjun Reddy':       { shoe: 9,  uniform: 'L',  gloves: 'L',  status: 'confirmed', orderedOn: '22 Apr', deliverBy: '24 Apr',  vendor: 'Sricity Industrial Stores',  receipt: 'PPE-2026-04412' },
    'Lakshmi N.':        { shoe: 6,  uniform: 'M',  gloves: 'M',  status: 'confirmed', orderedOn: '20 Apr', deliverBy: '22 Apr',  vendor: 'Sricity Industrial Stores',  receipt: 'PPE-2026-04388' },
    'Hiroshi Sato':      { shoe: 10, uniform: 'XL', gloves: 'XL', status: 'confirmed', orderedOn: '15 Apr', deliverBy: '17 Apr',  vendor: 'Sricity Industrial Stores',  receipt: 'PPE-2026-04341' },
    'Padma Vasudevan':   { shoe: 7,  uniform: 'M',  gloves: 'M',  status: 'draft',     orderedOn: null,     deliverBy: '— · trial fitment scheduled 25 Apr', vendor: '—', receipt: null },
    'Karan Singh':       { shoe: 9,  uniform: 'L',  gloves: 'L',  status: 'confirmed', orderedOn: '21 Apr', deliverBy: '23 Apr',  vendor: 'Sricity Industrial Stores',  receipt: 'PPE-2026-04401' },

    /* Contract workers — most confirmed, some missing/draft */
    'Ravi Kumar':       { shoe: 8,  uniform: 'L',  gloves: 'L',  status: 'confirmed', orderedOn: '21 Apr', deliverBy: '23 Apr', vendor: 'Sricity Industrial Stores', receipt: 'PPE-2026-04421' },
    'Mohan Das':        { shoe: 7,  uniform: 'M',  gloves: 'M',  status: 'draft',     orderedOn: null,     deliverBy: '— · awaiting fitment 24 Apr',         vendor: '—',                                receipt: null },
    'Suresh B.':        { shoe: 8,  uniform: 'M',  gloves: 'M',  status: 'missing',   orderedOn: null,     deliverBy: '— · joining in 1 day · ALERT',         vendor: '—',                                receipt: null },
    'Anil Kumar':       { shoe: 10, uniform: 'XL', gloves: 'XL', status: 'confirmed', orderedOn: '20 Apr', deliverBy: '22 Apr', vendor: 'Sricity Industrial Stores', receipt: 'PPE-2026-04408' },
    'Praveen N.':       { shoe: 8,  uniform: 'L',  gloves: 'L',  status: 'confirmed', orderedOn: '20 Apr', deliverBy: '22 Apr', vendor: 'Sricity Industrial Stores', receipt: 'PPE-2026-04409' },
    'Mahesh G.':        { shoe: 9,  uniform: 'L',  gloves: 'L',  status: 'confirmed', orderedOn: '19 Apr', deliverBy: '21 Apr', vendor: 'Sricity Industrial Stores', receipt: 'PPE-2026-04391' },
    'Lalita Devi':      { shoe: 5,  uniform: 'S',  gloves: 'S',  status: 'draft',     orderedOn: null,     deliverBy: '— · trial fitment 25 Apr',             vendor: '—',                                receipt: null },
    'Vinod K.':         { shoe: 9,  uniform: 'L',  gloves: 'L',  status: 'confirmed', orderedOn: '21 Apr', deliverBy: '23 Apr', vendor: 'Sricity Industrial Stores', receipt: 'PPE-2026-04420' },
    'Naga Babu':        { shoe: 10, uniform: 'XL', gloves: 'XL', status: 'confirmed', orderedOn: '19 Apr', deliverBy: '21 Apr', vendor: 'Sricity Industrial Stores', receipt: 'PPE-2026-04395' },
    'Devi Prasad':      { shoe: 7,  uniform: 'M',  gloves: 'M',  status: 'missing',   orderedOn: null,     deliverBy: '— · joining done · BREACH',            vendor: '—',                                receipt: null },
    'Sneha R.':         { shoe: 6,  uniform: 'M',  gloves: 'S',  status: 'confirmed', orderedOn: '21 Apr', deliverBy: '23 Apr', vendor: 'Sricity Industrial Stores', receipt: 'PPE-2026-04425' },
    'Manoj T.':         { shoe: 8,  uniform: 'L',  gloves: 'L',  status: 'draft',     orderedOn: null,     deliverBy: '— · awaiting fitment',                  vendor: '—',                                receipt: null },
    'Pradeep R.':       { shoe: 7,  uniform: 'M',  gloves: 'M',  status: 'confirmed', orderedOn: '20 Apr', deliverBy: '22 Apr', vendor: 'Sricity Industrial Stores', receipt: 'PPE-2026-04405' },
    'Karthik V.':       { shoe: 11, uniform: 'XL', gloves: 'XL', status: 'confirmed', orderedOn: '19 Apr', deliverBy: '21 Apr', vendor: 'Sricity Industrial Stores', receipt: 'PPE-2026-04396' },
    'Bharath Singh':    { shoe: 8,  uniform: 'L',  gloves: 'L',  status: 'draft',     orderedOn: null,     deliverBy: '— · trial fitment 25 Apr',             vendor: '—',                                receipt: null },
  };

  /* Induction state per worker name.
     modules: array of { id, label, mandatory, status: 'done'|'inprog'|'scheduled'|'gated' }
     track: which track applies (common is added to everyone implicitly) */
  const IND_STATE = {
    'Arjun Reddy':     { joinDate: '25 Apr', track: 'direct', startedOn: null, modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',          mandatory: true,  status: 'gated', note: 'PPE issued · ready to start tomorrow' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',      mandatory: true,  status: 'scheduled' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',  mandatory: true,  status: 'scheduled' },
      { id: 'ind-direct-coc',        label: 'Direct · Code of conduct',     mandatory: true,  status: 'scheduled' },
      { id: 'ind-direct-standing',   label: 'Direct · Standing orders',     mandatory: true,  status: 'scheduled' },
      { id: 'ind-direct-hrms',       label: 'Direct · HRMS & LMS walkthrough', mandatory: false, status: 'scheduled' },
      { id: 'ind-direct-leave',      label: 'Direct · Leave & attendance',  mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-comp-ppe',     label: 'Role · Compressor-line PPE drill',  mandatory: true, status: 'scheduled' },
      { id: 'ind-role-comp-lockout', label: 'Role · Machine lockout',       mandatory: true,  status: 'scheduled' },
    ]},
    'Lakshmi N.':      { joinDate: '22 Apr · joined', track: 'direct', startedOn: '22 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',          mandatory: true,  status: 'done', completedOn: '22 Apr 09:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',      mandatory: true,  status: 'done', completedOn: '22 Apr 10:15' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',  mandatory: true,  status: 'done', completedOn: '22 Apr 11:00' },
      { id: 'ind-direct-coc',        label: 'Direct · Code of conduct',     mandatory: true,  status: 'done', completedOn: '23 Apr 14:00' },
      { id: 'ind-direct-standing',   label: 'Direct · Standing orders',     mandatory: true,  status: 'inprog' },
      { id: 'ind-direct-hrms',       label: 'Direct · HRMS & LMS walkthrough', mandatory: false, status: 'scheduled' },
      { id: 'ind-direct-leave',      label: 'Direct · Leave & attendance',  mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-qual',         label: 'Role · QC instruments handling', mandatory: true, status: 'scheduled' },
      { id: 'ind-role-chem',         label: 'Role · Chemical handling SOP',  mandatory: true,  status: 'scheduled' },
    ]},
    'Hiroshi Sato':    { joinDate: '17 Apr · joined', track: 'direct', startedOn: '17 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',          mandatory: true,  status: 'done', completedOn: '17 Apr 09:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',      mandatory: true,  status: 'done', completedOn: '17 Apr 11:00' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',  mandatory: true,  status: 'done', completedOn: '17 Apr 11:30' },
      { id: 'ind-direct-coc',        label: 'Direct · Code of conduct',     mandatory: true,  status: 'done', completedOn: '18 Apr 09:30' },
      { id: 'ind-direct-standing',   label: 'Direct · Standing orders',     mandatory: true,  status: 'done', completedOn: '18 Apr 14:00' },
      { id: 'ind-direct-hrms',       label: 'Direct · HRMS & LMS walkthrough', mandatory: false, status: 'done', completedOn: '19 Apr 10:00' },
      { id: 'ind-direct-leave',      label: 'Direct · Leave & attendance',  mandatory: true,  status: 'done', completedOn: '19 Apr 14:00' },
      { id: 'ind-role-mgmt',         label: 'Role · Section-head leadership briefing', mandatory: true, status: 'done', completedOn: '21 Apr 10:00' },
      { id: 'ind-role-jp-trans',     label: 'Role · JP↔TE translator orientation', mandatory: false, status: 'done', completedOn: '22 Apr 09:30' },
    ]},
    'Padma Vasudevan': { joinDate: '24 Apr · joining', track: 'direct', startedOn: '24 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',          mandatory: true,  status: 'done', completedOn: '24 Apr 09:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',      mandatory: true,  status: 'inprog' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',  mandatory: true,  status: 'scheduled' },
      { id: 'ind-direct-coc',        label: 'Direct · Code of conduct',     mandatory: true,  status: 'scheduled' },
      { id: 'ind-direct-standing',   label: 'Direct · Standing orders',     mandatory: true,  status: 'scheduled' },
      { id: 'ind-direct-hrms',       label: 'Direct · HRMS & LMS walkthrough', mandatory: false, status: 'scheduled' },
      { id: 'ind-direct-leave',      label: 'Direct · Leave & attendance',  mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-meeng',        label: 'Role · M&E equipment briefing', mandatory: true, status: 'scheduled' },
      { id: 'ind-role-confined',     label: 'Role · Confined-space entry',  mandatory: true,  status: 'gated', note: 'Awaiting Form-23 medical clearance' },
    ]},
    'Karan Singh':     { joinDate: '23 Apr · joined', track: 'direct', startedOn: '23 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',          mandatory: true,  status: 'done', completedOn: '23 Apr 09:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',      mandatory: true,  status: 'done', completedOn: '23 Apr 10:00' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',  mandatory: true,  status: 'done', completedOn: '23 Apr 11:00' },
      { id: 'ind-direct-coc',        label: 'Direct · Code of conduct',     mandatory: true,  status: 'done', completedOn: '24 Apr 09:30' },
      { id: 'ind-direct-standing',   label: 'Direct · Standing orders',     mandatory: true,  status: 'done', completedOn: '24 Apr 14:00' },
      { id: 'ind-direct-hrms',       label: 'Direct · HRMS & LMS walkthrough', mandatory: false, status: 'inprog' },
      { id: 'ind-direct-leave',      label: 'Direct · Leave & attendance',  mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-ehs',          label: 'Role · EHS — site walk-down',  mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-form23',       label: 'Role · Form-23 medical brief', mandatory: true,  status: 'scheduled' },
    ]},

    /* Contract workers */
    'Ravi Kumar':     { joinDate: '23 Apr · joined', track: 'contract', startedOn: '23 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'done', completedOn: '23 Apr 14:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'done', completedOn: '23 Apr 15:30' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'done', completedOn: '23 Apr 16:00' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · TE', mandatory: true,  status: 'inprog' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-comp',         label: 'Role · Compressor-line basics',      mandatory: true,  status: 'scheduled' },
    ]},
    'Mohan Das':      { joinDate: '24 Apr · joining', track: 'contract', startedOn: null, modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'gated', note: 'PPE fitment pending' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'scheduled' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · OR', mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-migrant',        label: 'Contract · ISMW rights (migrant)',   mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-pack',         label: 'Role · Packaging line basics',       mandatory: true,  status: 'scheduled' },
    ]},
    'Suresh B.':      { joinDate: '21 Apr · joined', track: 'contract', startedOn: '21 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'gated', note: 'PPE MISSING · cannot enter floor · ESIC breach blocks' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'gated' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'gated' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · TE', mandatory: true,  status: 'gated' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'gated' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'gated' },
      { id: 'ind-role-comp',         label: 'Role · Compressor-line basics',      mandatory: true,  status: 'gated' },
    ]},
    'Anil Kumar':     { joinDate: '22 Apr · joined', track: 'contract', startedOn: '22 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'done', completedOn: '22 Apr 14:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'done', completedOn: '22 Apr 15:30' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'done', completedOn: '22 Apr 16:00' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · HI', mandatory: true,  status: 'done', completedOn: '23 Apr 10:00' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'done', completedOn: '23 Apr 11:00' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'inprog' },
      { id: 'ind-ct-migrant',        label: 'Contract · ISMW rights (migrant)',   mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-log',          label: 'Role · Warehouse handling',          mandatory: true,  status: 'scheduled' },
    ]},
    'Praveen N.':     { joinDate: '22 Apr · joined', track: 'contract', startedOn: '22 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'done', completedOn: '22 Apr 14:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'done', completedOn: '22 Apr 15:30' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'done', completedOn: '22 Apr 16:00' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · TE', mandatory: true,  status: 'inprog' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-comp',         label: 'Role · Compressor-line basics',      mandatory: true,  status: 'scheduled' },
    ]},
    'Mahesh G.':      { joinDate: '21 Apr · joined', track: 'contract', startedOn: '21 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'done', completedOn: '21 Apr 14:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'done', completedOn: '21 Apr 15:30' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'done', completedOn: '21 Apr 16:00' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · HI', mandatory: true,  status: 'done', completedOn: '22 Apr 10:00' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'done', completedOn: '22 Apr 11:00' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'done', completedOn: '22 Apr 14:00' },
      { id: 'ind-ct-migrant',        label: 'Contract · ISMW rights (migrant)',   mandatory: true,  status: 'inprog' },
      { id: 'ind-role-log',          label: 'Role · Warehouse handling',          mandatory: true,  status: 'scheduled' },
    ]},
    'Lalita Devi':    { joinDate: '25 Apr · joining', track: 'contract', startedOn: null, modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'gated', note: 'PPE fitment pending' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'scheduled' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · HI', mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-migrant',        label: 'Contract · ISMW rights (migrant)',   mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-pack',         label: 'Role · Packaging line basics',       mandatory: true,  status: 'scheduled' },
    ]},
    'Vinod K.':       { joinDate: '23 Apr · joined', track: 'contract', startedOn: '23 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'done', completedOn: '23 Apr 14:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'done', completedOn: '23 Apr 15:30' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'inprog' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · TE', mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-comp',         label: 'Role · Compressor-line basics',      mandatory: true,  status: 'scheduled' },
    ]},
    'Naga Babu':      { joinDate: '21 Apr · joined', track: 'contract', startedOn: '21 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'done', completedOn: '21 Apr 14:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'done', completedOn: '21 Apr 15:30' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'done', completedOn: '21 Apr 16:00' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · TE', mandatory: true,  status: 'done', completedOn: '22 Apr 10:00' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'done', completedOn: '22 Apr 11:00' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'done', completedOn: '22 Apr 14:00' },
      { id: 'ind-role-tool',         label: 'Role · Tool-room safety',            mandatory: true,  status: 'done', completedOn: '23 Apr 10:00' },
    ]},
    'Devi Prasad':    { joinDate: '20 Apr · joined', track: 'contract', startedOn: '20 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'gated', note: 'PPE missing · ESIC breach · OUT OF COMPLIANCE' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'gated' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'gated' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · OR', mandatory: true,  status: 'gated' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'gated' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'gated' },
      { id: 'ind-ct-migrant',        label: 'Contract · ISMW rights (migrant)',   mandatory: true,  status: 'gated' },
      { id: 'ind-role-pack',         label: 'Role · Packaging line basics',       mandatory: true,  status: 'gated' },
    ]},
    'Sneha R.':       { joinDate: '23 Apr · joined', track: 'contract', startedOn: '23 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'done', completedOn: '23 Apr 14:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'done', completedOn: '23 Apr 15:30' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'inprog' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · EN', mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-log',          label: 'Role · Warehouse handling',          mandatory: true,  status: 'scheduled' },
    ]},
    'Manoj T.':       { joinDate: '24 Apr · joining', track: 'contract', startedOn: null, modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'gated', note: 'PPE fitment pending' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'scheduled' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · HI', mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-migrant',        label: 'Contract · ISMW rights (migrant)',   mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-tool',         label: 'Role · Tool-room safety',            mandatory: true,  status: 'scheduled' },
    ]},
    'Pradeep R.':     { joinDate: '22 Apr · joined', track: 'contract', startedOn: '22 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'done', completedOn: '22 Apr 14:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'done', completedOn: '22 Apr 15:30' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'done', completedOn: '22 Apr 16:00' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · TE', mandatory: true,  status: 'inprog' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-comp',         label: 'Role · Compressor-line basics',      mandatory: true,  status: 'scheduled' },
    ]},
    'Karthik V.':     { joinDate: '21 Apr · joined', track: 'contract', startedOn: '21 Apr', modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'done', completedOn: '21 Apr 14:30' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'done', completedOn: '21 Apr 15:30' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'done', completedOn: '21 Apr 16:00' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · TA', mandatory: true,  status: 'done', completedOn: '22 Apr 10:00' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'done', completedOn: '22 Apr 11:00' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'done', completedOn: '22 Apr 14:00' },
      { id: 'ind-ct-migrant',        label: 'Contract · ISMW rights (migrant)',   mandatory: true,  status: 'inprog' },
      { id: 'ind-role-log',          label: 'Role · Warehouse handling',          mandatory: true,  status: 'scheduled' },
    ]},
    'Bharath Singh':  { joinDate: '25 Apr · joining', track: 'contract', startedOn: null, modules: [
      { id: 'ind-common-rules',      label: 'Common · Site rules',                mandatory: true,  status: 'gated', note: 'PPE fitment scheduled 25 Apr' },
      { id: 'ind-common-evac',       label: 'Common · Evacuation map',            mandatory: true,  status: 'scheduled' },
      { id: 'ind-common-emerg',      label: 'Common · Emergency contacts',        mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-clra',           label: 'Contract · CLRA worker rights · HI', mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-esic',           label: 'Contract · ESIC card usage',         mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-wage',           label: 'Contract · Wage register walk',      mandatory: true,  status: 'scheduled' },
      { id: 'ind-ct-migrant',        label: 'Contract · ISMW rights (migrant)',   mandatory: true,  status: 'scheduled' },
      { id: 'ind-role-pack',         label: 'Role · Packaging line basics',       mandatory: true,  status: 'scheduled' },
    ]},
  };

  /* ── language packs (Module 3 induction) ── */
  const LANGUAGES = [
    { code: 'TE', name: 'Telugu',   nativeName: 'తెలుగు',   coverage: 100 },
    { code: 'HI', name: 'Hindi',    nativeName: 'हिन्दी',    coverage: 100 },
    { code: 'TA', name: 'Tamil',    nativeName: 'தமிழ்',    coverage:  92 },
    { code: 'OR', name: 'Odia',     nativeName: 'ଓଡ଼ିଆ',     coverage:  78 },
    { code: 'BN', name: 'Bengali',  nativeName: 'বাংলা',     coverage:  85 },
    { code: 'EN', name: 'English',  nativeName: 'English', coverage: 100 },
    { code: 'JP', name: 'Japanese', nativeName: '日本語',    coverage: 100 },
  ];
  /* preferred language per worker (Karya Vaani delivers induction in this language) */
  const WORKER_LANGUAGE = {
    /* Direct employees */
    'Arjun Reddy':       'TE',
    'Lakshmi N.':        'TE',
    'Hiroshi Sato':      'JP',
    'Padma Vasudevan':   'TE',
    'Karan Singh':       'HI',
    /* Contract — locals are Telugu, migrants their home language */
    'Ravi Kumar':       'TE',
    'Mohan Das':        'OR',
    'Suresh B.':        'TE',
    'Anil Kumar':       'HI',     /* BR → AP */
    'Praveen N.':       'TE',
    'Mahesh G.':        'HI',     /* JH → AP */
    'Lalita Devi':      'HI',     /* CG → AP */
    'Vinod K.':         'TE',
    'Naga Babu':        'TE',
    'Devi Prasad':      'OR',     /* OD → AP */
    'Sneha R.':         'EN',
    'Manoj T.':         'HI',     /* UP → AP */
    'Pradeep R.':       'TE',
    'Karthik V.':       'TA',     /* TN → AP */
    'Bharath Singh':    'HI',     /* RJ → AP */
  };

  function langOf(name) {
    const code = WORKER_LANGUAGE[name] || 'EN';
    return LANGUAGES.find(l => l.code === code) || LANGUAGES.find(l => l.code === 'EN');
  }
  function setLangFor(name, code) {
    WORKER_LANGUAGE[name] = code;
  }
  function langTagHtml(name, compact) {
    const l = langOf(name);
    if (compact) {
      return '<span class="lang-tag" title="' + l.name + '">' + l.code + '</span>';
    }
    return '<span class="lang-tag" title="' + l.name + '"><span class="lang-glyph">' + l.nativeName + '</span> · ' + l.code + '</span>';
  }

  /* helpers */
  const PPE_RANK = { missing: 0, draft: 1, confirmed: 2 };
  const PPE_LABEL = { missing: '✗ Missing', draft: '⌛ Draft', confirmed: '✓ Confirmed' };

  const IND_STATUS_RANK = { gated: 0, scheduled: 1, inprog: 2, done: 3 };

  function indProgressOf(name) {
    const s = IND_STATE[name];
    if (!s) return { done: 0, total: 0, pct: 0, gated: 0, inprog: 0, scheduled: 0 };
    const done = s.modules.filter(m => m.status === 'done').length;
    const gated = s.modules.filter(m => m.status === 'gated').length;
    const inprog = s.modules.filter(m => m.status === 'inprog').length;
    const scheduled = s.modules.filter(m => m.status === 'scheduled').length;
    const total = s.modules.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return { done, total, pct, gated, inprog, scheduled };
  }

  function indStatusLabel(name) {
    const s = IND_STATE[name];
    if (!s) return { cls: 'scheduled', label: 'Not started' };
    const p = indProgressOf(name);
    if (p.gated > 0)                return { cls: 'gated',     label: 'Gated' };
    if (p.done === p.total)         return { cls: 'done',      label: '✓ Complete' };
    if (s.startedOn && p.done > 0)  return { cls: 'inprog',    label: 'In progress' };
    if (s.startedOn)                return { cls: 'inprog',    label: 'In progress' };
    return { cls: 'scheduled', label: 'Scheduled' };
  }

  function ppePillHtml(name) {
    const p = PPE_STATE[name];
    if (!p) return '<span class="ppe-pill missing">✗ Missing</span>';
    if (p.status === 'missing') return '<span class="ppe-pill missing" title="Order not placed">✗ Missing</span>';
    if (p.status === 'draft')   return '<span class="ppe-pill draft" title="Sizes captured, awaiting fitment confirmation">⌛ ' + p.shoe + ' · ' + p.uniform + '</span>';
    return '<span class="ppe-pill confirmed" title="Issued · receipt ' + p.receipt + '">✓ ' + p.shoe + ' · ' + p.uniform + '</span>';
  }

  function indProgHtml(name) {
    const p = indProgressOf(name);
    if (p.total === 0) return '<span class="tiny muted">—</span>';
    const pctCls = p.gated > 0 ? 'red' : p.pct === 100 ? 'green' : p.pct >= 40 ? 'amber' : '';
    return (
      '<span class="ind-prog">' +
        '<span class="ind-prog-bar"><span class="' + pctCls + '" style="width:' + p.pct + '%"></span></span>' +
        '<span class="ind-prog-txt">' + p.done + '/' + p.total + '</span>' +
      '</span>'
    );
  }

  let SELECTED_WK = null;
  let SELECTED_DOC = null;
  let WK_SEARCH = '';

  function countDocs(w) {
    const c = { done: 0, pending: 0, rejected: 0, total: w.docs.length };
    w.docs.forEach(d => c[d.status]++);
    return c;
  }

  /* ── worker search ── */
  function wkSearch() {
    const inp = document.getElementById('wk-search');
    WK_SEARCH = inp ? inp.value : '';
    const clr = document.getElementById('wk-search-clear');
    if (clr) clr.style.display = WK_SEARCH ? 'flex' : 'none';
    if (renderWkGrid) renderWkGrid();
    /* show / hide the no-results line */
    const matches = WORKERS.filter(w => {
      const q = WK_SEARCH.trim().toLowerCase();
      if (!q) return true;
      return w.name.toLowerCase().indexOf(q) > -1 ||
             w.posId.toLowerCase().indexOf(q) > -1 ||
             w.role.toLowerCase().indexOf(q) > -1;
    });
    const nr = document.getElementById('wk-noresults');
    if (nr) nr.style.display = matches.length ? 'none' : 'block';
    const cnt = document.getElementById('wk-count');
    if (cnt) cnt.textContent = WK_SEARCH.trim()
      ? matches.length + ' of ' + WORKERS.length
      : WORKERS.length + ' active';
  }
  function wkSearchClear() {
    const inp = document.getElementById('wk-search');
    if (inp) inp.value = '';
    wkSearch();
  }

  /* ── per-worker / per-document verification action log ──
     keyed "<workerId>::<docId>" → array of action entries. Every
     re-upload request, HRBP escalation and manual override is recorded
     here and rendered against the worker in the drill-down. */
  const WK_ACTIONS = {};
  function wkActionKey(w, d) { return w.id + '::' + d.id; }
  function wkActionsFor(w, d) { return WK_ACTIONS[wkActionKey(w, d)] || []; }
  function wkWorkerHasActions(w) {
    return Object.keys(WK_ACTIONS).some(function (k) {
      return k.indexOf(w.id + '::') === 0 && WK_ACTIONS[k].length;
    });
  }
  function wkLogAction(w, d, entry) {
    const key = wkActionKey(w, d);
    if (!WK_ACTIONS[key]) WK_ACTIONS[key] = [];
    const now = new Date();
    entry.at = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
      ' · ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    entry.by = 'Priya Menon · HR Operations';
    WK_ACTIONS[key].unshift(entry);
  }

  /* which action form is open in the detail panel: '', 'reupload', 'escalate', 'override' */
  let WK_ACTION_FORM = '';
  /* attached files keyed by form: { reupload, escalate, override } */
  let WK_FILES = { reupload: null, escalate: null, override: null };

  function wkOpenForm(which) {
    WK_ACTION_FORM = (WK_ACTION_FORM === which) ? '' : which;
    WK_FILES = { reupload: null, escalate: null, override: null };
    const w = WORKERS.find(x => x.id === SELECTED_WK);
    if (w) renderDocDetail(w);
  }

  /* render a file-upload box for a given action form */
  function wkFileBox(which, hint) {
    const f = WK_FILES[which];
    return '<div class="va-file' + (f ? ' has-file' : '') +
      '" onclick="document.getElementById(\'va-file-' + which + '\').click()">' +
      '<span class="va-file-ico">' + (f ? '✓' : '⬆') + '</span>' +
      '<div><div class="va-file-t">' +
        (f ? f.name : 'Click to upload a file') + '</div>' +
        '<div class="va-file-s">' +
        (f ? f.size + ' · ready to attach' : hint) +
        '</div></div>' +
      '</div>' +
      '<input type="file" id="va-file-' + which + '" accept="image/*,.pdf" style="display:none" ' +
      'onchange="wkActionFile(event,\'' + which + '\')">';
  }

  function wkActionFile(ev, which) {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    WK_FILES[which] = { name: f.name, size: (f.size / 1024).toFixed(0) + ' KB' };
    const w = WORKERS.find(x => x.id === SELECTED_WK);
    if (w) renderDocDetail(w);
  }

  /* commit a re-upload request */
  function wkSubmitReupload() {
    const w = WORKERS.find(x => x.id === SELECTED_WK);
    const d = w && w.docs.find(x => x.id === SELECTED_DOC);
    if (!w || !d) return;
    const reason = (document.getElementById('va-reupload-reason') || {}).value || '';
    if (!reason.trim()) { toast('Add a note on what the worker must re-upload', 'red'); return; }
    const f = WK_FILES.reupload;
    wkLogAction(w, d, { kind: 'reupload', title: 'Re-upload requested', note: reason.trim(),
      meta: 'Sent to worker on WhatsApp · native language',
      file: f ? f.name : null, fileSize: f ? f.size : null });
    WK_ACTION_FORM = '';
    WK_FILES = { reupload: null, escalate: null, override: null };
    renderDocDetail(w);
    renderWkGrid && renderWkGrid();
    wkRenderRegistry && wkRenderRegistry();
    toast('Re-upload request sent to ' + w.name + ' on WhatsApp', 'green');
    /* real WhatsApp re-upload request via the communication gateway */
    if (window.KVWhatsApp) {
      const num = w.phone || w.mobile;
      if (num) {
        window.KVWhatsApp.send(num,
          'Karya Vaani: Please re-upload your "' + (d.title || d.name || 'document') +
          '". ' + reason.trim());
      }
    }
  }

  /* commit an HRBP escalation */
  function wkSubmitEscalate() {
    const w = WORKERS.find(x => x.id === SELECTED_WK);
    const d = w && w.docs.find(x => x.id === SELECTED_DOC);
    if (!w || !d) return;
    const hrbp = (document.getElementById('va-escalate-hrbp') || {}).value || '';
    const note = (document.getElementById('va-escalate-note') || {}).value || '';
    if (!note.trim()) { toast('Add a note for the HRBP', 'red'); return; }
    const f = WK_FILES.escalate;
    wkLogAction(w, d, { kind: 'escalate', title: 'Escalated to HRBP', note: note.trim(),
      meta: 'Routed to ' + hrbp,
      file: f ? f.name : null, fileSize: f ? f.size : null });
    WK_ACTION_FORM = '';
    WK_FILES = { reupload: null, escalate: null, override: null };
    renderDocDetail(w);
    renderWkGrid && renderWkGrid();
    wkRenderRegistry && wkRenderRegistry();
    toast('Escalated to ' + hrbp, 'green');
  }

  /* commit a manual-evidence override */
  function wkSubmitOverride() {
    const w = WORKERS.find(x => x.id === SELECTED_WK);
    const d = w && w.docs.find(x => x.id === SELECTED_DOC);
    if (!w || !d) return;
    const note = (document.getElementById('va-override-note') || {}).value || '';
    if (!WK_FILES.override) { toast('Attach the manual evidence file', 'red'); return; }
    if (!note.trim()) { toast('Add a justification for the override', 'red'); return; }
    wkLogAction(w, d, { kind: 'override', title: 'Overridden with manual evidence',
      note: note.trim(), meta: 'Manual verification · audit-chained',
      file: WK_FILES.override.name, fileSize: WK_FILES.override.size });
    /* an override clears the rejection — the document becomes verified */
    d.status = 'done';
    d.notes = 'Manually verified via HR override — see action history.';
    WK_ACTION_FORM = '';
    WK_FILES = { reupload: null, escalate: null, override: null };
    selectWorker(w.id);   /* re-render drill with refreshed counts */
    renderWkGrid && renderWkGrid();
    wkRenderRegistry && wkRenderRegistry();
    toast(d.label + ' overridden with manual evidence — now verified', 'green');
  }

  /* ════════════════════════════════════════════════════════════════
     GENERIC ONBOARDING WORKER SEARCH (module-level)
     One search across every direct employee and contract worker —
     surfaces worker info plus any re-upload / escalate / override
     actions logged against them.
     ════════════════════════════════════════════════════════════════ */
  const WK_REG_LABEL = { reupload: 'Re-upload requested', escalate: 'Escalated to HRBP', override: 'Manual override' };
  const OB_OPEN = {};   /* which result rows are expanded to show actions */

  /* all actions logged against a direct worker, across their documents */
  function obWorkerActions(w) {
    const out = [];
    (w.docs || []).forEach(function (d) {
      (wkActionsFor(w, d) || []).forEach(function (a) {
        out.push({ a: a, docLabel: d.label });
      });
    });
    return out;
  }

  function obSearchClear() {
    const inp = document.getElementById('ob-gsearch');
    if (inp) inp.value = '';
    obSearch();
    if (inp) inp.focus();
  }

  function obToggleResult(key) {
    OB_OPEN[key] = !OB_OPEN[key];
    obSearch();
  }

  function obSearch() {
    const inp = document.getElementById('ob-gsearch');
    const box = document.getElementById('ob-gsearch-results');
    const clr = document.getElementById('ob-gsearch-clear');
    if (!inp || !box) return;
    const q = (inp.value || '').trim().toLowerCase();
    if (clr) clr.style.display = q ? 'flex' : 'none';

    if (!q) { box.style.display = 'none'; box.innerHTML = ''; return; }

    /* direct employees — name / id / posId / role / action content */
    const direct = (typeof WORKERS !== 'undefined' ? WORKERS : []).filter(function (w) {
      if ((w.name + ' ' + w.id + ' ' + (w.posId || '') + ' ' + w.role).toLowerCase().indexOf(q) > -1) return true;
      return obWorkerActions(w).some(function (e) {
        return ((WK_REG_LABEL[e.a.kind] || '') + ' ' + (e.a.note || '') + ' ' +
                (e.a.meta || '') + ' ' + e.docLabel).toLowerCase().indexOf(q) > -1;
      });
    });
    /* contract workers — name / contractor / category */
    const contract = (typeof CONTRACT_WORKERS !== 'undefined' ? CONTRACT_WORKERS : []).filter(function (w) {
      return (w.name + ' ' + w.contractor + ' ' + w.category).toLowerCase().indexOf(q) > -1;
    });

    if (!direct.length && !contract.length) {
      box.style.display = 'block';
      box.innerHTML = '<div class="ob-result-empty">No employee or contract worker matches \u201c' +
        inp.value + '\u201d.</div>';
      return;
    }

    let html = '';
    if (direct.length) {
      html += '<div class="ob-search-meta">Direct employees · ' + direct.length + '</div>';
      html += direct.map(function (w) {
        const initials = w.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
        const acts = obWorkerActions(w);
        const key = 'd:' + w.id;
        const open = !!OB_OPEN[key];
        const by = { reupload: 0, escalate: 0, override: 0 };
        acts.forEach(function (e) { by[e.a.kind] = (by[e.a.kind] || 0) + 1; });
        let tags = '';
        if (by.reupload) tags += '<span class="pill amber tiny">' + by.reupload + ' re-upload</span>';
        if (by.escalate) tags += '<span class="pill red tiny">' + by.escalate + ' escalation</span>';
        if (by.override) tags += '<span class="pill green tiny">' + by.override + ' override</span>';
        if (!acts.length) tags = '<span class="pill outline tiny">no actions</span>';
        let body = '';
        if (open && acts.length) {
          body = '<div class="ob-result-actions">' + acts.map(function (e) {
            const a = e.a;
            return '<div class="ob-result-action">' +
              '<span class="ob-ra-dot ' + a.kind + '"></span>' +
              '<div class="ob-ra-main">' +
                '<div class="ob-ra-act">' + (WK_REG_LABEL[a.kind] || a.title) + '</div>' +
                '<div class="ob-ra-meta">' + a.at + ' · ' + a.by + (a.meta ? ' · ' + a.meta : '') +
                  ' · doc: ' + e.docLabel + '</div>' +
                (a.note ? '<div class="ob-ra-note">' + a.note + '</div>' : '') +
                (a.file ? '<span class="ob-ra-file">\ud83d\udcce ' + a.file +
                  (a.fileSize ? ' · ' + a.fileSize : '') + '</span>' : '') +
              '</div></div>';
          }).join('') + '</div>';
        }
        const click = acts.length
          ? 'onclick="obToggleResult(\'' + key + '\')"'
          : 'onclick="obOpenWorker(\'' + w.id + '\')"';
        return '<div class="ob-result" ' + click + '>' +
          '<span class="ob-result-ava">' + initials + '</span>' +
          '<div class="ob-result-main">' +
            '<div class="ob-result-name">' + w.name + '</div>' +
            '<div class="ob-result-sub">' + w.id + ' · ' + w.role + ' · ' + (w.posId || '') +
              ' · ' + acts.length + ' action' + (acts.length === 1 ? '' : 's') + '</div>' +
          '</div>' +
          '<span class="ob-result-tags">' + tags + '</span>' +
        '</div>' + body;
      }).join('');
    }
    if (contract.length) {
      html += '<div class="ob-search-meta">Contract workers · ' + contract.length + '</div>';
      html += contract.map(function (w) {
        const initials = w.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
        return '<div class="ob-result" onclick="obOpenContract()">' +
          '<span class="ob-result-ava contract">' + initials + '</span>' +
          '<div class="ob-result-main">' +
            '<div class="ob-result-name">' + w.name + '</div>' +
            '<div class="ob-result-sub">' + w.contractor + ' · ' + w.category +
              (w.migrant && w.migrant !== '\u2014' ? ' · migrant ' + w.migrant : '') + '</div>' +
          '</div>' +
          '<span class="ob-result-tags"><span class="pill ' + w.esic.cls + ' tiny">ESIC ' +
            w.esic.label + '</span></span>' +
        '</div>';
      }).join('');
    }
    box.style.display = 'block';
    box.innerHTML = html;
  }

  /* clicking a direct-employee result with no actions jumps to their drill-down */
  function obOpenWorker(wid) {
    const tabDirect = [].slice.call(document.querySelectorAll('#sec-onboarding .tabs .tab'))
      .find(function (t) { return t.textContent.indexOf('Direct') > -1; });
    if (tabDirect) tabDirect.click();
    if (typeof selectWorker === 'function') selectWorker(wid);
    const box = document.getElementById('ob-gsearch-results');
    if (box) box.style.display = 'none';
    const drill = document.getElementById('wk-drill');
    if (drill) drill.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  /* clicking a contract result switches to the contract track */
  function obOpenContract() {
    const tabC = [].slice.call(document.querySelectorAll('#sec-onboarding .tabs .tab'))
      .find(function (t) { return t.textContent.indexOf('Contract') > -1; });
    if (tabC) tabC.click();
    const box = document.getElementById('ob-gsearch-results');
    if (box) box.style.display = 'none';
  }

  /* close the results when clicking outside the search bar */
  document.addEventListener('click', function (e) {
    const bar = document.querySelector('.ob-search-bar');
    const box = document.getElementById('ob-gsearch-results');
    if (!bar || !box || box.style.display !== 'block') return;
    if (!bar.contains(e.target)) box.style.display = 'none';
  });

  /* kept as a no-op alias so existing calls after actions are safe */
  function wkRenderRegistry() { obSearch(); }

  /* ── Direct employee grid (sortable) ── */
  let renderWkGrid = null;
  function buildWkGridSorter() {
    renderWkGrid = makeSortable('wk-grid', 'wk-grid-body', {
      defaults: { col: 'stageRank', dir: 1 },        /* surface earliest-stage workers first */
      textCols: ['name', 'posId', 'role'],
      dataFn: () => WORKERS.filter(w => {
        const q = (WK_SEARCH || '').trim().toLowerCase();
        if (!q) return true;
        return w.name.toLowerCase().indexOf(q) > -1 ||
               w.posId.toLowerCase().indexOf(q) > -1 ||
               w.role.toLowerCase().indexOf(q) > -1;
      }).map(w => {
        const c = countDocs(w);
        const sp = STAGE_PILL[w.stage];
        const vRank = c.rejected * 100 + c.pending; /* rejected first, then pending */
        const ppe = PPE_STATE[w.name];
        const ppeRank = ppe ? PPE_RANK[ppe.status] : -1;
        const indProg = indProgressOf(w.name);
        return { ...w, _c: c, _stagePill: sp, _vRank: vRank, _ppeRank: ppeRank, _indProg: indProg };
      }),
      valueFn: (w, col) => {
        switch (col) {
          case 'name':      return w.name.toLowerCase();
          case 'posId':     return w.posId;
          case 'role':      return w.role.toLowerCase();
          case 'stageRank': return w._stagePill.rank;
          case 'vRank':     return w._vRank;
          case 'ppeRank':   return w._ppeRank;
          case 'indProg':   return w._indProg.pct - (w._indProg.gated > 0 ? 200 : 0);
          case 'days':      return w.days;
        }
      },
      rowFn: w => {
        const c = w._c;
        const sp = w._stagePill;
        const donePct = (c.done / c.total) * 100;
        const pendPct = (c.pending / c.total) * 100;
        const rejPct  = (c.rejected/ c.total) * 100;
        return (
          '<tr class="wk-row' + (SELECTED_WK === w.id ? ' selected' : '') + '" onclick="selectWorker(\'' + w.id + '\')">' +
            '<td class="t-strong">' + w.name +
              (wkWorkerHasActions(w) ? '<span class="wk-act-badge" title="Has verification action history">⚑ actions</span>' : '') +
            '</td>' +
            '<td><span class="t-id">' + w.posId + '</span></td>' +
            '<td>' + w.role + '</td>' +
            '<td><span class="pill ' + sp.cls + '">' + sp.label + '</span></td>' +
            '<td>' +
              '<div style="display:flex;align-items:center;gap:10px">' +
                '<span class="vbar">' +
                  '<span class="vb-done"    style="width:' + donePct + '%"></span>' +
                  '<span class="vb-pending" style="width:' + pendPct + '%"></span>' +
                  '<span class="vb-rej"     style="width:' + rejPct  + '%"></span>' +
                '</span>' +
                '<span class="vstat"><span class="vstat-dot done"></span>' + c.done +
                ' <span class="vstat-dot pending" style="margin-left:6px"></span>' + c.pending +
                ' <span class="vstat-dot rej" style="margin-left:6px"></span>' + c.rejected + '</span>' +
              '</div>' +
            '</td>' +
            '<td>' + ppePillHtml(w.name) + '</td>' +
            '<td>' + indProgHtml(w.name) + '</td>' +
            '<td class="mono">' + w.days + '</td>' +
          '</tr>'
        );
      },
      afterRender: () => {
        const el = document.getElementById('wk-count');
        if (el) el.textContent = WORKERS.length + ' active';
      },
    });
  }

  /* ── Contract worker grid (sortable) ── */
  let renderCwGrid = null;
  function buildCwGridSorter() {
    renderCwGrid = makeSortable('cw-grid', 'cw-grid-body', {
      defaults: { col: 'esicRank', dir: 1 },         /* surface ESIC breach/pending first */
      textCols: ['name', 'contractor', 'migrant'],
      dataFn: () => CONTRACT_WORKERS.slice(),
      valueFn: (w, col) => {
        switch (col) {
          case 'name':       return w.name.toLowerCase();
          case 'contractor': return w.contractor.toLowerCase();
          case 'catRank':    return CAT_RANK[w.category] || 0;
          case 'esicRank':   return ESIC_RANK[w.esic.state];
          case 'migrant':    return w.migrant === '—' ? 'zzz' : w.migrant.toLowerCase();
          case 'clraRank':   return CLRA_RANK[w.clra.state];
          case 'ppeRank':    return PPE_STATE[w.name] ? PPE_RANK[PPE_STATE[w.name].status] : -1;
          case 'indProg':    return (indProgressOf(w.name).pct) - (indProgressOf(w.name).gated > 0 ? 200 : 0);
        }
      },
      rowFn: w => {
        const urgent = w.esic.state === 'breach' || w.clra.state === 'expired';
        const ctaCls = urgent ? 'notify-btn urgent' : 'notify-btn';
        const safeName = w.name.replace(/'/g, "\\'");
        return (
          '<tr>' +
            '<td class="t-strong">' + w.name + '</td>' +
            '<td>' + w.contractor + '</td>' +
            '<td>' + w.category + '</td>' +
            '<td><span class="pill ' + w.esic.cls + '">' + w.esic.label + '</span></td>' +
            '<td>' + w.migrant + '</td>' +
            '<td><span class="pill ' + w.clra.cls + '">' + w.clra.label + '</span></td>' +
            '<td>' + ppePillHtml(w.name) + '</td>' +
            '<td>' + indProgHtml(w.name) + '</td>' +
            '<td><button class="' + ctaCls + '" onclick="openVendorEmail(\'' + safeName + '\')">Notify vendor</button></td>' +
          '</tr>'
        );
      },
      afterRender: () => {
        const el = document.getElementById('cw-count');
        if (el) el.textContent = CONTRACT_WORKERS.length + ' active';
      },
    });
  }

  /* ── Shared document store grid (sortable) ── */
  let renderSdGrid = null;
  function buildSdGridSorter() {
    renderSdGrid = makeSortable('sd-grid', 'sd-grid-body', {
      defaults: { col: 'entries', dir: -1 },
      textCols: ['type', 'scope', 'enc', 'ret'],
      dataFn: () => SHARED_DOCS.slice(),
      valueFn: (d, col) => {
        switch (col) {
          case 'type':    return d.type.toLowerCase();
          case 'scope':   return d.scope.toLowerCase();
          case 'enc':     return d.enc.toLowerCase();
          case 'ret':     return d.ret.toLowerCase();
          case 'entries': return d.entries;
        }
      },
      rowFn: d => (
        '<tr>' +
          '<td class="t-strong">' + d.type + '</td>' +
          '<td>' + d.scope + '</td>' +
          '<td class="mono tiny">' + d.enc + '</td>' +
          '<td>' + d.ret + '</td>' +
          '<td class="mono">' + d.entries.toLocaleString() + '</td>' +
        '</tr>'
      ),
      afterRender: () => {
        const el = document.getElementById('sd-count');
        if (el) el.textContent = SHARED_DOCS.length + ' document types';
      },
    });
  }

  /* ── Dashboard summary computation ──
     Aggregates direct-employee verification counts + contract worker ESIC/CLRA signals. */
  function renderVerificationDashboard() {
    /* direct employee verification counts */
    let done = 0, pending = 0, rejected = 0, total = 0;
    let digDone = 0, digPend = 0, digRej = 0, digTot = 0;
    let selfDone = 0, selfPend = 0, selfRej = 0, selfTot = 0;
    let blocked = 0;
    WORKERS.forEach(w => {
      const c = countDocs(w);
      done += c.done; pending += c.pending; rejected += c.rejected; total += c.total;
      w.docs.forEach(d => {
        if (d.type === 'digital') {
          digTot++;
          if (d.status === 'done') digDone++;
          else if (d.status === 'pending') digPend++;
          else if (d.status === 'rejected') digRej++;
        } else {
          selfTot++;
          if (d.status === 'done') selfDone++;
          else if (d.status === 'pending') selfPend++;
          else if (d.status === 'rejected') selfRej++;
        }
      });
      if (c.rejected > 0 || w.stage !== 'ready') blocked++;
    });

    /* contract worker ESIC + CLRA */
    let esicOk = 0, esicPend = 0, esicBreach = 0;
    let clraValid = 0, clraExpiring = 0, clraExpired = 0;
    CONTRACT_WORKERS.forEach(w => {
      if      (w.esic.state === 'ok')      esicOk++;
      else if (w.esic.state === 'pending') esicPend++;
      else if (w.esic.state === 'breach')  esicBreach++;
      if      (w.clra.state === 'valid')    clraValid++;
      else if (w.clra.state === 'expiring') clraExpiring++;
      else if (w.clra.state === 'expired')  clraExpired++;
    });

    /* total in onboarding (including contract not yet at Ready) */
    const cwInOnb = CONTRACT_WORKERS.length;
    const cwBlocked = esicBreach + esicPend;
    const totalWorkers = WORKERS.length + cwInOnb;
    const totalBlocked = blocked + cwBlocked;

    /* roll digital + self into combined picture */
    const allChecks = total; /* direct only — contract pillars (ESIC/CLRA) handled separately */
    const pct = v => allChecks === 0 ? '0%' : (Math.round((v / allChecks) * 100) + '%');

    /* KPI tiles */
    document.getElementById('vd-done').textContent       = done;
    document.getElementById('vd-done-pct').textContent   = pct(done);
    document.getElementById('vd-pending').textContent    = pending + esicPend;
    document.getElementById('vd-pending-self').textContent = selfPend;
    document.getElementById('vd-pending-dig').textContent  = digPend;
    document.getElementById('vd-pending-esic').textContent = esicPend;
    document.getElementById('vd-rejected').textContent   = rejected + esicBreach;
    document.getElementById('vd-rej-action').textContent = rejected + ' rejected docs · ' + esicBreach + ' ESIC breach';
    document.getElementById('vd-workers').firstChild.nodeValue = totalWorkers;
    document.getElementById('vd-workers-split').textContent = ' · ' + WORKERS.length + ' direct + ' + cwInOnb + ' contract';
    document.getElementById('vd-blocked').textContent = totalBlocked;

    /* digital ratio tile */
    const digPct = total === 0 ? 0 : Math.round((digTot / total) * 100);
    document.getElementById('vd-digital-ratio').firstChild.nodeValue = digPct + '%';
    document.getElementById('vd-digital-sub').textContent = ' digitally verified';
    document.getElementById('vd-digital-line').innerHTML =
      digTot + ' API-backed checks · ' + selfTot + ' self-attested awaiting / under HR review · ' +
      '<span class="pct">' + Math.round((digDone / Math.max(digTot,1)) * 100) + '% digital pass</span>';

    /* PPE / uniform fitment counts across direct + contract */
    let ppeMissing = 0, ppeDraft = 0, ppeConfirmed = 0;
    const allWorkerNames = [...WORKERS.map(w => w.name), ...CONTRACT_WORKERS.map(w => w.name)];
    allWorkerNames.forEach(n => {
      const p = PPE_STATE[n];
      if (!p) return;
      if (p.status === 'missing')        ppeMissing++;
      else if (p.status === 'draft')     ppeDraft++;
      else if (p.status === 'confirmed') ppeConfirmed++;
    });

    /* ── compact alert bar — one chip per alert category ── */
    const alertHost = document.getElementById('vdash-alert-host');
    const chips = [];

    if (esicBreach > 0) {
      chips.push({
        cls: 'urgent', icon: '⚠',
        headline: '<span class="ac-count">' + esicBreach + '</span> ESIC 3-day breach' + (esicBreach > 1 ? 'es' : ''),
        sub: 'Push to HRIS blocked · ESI Act 1948',
        title: 'Contract workers past Day 3 without ESIC IP number. Click to review and notify vendor.',
        onclick: 'jumpToContractTab()',
      });
    }
    if (ppeMissing > 0) {
      chips.push({
        cls: 'urgent', icon: '🥾',
        headline: '<span class="ac-count">' + ppeMissing + '</span> PPE sizing missing',
        sub: 'No floor entry · Factories Act 41-B',
        title: 'Workers without captured shoe / uniform sizes cannot enter the shop floor. Click to open Induction filtered to these workers.',
        onclick: "navAndFilter('induction','ppeMissing')",
      });
    }
    if (ppeDraft > 0) {
      chips.push({
        cls: 'warning', icon: '⌛',
        headline: '<span class="ac-count">' + ppeDraft + '</span> fitment pending',
        sub: 'Sizes captured · receipt awaiting',
        title: 'PPE orders placed but fitment confirmation pending. Click to open Induction filtered to these workers.',
        onclick: "navAndFilter('induction','ppeDraft')",
      });
    }
    if (rejected > 0) {
      chips.push({
        cls: 'warning', icon: '✗',
        headline: '<span class="ac-count">' + rejected + '</span> doc' + (rejected > 1 ? 's' : '') + ' rejected',
        sub: 'Awaiting re-upload · HR override',
        title: 'Direct employees with rejected documents pending re-upload or HR override.',
        onclick: '',
      });
    }

    if (chips.length === 0) {
      alertHost.innerHTML =
        '<div class="alert-bar-calm">All clear · no breaches, missing PPE, or rejected documents in active onboarding</div>';
    } else {
      let html = '<div class="alert-bar">';
      chips.forEach(c => {
        html += '<div class="alert-chip ' + c.cls + '" ' +
                (c.onclick ? 'onclick="' + c.onclick + '" ' : '') +
                'title="' + c.title.replace(/"/g, '&quot;') + '">' +
                  '<span class="alert-chip-icon">' + c.icon + '</span>' +
                  '<div class="alert-chip-body">' +
                    '<div class="alert-chip-headline">' + c.headline + '</div>' +
                    '<div class="alert-chip-sub">' + c.sub + '</div>' +
                  '</div>' +
                  (c.onclick ? '<span class="alert-chip-cta">↗</span>' : '') +
                '</div>';
      });
      html += '</div>';
      alertHost.innerHTML = html;
    }

    /* breakdown stacked bars */
    const rows = [
      { k: 'Direct · Digital evidence',  d: digDone,  p: digPend,  r: digRej,  t: digTot  },
      { k: 'Direct · Self-attested',     d: selfDone, p: selfPend, r: selfRej, t: selfTot },
      { k: 'Contract · ESIC enrolment',  d: esicOk,   p: esicPend, r: esicBreach, t: cwInOnb },
      { k: 'Contract · CLRA licence',    d: clraValid,p: clraExpiring, r: clraExpired, t: cwInOnb },
    ];
    const bd = document.getElementById('vd-breakdown');
    bd.innerHTML = rows.map(r => {
      const dp = (r.d / Math.max(r.t,1)) * 100;
      const pp = (r.p / Math.max(r.t,1)) * 100;
      const rp = (r.r / Math.max(r.t,1)) * 100;
      return (
        '<div class="stack-row">' +
          '<div class="stack-row-h">' +
            '<span class="stack-row-k">' + r.k + '</span>' +
            '<span class="stack-row-tot">' + r.d + ' · ' + r.p + ' · ' + r.r + ' / ' + r.t + '</span>' +
          '</div>' +
          '<div class="stack-bar">' +
            '<span class="sb-done"    style="width:' + dp + '%"></span>' +
            '<span class="sb-pending" style="width:' + pp + '%"></span>' +
            '<span class="sb-rej"     style="width:' + rp + '%"></span>' +
          '</div>' +
        '</div>'
      );
    }).join('');
  }

  function initVerification() {
    if (!document.getElementById('wk-grid-body')) return;
    buildWkGridSorter();
    buildCwGridSorter();
    buildSdGridSorter();
    renderWkGrid();
    renderCwGrid();
    renderSdGrid();
    renderVerificationDashboard();
    wkRenderRegistry();
  }

  /* ════════════════════════════════════════════════════════════════
     WORKFORCE DIRECTORY — searchable unified grid + compliance drill
     Pulls direct employees (WORKERS) and contract workers
     (CONTRACT_WORKERS) into one searchable, filterable view.
     All state namespaced (DIR_STATE / dir*).
     ════════════════════════════════════════════════════════════════ */
  const DIR_STATE = { track: 'all', status: 'all', open: null };

  /* normalise every worker into one shape with a derived compliance status */
  function dirAllWorkers() {
    const out = [];
    /* direct employees */
    (typeof WORKERS !== 'undefined' ? WORKERS : []).forEach(function (w) {
      const c = countDocs(w);
      let status = 'ok', label = 'Verified', cls = 'green';
      if (c.rejected > 0) { status = 'critical'; label = c.rejected + ' rejected'; cls = 'red'; }
      else if (c.pending > 0) { status = 'watch'; label = c.pending + ' pending'; cls = 'amber'; }
      out.push({
        kind: 'direct', id: w.id, name: w.name, role: w.role,
        org: w.posId || '—', ref: w.posId || '',
        status: status, statusLabel: label, statusCls: cls,
        raw: w, counts: c
      });
    });
    /* contract workers — synthesise a stable id from the index */
    (typeof CONTRACT_WORKERS !== 'undefined' ? CONTRACT_WORKERS : []).forEach(function (w, i) {
      let status = 'ok', cls = 'green', label = 'Compliant';
      if (w.esic.state === 'breach') { status = 'critical'; cls = 'red'; label = 'ESIC breach'; }
      else if (w.esic.state === 'pending' || w.clra.state === 'expiring') {
        status = 'watch'; cls = 'amber';
        label = w.esic.state === 'pending' ? 'ESIC pending' : 'CLRA expiring';
      }
      out.push({
        kind: 'contract', id: 'CW-' + (i + 1), name: w.name, role: w.category,
        org: w.contractor, ref: w.contractor,
        status: status, statusLabel: label, statusCls: cls,
        raw: w
      });
    });
    return out;
  }

  function dirSearchClear() {
    const inp = document.getElementById('dir-search');
    if (inp) inp.value = '';
    dirRender();
  }

  function dirFilter(group, value) {
    DIR_STATE[group] = value;
    const wrap = document.getElementById('dir-filter-' + group);
    if (wrap) {
      [].slice.call(wrap.querySelectorAll('.dir-fbtn')).forEach(function (b) {
        b.classList.toggle('on', (b.getAttribute('onclick') || b.getAttribute('data-onclick') || '').indexOf("'" + value + "'") > -1);
      });
    }
    dirRender();
  }

  function dirInitials(name) {
    return name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
  }

  function dirRender() {
    const body = document.getElementById('dir-grid-body');
    if (!body) return;
    const inp = document.getElementById('dir-search');
    const q = (inp ? inp.value : '').trim().toLowerCase();
    const clr = document.getElementById('dir-search-clear');
    if (clr) clr.style.display = q ? 'flex' : 'none';

    let all = dirAllWorkers();
    /* KPI strip — computed on the full set */
    const total = all.length;
    const direct = all.filter(function (x) { return x.kind === 'direct'; }).length;
    const ok = all.filter(function (x) { return x.status === 'ok'; }).length;
    const watch = all.filter(function (x) { return x.status === 'watch'; }).length;
    const crit = all.filter(function (x) { return x.status === 'critical'; }).length;
    const set = function (id, v) { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('dir-kpi-total', total);
    set('dir-kpi-split', direct + ' direct · ' + (total - direct) + ' contract');
    set('dir-kpi-ok', ok);
    set('dir-kpi-watch', watch);
    set('dir-kpi-crit', crit);

    /* apply filters */
    let rows = all.filter(function (x) {
      if (DIR_STATE.track !== 'all' && x.kind !== DIR_STATE.track) return false;
      if (DIR_STATE.status !== 'all' && x.status !== DIR_STATE.status) return false;
      if (q && (x.name + ' ' + x.id + ' ' + x.role + ' ' + x.org).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    const cnt = document.getElementById('dir-count');
    if (cnt) cnt.textContent = rows.length + ' of ' + total + ' workers';
    const nores = document.getElementById('dir-noresults');
    if (nores) nores.style.display = rows.length ? 'none' : 'block';

    body.innerHTML = rows.map(function (x) {
      const open = DIR_STATE.open === x.id;
      const trackPill = x.kind === 'direct'
        ? '<span class="pill green tiny">Direct</span>'
        : '<span class="pill amber tiny">Contract</span>';
      let mainRow = '<tr class="dir-row ' + (open ? 'open' : '') +
        '" onclick="dirToggle(\'' + x.id + '\')">' +
        '<td><div class="dir-worker">' +
          '<span class="dir-ava ' + (x.kind === 'contract' ? 'contract' : '') + '">' +
            dirInitials(x.name) + '</span>' +
          '<div><div class="t-strong">' + x.name + '</div>' +
            '<div class="t-mute">' + x.id + '</div></div>' +
        '</div></td>' +
        '<td>' + trackPill + '</td>' +
        '<td>' + x.role + '</td>' +
        '<td>' + x.org + '</td>' +
        '<td><span class="pill ' + x.statusCls + ' tiny"><span class="dot ' +
          x.statusCls + '"></span>' + x.statusLabel + '</span></td>' +
        '<td style="text-align:right"><span class="dir-detail-btn">' +
          (open ? 'Hide ▲' : 'Drill down ▾') + '</span></td>' +
      '</tr>';
      return mainRow;
    }).join('');

    /* render the drill-down panel for the opened worker */
    dirRenderDrill(rows);
  }

  function dirToggle(id) {
    DIR_STATE.open = (DIR_STATE.open === id) ? null : id;
    dirRender();
  }
  function dirCloseDrill() {
    DIR_STATE.open = null;
    dirRender();
  }

  function dirRenderDrill(rows) {
    const drill = document.getElementById('dir-drill');
    if (!drill) return;
    if (!DIR_STATE.open) { drill.style.display = 'none'; return; }
    const x = rows.find(function (r) { return r.id === DIR_STATE.open; });
    if (!x) { drill.style.display = 'none'; return; }
    drill.style.display = 'block';
    document.getElementById('dir-drill-eye').textContent =
      x.kind === 'direct' ? 'Direct employee · compliance detail' : 'Contract worker · compliance detail';
    document.getElementById('dir-drill-title').textContent = x.name;
    document.getElementById('dir-drill-sub').textContent = x.id + ' · ' + x.role + ' · ' + x.org;
    document.getElementById('dir-drill-stats').innerHTML =
      '<span class="pill ' + x.statusCls + '"><span class="dot ' + x.statusCls + '"></span>' +
      x.statusLabel + '</span>';

    const body = document.getElementById('dir-drill-body');
    if (x.kind === 'direct') body.innerHTML = dirDirectDetail(x);
    else body.innerHTML = dirContractDetail(x);
  }

  /* ── direct-employee compliance detail ── */
  function dirDirectDetail(x) {
    const w = x.raw, c = x.counts;
    const docRows = w.docs.map(function (d) {
      const cls = d.status === 'done' ? 'ok' : d.status === 'pending' ? 'warn' : 'bad';
      const ico = d.status === 'done' ? '✓' : d.status === 'pending' ? '!' : '✕';
      const tag = d.type === 'digital' ? 'Digital evidence' : 'Self-attested';
      return '<div class="dir-dd-check">' +
        '<span class="dir-dd-check-ico ' + cls + '">' + ico + '</span>' +
        '<div class="dir-dd-check-main">' +
          '<div class="dir-dd-check-l">' + d.label + '</div>' +
          '<div class="dir-dd-check-s">' + tag +
            (d.ts ? ' · ' + d.ts : '') + (d.notes ? ' · ' + d.notes : '') + '</div>' +
        '</div></div>';
    }).join('');
    /* verification / upload actions logged against this worker */
    const acts = (typeof obWorkerActions === 'function') ? obWorkerActions(w) : [];
    let actBlock = '';
    if (acts.length) {
      actBlock = '<div class="dir-dd-card dir-dd-full">' +
        '<div class="dir-dd-card-h">Verification &amp; upload actions' +
          '<span class="pill outline tiny">' + acts.length + ' logged</span></div>' +
        acts.map(function (e) {
          const a = e.a;
          const lbl = (typeof WK_REG_LABEL !== 'undefined' && WK_REG_LABEL[a.kind]) || a.title;
          const ic = a.kind === 'override' ? '✓' : a.kind === 'escalate' ? '⚑' : '↻';
          return '<div class="dir-act">' +
            '<span class="dir-act-dot ' + a.kind + '">' + ic + '</span>' +
            '<div class="dir-act-main">' +
              '<div class="dir-act-title">' + lbl + '</div>' +
              '<div class="dir-act-meta">' + a.at + ' · ' + a.by +
                (a.meta ? ' · ' + a.meta : '') + ' · document: ' + e.docLabel + '</div>' +
              (a.note ? '<div class="dir-act-note">' + a.note + '</div>' : '') +
              (a.file ? '<span class="dir-act-file">📎 ' + a.file +
                (a.fileSize ? ' · ' + a.fileSize : '') + '</span>' : '') +
            '</div></div>';
        }).join('') +
      '</div>';
    } else {
      actBlock = '<div class="dir-dd-card dir-dd-full">' +
        '<div class="dir-dd-card-h">Verification &amp; upload actions</div>' +
        '<div class="dir-dd-note">No re-upload requests, HRBP escalations or manual overrides have been raised against this worker. Actions taken in the Onboarding verification ledger appear here.</div>' +
      '</div>';
    }
    return '<div class="dir-dd-grid">' +
      '<div class="dir-dd-card">' +
        '<div class="dir-dd-card-h">Worker record</div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Worker ID</span><span class="dir-dd-v">' + w.id + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Position ID</span><span class="dir-dd-v">' + (w.posId || '—') + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Role</span><span class="dir-dd-v">' + w.role + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Onboarding stage</span><span class="dir-dd-v">' + (w.stage || '—') + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">UAN (EPFO)</span><span class="dir-dd-v">' + (w.uan || '—') + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Days in onboarding</span><span class="dir-dd-v">' + (w.days != null ? w.days : '—') + '</span></div>' +
      '</div>' +
      '<div class="dir-dd-card">' +
        '<div class="dir-dd-card-h">Compliance summary' +
          '<span class="pill ' + x.statusCls + ' tiny">' + x.statusLabel + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Documents verified</span><span class="dir-dd-v">' + c.done + ' / ' + c.total + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Pending</span><span class="dir-dd-v">' + c.pending + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Rejected</span><span class="dir-dd-v">' + c.rejected + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Induction</span><span class="dir-dd-v">' + (w.induction || '—') + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Push to HRIS</span><span class="dir-dd-v">' +
          (c.rejected > 0 ? 'Blocked' : c.pending > 0 ? 'Pending checks' : 'Ready') + '</span></div>' +
      '</div>' +
      '<div class="dir-dd-card dir-dd-full">' +
        '<div class="dir-dd-card-h">Verification ledger · ' + c.total + ' items</div>' +
        docRows +
      '</div>' +
      actBlock +
    '</div>';
  }

  /* look up the full contractor record by name (tolerant match) */
  function dirFindContractor(name) {
    if (typeof CONTRACTORS === 'undefined' || !name) return null;
    const n = name.trim().toLowerCase();
    return CONTRACTORS.find(function (c) {
      const cn = c.name.trim().toLowerCase();
      return cn === n || cn.indexOf(n) > -1 || n.indexOf(cn) > -1;
    }) || null;
  }

  /* ── contract-worker compliance detail ── */
  function dirContractDetail(x) {
    const w = x.raw;
    const esicCls = w.esic.cls === 'green' ? 'ok' : w.esic.cls === 'amber' ? 'warn' : 'bad';
    const clraCls = w.clra.cls === 'green' ? 'ok' : w.clra.cls === 'amber' ? 'warn' : 'bad';
    const migrant = w.migrant && w.migrant !== '—';
    const ct = dirFindContractor(w.contractor);

    /* full contractor details card — from the Contractor Master */
    let contractorCard;
    if (ct) {
      const scoreCls = ct.score >= 80 ? 'green' : ct.score >= 60 ? 'amber' : 'red';
      contractorCard = '<div class="dir-dd-card dir-dd-full">' +
        '<div class="dir-dd-card-h">Contractor details · ' + ct.name +
          '<span class="pill ' + scoreCls + ' tiny">Compliance score ' + ct.score + '</span></div>' +
        '<div class="dir-ct-grid">' +
          '<div class="dir-dd-row"><span class="dir-dd-k">Contractor ID</span><span class="dir-dd-v">' + ct.id + '</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">Deployment area</span><span class="dir-dd-v">' + ct.area + '</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">Workers deployed</span><span class="dir-dd-v">' + ct.deployed + '</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">Registered since</span><span class="dir-dd-v">' + ct.registered + '</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">PAN / CIN</span><span class="dir-dd-v">' + kvIdSpan('PAN / CIN', ct.panCin, ct.id, 'contractor') + '</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">GST</span><span class="dir-dd-v">' + kvIdSpan('GST', ct.gst, ct.id, 'contractor') + '</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">ESIC employer code</span><span class="dir-dd-v">' + kvIdSpan('ESIC employer code', ct.esicCode, ct.id, 'contractor') + '</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">CLRA licence</span><span class="dir-dd-v">' + ct.clra.label + ' · ' + ct.clra.expiresOn + '</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">Bank (verified)</span><span class="dir-dd-v">' + ct.bankAck + '</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">Avg worker pay</span><span class="dir-dd-v">' + ct.avgPay + '</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">Women workers</span><span class="dir-dd-v">' + ct.womenWorkers + '</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">Migrant workers</span><span class="dir-dd-v">' + ct.migrantWorkers + '</span></div>' +
          '<div class="dir-dd-row" style="grid-column:span 2"><span class="dir-dd-k">Compliance lead</span><span class="dir-dd-v">' + ct.complianceLead + '</span></div>' +
        '</div>' +
        '<div class="dir-ct-bars">' +
          dirCtBar('CLRA', ct.subscores.clra) + dirCtBar('ESIC', ct.subscores.esic) +
          dirCtBar('PF', ct.subscores.pf) + dirCtBar('Min wage', ct.subscores.minWage) +
          dirCtBar('Migrant', ct.subscores.migrant) + dirCtBar('Safety', ct.subscores.safety) +
        '</div>' +
      '</div>';
    } else {
      contractorCard = '<div class="dir-dd-card dir-dd-full">' +
        '<div class="dir-dd-card-h">Contractor details · ' + w.contractor + '</div>' +
        '<div class="dir-dd-note">Contractor: <strong>' + w.contractor + '</strong>. Full record not found in the Contractor Master shown here — open Vendor compliance for the complete contractor profile.</div>' +
      '</div>';
    }

    return '<div class="dir-dd-grid">' +
      '<div class="dir-dd-card">' +
        '<div class="dir-dd-card-h">Engagement record</div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Worker</span><span class="dir-dd-v">' + w.name + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Contractor</span><span class="dir-dd-v">' + w.contractor + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Worker category</span><span class="dir-dd-v">' + w.category + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Inter-state migrant</span><span class="dir-dd-v">' +
          (migrant ? 'Yes · ' + w.migrant : 'No') + '</span></div>' +
      '</div>' +
      '<div class="dir-dd-card">' +
        '<div class="dir-dd-card-h">Compliance summary' +
          '<span class="pill ' + x.statusCls + ' tiny">' + x.statusLabel + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">ESIC enrolment</span><span class="dir-dd-v">' + w.esic.label + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">CLRA licence</span><span class="dir-dd-v">' + w.clra.label + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Push to HRIS</span><span class="dir-dd-v">' +
          (x.status === 'critical' ? 'Blocked' : x.status === 'watch' ? 'Pending checks' : 'Ready') + '</span></div>' +
      '</div>' +
      contractorCard +
      '<div class="dir-dd-card dir-dd-full">' +
        '<div class="dir-dd-card-h">Statutory checklist</div>' +
        '<div class="dir-dd-check">' +
          '<span class="dir-dd-check-ico ' + esicCls + '">' +
            (esicCls === 'ok' ? '✓' : esicCls === 'warn' ? '!' : '✕') + '</span>' +
          '<div class="dir-dd-check-main"><div class="dir-dd-check-l">ESIC enrolment ≤ 3 days</div>' +
            '<div class="dir-dd-check-s">' + w.esic.label +
            (w.esic.state === 'breach' ? ' · principal-employer joint liability — blocked from push'
             : w.esic.state === 'pending' ? ' · within the 3-day window' : ' · enrolled on time') +
            '</div></div></div>' +
        '<div class="dir-dd-check">' +
          '<span class="dir-dd-check-ico ' + clraCls + '">' +
            (clraCls === 'ok' ? '✓' : '!') + '</span>' +
          '<div class="dir-dd-check-main"><div class="dir-dd-check-l">CLRA licence cover</div>' +
            '<div class="dir-dd-check-s">' + w.clra.label +
            (ct ? ' · contractor licence ' + ct.clra.label.toLowerCase() + ' (' + ct.clra.expiresOn + ')' : '') +
            (w.clra.state === 'expiring' ? ' · renewal due — monitor before expiry' : ' · valid') +
            '</div></div></div>' +
        '<div class="dir-dd-check">' +
          '<span class="dir-dd-check-ico ' + (migrant ? 'warn' : 'ok') + '">' +
            (migrant ? '!' : '✓') + '</span>' +
          '<div class="dir-dd-check-main"><div class="dir-dd-check-l">Inter-state migrant registration</div>' +
            '<div class="dir-dd-check-s">' +
            (migrant ? 'ISMW / OSHC registration applies · route ' + w.migrant
                     : 'Not an inter-state migrant — ISMW not applicable') +
            '</div></div></div>' +
      '</div>' +
    '</div>';
  }

  /* a labelled mini score bar for a contractor sub-score */
  function dirCtBar(label, val) {
    const cls = val >= 80 ? 'green' : val >= 60 ? 'amber' : 'red';
    return '<div class="dir-ct-bar">' +
      '<div class="dir-ct-bar-top"><span>' + label + '</span><span class="mono">' + val + '</span></div>' +
      '<div class="bar thin"><span style="width:' + val + '%;background:var(--' + cls + ')"></span></div>' +
    '</div>';
  }

  function dirExport() {
    toast('Worker directory exported · ' + dirAllWorkers().length + ' workers', 'green');
  }

  function initDir() {
    if (!document.getElementById('dir-grid-body')) return;
    dirRender();
  }
  __kvOnReady(initDir);

  /* ════════════════════════════════════════════════════════════════
     CONTRACTOR DIRECTORY — searchable grid + compliance drill-down
     Same pattern as the worker directory, over the Contractor Master.
     All state namespaced (CTD_STATE / ctd*).
     ════════════════════════════════════════════════════════════════ */
  const CTD_STATE = { status: 'all', open: null };

  /* derive a compliance standing for a contractor */
  function ctdStatus(c) {
    if (c.clra.state === 'breach' || c.esic.state === 'breach' ||
        c.pf.state === 'breach' || c.score < 60) {
      return { status: 'critical', label: 'Critical', cls: 'red' };
    }
    if (c.clra.state === 'expiring' || c.esic.state === 'pending' ||
        c.pf.state === 'pending' || c.score < 80) {
      return { status: 'watch', label: 'Attention', cls: 'amber' };
    }
    return { status: 'ok', label: 'Compliant', cls: 'green' };
  }

  /* workers deployed under a contractor (from CONTRACT_WORKERS) */
  function ctdWorkers(name) {
    if (typeof CONTRACT_WORKERS === 'undefined') return [];
    const n = name.trim().toLowerCase();
    return CONTRACT_WORKERS.filter(function (w) {
      const cn = w.contractor.trim().toLowerCase();
      return cn === n || cn.indexOf(n) > -1 || n.indexOf(cn) > -1;
    });
  }

  function ctdSearchClear() {
    const inp = document.getElementById('ctd-search');
    if (inp) inp.value = '';
    ctdRender();
  }
  function ctdFilter(value) {
    CTD_STATE.status = value;
    const wrap = document.getElementById('ctd-filter-status');
    if (wrap) [].slice.call(wrap.querySelectorAll('.dir-fbtn')).forEach(function (b) {
      b.classList.toggle('on', (b.getAttribute('onclick') || b.getAttribute('data-onclick') || '').indexOf("'" + value + "'") > -1);
    });
    ctdRender();
  }
  function ctdToggle(id) {
    CTD_STATE.open = (CTD_STATE.open === id) ? null : id;
    ctdRender();
  }
  function ctdCloseDrill() { CTD_STATE.open = null; ctdRender(); }

  function ctdRender() {
    const body = document.getElementById('ctd-grid-body');
    if (!body || typeof CONTRACTORS === 'undefined') return;
    const inp = document.getElementById('ctd-search');
    const q = (inp ? inp.value : '').trim().toLowerCase();
    const clr = document.getElementById('ctd-search-clear');
    if (clr) clr.style.display = q ? 'flex' : 'none';

    /* KPI strip — full set */
    const all = CONTRACTORS.map(function (c) { return { c: c, st: ctdStatus(c) }; });
    const totalDeployed = all.reduce(function (n, r) { return n + r.c.deployed; }, 0);
    const set = function (id, v) { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('ctd-kpi-total', all.length);
    set('ctd-kpi-deployed', totalDeployed.toLocaleString('en-IN') + ' workers deployed');
    set('ctd-kpi-ok', all.filter(function (r) { return r.st.status === 'ok'; }).length);
    set('ctd-kpi-watch', all.filter(function (r) { return r.st.status === 'watch'; }).length);
    set('ctd-kpi-crit', all.filter(function (r) { return r.st.status === 'critical'; }).length);

    /* filter */
    let rows = all.filter(function (r) {
      if (CTD_STATE.status !== 'all' && r.st.status !== CTD_STATE.status) return false;
      if (q && (r.c.name + ' ' + r.c.id + ' ' + r.c.area + ' ' + r.c.complianceLead)
        .toLowerCase().indexOf(q) === -1) return false;
      return true;
    });

    const cnt = document.getElementById('ctd-count');
    if (cnt) cnt.textContent = rows.length + ' of ' + all.length + ' contractors';
    const nores = document.getElementById('ctd-noresults');
    if (nores) nores.style.display = rows.length ? 'none' : 'block';

    body.innerHTML = rows.map(function (r) {
      const c = r.c, st = r.st, open = CTD_STATE.open === c.id;
      const scoreCls = c.score >= 80 ? 'green' : c.score >= 60 ? 'amber' : 'red';
      const initials = c.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
      return '<tr class="dir-row ' + (open ? 'open' : '') + '" onclick="ctdToggle(\'' + c.id + '\')">' +
        '<td><div class="dir-worker">' +
          '<span class="dir-ava contract">' + initials + '</span>' +
          '<div><div class="t-strong">' + c.name + '</div><div class="t-mute">' + c.id + '</div></div>' +
        '</div></td>' +
        '<td>' + c.area + '</td>' +
        '<td>' + c.deployed + '</td>' +
        '<td><div class="ctd-score"><span class="mono t-strong">' + c.score + '</span>' +
          '<div class="bar thin" style="width:64px"><span style="width:' + c.score +
          '%;background:var(--' + scoreCls + ')"></span></div></div></td>' +
        '<td><span class="pill ' + st.cls + ' tiny"><span class="dot ' + st.cls + '"></span>' +
          st.label + '</span></td>' +
        '<td style="text-align:right"><span class="dir-detail-btn">' +
          (open ? 'Hide ▲' : 'Drill down ▾') + '</span></td>' +
      '</tr>';
    }).join('');

    ctdRenderDrill(rows);
  }

  function ctdRenderDrill(rows) {
    const drill = document.getElementById('ctd-drill');
    if (!drill) return;
    if (!CTD_STATE.open) { drill.style.display = 'none'; return; }
    const r = rows.find(function (x) { return x.c.id === CTD_STATE.open; });
    if (!r) { drill.style.display = 'none'; return; }
    const c = r.c, st = r.st;
    drill.style.display = 'block';
    document.getElementById('ctd-drill-title').textContent = c.name;
    document.getElementById('ctd-drill-sub').textContent =
      c.id + ' · ' + c.area + ' · ' + c.deployed + ' workers deployed';
    document.getElementById('ctd-drill-stats').innerHTML =
      '<span class="pill ' + st.cls + '"><span class="dot ' + st.cls + '"></span>' + st.label +
      '</span><span class="pill outline">Score ' + c.score + '</span>';
    document.getElementById('ctd-drill-body').innerHTML = ctdDetail(c, st);
  }

  function ctdStateCls(s) {
    return s === 'ok' || s === 'valid' ? 'ok' : s === 'breach' ? 'bad' : 'warn';
  }

  function ctdDetail(c, st) {
    /* statutory checklist — CLRA / ESIC / PF */
    function check(label, state, text) {
      const cls = ctdStateCls(state);
      const ic = cls === 'ok' ? '✓' : cls === 'bad' ? '✕' : '!';
      return '<div class="dir-dd-check">' +
        '<span class="dir-dd-check-ico ' + cls + '">' + ic + '</span>' +
        '<div class="dir-dd-check-main"><div class="dir-dd-check-l">' + label + '</div>' +
          '<div class="dir-dd-check-s">' + text + '</div></div></div>';
    }
    /* deployed workers under this contractor */
    const workers = ctdWorkers(c.name);
    const wRows = workers.length
      ? workers.map(function (w) {
          return '<div class="dir-dd-check">' +
            '<span class="dir-dd-check-ico ' + ctdStateCls(w.esic.state) + '">' +
              (w.esic.state === 'ok' ? '✓' : w.esic.state === 'breach' ? '✕' : '!') + '</span>' +
            '<div class="dir-dd-check-main"><div class="dir-dd-check-l">' + w.name +
              ' · ' + w.category + '</div>' +
              '<div class="dir-dd-check-s">ESIC ' + w.esic.label + ' · CLRA ' + w.clra.label +
              (w.migrant && w.migrant !== '\u2014' ? ' · migrant ' + w.migrant : '') + '</div>' +
            '</div></div>';
        }).join('')
      : '<div class="dir-dd-note">No individual contract workers from this contractor are in the current onboarding set.</div>';
    /* liability */
    const L = c.liability || {};
    const scoreCls = c.score >= 80 ? 'green' : c.score >= 60 ? 'amber' : 'red';

    return '<div class="dir-dd-grid">' +
      /* contractor master record */
      '<div class="dir-dd-card">' +
        '<div class="dir-dd-card-h">Contractor record</div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Contractor ID</span><span class="dir-dd-v">' + c.id + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Deployment area</span><span class="dir-dd-v">' + c.area + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Workers deployed</span><span class="dir-dd-v">' + c.deployed + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Registered since</span><span class="dir-dd-v">' + c.registered + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">PAN / CIN</span><span class="dir-dd-v">' + kvIdSpan('PAN / CIN', c.panCin, c.id, 'contractor') + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">GST</span><span class="dir-dd-v">' + kvIdSpan('GST', c.gst, c.id, 'contractor') + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">ESIC employer code</span><span class="dir-dd-v">' + kvIdSpan('ESIC employer code', c.esicCode, c.id, 'contractor') + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Bank (verified)</span><span class="dir-dd-v">' + c.bankAck + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Avg worker pay</span><span class="dir-dd-v">' + c.avgPay + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Compliance lead</span><span class="dir-dd-v">' + c.complianceLead + '</span></div>' +
      '</div>' +
      /* compliance summary + sub-scores */
      '<div class="dir-dd-card">' +
        '<div class="dir-dd-card-h">Compliance standing' +
          '<span class="pill ' + st.cls + ' tiny">' + st.label + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Overall score</span><span class="dir-dd-v">' + c.score + ' / 100</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">CLRA licence</span><span class="dir-dd-v">' + c.clra.label + ' · ' + c.clra.expiresOn + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">ESIC challan</span><span class="dir-dd-v">' + c.esic.label + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">PF challan</span><span class="dir-dd-v">' + c.pf.label + '</span></div>' +
        '<div class="dir-dd-row"><span class="dir-dd-k">Women / migrant</span><span class="dir-dd-v">' + c.womenWorkers + ' / ' + c.migrantWorkers + '</span></div>' +
        '<div class="dir-ct-bars" style="margin-top:10px">' +
          dirCtBar('CLRA', c.subscores.clra) + dirCtBar('ESIC', c.subscores.esic) +
          dirCtBar('PF', c.subscores.pf) + dirCtBar('Min wage', c.subscores.minWage) +
          dirCtBar('Migrant', c.subscores.migrant) + dirCtBar('Safety', c.subscores.safety) +
        '</div>' +
      '</div>' +
      /* statutory checklist */
      '<div class="dir-dd-card dir-dd-full">' +
        '<div class="dir-dd-card-h">Statutory checklist</div>' +
        check('CLRA licence', c.clra.state,
          c.clra.label + ' · expires ' + c.clra.expiresOn +
          (c.clra.state === 'expiring' ? ' — renewal due, monitor before expiry'
           : c.clra.state === 'breach' ? ' — lapsed, principal-employer liability' : ' — valid')) +
        check('ESIC challan reconciliation', c.esic.state,
          (c.esic.detail || c.esic.label) +
          (c.esic.state === 'breach' ? ' — joint-liability exposure on the shortfall' : '')) +
        check('PF challan reconciliation', c.pf.state, c.pf.detail || c.pf.label) +
      '</div>' +
      /* liability exposure */
      '<div class="dir-dd-card dir-dd-full">' +
        '<div class="dir-dd-card-h">Liability exposure</div>' +
        '<div class="dir-ct-grid">' +
          '<div class="dir-dd-row"><span class="dir-dd-k">Statutory penalty (mid)</span><span class="dir-dd-v">₹' + (L.statutoryMid != null ? L.statutoryMid : '—') + ' L</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">Statutory range</span><span class="dir-dd-v">₹' + (L.statutoryLow != null ? L.statutoryLow : '—') + ' – ' + (L.statutoryHigh != null ? L.statutoryHigh : '—') + ' L</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">Operational risk</span><span class="dir-dd-v">' + (L.operationalDays != null ? L.operationalDays + 'd stop · ₹' + L.operationalPerDay + ' L/d' : '—') + '</span></div>' +
          '<div class="dir-dd-row"><span class="dir-dd-k">Customer-audit risk</span><span class="dir-dd-v">' + (L.customerAudit != null ? L.customerAudit + ' open finding(s)' : '—') + '</span></div>' +
          '<div class="dir-dd-row" style="grid-column:span 2"><span class="dir-dd-k">Contract value at risk</span><span class="dir-dd-v">₹' + (L.contractValueRisk != null ? L.contractValueRisk : '—') + ' L</span></div>' +
        '</div>' +
      '</div>' +
      /* deployed workers */
      '<div class="dir-dd-card dir-dd-full">' +
        '<div class="dir-dd-card-h">Workers deployed by this contractor' +
          '<span class="pill outline tiny">' + workers.length + ' in onboarding set</span></div>' +
        wRows +
      '</div>' +
    '</div>';
  }

  function ctdExport() {
    toast('Contractor directory exported · ' +
      (typeof CONTRACTORS !== 'undefined' ? CONTRACTORS.length : 0) + ' contractors', 'green');
  }

  function initCtd() {
    if (!document.getElementById('ctd-grid-body')) return;
    ctdRender();
  }
  __kvOnReady(initCtd);

  function selectWorker(id) {
    SELECTED_WK = id;
    const w = WORKERS.find(x => x.id === id);
    if (!w) return;

    /* default to first non-done doc, else first doc */
    const firstFlagged = w.docs.find(d => d.status !== 'done');
    SELECTED_DOC = firstFlagged ? firstFlagged.id : w.docs[0].id;

    /* re-render direct-employee grid for selected state */
    if (renderWkGrid) renderWkGrid();

    /* show drill panel */
    const drill = document.getElementById('wk-drill');
    drill.style.display = 'block';

    const c = countDocs(w);
    document.getElementById('wk-drill-eye').textContent = w.posId + ' → onboarding';
    document.getElementById('wk-drill-title').textContent = w.name + ' · ' + w.role;
    document.getElementById('wk-drill-sub').textContent =
      'Day ' + w.days + ' of onboarding · UAN ' + w.uan + ' · induction ' + w.induction;

    const stats = document.getElementById('wk-drill-stats');
    stats.innerHTML =
      '<div class="drill-h-stat"><span class="drill-h-stat-v" style="color:var(--green-dk)">' + c.done    + '</span><span class="drill-h-stat-k">Done</span></div>' +
      '<div class="drill-h-stat"><span class="drill-h-stat-v" style="color:var(--amber-dk)">'+ c.pending + '</span><span class="drill-h-stat-k">Pending</span></div>' +
      '<div class="drill-h-stat"><span class="drill-h-stat-v" style="color:var(--red-dk)">'  + c.rejected+ '</span><span class="drill-h-stat-k">Rejected</span></div>';

    document.getElementById('wk-drill-count').textContent = c.total + ' items';

    renderDocList(w);
    renderDocDetail(w);

    /* scroll into view */
    setTimeout(() => drill.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function closeWkDrill() {
    SELECTED_WK = null;
    SELECTED_DOC = null;
    WK_ACTION_FORM = '';
    WK_FILES = { reupload: null, escalate: null, override: null };
    document.getElementById('wk-drill').style.display = 'none';
    if (renderWkGrid) renderWkGrid();
  }

  /* programmatic tab switch from dashboard alerts */
  function jumpToContractTab() {
    const tabBar = document.querySelector('#sec-onboarding .tabs');
    if (!tabBar) return;
    const tabs = tabBar.querySelectorAll('.tab');
    tabs.forEach(t => t.classList.remove('on'));
    tabs[1].classList.add('on'); /* contract tab */
    document.querySelectorAll('#ob-direct, #ob-contract, #ob-docs').forEach(p => p.style.display = 'none');
    document.getElementById('ob-contract').style.display = 'block';
  }

  /* Navigate to a section AND apply a chip filter inside that section.
     Currently supports the Induction module (sec-induction). */
  function navAndFilter(target, filterKey) {
    if (target === 'induction') {
      nav('induction', document.querySelectorAll('#grp-verticals .sb-item')[2]);
      /* Wait for the section to mount, then apply filter + scroll to grid */
      setTimeout(() => { if (typeof setIndFilter === 'function') setIndFilter(filterKey); }, 80);
    }
  }

  function renderDocList(w) {
    const list = document.getElementById('wk-drill-list');
    list.innerHTML = '';
    /* order: rejected first, then pending, then done */
    const ord = { rejected: 0, pending: 1, done: 2 };
    const sorted = w.docs.slice().sort((a,b) => ord[a.status] - ord[b.status]);
    sorted.forEach(d => {
      const row = document.createElement('div');
      row.className = 'drill-doc ' + d.type + (d.id === SELECTED_DOC ? ' on' : '');
      row.onclick = () => { SELECTED_DOC = d.id; WK_ACTION_FORM = ''; WK_FILES = { reupload: null, escalate: null, override: null }; renderDocList(w); renderDocDetail(w); };
      const icon = d.type === 'digital' ? '⌬' : '📄';
      const typeLabel = d.type === 'digital' ? 'DIGITAL' : 'SELF-ATTEST';
      row.innerHTML =
        '<div class="drill-doc-icon">' + icon + '</div>' +
        '<div class="drill-doc-mid">' +
          '<div class="drill-doc-label">' + d.label + '</div>' +
          '<div class="drill-doc-meta"><span class="typ">' + typeLabel + '</span>' +
          (d.status === 'rejected' ? 'Action required' :
           d.status === 'pending'  ? (d.ts || d.uploaded || 'Awaiting…') :
                                     (d.ts || d.uploaded || 'Verified')) +
          '</div>' +
        '</div>' +
        '<div class="drill-doc-stat ' + d.status + '">' +
          (d.status === 'done' ? '✓ DONE' : d.status === 'pending' ? '⌛ PENDING' : '✗ REJECTED') +
        '</div>';
      list.appendChild(row);
    });
  }

  function renderDocDetail(w) {
    const d = w.docs.find(x => x.id === SELECTED_DOC);
    const out = document.getElementById('wk-drill-detail');
    if (!d) { out.innerHTML = '<div class="muted tiny">Select a document to view evidence.</div>'; return; }

    const isDigital = d.type === 'digital';
    const statusClass = d.status === 'rejected' ? 'rejected' :
                        d.status === 'pending'  ? 'empty' :
                        (isDigital ? 'digital' : 'self');

    let html = '';
    html += '<div class="drill-detail-h">';
    html += '  <div>';
    html += '    <div class="drill-detail-title">' + d.label + '</div>';
    html += '    <div class="drill-detail-meta">' +
              (isDigital ? '<span class="pill blue tiny">Digitally verified</span>'
                         : '<span class="pill" style="background:var(--plum-soft);color:var(--plum)" >Self-attested</span>') +
              ' · ' +
              (d.status === 'done' ? '<span class="pill green tiny">✓ Verified</span>' :
               d.status === 'pending' ? '<span class="pill amber tiny">⌛ Pending</span>' :
                                       '<span class="pill red tiny">✗ Rejected</span>') +
            '</div>';
    html += '  </div>';
    html += '  <div class="tiny muted">' + w.posId + ' · ' + w.name + '</div>';
    html += '</div>';

    if (d.subject) {
      html += '<div style="font-size:0.86rem;color:var(--ink);margin-bottom:6px">' + d.subject + '</div>';
    }

    html += '<div class="evidence-panel ' + statusClass + '">';
    if (isDigital) {
      html += '<div class="ev-row"><div class="ev-k">Source system</div><div class="ev-v plain">' + (d.source || '—') + '</div></div>';
      html += '<div class="ev-row"><div class="ev-k">Timestamp</div><div class="ev-v">' + (d.ts || '—') + '</div></div>';
      html += '<div class="ev-row"><div class="ev-k">Audit hash</div><div class="ev-v">' + (d.hash || '—') + '</div></div>';
      if (d.payload) {
        html += '<div class="ev-row"><div class="ev-k">Response payload</div><div class="ev-v plain">stored encrypted · sample below</div></div>';
        html += '<div class="ev-payload">' + formatJson(d.payload) + '</div>';
      }
      if (d.status === 'rejected' && d.rejReason) {
        html += '<div class="ev-row" style="margin-top:6px"><div class="ev-k" style="color:var(--red-dk)">Rejection reason</div><div class="ev-v plain" style="color:var(--red-dk)">' + d.rejReason + '</div></div>';
      }
    } else {
      /* self-attested */
      if (d.status === 'pending' && !d.file) {
        html += '<div class="ev-row"><div class="ev-k">Status</div><div class="ev-v plain">No document uploaded yet</div></div>';
        if (d.notes) html += '<div class="ev-row"><div class="ev-k">Next step</div><div class="ev-v plain">' + d.notes + '</div></div>';
      } else {
        html += '<div class="ev-row"><div class="ev-k">Uploaded</div><div class="ev-v">' + (d.uploaded || '—') + '</div></div>';
        html += '<div class="ev-row"><div class="ev-k">Reviewer</div><div class="ev-v plain">' +
                (d.status === 'done' ? 'HR Operations · Sricity'
                : d.status === 'rejected' ? 'HR Operations · returned to worker'
                : 'pending HR review') + '</div></div>';
        if (d.notes) html += '<div class="ev-row"><div class="ev-k">HR note</div><div class="ev-v plain">' + d.notes + '</div></div>';
        if (d.rejReason) html += '<div class="ev-row"><div class="ev-k" style="color:var(--red-dk)">Rejection reason</div><div class="ev-v plain" style="color:var(--red-dk)">' + d.rejReason + '</div></div>';

        html += '<div class="ev-thumb">';
        html += '  <div class="ev-thumb-icon">' + (d.file && d.file.includes('.pdf') ? 'PDF' : d.file && d.file.includes('.jpg') ? 'JPG' : 'DOC') + '</div>';
        html += '  <div class="ev-thumb-mid">';
        html += '    <div class="ev-thumb-name">' + (d.file || '—') + '</div>';
        html += '    <div class="ev-thumb-meta">' + (d.size || '') +
                  (d.uploaded ? ' · uploaded ' + d.uploaded : '') + '</div>';
        html += '  </div>';
        html += '</div>';
      }
    }
    html += '</div>';

    /* actions */
    html += '<div class="drill-acts">';
    if (d.status === 'pending' && isDigital) {
      html += '<button class="btn">Retry API call</button>';
      html += '<button class="btn">View queue log</button>';
    } else if (d.status === 'pending' && !isDigital) {
      html += '<button class="btn primary">Send WA reminder · native language</button>';
      html += '<button class="btn">Mark not applicable</button>';
    } else if (d.status === 'rejected') {
      html += '<button class="btn primary" onclick="wkOpenForm(\'reupload\')">Request re-upload</button>';
      html += '<button class="btn" onclick="wkOpenForm(\'escalate\')">Escalate to HRBP</button>';
      html += '<button class="btn" onclick="wkOpenForm(\'override\')">Override with manual evidence</button>';
    } else {
      html += '<button class="btn">View full audit chain</button>';
      html += '<button class="btn">Download evidence packet</button>';
    }
    html += '</div>';

    /* inline action form (re-upload / escalate / override) */
    if (d.status === 'rejected' && WK_ACTION_FORM === 'reupload') {
      html += '<div class="va-form">' +
        '<div class="va-form-h"><span class="va-ico">↻</span> Request document re-upload</div>' +
        '<label class="field-l">What must the worker re-upload?</label>' +
        '<textarea id="va-reupload-reason" placeholder="e.g. Upload your latest address proof — bill dated within the last 90 days."></textarea>' +
        '<label class="field-l">Attach a reference (optional)</label>' +
        wkFileBox('reupload', 'Sample, marked-up copy or instructions for the worker') +
        '<div class="va-form-acts">' +
          '<button class="btn primary" onclick="wkSubmitReupload()">Send request on WhatsApp</button>' +
          '<button class="btn" onclick="wkOpenForm(\'reupload\')">Cancel</button>' +
        '</div></div>';
    }
    if (d.status === 'rejected' && WK_ACTION_FORM === 'escalate') {
      html += '<div class="va-form">' +
        '<div class="va-form-h"><span class="va-ico">⚑</span> Escalate to HR Business Partner</div>' +
        '<label class="field-l">Assign HRBP</label>' +
        '<select id="va-escalate-hrbp">' +
          '<option>Kavya Sharma · HRBP · Production</option>' +
          '<option>Rohit Verma · HRBP · Contract &amp; IR</option>' +
          '<option>Deepa Nair · HRBP · Compliance</option>' +
        '</select>' +
        '<label class="field-l">Reason for escalation</label>' +
        '<textarea id="va-escalate-note" placeholder="Describe why this document needs HRBP review or a decision."></textarea>' +
        '<label class="field-l">Attach supporting file (optional)</label>' +
        wkFileBox('escalate', 'Rejected document, correspondence or context for the HRBP') +
        '<div class="va-form-acts">' +
          '<button class="btn primary" onclick="wkSubmitEscalate()">Escalate</button>' +
          '<button class="btn" onclick="wkOpenForm(\'escalate\')">Cancel</button>' +
        '</div></div>';
    }
    if (d.status === 'rejected' && WK_ACTION_FORM === 'override') {
      html += '<div class="va-form">' +
        '<div class="va-form-h"><span class="va-ico">✓</span> Override with manual evidence</div>' +
        '<label class="field-l">Attach manual evidence <span style="color:var(--red-dk)">*</span></label>' +
        wkFileBox('override', 'Scanned document, signed form or photo · PDF / JPG / PNG') +
        '<label class="field-l">Override justification</label>' +
        '<textarea id="va-override-note" placeholder="State the basis for accepting this manual evidence in place of the rejected document."></textarea>' +
        '<div class="va-form-acts">' +
          '<button class="btn primary" onclick="wkSubmitOverride()">Apply override</button>' +
          '<button class="btn" onclick="wkOpenForm(\'override\')">Cancel</button>' +
        '</div></div>';
    }

    /* action history for this worker + document */
    const log = wkActionsFor(w, d);
    html += '<div class="va-log">';
    html += '  <div class="va-log-h">Action history · ' + w.name + ' · ' + d.label + '</div>';
    if (!log.length) {
      html += '  <div class="va-log-empty">No actions recorded against this document yet.</div>';
    } else {
      log.forEach(function (e) {
        html += '<div class="va-log-item">' +
          '<span class="va-log-dot ' + e.kind + '"></span>' +
          '<div class="va-log-main">' +
            '<div class="va-log-act">' + e.title + '</div>' +
            '<div class="va-log-meta">' + e.at + ' · ' + e.by + (e.meta ? ' · ' + e.meta : '') + '</div>' +
            (e.note ? '<div class="va-log-note">' + e.note + '</div>' : '') +
            (e.file ? '<span class="va-log-file">📎 ' + e.file +
                      (e.fileSize ? ' · ' + e.fileSize : '') + '</span>' : '') +
          '</div>' +
        '</div>';
      });
    }
    html += '</div>';

    out.innerHTML = html;
  }

  function formatJson(obj) {
    /* simple syntax-coloured JSON pretty-print */
    const json = JSON.stringify(obj, null, 2);
    return json.replace(/(\".*?\":)|(\".*?\")|(\b(?:true|false|null)\b)|(\b\d+(?:\.\d+)?\b)/g,
      (m, k, s, b, n) => {
        if (k) return '<span class="k">' + k + '</span>';
        if (s) return '<span class="s">' + s + '</span>';
        if (b || n) return '<span class="n">' + (b || n) + '</span>';
        return m;
      });
  }

  /* ════════════════════════════════════════════════════════════════
     EXCEL EXPORTS · SheetJS-powered, one workbook per grid
     ════════════════════════════════════════════════════════════════ */

  function todayStamp() {
    const d = new Date();
    const pad = n => (n < 10 ? '0' + n : '' + n);
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  }

  function toast(msg, kind) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast on' + (kind ? ' ' + kind : '');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => { t.className = 'toast'; }, 2400);
  }

  function ensureSheetJS() {
    if (typeof XLSX === 'undefined') {
      toast('Excel library not loaded — check internet', 'red');
      return false;
    }
    return true;
  }

  function downloadWorkbook(sheetName, headers, rows, filename) {
    if (!ensureSheetJS()) return;
    const wb = XLSX.utils.book_new();
    const aoa = [headers].concat(rows);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    /* column widths */
    ws['!cols'] = headers.map((h, i) => {
      const max = Math.max(h.length, ...rows.map(r => String(r[i] || '').length));
      return { wch: Math.min(Math.max(max + 2, 10), 42) };
    });
    /* freeze header row */
    ws['!freeze'] = { ySplit: 1 };
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename);
    toast('Downloaded ' + filename, 'green');
  }

  function downloadReqs() {
    const headers = ['Position ID', 'Role', 'Function', 'Contractor(s)', 'Decision ref',
                     'Approval', 'Hiring manager', 'Approved', 'Target close', 'Stage', 'Days open', 'SLA'];
    const rows = REQS.map(r => [
      r.id, r.role, r.fn,
      (r.contractors && r.contractors.length) ? r.contractors.join(', ') : 'Direct hire',
      r.knRef || '—', APPR_LABEL[r.approval] || r.approval,
      r.hm, r.approved, r.target,
      STAGES[r.stage], r.days, SLA_LABEL[r.sla]
    ]);
    downloadWorkbook('Open requisitions', headers, rows,
      'plant-vaani_open-requisitions_' + todayStamp() + '.xlsx');
  }

  function downloadDirect() {
    const headers = ['Worker', 'Position ID', 'Role', 'Stage', 'UAN', 'Induction', 'Days open',
                     'Docs done', 'Docs pending', 'Docs rejected', 'Total docs'];
    const rows = WORKERS.map(w => {
      const c = countDocs(w);
      return [w.name, w.posId, w.role, STAGE_PILL[w.stage].label, w.uan, w.induction, w.days,
              c.done, c.pending, c.rejected, c.total];
    });
    downloadWorkbook('Direct employees', headers, rows,
      'plant-vaani_direct-employees_' + todayStamp() + '.xlsx');
  }

  function downloadContract() {
    const headers = ['Worker', 'Contractor', 'Category', 'ESIC status',
                     'Migrant', 'CLRA licence', 'Action required'];
    const rows = CONTRACT_WORKERS.map(w => {
      const action =
        w.esic.state === 'breach'   ? 'ESIC 3-day breach · escalate to vendor + register IP immediately'
      : w.esic.state === 'pending'  ? 'Within 3-day window · vendor to register ESIC IP'
      : w.clra.state === 'expired'  ? 'CLRA licence expired · halt deployment'
      : w.clra.state === 'expiring' ? 'CLRA licence expiring within 30 days · vendor to renew'
      : '—';
      return [w.name, w.contractor, w.category, w.esic.label, w.migrant, w.clra.label, action];
    });
    downloadWorkbook('Contract workers', headers, rows,
      'plant-vaani_contract-workers_' + todayStamp() + '.xlsx');
  }

  function downloadSharedDocs() {
    const headers = ['Document type', 'Worker scope', 'Encryption', 'Retention', 'Audit entries'];
    const rows = SHARED_DOCS.map(d => [d.type, d.scope, d.enc, d.ret, d.entries]);
    downloadWorkbook('Shared document store', headers, rows,
      'plant-vaani_shared-docs_' + todayStamp() + '.xlsx');
  }

  /* ════════════════════════════════════════════════════════════════
     SHARED DOCUMENT STORE · drill-down
     ════════════════════════════════════════════════════════════════ */

  let SELECTED_SD = null;

  /* generate stable but realistic drill-down detail for a document type */
  function sdDetail(d) {
    /* deterministic pseudo-random based on type name */
    const seed = d.type.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const rng = (k) => ((seed * 9301 + k * 49297) % 233280) / 233280;

    /* sample instances */
    const sampleWorkers = [
      'Arjun Reddy · POS-2026-0148', 'Lakshmi N. · POS-2026-0151',
      'Hiroshi Sato · POS-2026-0152', 'Padma Vasudevan · POS-2026-0171',
      'Karan Singh · POS-2026-0159', 'Ravi Kumar · WK-CT-1041 · Sri Lakshmi Engg',
      'Mohan Das · WK-CT-1042 · Pavan Manpower', 'Suresh B. · WK-CT-1043 · Sri Lakshmi Engg',
      'Anil Kumar · WK-CT-1044 · Bharat Contractors', 'Lalita Devi · WK-CT-1047 · Pavan Manpower',
    ];
    const instances = [];
    const n = Math.min(8, d.entries < 100 ? 4 : 6 + Math.floor(rng(1) * 3));
    for (let i = 0; i < n; i++) {
      const w = sampleWorkers[(seed + i * 7) % sampleWorkers.length];
      const day = 20 + ((seed + i * 3) % 8);
      const hr  = 8 + ((seed + i * 5) % 12);
      const min = ((seed * 7 + i * 13) % 60);
      const pad = x => (x < 10 ? '0' + x : '' + x);
      instances.push({
        ref: 'EVT-' + (200000 + seed + i * 17),
        worker: w,
        action: i % 3 === 0 ? 'UPLOAD' : i % 3 === 1 ? 'VIEW' : 'UPDATE',
        ts: pad(day) + ' Apr 2026 · ' + pad(hr) + ':' + pad(min) + ' IST',
        actor: i % 4 === 0 ? 'system · API' : 'HR · Priya M.',
        hash: ['a3f7','7c12','9d4e','b821','5b88','de77','cf02','f102','aa90','882c']
                [(seed + i) % 10] + '…' +
              ['d290','8e44','22f1','f4a0','f021','0911','9ac7','aab4','dd31','5e10']
                [(seed + i * 3) % 10],
      });
    }

    /* audit entries — most recent */
    const audit = instances.slice(0, 5).map(x => ({
      ref: x.ref, ts: x.ts, action: x.action,
      worker: x.worker, actor: x.actor, hash: x.hash,
    }));

    /* crypto */
    const crypto = {
      algorithm: 'AES-256-GCM',
      kek: 'per-tenant master · KMS-managed',
      dek: 'per-document · rotated quarterly',
      tlsAtRest: true,
      tlsInTransit: 'TLS 1.3',
      lastRotation: ['12 Jan 2026', '14 Feb 2026', '03 Mar 2026', '18 Apr 2026'][(seed % 4)],
      rotationFreq: 'Quarterly · scheduled',
      hsmBacked: true,
    };

    /* access log */
    const accessRoles = [
      { role: 'HR Operations · Sricity',    views: 240 + Math.floor(rng(2) * 80), exports: 12 + Math.floor(rng(3) * 8) },
      { role: 'Compliance team · Bangalore',views: 60  + Math.floor(rng(4) * 40), exports: 4 + Math.floor(rng(5) * 6) },
      { role: 'Internal auditor',           views: 18  + Math.floor(rng(6) * 12), exports: 6 + Math.floor(rng(7) * 4) },
      { role: 'System · API integrations',  views: 380 + Math.floor(rng(8) * 200), exports: 0 },
    ];

    /* retention */
    const retentionPhases =
      d.ret.includes('+ 7y')   ? [{ k: 'Active', pct: 30, cls: 'rt-active', cap: 'while worker active' },
                                   { k: 'Statutory retention', pct: 55, cls: 'rt-stat',   cap: '+7 years post-exit' },
                                   { k: 'Purged', pct: 15, cls: 'rt-purged', cap: 'auto-delete' }]
    : d.ret.includes('+ 3y')   ? [{ k: 'Active', pct: 45, cls: 'rt-active', cap: 'while worker active' },
                                   { k: 'Statutory retention', pct: 40, cls: 'rt-stat',   cap: '+3 years post-exit' },
                                   { k: 'Purged', pct: 15, cls: 'rt-purged', cap: 'auto-delete' }]
    : d.ret.includes('+ 1y')   ? [{ k: 'Active', pct: 60, cls: 'rt-active', cap: 'while worker active' },
                                   { k: 'Statutory retention', pct: 25, cls: 'rt-stat',   cap: '+1 year post-exit' },
                                   { k: 'Purged', pct: 15, cls: 'rt-purged', cap: 'auto-delete' }]
    : d.ret.includes('min')    ? [{ k: 'Active', pct: 60, cls: 'rt-active', cap: 'while worker active' },
                                   { k: 'Statutory retention', pct: 30, cls: 'rt-stat',   cap: 'statutory minimum (ESIC: 5y / ISMW: 5y)' },
                                   { k: 'Purged', pct: 10, cls: 'rt-purged', cap: 'auto-delete' }]
                              : [{ k: 'Active', pct: 80, cls: 'rt-active', cap: 'while worker active' },
                                 { k: 'Purged', pct: 20, cls: 'rt-purged', cap: 'on exit' }];

    return { instances, audit, crypto, accessRoles, retentionPhases };
  }

  function openSdDrill(typeIdx) {
    const d = SHARED_DOCS[typeIdx];
    if (!d) return;
    SELECTED_SD = d.type;

    /* mark selected row */
    document.querySelectorAll('#sd-grid-body tr').forEach(tr => tr.classList.remove('selected'));
    document.querySelectorAll('#sd-grid-body tr').forEach(tr => {
      if (tr.firstChild && tr.firstChild.textContent === d.type) tr.classList.add('selected');
    });

    const drill = document.getElementById('sd-drill');
    drill.classList.add('on');
    document.getElementById('sd-drill-eye').textContent = 'Document type detail · ' + d.scope;
    document.getElementById('sd-drill-title').textContent = d.type;
    document.getElementById('sd-drill-meta').textContent =
      d.entries.toLocaleString() + ' audit entries · ' + d.enc + ' · retention: ' + d.ret;

    const det = sdDetail(d);

    /* INSTANCES pane */
    let html = '';
    html += '<div class="sd-mini-grid">';
    html += '  <div class="sd-mini"><div class="sd-mini-eye">Total instances</div>' +
            '<div class="sd-mini-v">' + d.entries.toLocaleString() + '</div>' +
            '<div class="sd-mini-s">workers covered</div></div>';
    html += '  <div class="sd-mini"><div class="sd-mini-eye">Last upload</div>' +
            '<div class="sd-mini-v" style="font-size:0.95rem">' + det.instances[0].ts + '</div>' +
            '<div class="sd-mini-s">' + det.instances[0].worker.split(' · ')[0] + '</div></div>';
    html += '  <div class="sd-mini"><div class="sd-mini-eye">Auto-verified</div>' +
            '<div class="sd-mini-v">' + (d.scope === 'Direct' || d.scope === 'Both' ?
              (60 + (det.instances.length * 5)) + '%' : '—') + '</div>' +
            '<div class="sd-mini-s">via API integrations</div></div>';
    html += '  <div class="sd-mini"><div class="sd-mini-eye">Average review SLA</div>' +
            '<div class="sd-mini-v">' + (d.scope === 'Contractor entity' ? '48h' : '12h') + '</div>' +
            '<div class="sd-mini-s">to HR approval</div></div>';
    html += '</div>';

    html += '<div class="card-h" style="padding:0;margin-top:6px"><div class="card-h-title" style="font-size:0.85rem">Recent instances</div><div class="card-h-sub">' + det.instances.length + ' of ' + d.entries.toLocaleString() + ' shown — anonymised references</div></div>';
    html += '<table class="t" style="margin-top:8px"><thead><tr><th>Reference</th><th>Worker</th><th>Action</th><th>Timestamp</th><th>Actor</th><th>Audit hash</th></tr></thead><tbody>';
    det.instances.forEach(x => {
      html += '<tr><td class="mono tiny">' + x.ref + '</td>' +
              '<td class="t-strong">' + x.worker + '</td>' +
              '<td><span class="pill outline tiny">' + x.action + '</span></td>' +
              '<td class="mono tiny">' + x.ts + '</td>' +
              '<td>' + x.actor + '</td>' +
              '<td class="mono tiny">' + x.hash + '</td></tr>';
    });
    html += '</tbody></table>';
    document.getElementById('sd-pane-instances').innerHTML = html;

    /* AUDIT pane */
    let ah = '<div class="chain">';
    det.audit.forEach(a => {
      const cls = a.action === 'UPLOAD' ? 'green' : a.action === 'UPDATE' ? 'amber' : '';
      ah += '<div class="chain-row ' + cls + '">' +
              '<div class="chain-time">' + a.ts + ' · ' + a.ref + '</div>' +
              '<div class="chain-title">' + a.action + ' · ' + a.worker + '</div>' +
              '<div class="chain-detail">Actor: ' + a.actor + '</div>' +
              '<div class="chain-hash">' + a.hash + '</div>' +
            '</div>';
    });
    ah += '</div>';
    ah += '<div class="note" style="margin-top:12px"><strong>Chain integrity:</strong> Each entry is SHA-256 hashed with the previous entry\'s hash. The full audit chain for ' +
          d.entries.toLocaleString() + ' events is verifiable in Inspector mode.</div>';
    document.getElementById('sd-pane-audit').innerHTML = ah;

    /* CRYPTO pane */
    let ch = '';
    ch += '<div class="sd-mini-grid" style="grid-template-columns:repeat(3,1fr)">';
    ch += '  <div class="sd-mini"><div class="sd-mini-eye">Algorithm</div>' +
          '<div class="sd-mini-v" style="font-size:0.95rem;font-family:var(--mono)">' + det.crypto.algorithm + '</div>' +
          '<div class="sd-mini-s">authenticated encryption</div></div>';
    ch += '  <div class="sd-mini"><div class="sd-mini-eye">Key hierarchy</div>' +
          '<div class="sd-mini-v" style="font-size:0.85rem">KEK + DEK</div>' +
          '<div class="sd-mini-s">' + det.crypto.kek + '</div></div>';
    ch += '  <div class="sd-mini"><div class="sd-mini-eye">HSM</div>' +
          '<div class="sd-mini-v" style="font-size:0.95rem">' + (det.crypto.hsmBacked ? 'Backed' : 'Software') + '</div>' +
          '<div class="sd-mini-s">FIPS 140-2 L3</div></div>';
    ch += '</div>';
    ch += '<div class="sd-rotation"><strong>Last DEK rotation:</strong> ' + det.crypto.lastRotation + ' · next rotation scheduled per ' + det.crypto.rotationFreq.toLowerCase() + ' policy. TLS in transit: ' + det.crypto.tlsInTransit + '.</div>';
    ch += '<div class="card-h" style="padding:0;margin-top:14px"><div class="card-h-title" style="font-size:0.85rem">Recent key rotations</div></div>';
    ch += '<table class="t" style="margin-top:8px"><thead><tr><th>Date</th><th>Event</th><th>Initiated by</th><th>Key version</th></tr></thead><tbody>';
    [['18 Apr 2026','Scheduled DEK rotation','system','v2026.q2'],
     ['03 Mar 2026','Scheduled DEK rotation','system','v2026.q1.r2'],
     ['12 Jan 2026','Tenant onboarding · KEK provisioned','HR · Priya M.','v2026.q1.r1'],
     ['28 Dec 2025','Compliance re-attestation','Auditor','v2025.q4']]
     .forEach(r => { ch += '<tr><td class="mono tiny">' + r[0] + '</td><td>' + r[1] + '</td><td>' + r[2] + '</td><td class="mono">' + r[3] + '</td></tr>'; });
    ch += '</tbody></table>';
    document.getElementById('sd-pane-crypto').innerHTML = ch;

    /* ACCESS pane */
    let xh = '';
    xh += '<div class="card-h" style="padding:0;margin-bottom:10px"><div class="card-h-title" style="font-size:0.85rem">Access in the last 30 days</div><div class="card-h-sub">Role-based access control · all events logged to audit chain</div></div>';
    xh += '<table class="t"><thead><tr><th>Role</th><th>View events</th><th>Export events</th><th>Last access</th></tr></thead><tbody>';
    det.accessRoles.forEach((r, i) => {
      xh += '<tr><td class="t-strong">' + r.role + '</td>' +
            '<td class="mono">' + r.views + '</td>' +
            '<td class="mono">' + r.exports + '</td>' +
            '<td class="mono tiny">' + (i === 0 ? 'today · 14:02 IST' : i === 1 ? '2d ago' : i === 2 ? '5d ago' : 'today · continuous') + '</td>' +
            '</tr>';
    });
    xh += '</tbody></table>';
    xh += '<div class="note" style="margin-top:12px"><strong>No unusual access detected.</strong> Karya Vaani monitors for anomalies (off-hours, geographic, bulk export). Any flagged event opens an alert in Audit trail.</div>';
    document.getElementById('sd-pane-access').innerHTML = xh;

    /* RETENTION pane */
    let rh = '';
    rh += '<div style="font-size:0.85rem;color:var(--ink-2);margin-bottom:8px">Retention policy for <strong>' + d.type + '</strong>: <span class="mono">' + d.ret + '</span></div>';
    rh += '<div class="retention-tl">';
    det.retentionPhases.forEach(p => {
      rh += '<div class="' + p.cls + '" style="flex:' + p.pct + '"><div>' + p.k + '</div></div>';
    });
    rh += '</div>';
    rh += '<div style="display:flex;gap:14px;margin-top:6px">';
    det.retentionPhases.forEach(p => {
      rh += '<div class="retention-tl-cap" style="flex:' + p.pct + '">' + p.cap + '</div>';
    });
    rh += '</div>';
    rh += '<div class="card-h" style="padding:0;margin-top:18px"><div class="card-h-title" style="font-size:0.85rem">Legal basis &amp; controls</div></div>';
    rh += '<table class="t" style="margin-top:8px"><tbody>';
    rh += '<tr><td class="t-strong">Statutory basis</td><td>' + (
      d.type.includes('ESIC')    ? 'ESI Act 1948 · Regulation 32 (retention of records 5 years)'
    : d.type.includes('CLRA')    ? 'Contract Labour (R&A) Act 1970 · s.25 (records & registers)'
    : d.type.includes('Migrant') ? 'Inter-State Migrant Workmen Act 1979 · Rule 21'
    : d.type.includes('Standing-order') ? 'IESO Act 1946 · s.13(2)'
    : d.type === 'PAN' || d.type.includes('Bank') ? 'IT Act 1961 + RBI KYC retention guidelines (10 years)'
    : 'Code on Social Security 2020 + Wages Code 2019 records-retention schedules') + '</td></tr>';
    rh += '<tr><td class="t-strong">Auto-purge job</td><td class="mono tiny">retention.purge.daily · last run today 03:00 IST · ' + Math.floor(d.entries / 240) + ' records purged this month</td></tr>';
    rh += '<tr><td class="t-strong">Legal hold override</td><td>Active worker = no purge · litigation hold = manual override (audit logged)</td></tr>';
    rh += '<tr><td class="t-strong">Tenant control</td><td>Daikin Sricity policy override available · current policy matches statutory minimum</td></tr>';
    rh += '</tbody></table>';
    document.getElementById('sd-pane-retention').innerHTML = rh;

    /* reset to first tab */
    document.querySelectorAll('#sd-drill .sd-drill-tab').forEach((t, i) => t.classList.toggle('on', i === 0));
    document.querySelectorAll('#sd-drill .sd-pane').forEach((p, i) => p.classList.toggle('on', i === 0));

    setTimeout(() => drill.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  function closeSdDrill() {
    SELECTED_SD = null;
    document.getElementById('sd-drill').classList.remove('on');
    document.querySelectorAll('#sd-grid-body tr').forEach(tr => tr.classList.remove('selected'));
  }

  function sdTab(evt, name) {
    document.querySelectorAll('#sd-drill .sd-drill-tab').forEach(t => t.classList.remove('on'));
    evt.target.classList.add('on');
    document.querySelectorAll('#sd-drill .sd-pane').forEach(p => p.classList.remove('on'));
    document.getElementById('sd-pane-' + name).classList.add('on');
  }

  /* hook up sd row clicks — rebuild rowFn for SD grid */
  /* This wraps the existing buildSdGridSorter to make rows clickable. */
  const _origBuildSd = buildSdGridSorter;
  buildSdGridSorter = function() {
    renderSdGrid = makeSortable('sd-grid', 'sd-grid-body', {
      defaults: { col: 'entries', dir: -1 },
      textCols: ['type', 'scope', 'enc', 'ret'],
      dataFn: () => SHARED_DOCS.slice(),
      valueFn: (d, col) => {
        switch (col) {
          case 'type':    return d.type.toLowerCase();
          case 'scope':   return d.scope.toLowerCase();
          case 'enc':     return d.enc.toLowerCase();
          case 'ret':     return d.ret.toLowerCase();
          case 'entries': return d.entries;
        }
      },
      rowFn: d => {
        const idx = SHARED_DOCS.indexOf(d);
        const cls = SELECTED_SD === d.type ? 'sd-row selected' : 'sd-row';
        return (
          '<tr class="' + cls + '" onclick="openSdDrill(' + idx + ')">' +
            '<td class="t-strong">' + d.type + '</td>' +
            '<td>' + d.scope + '</td>' +
            '<td class="mono tiny">' + d.enc + '</td>' +
            '<td>' + d.ret + '</td>' +
            '<td class="mono">' + d.entries.toLocaleString() + '</td>' +
          '</tr>'
        );
      },
      afterRender: () => {
        const el = document.getElementById('sd-count');
        if (el) el.textContent = SHARED_DOCS.length + ' document types';
      },
    });
  };

  /* ════════════════════════════════════════════════════════════════
     EMAIL · vendor notification modal
     ════════════════════════════════════════════════════════════════ */

  /* contractor (vendor) contact directory */
  const VENDOR_DIRECTORY = {
    'Sri Lakshmi Engg':   { contact: 'Rajesh Yadav',      email: 'rajesh.yadav@srilakshmi-engg.in',  cc: 'compliance@srilakshmi-engg.in' },
    'Pavan Manpower':     { contact: 'Sandeep Kumar',     email: 'sandeep@pavanmanpower.in',         cc: 'ops@pavanmanpower.in' },
    'Bharat Contractors': { contact: 'Vijay Bhushan',     email: 'vijay.b@bharatcontractors.co.in',  cc: 'esic-team@bharatcontractors.co.in' },
    'Sai Industrial':     { contact: 'Lakshmi Reddy',     email: 'lakshmi@saiindustrial.co.in',      cc: 'hr@saiindustrial.co.in' },
  };
  const CC_INTERNAL = 'compliance.sricity@daikin.co.in';

  function composeFor(worker) {
    const v = VENDOR_DIRECTORY[worker.contractor] || { contact: 'Vendor contact', email: 'vendor@example.com', cc: '' };
    const esicState = worker.esic.state;
    const clraState = worker.clra.state;
    const isBreach = esicState === 'breach';
    const isPending = esicState === 'pending';
    const isCLRA = clraState === 'expiring' || clraState === 'expired';

    let subject, body, severity;
    if (isBreach) {
      severity = 'URGENT · ESIC 3-day breach';
      subject = '[URGENT] ESIC 3-day enrolment breach — ' + worker.name + ' (' + worker.category + ')';
      body =
'Dear ' + v.contact + ',\n\n' +
'This is a statutory escalation regarding contract worker ' + worker.name + ' (Category: ' + worker.category + ') currently deployed at Daikin Sricity through ' + worker.contractor + '.\n\n' +
'ESIC enrolment status: ' + worker.esic.label + '\n' +
'\u00B7 The ESI Act 1948 mandates ESIC enrolment within 3 calendar days of joining\n' +
'\u00B7 This worker is past the statutory window without a valid ESIC IP number\n' +
'\u00B7 Karya Vaani has automatically halted this worker\'s push-to-HRIS\n\n' +
'Required action within 24 hours:\n' +
'  1. Complete ESIC enrolment via the ESIC employer portal\n' +
'  2. Upload the IP number to the Karya Vaani Contractor portal\n' +
'  3. Acknowledge this notice with an expected closure date\n\n' +
'Failure to resolve within 24 hours will trigger:\n' +
'  \u00B7 Worker deployment suspension at site\n' +
'  \u00B7 Joint-liability exposure noted against your firm\'s compliance score\n' +
'  \u00B7 Escalation to your assigned Daikin Compliance lead\n\n' +
'For assistance, reply to this email or call the Sricity Compliance helpdesk at +91-877-XXXXXXX.\n\n' +
'Regards,\n' +
'Karya Vaani (on behalf of Daikin Sricity HR)\n' +
'Audit reference: PV-ESIC-' + Date.now().toString().slice(-7) + '\n' +
'This notice is auto-logged to the Karya Vaani audit chain (SHA-256).';
    } else if (isPending) {
      severity = 'High · ESIC pending';
      subject = '[Action needed] ESIC enrolment pending — ' + worker.name;
      body =
'Dear ' + v.contact + ',\n\n' +
'Contract worker ' + worker.name + ' (Category: ' + worker.category + ', deployed via ' + worker.contractor + ') is currently within the ESIC 3-day enrolment window but enrolment is not yet complete.\n\n' +
'ESIC enrolment status: ' + worker.esic.label + '\n\n' +
'Action required before the 3-day deadline:\n' +
'  1. Complete ESIC enrolment\n' +
'  2. Upload IP number to the Karya Vaani Contractor portal\n\n' +
'Note: Failure to close this within the statutory window will trigger an ESIC 3-day breach, halt push-to-HRIS, and affect your compliance score.\n\n' +
'Regards,\n' +
'Karya Vaani (on behalf of Daikin Sricity HR)\n' +
'Audit reference: PV-ESIC-' + Date.now().toString().slice(-7);
    } else if (clraState === 'expired') {
      severity = 'URGENT · CLRA licence expired';
      subject = '[URGENT] CLRA licence expired — ' + worker.contractor;
      body =
'Dear ' + v.contact + ',\n\n' +
'Your CLRA (Contract Labour Regulation & Abolition) licence has expired. All deployment under this licence is now at risk of being deemed non-compliant under the Contract Labour Act 1970.\n\n' +
'Action required immediately:\n' +
'  1. Apply for licence renewal with the appropriate Labour Commissioner\n' +
'  2. Upload renewed licence to the Karya Vaani Contractor portal\n' +
'  3. Submit interim acknowledgement from the licensing authority\n\n' +
'Until resolved, no new worker deployment will be permitted at Daikin Sricity sites.\n\n' +
'Regards,\nKarya Vaani (on behalf of Daikin Sricity HR)';
    } else if (clraState === 'expiring') {
      severity = 'Medium · CLRA licence expiring soon';
      subject = '[Reminder] CLRA licence expiring within 30 days — ' + worker.contractor;
      body =
'Dear ' + v.contact + ',\n\n' +
'Your CLRA licence linked to deployments at Daikin Sricity is expiring within 30 days.\n\n' +
'Worker in scope: ' + worker.name + ' (' + worker.category + ')\nCLRA licence: ' + worker.clra.label + '\n\n' +
'Please initiate renewal at the earliest. Karya Vaani will block new deployments past the expiry date.\n\n' +
'Regards,\nKarya Vaani (on behalf of Daikin Sricity HR)';
    } else {
      severity = 'Routine';
      subject = 'Compliance check-in — ' + worker.name;
      body =
'Dear ' + v.contact + ',\n\n' +
'This is a routine compliance check-in for contract worker ' + worker.name + ' deployed via ' + worker.contractor + '.\n\n' +
'Current status:\n' +
'  \u00B7 ESIC: ' + worker.esic.label + '\n' +
'  \u00B7 CLRA licence: ' + worker.clra.label + '\n' +
'  \u00B7 Migrant: ' + worker.migrant + '\n\n' +
'No action is required at this time. Please reply if you have any updates.\n\n' +
'Regards,\nKarya Vaani (on behalf of Daikin Sricity HR)';
    }

    return { vendor: v, subject, body, severity, worker };
  }

  let _emailCtx = null;

  function openVendorEmail(workerName) {
    const w = CONTRACT_WORKERS.find(x => x.name === workerName);
    if (!w) return;
    const c = composeFor(w);
    _emailCtx = c;

    document.getElementById('em-eye').textContent = 'Notify vendor · ' + w.contractor;
    document.getElementById('em-title').textContent = 'Compliance notice — ' + w.name;
    document.getElementById('em-to').innerHTML =
      '<span class="mono">' + c.vendor.email + '</span> · ' + c.vendor.contact;
    document.getElementById('em-cc').innerHTML =
      '<span class="mono">' + (c.vendor.cc || '—') + '</span> · ' +
      '<span class="mono">' + CC_INTERNAL + '</span>';
    document.getElementById('em-worker').innerHTML =
      '<span class="t-strong">' + w.name + '</span> · ' + w.category + ' · via ' + w.contractor;

    const sevColor = c.severity.startsWith('URGENT') ? 'red'
                   : c.severity.startsWith('High')   ? 'amber'
                   : c.severity.startsWith('Medium') ? 'amber'
                   :                                   'blue';
    document.getElementById('em-severity').innerHTML =
      '<span class="pill ' + sevColor + '">' + c.severity + '</span>';

    document.getElementById('em-subject').value = c.subject;
    document.getElementById('em-body').value    = c.body;
    updateEmailCount();

    document.getElementById('email-modal').classList.add('on');
    document.body.style.overflow = 'hidden';
  }

  function closeEmailModal() {
    document.getElementById('email-modal').classList.remove('on');
    document.body.style.overflow = '';
    _emailCtx = null;
  }

  function updateEmailCount() {
    const v = document.getElementById('em-body').value;
    document.getElementById('em-cnt').textContent = v.length + ' chars · ' + v.split(/\s+/).filter(Boolean).length + ' words';
  }

  function sendEmail() {
    if (!_emailCtx) return;
    const to = _emailCtx.vendor.email;
    const cc = [_emailCtx.vendor.cc, CC_INTERNAL].filter(Boolean).join(',');
    const subject = encodeURIComponent(document.getElementById('em-subject').value);
    const body    = encodeURIComponent(document.getElementById('em-body').value);
    const mailto = 'mailto:' + to + '?cc=' + cc + '&subject=' + subject + '&body=' + body;
    window.location.href = mailto;
    setTimeout(() => {
      toast('Opened in default mail client · audit entry logged', 'green');
      closeEmailModal();
    }, 250);
  }

  function openInGmail() {
    if (!_emailCtx) return;
    const to = _emailCtx.vendor.email;
    const cc = [_emailCtx.vendor.cc, CC_INTERNAL].filter(Boolean).join(',');
    const su = encodeURIComponent(document.getElementById('em-subject').value);
    const bd = encodeURIComponent(document.getElementById('em-body').value);
    const url = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(to) +
                '&cc=' + encodeURIComponent(cc) + '&su=' + su + '&body=' + bd;
    window.open(url, '_blank');
    toast('Opening in Gmail · audit entry logged', 'green');
  }

  function copyEmailBody() {
    const subject = document.getElementById('em-subject').value;
    const body = document.getElementById('em-body').value;
    const txt = 'Subject: ' + subject + '\n\n' + body;
    navigator.clipboard.writeText(txt).then(
      () => toast('Copied to clipboard', 'green'),
      () => toast('Copy failed — select &amp; ⌘C / Ctrl-C manually', 'red')
    );
  }

  /* ════════════════════════════════════════════════════════════════
     MODULE 3 · CONTRACTOR COMPLIANCE · drill-down + tasks + liability
     ════════════════════════════════════════════════════════════════ */

  /* ranking helpers for sortable columns */
  const CT_CLRA_RANK = { expired: 0, expiring: 1, valid: 2 };
  const CT_RECON_RANK = {
    'breach':  0,  /* hard mismatch (red) */
    'delayed': 1,  /* late but reconciling */
    'pending': 2,  /* awaiting */
    'ok':      3,
  };

  /* contractor master data — each contractor anchors workers, tasks, liability */
  let CONTRACTORS = (window.__KVDATA && window.__KVDATA.contractors) || [];

  /* contractor tasks (separate index — many tasks per contractor) */
  let CT_TASKS = (window.__KVDATA && window.__KVDATA.ctTasks) || [];

  /* ── sortable contractor grid ── */
  let renderCtGrid = null;
  let SELECTED_CT = null;
  let CT_SORT = { col: 'liab', dir: -1 };
  let CT_QUERY = '';

  function ctSortVal(c, col) {
    switch (col) {
      case 'name':       return c.name.toLowerCase();
      case 'deployed':   return c.deployed;
      case 'score':      return c.score;
      case 'clraRank':   return CT_CLRA_RANK[c.clra.state];
      case 'esicRank':   return CT_RECON_RANK[c.esic.state];
      case 'pfRank':     return CT_RECON_RANK[c.pf.state];
      case 'liab':       return c.liability.statutoryMid + c.liability.operationalDays * c.liability.operationalPerDay + c.liability.customerAudit + c.liability.contractValueRisk;
      case 'openTasks':  return CT_TASKS.filter(t => t.ctId === c.id && t.severity !== 'closed').length;
    }
  }

  function colorForScore(s) {
    if (s >= 80) return 'var(--green)';
    if (s >= 65) return 'var(--amber)';
    return 'var(--red)';
  }
  function colorForScoreText(s) {
    if (s >= 80) return 'var(--green-dk)';
    if (s >= 65) return 'var(--amber-dk)';
    return 'var(--red-dk)';
  }

  function liabilityTotal(c) {
    return c.liability.statutoryMid +
           Math.round(c.liability.operationalDays * c.liability.operationalPerDay) +
           c.liability.customerAudit +
           c.liability.contractValueRisk;
  }

  function fmtLakh(v) {
    if (v === 0) return '—';
    return '₹' + v + ' L';
  }

  function renderContractorGrid() {
    const q = CT_QUERY.trim().toLowerCase();
    let rows = CONTRACTORS.slice();
    if (q) {
      rows = rows.filter(c => (c.name + ' ' + c.area + ' ' + c.complianceLead).toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      const va = ctSortVal(a, CT_SORT.col), vb = ctSortVal(b, CT_SORT.col);
      if (va < vb) return -1 * CT_SORT.dir;
      if (va > vb) return  1 * CT_SORT.dir;
      return 0;
    });

    document.querySelectorAll('#ct-grid th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      const ind = th.querySelector('.sort-ind');
      ind.textContent = '↕';
      if (th.dataset.col === CT_SORT.col) {
        th.classList.add(CT_SORT.dir === 1 ? 'sort-asc' : 'sort-desc');
        ind.textContent = CT_SORT.dir === 1 ? '↑' : '↓';
      }
    });

    const colLabel = {
      name: 'Contractor', deployed: 'Deployed', score: 'Score',
      clraRank: 'CLRA', esicRank: 'ESIC', pfRank: 'PF',
      liab: 'Joint liability', openTasks: 'Open tasks'
    };
    const matchTxt = q
      ? (rows.length + ' of ' + CONTRACTORS.length + ' match "' + CT_QUERY + '" · ')
      : '';
    document.getElementById('ct-sort-state').textContent =
      matchTxt + 'Sorted by ' + colLabel[CT_SORT.col] + ' · ' + (CT_SORT.dir === 1 ? 'asc' : 'desc');

    const body = document.getElementById('ct-grid-body');
    body.innerHTML = '';
    if (rows.length === 0) {
      body.innerHTML = '<tr><td colspan="8" class="search-empty">No contractor matches <span class="mono">"' + CT_QUERY + '"</span></td></tr>';
      return;
    }
    rows.forEach(c => {
      const total = liabilityTotal(c);
      const openTasks = CT_TASKS.filter(t => t.ctId === c.id && t.severity !== 'closed').length;
      const sCol = colorForScore(c.score);
      const sTxt = colorForScoreText(c.score);
      const tr = document.createElement('tr');
      tr.className = 'ct-row' + (SELECTED_CT === c.id ? ' selected' : '');
      tr.onclick = () => openCtDrill(c.id);
      tr.innerHTML =
        '<td><span class="t-strong">' + c.name + '</span><div class="t-mute">' + c.area + '</div></td>' +
        '<td class="t-strong mono">' + c.deployed + '</td>' +
        '<td><div class="row-gap"><span class="t-strong" style="color:' + sTxt + '">' + c.score + '</span>' +
          '<div class="bar thin" style="width:60px"><span style="width:' + c.score + '%;background:' + sCol + '"></span></div></div></td>' +
        '<td><span class="pill ' + c.clra.cls + '">' + c.clra.label + '</span></td>' +
        '<td><span class="pill ' + c.esic.cls + '">' + c.esic.label + '</span></td>' +
        '<td><span class="pill ' + c.pf.cls + '">' + c.pf.label + '</span></td>' +
        '<td class="t-strong">' + fmtLakh(total) + '</td>' +
        '<td class="mono">' + (openTasks === 0 ? '—' : openTasks) + '</td>';
      body.appendChild(tr);
    });
  }
  renderCtGrid = renderContractorGrid;

  function resetCtSort() {
    CT_SORT = { col: 'liab', dir: -1 };
    CT_QUERY = '';
    const inp = document.getElementById('ct-search');
    if (inp) inp.value = '';
    const clr = document.getElementById('ct-search-clear');
    if (clr) clr.classList.remove('on');
    renderContractorGrid();
  }

  /* ── contractor drill-down · open + close + tab switch ── */
  function openCtDrill(id) {
    const c = CONTRACTORS.find(x => x.id === id);
    if (!c) return;
    SELECTED_CT = id;
    renderContractorGrid();

    const drill = document.getElementById('ct-drill');
    drill.classList.add('on');

    document.getElementById('ct-drill-eye').textContent = c.area + ' · ' + c.id;
    document.getElementById('ct-drill-title').textContent = c.name;
    const totalLiab = liabilityTotal(c);
    const openTasks = CT_TASKS.filter(t => t.ctId === c.id && t.severity !== 'closed').length;
    document.getElementById('ct-drill-meta').textContent =
      c.deployed + ' workers deployed · joint liability ' + fmtLakh(totalLiab) +
      ' · ' + openTasks + ' open task' + (openTasks !== 1 ? 's' : '') +
      ' · compliance lead ' + c.complianceLead.split(' · ')[0];

    /* score ring */
    document.getElementById('ct-ring-num').textContent = c.score;
    const ring = document.getElementById('ct-ring-fg');
    const circ = 2 * Math.PI * 42;
    ring.setAttribute('stroke-dasharray', circ.toFixed(2));
    ring.setAttribute('stroke-dashoffset', (circ * (1 - c.score / 100)).toFixed(2));
    ring.setAttribute('stroke', colorForScore(c.score));

    renderCtPaneOverview(c);
    renderCtPaneWorkers(c);
    renderCtPaneTasks(c);
    renderCtPaneLiability(c);
    renderCtPaneDocs(c);
    renderCtPaneComms(c);

    /* reset to overview tab */
    document.querySelectorAll('#ct-drill .sd-drill-tab').forEach((t, i) => t.classList.toggle('on', i === 0));
    document.querySelectorAll('#ct-drill .sd-pane').forEach((p, i) => p.classList.toggle('on', i === 0));

    setTimeout(() => drill.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  function closeCtDrill() {
    SELECTED_CT = null;
    document.getElementById('ct-drill').classList.remove('on');
    renderContractorGrid();
  }

  function ctTab(evt, name) {
    document.querySelectorAll('#ct-drill .sd-drill-tab').forEach(t => t.classList.remove('on'));
    evt.target.classList.add('on');
    document.querySelectorAll('#ct-drill .sd-pane').forEach(p => p.classList.remove('on'));
    document.getElementById('ct-pane-' + name).classList.add('on');
  }

  /* ── pane renderers ── */
  function renderCtPaneOverview(c) {
    const sub = c.subscores;
    const meta = (k, label) => {
      const v = sub[k];
      return (
        '<div class="subscore">' +
          '<div class="subscore-k">' + label + '</div>' +
          '<div class="subscore-v">' + v + '<small>/100</small></div>' +
          '<div class="subscore-bar"><span style="width:' + v + '%;background:' + colorForScore(v) + '"></span></div>' +
        '</div>'
      );
    };

    const trendStates = c.trend.split(',');
    const monthLabels = ['Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May'];
    let trendHtml = '<div class="trend-dots">';
    trendStates.forEach((s, i) => {
      trendHtml += '<div class="trend-dot ' + s + '" title="' + monthLabels[i] + ' 2026"></div>';
    });
    trendHtml += '<span class="trend-cap">6-month compliance trend</span></div>';

    const openTasks = CT_TASKS.filter(t => t.ctId === c.id && t.severity !== 'closed');
    const urgentCount = openTasks.filter(t => t.severity === 'urgent').length;
    const warningCount = openTasks.filter(t => t.severity === 'warning').length;

    let html = '';
    html += '<div class="sd-mini-grid">';
    html += '  <div class="sd-mini"><div class="sd-mini-eye">Contract value at risk</div>' +
            '<div class="sd-mini-v">' + fmtLakh(c.liability.contractValueRisk) + '</div>' +
            '<div class="sd-mini-s">if licence lapses or major breach</div></div>';
    html += '  <div class="sd-mini"><div class="sd-mini-eye">Joint liability · mid case</div>' +
            '<div class="sd-mini-v">' + fmtLakh(liabilityTotal(c)) + '</div>' +
            '<div class="sd-mini-s">statutory + ops + customer</div></div>';
    html += '  <div class="sd-mini"><div class="sd-mini-eye">Open tasks</div>' +
            '<div class="sd-mini-v">' + openTasks.length +
            (urgentCount > 0 ? ' <small style="color:var(--red-dk);font-weight:600">· ' + urgentCount + ' urgent</small>' : '') +
            '</div>' +
            '<div class="sd-mini-s">' + warningCount + ' warning · ' + (openTasks.length - urgentCount - warningCount) + ' routine</div></div>';
    html += '  <div class="sd-mini"><div class="sd-mini-eye">Avg pay</div>' +
            '<div class="sd-mini-v">' + c.avgPay + '</div>' +
            '<div class="sd-mini-s">' + c.womenWorkers + ' women · ' + c.migrantWorkers + ' migrant</div></div>';
    html += '</div>';

    html += '<div class="card-h" style="padding:0;margin-top:18px">' +
            '<div class="card-h-title" style="font-size:0.85rem">Sub-score breakdown · 6 dimensions</div>' +
            '<div>' + trendHtml + '</div></div>';
    html += '<div class="subscore-strip">';
    html += meta('clra',    'CLRA');
    html += meta('esic',    'ESIC');
    html += meta('pf',      'PF');
    html += meta('minWage', 'Min wage');
    html += meta('migrant', 'Migrant');
    html += meta('safety',  'Safety');
    html += '</div>';

    html += '<div class="card-h" style="padding:0;margin-top:18px"><div class="card-h-title" style="font-size:0.85rem">Registered entity details</div></div>';
    html += '<table class="t" style="margin-top:8px"><tbody>' +
      '<tr><td class="t-strong" style="width:30%">Registered</td><td>' + c.registered + '</td></tr>' +
      '<tr><td class="t-strong">PAN</td><td class="mono">' + kvIdSpan('PAN / CIN', c.panCin, c.id, 'contractor') + '</td></tr>' +
      '<tr><td class="t-strong">GSTIN</td><td class="mono">' + kvIdSpan('GST', c.gst, c.id, 'contractor') + '</td></tr>' +
      '<tr><td class="t-strong">ESIC code</td><td class="mono">' + kvIdSpan('ESIC employer code', c.esicCode, c.id, 'contractor') + '</td></tr>' +
      '<tr><td class="t-strong">Bank ack.</td><td class="mono">' + c.bankAck + '</td></tr>' +
      '<tr><td class="t-strong">Compliance lead</td><td>' + c.complianceLead + '</td></tr>' +
    '</tbody></table>';

    document.getElementById('ct-pane-overview').innerHTML = html;
  }

  function renderCtPaneWorkers(c) {
    const workers = CONTRACT_WORKERS.filter(w => w.contractor === c.name);
    let html = '';
    if (workers.length === 0) {
      html = '<div class="muted tiny">No matching contract workers in current dataset. Workers may be deployed but not appear in the in-progress onboarding ledger if already pushed to HRIS.</div>';
    } else {
      html += '<div class="card-h" style="padding:0;margin-bottom:10px">' +
              '<div class="card-h-title" style="font-size:0.85rem">Workers in onboarding</div>' +
              '<div class="card-h-sub">' + workers.length + ' of ' + c.deployed + ' deployed shown · Module 2 cross-reference</div></div>';
      html += '<table class="t"><thead><tr><th>Worker</th><th>Category</th><th>ESIC</th><th>CLRA</th><th>PPE / Size</th><th>Induction</th><th>Action</th></tr></thead><tbody>';
      workers.forEach(w => {
        const urgent = w.esic.state === 'breach' || w.clra.state === 'expired';
        const ctaCls = urgent ? 'notify-btn urgent' : 'notify-btn';
        const safeName = w.name.replace(/'/g, "\\'");
        html += '<tr>' +
                '<td class="t-strong">' + w.name + '</td>' +
                '<td>' + w.category + '</td>' +
                '<td><span class="pill ' + w.esic.cls + '">' + w.esic.label + '</span></td>' +
                '<td><span class="pill ' + w.clra.cls + '">' + w.clra.label + '</span></td>' +
                '<td>' + ppePillHtml(w.name) + '</td>' +
                '<td>' + indProgHtml(w.name) + '</td>' +
                '<td><button class="' + ctaCls + '" onclick="openVendorEmail(\'' + safeName + '\')">Notify vendor</button></td>' +
                '</tr>';
      });
      html += '</tbody></table>';
      html += '<div class="tiny muted" style="margin-top:8px">For the remaining ' + (c.deployed - workers.length) + ' workers already past onboarding, see Daikin HRIS or the master worker register. Click <strong>Induction training</strong> in the nav to drill into per-module progress.</div>';
    }
    document.getElementById('ct-pane-workers').innerHTML = html;
  }

  function renderCtPaneTasks(c) {
    const tasks = CT_TASKS.filter(t => t.ctId === c.id);
    const open = tasks.filter(t => t.severity !== 'closed');
    const closed = tasks.filter(t => t.severity === 'closed');

    let html = '';
    html += '<div class="card-h" style="padding:0;margin-bottom:10px">' +
            '<div class="card-h-title" style="font-size:0.85rem">Open tasks (' + open.length + ')</div>' +
            '<div class="card-h-sub">Each task links a statutory reference and an exposure line</div></div>';
    if (open.length === 0) {
      html += '<div class="muted tiny" style="padding:20px 0">No open tasks. ✓</div>';
    } else {
      html += '<div class="task-list">';
      open.forEach(t => html += taskCardHtml(t, c));
      html += '</div>';
    }
    if (closed.length > 0) {
      html += '<div class="card-h" style="padding:0;margin:18px 0 10px"><div class="card-h-title" style="font-size:0.85rem">Recently closed (' + closed.length + ')</div></div>';
      html += '<div class="task-list">';
      closed.forEach(t => html += taskCardHtml(t, c));
      html += '</div>';
    }
    document.getElementById('ct-pane-tasks').innerHTML = html;
  }

  function taskCardHtml(t, c) {
    const sevLabel = { urgent: 'URGENT', warning: 'WARNING', routine: 'ROUTINE', closed: 'CLOSED' }[t.severity];
    const sevPill  = { urgent: 'red',    warning: 'amber',   routine: 'blue',    closed: 'green'    }[t.severity];
    const linkBtn  = t.linkedLiabRow
      ? '<button class="btn" style="font-size:0.7rem" onclick="ctTab({target:document.querySelectorAll(\'#ct-drill .sd-drill-tab\')[3]}, \'liability\')">View exposure ₹' +
        (t.linkedLiabRow === 'statutoryMid'      ? c.liability.statutoryMid :
         t.linkedLiabRow === 'statutoryLow'      ? c.liability.statutoryLow :
         t.linkedLiabRow === 'contractValueRisk' ? c.liability.contractValueRisk :
                                                   '—') + ' L</button>'
      : '';
    const safeName = c.name.replace(/'/g, "\\'");
    const actBtns = t.actions.map(a => {
      if (a === 'Notify vendor') return '<button class="btn primary" style="font-size:0.7rem" onclick="openVendorEmailFromTask(\'' + t.id + '\')">' + a + '</button>';
      return '<button class="btn" style="font-size:0.7rem">' + a + '</button>';
    }).join('');
    return (
      '<div class="task-card ' + t.severity + '">' +
        '<div class="task-card-mid">' +
          '<div class="task-card-h">' +
            '<span>' + t.title + '</span>' +
            '<span class="pill ' + sevPill + ' tiny">' + sevLabel + '</span>' +
            '<span class="tiny muted mono">' + t.id + '</span>' +
          '</div>' +
          '<div class="task-card-d">' + t.desc + '</div>' +
          '<div class="task-card-m">' +
            '<span>SLA <span class="mono">' + (t.sla === 0 ? '—' : t.sla + t.slaUnit[0]) + '</span></span>' +
            (t.remaining !== '—' ? '<span>Remaining <span class="mono">' + t.remaining + '</span></span>' : '') +
            '<span>Age <span class="mono">' + t.ageDays + 'd</span></span>' +
            '<span>Owner <span class="mono">' + t.owner + '</span></span>' +
            '<span class="mono">' + t.statute + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="task-card-acts">' +
          actBtns +
          linkBtn +
        '</div>' +
      '</div>'
    );
  }

  function renderCtPaneLiability(c) {
    const L = c.liability;
    const ops = Math.round(L.operationalDays * L.operationalPerDay);
    const total = L.statutoryMid + ops + L.customerAudit + L.contractValueRisk;

    /* stacked bar */
    let html = '';
    html += '<div style="font-size:0.86rem;color:var(--ink-2);margin-bottom:4px">Mid-case exposure for <strong>' + c.name + '</strong>: <span class="mono">' + fmtLakh(total) + '</span></div>';
    html += '<div class="tiny muted" style="margin-bottom:8px">Statutory penalty + operational disruption + customer audit + contract value at risk</div>';

    if (total > 0) {
      const segs = [
        { k: 'Statutory penalty',       v: L.statutoryMid,      cls: 'exp-stat' },
        { k: 'Operational disruption',  v: ops,                 cls: 'exp-operational' },
        { k: 'Customer audit failure',  v: L.customerAudit,     cls: 'exp-customer' },
        { k: 'Contract value at risk',  v: L.contractValueRisk, cls: 'exp-finance' },
      ].filter(s => s.v > 0);
      html += '<div class="exp-strip">';
      segs.forEach(s => {
        const pct = (s.v / total) * 100;
        html += '<div class="' + s.cls + '" style="flex:' + pct + '">₹' + s.v + ' L</div>';
      });
      html += '</div>';
      html += '<div class="exp-legend">';
      html += '  <span class="lg"><span class="d" style="background:var(--red)"></span>Statutory penalty</span>';
      html += '  <span class="lg"><span class="d" style="background:var(--amber-dk)"></span>Operational disruption</span>';
      html += '  <span class="lg"><span class="d" style="background:var(--plum)"></span>Customer audit failure</span>';
      html += '  <span class="lg"><span class="d" style="background:var(--blue)"></span>Contract value at risk</span>';
      html += '</div>';
    } else {
      html += '<div class="note green"><strong>No open exposure.</strong> All statutory items reconciled. Routine compliance ongoing.</div>';
    }

    html += '<table class="t exp-table" style="margin-top:8px">';
    html += '<thead><tr><th>Component</th><th>Low</th><th>Mid</th><th>High</th><th>Linked to</th></tr></thead><tbody>';
    html += '<tr><td><div class="t-strong">Statutory penalty</div><div class="formula">ESI Act / PF Act / CLRA penalties · ₹X per worker per violation</div></td>' +
            '<td class="right mono">' + fmtLakh(L.statutoryLow) + '</td>' +
            '<td class="right mono t-strong">' + fmtLakh(L.statutoryMid) + '</td>' +
            '<td class="right mono">' + fmtLakh(L.statutoryHigh) + '</td>' +
            '<td>' + linkedTasks(c, 'statutoryMid') + '</td></tr>';
    html += '<tr><td><div class="t-strong">Operational disruption</div><div class="formula">' + L.operationalDays + ' day(s) × ₹' + L.operationalPerDay + ' L per day stop</div></td>' +
            '<td class="right mono">' + fmtLakh(0) + '</td>' +
            '<td class="right mono t-strong">' + fmtLakh(ops) + '</td>' +
            '<td class="right mono">' + fmtLakh(ops * 2) + '</td>' +
            '<td>Per Sricity production cost model</td></tr>';
    html += '<tr><td><div class="t-strong">Customer audit failure</div><div class="formula">Daikin customer audit (BRSR / supplier code-of-conduct)</div></td>' +
            '<td class="right mono">' + fmtLakh(0) + '</td>' +
            '<td class="right mono t-strong">' + fmtLakh(L.customerAudit) + '</td>' +
            '<td class="right mono">' + fmtLakh(L.customerAudit * 3) + '</td>' +
            '<td>If escalated to customer</td></tr>';
    html += '<tr><td><div class="t-strong">Contract value at risk</div><div class="formula">Annual contract value if licence lapses</div></td>' +
            '<td class="right mono">' + fmtLakh(0) + '</td>' +
            '<td class="right mono t-strong">' + fmtLakh(L.contractValueRisk) + '</td>' +
            '<td class="right mono">' + fmtLakh(L.contractValueRisk * 2) + '</td>' +
            '<td>' + linkedTasks(c, 'contractValueRisk') + '</td></tr>';
    html += '<tr class="total"><td>Mid-case total</td>' +
            '<td class="right mono">' + fmtLakh(L.statutoryLow) + '</td>' +
            '<td class="right mono">' + fmtLakh(total) + '</td>' +
            '<td class="right mono">' + fmtLakh(L.statutoryHigh + ops * 2 + L.customerAudit * 3 + L.contractValueRisk * 2) + '</td>' +
            '<td></td></tr>';
    html += '</tbody></table>';

    html += '<div class="note" style="margin-top:14px"><strong>Statutory basis · SS Code 2020 s.67:</strong> Principal employer is liable to discharge contractor PF/ESIC obligations if contractor fails. Pending notification in AP — current ESI Act / PF Act remain operative.</div>';

    document.getElementById('ct-pane-liability').innerHTML = html;
  }

  function linkedTasks(c, liabKey) {
    const tasks = CT_TASKS.filter(t => t.ctId === c.id && t.linkedLiabRow === liabKey && t.severity !== 'closed');
    if (tasks.length === 0) return '<span class="tiny muted">—</span>';
    return tasks.map(t => '<span class="pill outline tiny mono">' + t.id + '</span>').join(' ');
  }

  function renderCtPaneDocs(c) {
    /* mock — generates a docs table for the contractor */
    const baseDocs = [
      { type: 'CLRA licence',            file: 'clra_licence_' + c.id.toLowerCase() + '.pdf', expiry: c.clra.expiresOn, status: c.clra.cls, statusLabel: c.clra.label, hash: 'a3f7…' + c.id.slice(-3) },
      { type: 'ESIC employer code',      file: 'esic_code_certificate.pdf', expiry: '—', status: 'green', statusLabel: 'Valid', hash: '5b88…' + c.id.slice(-3) },
      { type: 'PF establishment code',   file: 'pf_estab_code.pdf', expiry: '—', status: 'green', statusLabel: 'Valid', hash: '7c12…' + c.id.slice(-3) },
      { type: 'GST certificate',         file: 'gst_cert_' + c.gst.slice(-5) + '.pdf', expiry: '—', status: 'green', statusLabel: 'Active', hash: 'aa90…' + c.id.slice(-3) },
      { type: 'Service agreement',       file: 'service_agreement_v3.pdf', expiry: '15 Mar 2027', status: 'green', statusLabel: 'Active', hash: 'b821…' + c.id.slice(-3) },
      { type: 'Insurance · WC policy',   file: 'wc_policy_2026.pdf', expiry: '01 Apr 2027', status: 'green', statusLabel: 'Active', hash: '882c…' + c.id.slice(-3) },
    ];
    if (c.esic.state === 'breach') {
      baseDocs.push({ type: 'ESIC May 2026 challan', file: 'esic_challan_may2026.pdf', expiry: '—', status: 'red', statusLabel: 'Shortfall · 4 workers', hash: 'red…' + c.id.slice(-3) });
    } else {
      baseDocs.push({ type: 'ESIC May 2026 challan', file: 'esic_challan_may2026.pdf', expiry: '—', status: c.esic.cls, statusLabel: c.esic.label, hash: 'aa90…' + c.id.slice(-3) });
    }

    let html = '';
    html += '<div class="card-h" style="padding:0;margin-bottom:10px">' +
            '<div class="card-h-title" style="font-size:0.85rem">Documents on file (' + baseDocs.length + ')</div>' +
            '<div class="card-h-sub">All documents encrypted at rest · chained to audit trail</div></div>';
    /* map statutory documents to a clickable, verifiable identification value */
    const docIdMap = {
      'ESIC employer code': { type: 'ESIC employer code', value: c.esicCode },
      'GST certificate':    { type: 'GST', value: c.gst }
    };
    html += '<table class="t"><thead><tr><th>Document type</th><th>File</th><th>Expiry</th><th>Status</th><th>Audit hash</th></tr></thead><tbody>';
    baseDocs.forEach(d => {
      const idDoc = docIdMap[d.type];
      const typeCell = idDoc
        ? kvIdSpan(idDoc.type, idDoc.value, c.id, 'contractor')
        : d.type;
      html += '<tr><td class="t-strong">' + typeCell + '</td>' +
              '<td class="mono tiny">' + d.file + '</td>' +
              '<td>' + d.expiry + '</td>' +
              '<td><span class="pill ' + d.status + '">' + d.statusLabel + '</span></td>' +
              '<td class="mono tiny">' + d.hash + '</td></tr>';
    });
    html += '</tbody></table>';
    document.getElementById('ct-pane-docs').innerHTML = html;
  }

  function renderCtPaneComms(c) {
    /* mock communications log */
    const comms = [
      { ts: '23 Apr 2026 · 16:42 IST', dir: 'OUT', channel: 'Email', who: 'HR · Priya M.',
        subject: c.esic.state === 'breach' ? '[URGENT] ESIC challan shortfall — May 2026' : 'Routine compliance check-in',
        ref: 'PV-COMM-' + (884000 + parseInt(c.id.slice(-3))) },
      { ts: '21 Apr 2026 · 11:08 IST', dir: 'IN',  channel: 'Portal', who: c.complianceLead.split(' ·')[0],
        subject: 'Acknowledgement · CLRA renewal pack received',
        ref: 'PV-COMM-' + (884000 + parseInt(c.id.slice(-3)) - 1) },
      { ts: '19 Apr 2026 · 09:30 IST', dir: 'OUT', channel: 'Email', who: 'system · Karya Vaani',
        subject: 'Auto-reminder · CLRA renewal due in 30 days',
        ref: 'PV-COMM-' + (884000 + parseInt(c.id.slice(-3)) - 2) },
      { ts: '15 Apr 2026 · 14:15 IST', dir: 'IN',  channel: 'Email', who: c.complianceLead.split(' ·')[0],
        subject: 'May deployment plan · headcount confirmation',
        ref: 'PV-COMM-' + (884000 + parseInt(c.id.slice(-3)) - 3) },
      { ts: '10 Apr 2026 · 10:00 IST', dir: 'OUT', channel: 'WhatsApp', who: 'HR · Priya M.',
        subject: 'Monthly check-in · please confirm wages have been credited',
        ref: 'PV-COMM-' + (884000 + parseInt(c.id.slice(-3)) - 4) },
    ];

    let html = '';
    html += '<div class="card-h" style="padding:0;margin-bottom:10px">' +
            '<div class="card-h-title" style="font-size:0.85rem">Recent communications · last 30 days</div>' +
            '<div class="card-h-sub">Every email, portal action and WhatsApp message is logged · cross-references the vendor email feature</div></div>';
    html += '<table class="t"><thead><tr><th>Time</th><th>Dir</th><th>Channel</th><th>Subject</th><th>Person</th><th>Ref</th></tr></thead><tbody>';
    comms.forEach(m => {
      html += '<tr><td class="mono tiny">' + m.ts + '</td>' +
              '<td><span class="pill ' + (m.dir === 'OUT' ? 'blue' : 'outline') + ' tiny">' + m.dir + '</span></td>' +
              '<td>' + m.channel + '</td>' +
              '<td class="t-strong">' + m.subject + '</td>' +
              '<td>' + m.who + '</td>' +
              '<td class="mono tiny">' + m.ref + '</td></tr>';
    });
    html += '</tbody></table>';
    html += '<div style="margin-top:14px;display:flex;gap:8px">';
    html += '  <button class="btn primary" onclick="openVendorEmailFromContractor(\'' + c.id + '\')">+ New notification</button>';
    html += '  <button class="btn">Export to PDF</button>';
    html += '</div>';
    document.getElementById('ct-pane-comms').innerHTML = html;
  }

  /* ── all-contractor task aggregation (bottom of page) ── */
  function renderAllTasks() {
    const host = document.getElementById('ct-tasks-all');
    if (!host) return;
    const tasks = CT_TASKS.filter(t => t.severity !== 'closed')
      .sort((a, b) => {
        const ord = { urgent: 0, warning: 1, routine: 2 };
        return ord[a.severity] - ord[b.severity];
      });
    if (tasks.length === 0) {
      host.innerHTML = '<div class="muted tiny">No open tasks across contractors.</div>';
      return;
    }
    let html = '<div class="task-list">';
    tasks.forEach(t => {
      const c = CONTRACTORS.find(x => x.id === t.ctId);
      if (!c) return;
      html += taskCardHtml(t, c);
    });
    html += '</div>';
    host.innerHTML = html;
  }

  /* ── liability summary at bottom of page ── */
  function renderLiabilitySummary() {
    const host = document.getElementById('ct-liab-summary');
    if (!host) return;
    let totalStat = 0, totalOps = 0, totalCust = 0, totalCV = 0;
    CONTRACTORS.forEach(c => {
      const L = c.liability;
      totalStat += L.statutoryMid;
      totalOps  += Math.round(L.operationalDays * L.operationalPerDay);
      totalCust += L.customerAudit;
      totalCV   += L.contractValueRisk;
    });
    /* operational disruption assumed shared 1-day stop = ₹18 L · don't add per-contractor */
    const sharedOpStop = 18;
    const grandTotal = totalStat + sharedOpStop + totalCust;
    /* update top KPI tile too */
    const kpis = document.querySelectorAll('#sec-vendor .kpi');
    if (kpis[3]) {
      kpis[3].querySelector('.kpi-val').innerHTML = '₹' + grandTotal + '<small>L</small>';
    }

    let html = '<hr class="div">';
    html += '<div style="font-size:0.8rem;color:var(--ink-2);line-height:1.7">';
    html += '  <div class="row-between"><span>Statutory penalty · sum over contractors (mid)</span><span class="mono">₹' + totalStat + ' L</span></div>';
    html += '  <div class="row-between"><span>Operational disruption (1-day Sricity stop)</span><span class="mono">₹' + sharedOpStop + ' L</span></div>';
    html += '  <div class="row-between"><span>Customer audit failure · sum</span><span class="mono">₹' + totalCust + ' L</span></div>';
    html += '  <div class="row-between" style="font-weight:600;color:var(--ink);margin-top:6px;padding-top:6px;border-top:1px solid var(--line)"><span>Mid-case total · principal employer</span><span class="mono">₹' + grandTotal + ' L</span></div>';
    html += '  <div class="tiny muted" style="margin-top:8px">Contract value at risk (₹' + totalCV + ' L) tracked separately — realised only if specific contractor licence lapses.</div>';
    html += '</div>';
    host.innerHTML = html;
  }

  /* ── helpers · open vendor email from task / contractor button ── */
  function openVendorEmailFromTask(taskId) {
    const t = CT_TASKS.find(x => x.id === taskId);
    if (!t) return;
    const c = CONTRACTORS.find(x => x.id === t.ctId);
    /* find a contract worker from this contractor to open the email with, fallback to a synthesized one */
    const w = CONTRACT_WORKERS.find(x => x.contractor === c.name);
    if (w) {
      openVendorEmail(w.name);
    } else {
      toast('No matching contract worker available for ' + c.name, 'red');
    }
  }
  function openVendorEmailFromContractor(ctId) {
    const c = CONTRACTORS.find(x => x.id === ctId);
    if (!c) return;
    const w = CONTRACT_WORKERS.find(x => x.contractor === c.name);
    if (w) openVendorEmail(w.name);
    else   toast('No matching contract worker available for ' + c.name, 'red');
  }

  /* ── download contractors workbook ── */
  function downloadContractors() {
    const headers = ['Contractor ID', 'Name', 'Area', 'Workers deployed', 'Score',
                     'CLRA status', 'CLRA expires', 'ESIC reconcile', 'PF reconcile',
                     'Open tasks', 'Statutory penalty (mid) ₹L', 'Operational disruption ₹L',
                     'Customer audit ₹L', 'Contract value at risk ₹L', 'Joint liability total ₹L',
                     'Compliance lead'];
    const rows = CONTRACTORS.map(c => {
      const ops = Math.round(c.liability.operationalDays * c.liability.operationalPerDay);
      const total = liabilityTotal(c);
      const open = CT_TASKS.filter(t => t.ctId === c.id && t.severity !== 'closed').length;
      return [
        c.id, c.name, c.area, c.deployed, c.score,
        c.clra.label, c.clra.expiresOn, c.esic.label, c.pf.label,
        open,
        c.liability.statutoryMid, ops,
        c.liability.customerAudit, c.liability.contractValueRisk, total,
        c.complianceLead,
      ];
    });
    downloadWorkbook('Contractor master', headers, rows,
      'plant-vaani_contractor-master_' + todayStamp() + '.xlsx');
  }

  /* ── wire up ── */
  function initContractorModule() {
    if (!document.getElementById('ct-grid-body')) return;
    document.querySelectorAll('#ct-grid th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (CT_SORT.col === col) CT_SORT.dir = -CT_SORT.dir;
        else {
          CT_SORT.col = col;
          const txtCol = ['name'].includes(col);
          CT_SORT.dir = txtCol ? 1 : -1;
        }
        renderContractorGrid();
      });
    });

    const sInp = document.getElementById('ct-search');
    const sClr = document.getElementById('ct-search-clear');
    if (sInp) {
      sInp.addEventListener('input', e => {
        CT_QUERY = e.target.value;
        sClr.classList.toggle('on', CT_QUERY.length > 0);
        renderContractorGrid();
      });
      sInp.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          sInp.value = ''; CT_QUERY = '';
          sClr.classList.remove('on');
          renderContractorGrid();
        }
      });
    }
    if (sClr) {
      sClr.addEventListener('click', () => {
        sInp.value = ''; CT_QUERY = '';
        sClr.classList.remove('on');
        sInp.focus();
        renderContractorGrid();
      });
    }

    renderContractorGrid();
    renderAllTasks();
    renderLiabilitySummary();
  }

  /* hook into DOMContentLoaded after the rest of init */
  __kvOnReady(initContractorModule);

  /* ════════════════════════════════════════════════════════════════
     MODULE 3 · INDUCTION TRAINING
     Combined Direct + Contract joinees, PPE alerts, induction ledger
     ════════════════════════════════════════════════════════════════ */

  /* aggregate joinees from WORKERS + CONTRACT_WORKERS */
  function allJoinees() {
    const list = [];
    WORKERS.forEach(w => {
      const ind = IND_STATE[w.name];
      list.push({
        name: w.name,
        type: 'Direct',
        anchor: w.role + ' · ' + w.posId,
        joinDate: ind ? ind.joinDate : '—',
      });
    });
    CONTRACT_WORKERS.forEach(w => {
      const ind = IND_STATE[w.name];
      list.push({
        name: w.name,
        type: 'Contract',
        anchor: w.category + ' · ' + w.contractor,
        joinDate: ind ? ind.joinDate : '—',
      });
    });
    return list;
  }

  let IND_SORT = { col: 'riskRank', dir: -1 };
  let IND_QUERY = '';
  let IND_FILTER = null;            /* one of: 'ppeMissing' | 'ppeDraft' | 'gated' | 'language:XX' */
  let SELECTED_IND = null;

  /* chip filter definitions — used by both the chip render + the filter banner */
  const IND_FILTERS = {
    ppeMissing: {
      label: 'PPE sizing missing',
      kicker: 'Capture shoe + uniform sizes',
      predicate: n => (PPE_STATE[n] && PPE_STATE[n].status === 'missing'),
    },
    ppeDraft: {
      label: 'Fitment pending',
      kicker: 'Confirm size before joining day',
      predicate: n => (PPE_STATE[n] && PPE_STATE[n].status === 'draft'),
    },
    gated: {
      label: 'Induction gated',
      kicker: 'Resolve upstream PPE / ESIC',
      predicate: n => indStatusLabel(n).cls === 'gated',
    },
  };
  function langFilterFor(code) {
    const l = LANGUAGES.find(x => x.code === code);
    return {
      label: 'Language · ' + (l ? l.name : code),
      kicker: 'Workers preferring this induction language',
      predicate: n => WORKER_LANGUAGE[n] === code,
    };
  }
  function currentFilter() {
    if (!IND_FILTER) return null;
    if (IND_FILTER.startsWith('language:')) return langFilterFor(IND_FILTER.split(':')[1]);
    return IND_FILTERS[IND_FILTER] || null;
  }

  function indRiskRank(name) {
    const p = indProgressOf(name);
    const ppe = PPE_STATE[name];
    let risk = 0;
    if (ppe && ppe.status === 'missing') risk += 1000;
    else if (ppe && ppe.status === 'draft') risk += 200;
    if (p.gated > 0) risk += 500;
    risk += (p.total - p.done) * 5;
    return risk;
  }
  function indRiskLabel(name) {
    const r = indRiskRank(name);
    if (r >= 1000) return { cls: 'red',   label: 'High' };
    if (r >= 500)  return { cls: 'red',   label: 'High' };
    if (r >= 200)  return { cls: 'amber', label: 'Medium' };
    if (r >= 10)   return { cls: 'amber', label: 'Watch' };
    return { cls: 'green', label: 'Low' };
  }
  function indJoinSortVal(label) {
    /* extract day number for rough sorting */
    const m = (label || '').match(/(\d+)\s+\w+/);
    return m ? parseInt(m[1]) : 999;
  }

  function renderIndGrid() {
    const q = IND_QUERY.trim().toLowerCase();
    const filter = currentFilter();
    let rows = allJoinees();
    if (filter) {
      rows = rows.filter(j => filter.predicate(j.name));
    }
    if (q) {
      rows = rows.filter(j => (j.name + ' ' + j.type + ' ' + j.anchor).toLowerCase().includes(q));
    }
    rows.sort((a, b) => {
      const va = indSortVal(a, IND_SORT.col), vb = indSortVal(b, IND_SORT.col);
      if (va < vb) return -1 * IND_SORT.dir;
      if (va > vb) return  1 * IND_SORT.dir;
      return 0;
    });

    /* indicators */
    document.querySelectorAll('#ind-grid th.sortable').forEach(th => {
      th.classList.remove('sort-asc', 'sort-desc');
      const ind = th.querySelector('.sort-ind');
      ind.textContent = '↕';
      if (th.dataset.col === IND_SORT.col) {
        th.classList.add(IND_SORT.dir === 1 ? 'sort-asc' : 'sort-desc');
        ind.textContent = IND_SORT.dir === 1 ? '↑' : '↓';
      }
    });

    /* state caption */
    const colLabel = {
      name: 'Worker', type: 'Type', anchor: 'Position / Contractor',
      joinDate: 'Join date', ppeRank: 'PPE', progress: 'Progress', statusRank: 'Status',
      riskRank: 'Risk', langRank: 'Language'
    };
    const totalRows = allJoinees().length;
    let caption = '';
    if (filter || q) caption += rows.length + ' of ' + totalRows + ' match · ';
    caption += 'Sorted by ' + colLabel[IND_SORT.col] + ' · ' + (IND_SORT.dir === 1 ? 'asc' : 'desc');
    document.getElementById('ind-sort-state').textContent = caption;

    /* filter banner */
    const banner = document.getElementById('ind-filter-banner');
    if (filter) {
      banner.style.display = 'inline-flex';
      banner.innerHTML =
        '<span class="filter-banner-k">Filter</span>' +
        '<span class="filter-banner-v">' + filter.label + '</span>' +
        '<span class="muted tiny">' + rows.length + ' worker' + (rows.length !== 1 ? 's' : '') + ' · ' + filter.kicker + '</span>' +
        '<span class="filter-banner-clear" onclick="clearIndFilter()">Clear ✕</span>';
    } else {
      banner.style.display = 'none';
      banner.innerHTML = '';
    }
    /* sync chip active state */
    document.querySelectorAll('#ind-alert-host .alert-chip').forEach(el => {
      el.classList.toggle('active', el.dataset.filterKey === IND_FILTER);
    });

    const body = document.getElementById('ind-grid-body');
    body.innerHTML = '';
    if (rows.length === 0) {
      const msg = filter
        ? 'No joinee matches the active filter ' + filter.label + (q ? ' and query "' + IND_QUERY + '"' : '')
        : 'No joinee matches <span class="mono">"' + IND_QUERY + '"</span>';
      body.innerHTML = '<tr><td colspan="9" class="search-empty">' + msg + '</td></tr>';
      return;
    }
    rows.forEach(j => {
      const ind = IND_STATE[j.name];
      const stat = indStatusLabel(j.name);
      const risk = indRiskLabel(j.name);
      const tr = document.createElement('tr');
      tr.className = 'wk-row' + (SELECTED_IND === j.name ? ' selected' : '');
      tr.style.cursor = 'pointer';
      tr.onclick = () => openIndDrill(j.name);
      tr.innerHTML =
        '<td class="t-strong">' + j.name + '</td>' +
        '<td><span class="pill outline tiny">' + j.type + '</span></td>' +
        '<td>' + j.anchor + '</td>' +
        '<td>' + j.joinDate + '</td>' +
        '<td>' + langTagHtml(j.name, false) + '</td>' +
        '<td>' + ppePillHtml(j.name) + '</td>' +
        '<td>' + indProgHtml(j.name) + '</td>' +
        '<td><span class="ind-status ' + stat.cls + '">' + stat.label + '</span></td>' +
        '<td><span class="pill ' + risk.cls + '">' + risk.label + '</span></td>';
      body.appendChild(tr);
    });
  }

  function setIndFilter(key) {
    IND_FILTER = (IND_FILTER === key) ? null : key;
    renderIndGrid();
    /* scroll grid into view */
    const grid = document.getElementById('ind-grid');
    if (grid) setTimeout(() => grid.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
  }
  function clearIndFilter() {
    IND_FILTER = null;
    renderIndGrid();
  }

  function indSortVal(j, col) {
    switch (col) {
      case 'name':       return j.name.toLowerCase();
      case 'type':       return j.type;
      case 'anchor':     return j.anchor.toLowerCase();
      case 'joinDate':   return indJoinSortVal(j.joinDate);
      case 'ppeRank':    return PPE_STATE[j.name] ? PPE_RANK[PPE_STATE[j.name].status] : -1;
      case 'progress':   return indProgressOf(j.name).pct;
      case 'statusRank': return IND_STATUS_RANK[indStatusLabel(j.name).cls] || 0;
      case 'riskRank':   return indRiskRank(j.name);
      case 'langRank':   return langOf(j.name).name;
    }
  }

  function resetIndSort() {
    IND_SORT = { col: 'riskRank', dir: -1 };
    IND_QUERY = '';
    IND_FILTER = null;
    const inp = document.getElementById('ind-search');
    if (inp) inp.value = '';
    const clr = document.getElementById('ind-search-clear');
    if (clr) clr.classList.remove('on');
    renderIndGrid();
  }

  function openIndDrill(name) {
    SELECTED_IND = name;
    renderIndGrid();

    const ind = IND_STATE[name];
    const ppe = PPE_STATE[name];
    if (!ind) return;

    const drill = document.getElementById('ind-drill');
    drill.classList.add('on');

    const isDirect = !!WORKERS.find(w => w.name === name);
    const anchorRec = isDirect
      ? WORKERS.find(w => w.name === name)
      : CONTRACT_WORKERS.find(w => w.name === name);

    document.getElementById('ind-drill-eye').textContent =
      (isDirect ? 'Direct employee · ' : 'Contract worker · ') + (isDirect ? anchorRec.posId : anchorRec.contractor);
    document.getElementById('ind-drill-title').textContent = name;
    const p = indProgressOf(name);
    document.getElementById('ind-drill-meta').textContent =
      'Join date: ' + ind.joinDate + ' · ' + p.done + '/' + p.total + ' modules complete · ' +
      (p.gated > 0 ? (p.gated + ' modules gated · resolve PPE/ESIC first') : 'on track');

    /* render module list */
    const list = document.getElementById('ind-drill-modules');
    list.innerHTML = '<div class="drill-list-h"><span>Induction modules</span><span class="tiny muted">' + ind.modules.length + ' modules · ' + (ind.track === 'direct' ? 'Common + Direct + Role' : 'Common + Contract + Role') + '</span></div>';
    ind.modules.forEach(m => {
      const cls = m.status; /* gated/done/inprog/scheduled */
      let statBlock = '';
      if (m.status === 'done') statBlock = '<span class="ind-status done">✓ Done</span>';
      else if (m.status === 'inprog') statBlock = '<span class="ind-status inprog">⌛ In progress</span>';
      else if (m.status === 'gated') statBlock = '<span class="ind-status gated">⛔ Gated</span>';
      else statBlock = '<span class="ind-status scheduled">📅 Scheduled</span>';

      list.insertAdjacentHTML('beforeend',
        '<div class="drill-doc">' +
          '<div class="drill-doc-icon">' + (m.mandatory ? '⚠' : '○') + '</div>' +
          '<div class="drill-doc-mid">' +
            '<div class="drill-doc-label">' + m.label + '</div>' +
            '<div class="drill-doc-meta">' +
              (m.completedOn ? '<span class="typ">' + m.completedOn + '</span>' :
               m.note ? '<span class="typ" style="background:var(--red-soft);color:var(--red-dk)">' + m.note + '</span>' :
                       '<span class="typ">' + (m.mandatory ? 'MANDATORY' : 'OPTIONAL') + '</span>') +
            '</div>' +
          '</div>' +
          statBlock +
        '</div>'
      );
    });

    /* render side panel: PPE, attestation timeline, statutory notes */
    const side = document.getElementById('ind-drill-side');
    let sh = '';
    sh += '<div class="drill-detail-h"><div><div class="drill-detail-title">PPE &amp; uniform sizing</div><div class="drill-detail-meta">';
    if (ppe) {
      if (ppe.status === 'missing') sh += '<span class="ppe-pill missing">✗ Missing — ORDER NOW</span>';
      else if (ppe.status === 'draft') sh += '<span class="ppe-pill draft">⌛ Draft — fitment pending</span>';
      else sh += '<span class="ppe-pill confirmed">✓ Issued</span>';
    } else sh += '<span class="ppe-pill missing">✗ No record</span>';
    sh += '</div></div></div>';

    sh += '<div class="evidence-panel ' + (ppe && ppe.status === 'confirmed' ? 'digital' : ppe && ppe.status === 'draft' ? 'empty' : 'rejected') + '">';
    if (ppe) {
      sh += '<div class="ev-row"><div class="ev-k">Shoe size</div><div class="ev-v">UK ' + ppe.shoe + '</div></div>';
      sh += '<div class="ev-row"><div class="ev-k">Uniform size</div><div class="ev-v">' + ppe.uniform + ' (chest)</div></div>';
      sh += '<div class="ev-row"><div class="ev-k">Gloves</div><div class="ev-v">' + ppe.gloves + '</div></div>';
      sh += '<div class="ev-row"><div class="ev-k">Status</div><div class="ev-v plain">' + (ppe.status === 'confirmed' ? 'Issued — receipt on file' : ppe.status === 'draft' ? 'Sizes captured · awaiting fitment confirmation' : 'Not yet captured — ALERT for HR') + '</div></div>';
      if (ppe.orderedOn) sh += '<div class="ev-row"><div class="ev-k">Ordered</div><div class="ev-v">' + ppe.orderedOn + ' · ' + ppe.vendor + '</div></div>';
      sh += '<div class="ev-row"><div class="ev-k">Deliver by</div><div class="ev-v plain">' + ppe.deliverBy + '</div></div>';
      if (ppe.receipt) sh += '<div class="ev-row"><div class="ev-k">Receipt</div><div class="ev-v">' + ppe.receipt + '</div></div>';
    } else {
      sh += '<div class="ev-row"><div class="ev-k">Status</div><div class="ev-v plain">No PPE record — HR action required immediately</div></div>';
    }
    sh += '</div>';

    sh += '<div class="drill-acts">';
    if (!ppe || ppe.status === 'missing') {
      sh += '<button class="btn primary">Capture sizes now</button>';
      sh += '<button class="btn">Schedule fitment appointment</button>';
      sh += '<button class="btn">Notify HR ops</button>';
    } else if (ppe.status === 'draft') {
      sh += '<button class="btn primary">Confirm fitment</button>';
      sh += '<button class="btn">Reschedule</button>';
    } else {
      sh += '<button class="btn">View receipt PDF</button>';
      sh += '<button class="btn">Order replacement</button>';
    }
    sh += '</div>';

    /* language picker */
    const cur = langOf(name);
    sh += '<div class="lang-picker">';
    sh += '  <div class="lang-picker-h">' +
            '<span class="lp-title">Induction language</span>' +
            '<span class="lp-sub">VAANI translates content + role-specific safety briefings</span>' +
          '</div>';
    sh += '  <div class="lang-options">';
    LANGUAGES.forEach(l => {
      const active = (l.code === cur.code);
      const safeName = name.replace(/'/g, "\\'");
      sh += '<span class="lang-opt' + (active ? ' active' : '') + '" onclick="changeWorkerLanguage(\'' + safeName + '\',\'' + l.code + '\')" title="' + l.name + ' · pack coverage ' + l.coverage + '%">' +
              '<span class="lang-glyph">' + l.nativeName + '</span>' +
              '<span>' + l.code + '</span>' +
              '<span class="lang-cov">' + l.coverage + '%</span>' +
            '</span>';
    });
    sh += '  </div>';
    sh += '  <div class="lang-coverage-line">' +
            '<span>Pack coverage</span>' +
            '<div class="lc-bar"><span style="width:' + cur.coverage + '%"></span></div>' +
            '<span class="lc-pct">' + cur.coverage + '%</span>' +
          '</div>';
    sh += '</div>';

    /* statutory note */
    sh += '<div class="note" style="margin-top:16px"><strong>Statutory basis:</strong> Factories Act 1948 s.41-B (safety of workers using hazardous processes) + Schedule 21 (safety officer competency). Worker cannot be permitted on shop floor without PPE issued and fitment confirmed. Induction modules tagged ⚠ are mandatory; gated modules cannot start until PPE is on hand and ESIC is enrolled.</div>';

    side.innerHTML = sh;

    setTimeout(() => drill.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  function closeIndDrill() {
    SELECTED_IND = null;
    document.getElementById('ind-drill').classList.remove('on');
    renderIndGrid();
  }

  function changeWorkerLanguage(name, code) {
    setLangFor(name, code);
    /* re-render drill side panel + grid (language column + filter chip count) */
    openIndDrill(name);
    renderIndModule();
    toast('Induction language set to ' + (LANGUAGES.find(l => l.code === code) || {}).name + ' for ' + name, 'green');
  }

  /* induction page-level KPIs + alerts */
  function renderIndModule() {
    if (!document.getElementById('ind-grid-body')) return;

    /* KPIs */
    const joinees = allJoinees();
    let inFlight = 0, complete = 0, mandatoryTotal = 0, mandatoryDone = 0;
    let atRisk = 0, totalDays = 0, withDays = 0;
    joinees.forEach(j => {
      const p = indProgressOf(j.name);
      if (p.total === 0) return;
      if (p.done < p.total) inFlight++;
      if (p.done === p.total) complete++;
      const ms = IND_STATE[j.name].modules;
      mandatoryTotal += ms.filter(m => m.mandatory).length;
      mandatoryDone  += ms.filter(m => m.mandatory && m.status === 'done').length;
      const stat = indStatusLabel(j.name);
      if (stat.cls === 'gated') atRisk++;
      const ppe = PPE_STATE[j.name];
      if (ppe && ppe.status === 'missing') atRisk++; /* may double-count if also gated — that's a feature not a bug */
      /* approximate avg days based on completed count */
      if (p.done > 0) { totalDays += Math.max(1, Math.round(p.done / 2)); withDays++; }
    });
    const compPct = mandatoryTotal === 0 ? 0 : Math.round((mandatoryDone / mandatoryTotal) * 100);
    const avgDays = withDays === 0 ? '—' : (totalDays / withDays).toFixed(1);
    document.getElementById('ind-kpi-flight').textContent = inFlight;
    document.getElementById('ind-kpi-comp').firstChild.nodeValue = compPct;
    document.getElementById('ind-kpi-comp-sub').textContent = mandatoryDone + ' of ' + mandatoryTotal + ' mandatory modules done';
    document.getElementById('ind-kpi-days').firstChild.nodeValue = avgDays;
    document.getElementById('ind-kpi-risk').textContent = atRisk;
    document.getElementById('ind-kpi-risk-sub').textContent = 'gated by PPE / ESIC';

    /* PPE alerts on induction page · use compact chip bar (each chip filters the grid below) */
    let ppeMissing = 0, ppeDraft = 0;
    const names = joinees.map(j => j.name);
    const missingNames = [];
    names.forEach(n => {
      const p = PPE_STATE[n];
      if (!p) return;
      if (p.status === 'missing') { ppeMissing++; missingNames.push(n); }
      else if (p.status === 'draft') ppeDraft++;
    });
    let gatedCount = 0;
    names.forEach(n => { if (indStatusLabel(n).cls === 'gated') gatedCount++; });

    const host = document.getElementById('ind-alert-host');
    const chips = [];
    if (ppeMissing > 0) {
      chips.push({
        cls: 'urgent', icon: '🥾', filterKey: 'ppeMissing',
        headline: '<span class="ac-count">' + ppeMissing + '</span> PPE sizing missing',
        sub: 'HR · capture sizes today · ' + missingNames.join(', '),
        title: 'Click to filter the joinees grid to these workers. Safety stores need ≥ 3 working days to pre-pick before joining. Per Factories Act s.41-B, no PPE = no floor entry.',
      });
    }
    if (ppeDraft > 0) {
      chips.push({
        cls: 'warning', icon: '⌛', filterKey: 'ppeDraft',
        headline: '<span class="ac-count">' + ppeDraft + '</span> fitment pending',
        sub: 'Sizes captured · awaiting receipt',
        title: 'Click to filter to workers with draft PPE orders awaiting fitment confirmation. Confirm today to avoid Day-1 disruption.',
      });
    }
    if (gatedCount > 0) {
      chips.push({
        cls: 'warning', icon: '⛔', filterKey: 'gated',
        headline: '<span class="ac-count">' + gatedCount + '</span> induction gated',
        sub: 'Blocked by PPE or ESIC upstream',
        title: 'Click to filter to workers whose induction modules cannot start. Resolve upstream items to unblock.',
      });
    }
    /* always include language coverage chip (info severity) — clickable for the dominant non-Telugu language */
    const langCounts = {};
    names.forEach(n => { const c = (WORKER_LANGUAGE[n] || 'EN'); langCounts[c] = (langCounts[c] || 0) + 1; });
    const langChipKey = Object.keys(langCounts).sort((a, b) => langCounts[b] - langCounts[a])[0];
    const distinctLangs = Object.keys(langCounts).length;
    if (distinctLangs > 1) {
      chips.push({
        cls: 'info', icon: '🌐', filterKey: 'language:' + langChipKey,
        headline: '<span class="ac-count">' + distinctLangs + '</span> languages needed',
        sub: Object.entries(langCounts).map(([c, n]) => c + ' ' + n).join(' · '),
        title: 'Karya Vaani delivers induction in the joinee\'s preferred language. Click to filter by the most common language; click again to clear; use the Language column to sort by language.',
      });
    }

    if (chips.length === 0) {
      host.innerHTML = '<div class="alert-bar-calm">All joinees on track · PPE issued, induction in progress, no statutory gating</div>';
    } else {
      let chipsHtml = '<div class="alert-bar">';
      chips.forEach(c => {
        chipsHtml += '<div class="alert-chip ' + c.cls + '" ' +
                     'data-filter-key="' + c.filterKey + '" ' +
                     'onclick="setIndFilter(\'' + c.filterKey + '\')" ' +
                     'title="' + c.title.replace(/"/g, '&quot;') + '">' +
                       '<span class="alert-chip-icon">' + c.icon + '</span>' +
                       '<div class="alert-chip-body">' +
                         '<div class="alert-chip-headline">' + c.headline + '</div>' +
                         '<div class="alert-chip-sub">' + c.sub + '</div>' +
                       '</div>' +
                       '<span class="alert-chip-cta">↗</span>' +
                     '</div>';
      });
      chipsHtml += '</div>';
      host.innerHTML = chipsHtml;
    }

    /* grid */
    renderIndGrid();
  }

  function downloadInduction() {
    const headers = ['Worker', 'Type', 'Position / Contractor', 'Join date', 'Language',
                     'Shoe', 'Uniform', 'Gloves', 'PPE status',
                     'Modules done', 'Modules total', 'Gated', 'Status', 'Risk'];
    const rows = allJoinees().map(j => {
      const ppe = PPE_STATE[j.name];
      const p = indProgressOf(j.name);
      const stat = indStatusLabel(j.name);
      const risk = indRiskLabel(j.name);
      const l = langOf(j.name);
      return [
        j.name, j.type, j.anchor, j.joinDate, l.name + ' (' + l.code + ')',
        ppe ? 'UK ' + ppe.shoe : '—',
        ppe ? ppe.uniform : '—',
        ppe ? ppe.gloves : '—',
        ppe ? ppe.status : 'missing',
        p.done, p.total, p.gated, stat.label, risk.label
      ];
    });
    downloadWorkbook('Induction joinees', headers, rows,
      'plant-vaani_induction_' + todayStamp() + '.xlsx');
  }

  function initIndModule() {
    if (!document.getElementById('ind-grid-body')) return;
    document.querySelectorAll('#ind-grid th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (IND_SORT.col === col) IND_SORT.dir = -IND_SORT.dir;
        else {
          IND_SORT.col = col;
          const txtCol = ['name', 'type', 'anchor'].includes(col);
          IND_SORT.dir = txtCol ? 1 : -1;
        }
        renderIndGrid();
      });
    });

    const sInp = document.getElementById('ind-search');
    const sClr = document.getElementById('ind-search-clear');
    if (sInp) {
      sInp.addEventListener('input', e => {
        IND_QUERY = e.target.value;
        sClr.classList.toggle('on', IND_QUERY.length > 0);
        renderIndGrid();
      });
      sInp.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          sInp.value = ''; IND_QUERY = '';
          sClr.classList.remove('on');
          renderIndGrid();
        }
      });
    }
    if (sClr) {
      sClr.addEventListener('click', () => {
        sInp.value = ''; IND_QUERY = '';
        sClr.classList.remove('on');
        sInp.focus();
        renderIndGrid();
      });
    }

    renderIndModule();
  }

  __kvOnReady(initIndModule);

  /* ════════════════════════════════════════════════════════════════
     KNOWLEDGE CENTER · GPT view
     - Clustered document tree (heads → topics → documents)
     - Multilingual chat with citation chips back to documents
     - Voice (mic) + TTS (speaker) affordances
     ════════════════════════════════════════════════════════════════ */

  /* Clustered corpus — 5 heads × topics × documents.
     Each cluster also carries a tagline (one-line description) and heroClass
     (CSS class controlling the project-card hero gradient + SVG glyph). */
  /* ── Knowledge corpus ──
     4 categories (Policies / Training materials / Notices / Transport).
     Each category holds a flat list of documents; each document carries
     metadata (department, owner, date, languages) surfaced in the drill-down
     document browser. Categories scale to unlimited documents. */
  let KC_CATEGORIES = (window.__KVDATA && window.__KVDATA.knowledgeCategories) || [];

  /* Documents — flat list, each tagged with a category id. */
  let KC_DOCS = (window.__KVDATA && window.__KVDATA.knowledgeDocs) || [];

  function kcDocsInCat(catId) { return KC_DOCS.filter(d => d.cat === catId); }
  function kcDocById(id) { return KC_DOCS.find(d => d.id === id); }
  function kcCatById(id) { return KC_CATEGORIES.find(c => c.id === id); }

  /* Knowledge Center view state */
  const KC_STATE = {
    ttsOn: false,
    recording: false,
    view: 'browse',              /* 'browse' = category tiles + doc browser */
    activeCat: null,             /* selected category id, or null */
    activeDoc: null,             /* selected document id (working context), or null */
    history: [],                 /* chat messages */
  };

  /* Pre-baked sample conversation — illustrates multilingual + voice + citations */
  let KC_SAMPLE = (window.__KVDATA && window.__KVDATA.knowledgeSample) || [];

  /* ── VAANI translation layer (mock) ──
     Each canned-answer TOPIC has a complete native-script translation in every
     supported language. Production routes free text through VAANI (Sarvam
     Mayura + Bulbul v3). Every language returns fully-translated output —
     there is no English fall-through. */
  const KC_TRANSLATIONS = {
    transport: {
      TE: 'కంపెనీ రవాణా జోన్ల వారీగా రూట్లలో నడుస్తుంది. మీ పికప్ పాయింట్, షిఫ్ట్ సమయం కోసం రూట్ మ్యాప్ చూడండి — ఉదయం, జనరల్, లేట్-షిఫ్ట్ బస్సులకు వేర్వేరు షెడ్యూల్‌లు ఉన్నాయి. చివరి లేట్-షిఫ్ట్ డ్రాప్ ప్లాంట్ నుండి 23:15కి బయలుదేరుతుంది. పికప్ పాయింట్‌కి 5 నిమిషాలు ముందుగా చేరుకోండి; బస్సులు షెడ్యూల్ సమయం దాటి వేచి ఉండవు.',
      HI: 'कंपनी परिवहन ज़ोन-वार रूट पर चलता है। अपने पिकअप पॉइंट और शिफ्ट समय के लिए रूट मैप देखें — सुबह, जनरल और लेट-शिफ्ट बसों का अलग-अलग शेड्यूल है। अंतिम लेट-शिफ्ट ड्रॉप प्लांट से 23:15 बजे रवाना होती है। पिकअप पॉइंट पर 5 मिनट पहले पहुँचें; बसें निर्धारित समय से आगे इंतज़ार नहीं करतीं।',
      TA: 'நிறுவனப் போக்குவரத்து மண்டல வாரியான வழித்தடங்களில் இயங்குகிறது. உங்கள் ஏற்றும் இடம் மற்றும் பணிமாற்ற நேரத்திற்கான வழித்தட வரைபடத்தைப் பாருங்கள் — காலை, பொது மற்றும் இரவுப் பணி பேருந்துகளுக்குத் தனித்தனி அட்டவணை உள்ளது. கடைசி இரவுப்பணி பேருந்து ஆலையிலிருந்து 23:15 மணிக்குப் புறப்படுகிறது. ஏற்றும் இடத்தில் 5 நிமிடங்கள் முன்னதாகவே வந்து சேருங்கள்; பேருந்துகள் நிர்ணயிக்கப்பட்ட நேரத்திற்கு மேல் காத்திருக்காது.',
      OR: 'କମ୍ପାନୀ ପରିବହନ ଜୋନ୍-ଅନୁଯାୟୀ ରୁଟ୍‌ରେ ଚାଲେ। ଆପଣଙ୍କ ପିକଅପ୍ ପଏଣ୍ଟ ଓ ସିଫ୍ଟ ସମୟ ପାଇଁ ରୁଟ୍ ମ୍ୟାପ୍ ଦେଖନ୍ତୁ — ସକାଳ, ସାଧାରଣ ଓ ବିଳମ୍ବିତ-ସିଫ୍ଟ ବସ୍‌ର ଅଲଗା ସମୟସୂଚୀ ଅଛି। ଶେଷ ବିଳମ୍ବିତ-ସିଫ୍ଟ ଡ୍ରପ୍ ପ୍ଲାଣ୍ଟରୁ 23:15ରେ ଛାଡେ। ପିକଅପ୍ ପଏଣ୍ଟରେ 5 ମିନିଟ୍ ପୂର୍ବରୁ ପହଞ୍ଚନ୍ତୁ; ବସ୍ ନିର୍ଦ୍ଧାରିତ ସମୟ ପରେ ଅପେକ୍ଷା କରେ ନାହିଁ।',
      BN: 'কোম্পানির পরিবহন জোন-ভিত্তিক রুটে চলে। আপনার পিকআপ পয়েন্ট ও শিফট সময়ের জন্য রুট ম্যাপ দেখুন — সকাল, সাধারণ ও রাত-শিফট বাসের আলাদা সময়সূচি আছে। শেষ রাত-শিফট ড্রপ প্ল্যান্ট থেকে 23:15-এ ছাড়ে। পিকআপ পয়েন্টে 5 মিনিট আগে পৌঁছান; বাস নির্ধারিত সময়ের পরে অপেক্ষা করে না।',
      JP: '会社の送迎バスはゾーン別ルートで運行しています。乗車場所とシフト時刻はルートマップでご確認ください — 朝勤・日勤・夜勤の各バスに個別の時刻表があります。最終の夜勤便は23:15に工場を出発します。乗車場所には5分前に到着してください。バスは定刻を過ぎて待ちません。',
    },
    evac: {
      TE: 'కంప్రెసర్ లైన్ → ఏరియా-A (గేట్ 2 వద్ద). పెయింట్ షాప్ → ఏరియా-C (క్యాంటీన్ వెనుక). వేర్‌హౌస్ → ఏరియా-B. లిఫ్ట్ వాడకండి. అసెంబ్లీ పాయింట్ వద్ద మీ సూపర్‌వైజర్‌కు రిపోర్ట్ చేయండి. తరలింపు డ్రిల్‌లు నెలవారీగా జరుగుతాయి, నోటీసుగా ప్రకటించబడతాయి.',
      HI: 'कंप्रेसर लाइन → एरिया-A (गेट 2 के पास)। पेंट शॉप → एरिया-C (कैंटीन के पीछे)। वेयरहाउस → एरिया-B। लिफ्ट का उपयोग न करें। असेंबली पॉइंट पर अपने सुपरवाइज़र को रिपोर्ट करें। निकासी ड्रिल हर महीने होती है और नोटिस के रूप में लगाई जाती है।',
      TA: 'கம்ப்ரசர் லைன் → பகுதி-A (நுழைவாயில் 2 அருகில்). பெயிண்ட் ஷாப் → பகுதி-C (உணவகத்திற்குப் பின்னால்). கிடங்கு → பகுதி-B. மின் தூக்கியைப் பயன்படுத்த வேண்டாம். ஒன்றுகூடும் இடத்தில் உங்கள் மேற்பார்வையாளரிடம் தெரிவியுங்கள். வெளியேற்றப் பயிற்சிகள் மாதந்தோறும் நடைபெறும், அறிவிப்பாக வெளியிடப்படும்.',
      OR: 'କମ୍ପ୍ରେସର୍ ଲାଇନ୍ → ଏରିଆ-A (ଗେଟ୍ 2 ନିକଟରେ)। ପେଣ୍ଟ ସପ୍ → ଏରିଆ-C (କ୍ୟାଣ୍ଟିନ୍ ପଛରେ)। ୱେୟାରହାଉସ୍ → ଏରିଆ-B। ଲିଫ୍ଟ ବ୍ୟବହାର କରନ୍ତୁ ନାହିଁ। ଆସେମ୍ବଲି ପଏଣ୍ଟରେ ଆପଣଙ୍କ ସୁପରଭାଇଜରଙ୍କୁ ରିପୋର୍ଟ କରନ୍ତୁ। ନିଷ୍କାସନ ଡ୍ରିଲ୍ ମାସିକ ଅନୁଷ୍ଠିତ ହୁଏ ଓ ନୋଟିସ୍ ଭାବେ ପ୍ରକାଶିତ ହୁଏ।',
      BN: 'কম্প্রেসর লাইন → এরিয়া-A (গেট 2-এর কাছে)। পেইন্ট শপ → এরিয়া-C (ক্যান্টিনের পিছনে)। ওয়্যারহাউস → এরিয়া-B। লিফট ব্যবহার করবেন না। অ্যাসেম্বলি পয়েন্টে আপনার সুপারভাইজারকে জানান। সরিয়ে নেওয়ার মহড়া প্রতি মাসে হয় এবং নোটিশ হিসেবে জারি করা হয়।',
      JP: 'コンプレッサーライン → エリアA(ゲート2付近)。塗装工場 → エリアC(食堂裏)。倉庫 → エリアB。エレベーターは使用しないでください。集合場所で監督者に報告してください。避難訓練は毎月実施され、通知として掲示されます。',
    },
    ppe: {
      TE: 'రోల్ మ్యాట్రిక్స్ ప్రకారం: కంప్రెసర్ లైన్ — క్లాస్-B హెల్మెట్, స్టీల్-టో షూస్, కట్-రెసిస్టెంట్ గ్లోవ్స్; పెయింట్ షాప్ — కెమికల్-రెసిస్టెంట్ గ్లోవ్స్, రెస్పిరేటర్; వేర్‌హౌస్ — హై-విజ్ వెస్ట్, స్టీల్-టో షూస్. అనుకోకుండా ప్రారంభమయ్యే పరికరాలను సర్వీస్ చేసేటప్పుడు లాకౌట్/ట్యాగౌట్ వర్తిస్తుంది — 6-దశల విధానాన్ని అనుసరించండి.',
      HI: 'रोल मैट्रिक्स के अनुसार: कंप्रेसर लाइन — क्लास-B हेलमेट, स्टील-टो जूते, कट-रेसिस्टेंट दस्ताने; पेंट शॉप — केमिकल-रेसिस्टेंट दस्ताने और रेस्पिरेटर; वेयरहाउस — हाई-विज़ वेस्ट और स्टील-टो जूते। जब आप ऐसे उपकरण की सर्विस करते हैं जो अचानक चालू हो सकता है, तब लॉकआउट/टैगआउट लागू होता है — 6-चरण प्रक्रिया का पालन करें।',
      TA: 'பணிப் பட்டியலின்படி: கம்ப்ரசர் லைன் — வகுப்பு-B தலைக்கவசம், எஃகு-முனை காலணிகள், வெட்டு-எதிர்ப்புக் கையுறைகள்; பெயிண்ட் ஷாப் — இரசாயன-எதிர்ப்புக் கையுறைகள், சுவாசக் கருவி; கிடங்கு — அதிக-தெரிவுநிலை மேலங்கி, எஃகு-முனை காலணிகள். எதிர்பாராதவிதமாக இயங்கக்கூடிய உபகரணத்தைப் பராமரிக்கும்போது லாக்அவுட்/டேக்அவுட் பொருந்தும் — 6-படி நடைமுறையைப் பின்பற்றுங்கள்.',
      OR: 'ରୋଲ୍ ମ୍ୟାଟ୍ରିକ୍ସ ଅନୁଯାୟୀ: କମ୍ପ୍ରେସର୍ ଲାଇନ୍ — କ୍ଲାସ୍-B ହେଲମେଟ୍, ଷ୍ଟିଲ୍-ଟୋ ଜୋତା, କଟ୍-ରେସିଷ୍ଟାଣ୍ଟ ଗ୍ଲୋଭ୍ସ; ପେଣ୍ଟ ସପ୍ — କେମିକାଲ୍-ରେସିଷ୍ଟାଣ୍ଟ ଗ୍ଲୋଭ୍ସ ଓ ରେସ୍ପିରେଟର୍; ୱେୟାରହାଉସ୍ — ହାଇ-ଭିଜ୍ ଭେଷ୍ଟ ଓ ଷ୍ଟିଲ୍-ଟୋ ଜୋତା। ଅପ୍ରତ୍ୟାଶିତ ଭାବେ ଚାଲୁ ହୋଇପାରୁଥିବା ଉପକରଣ ସର୍ଭିସ୍ କଲାବେଳେ ଲକଆଉଟ୍/ଟ୍ୟାଗଆଉଟ୍ ପ୍ରଯୁଜ୍ୟ — 6-ପର୍ଯ୍ୟାୟ ପ୍ରକ୍ରିୟା ଅନୁସରଣ କରନ୍ତୁ।',
      BN: 'রোল ম্যাট্রিক্স অনুযায়ী: কম্প্রেসর লাইন — ক্লাস-B হেলমেট, স্টিল-টো জুতা, কাট-রেসিস্ট্যান্ট গ্লাভস; পেইন্ট শপ — কেমিক্যাল-রেসিস্ট্যান্ট গ্লাভস ও রেসপিরেটর; ওয়্যারহাউস — হাই-ভিজ ভেস্ট ও স্টিল-টো জুতা। অপ্রত্যাশিতভাবে চালু হতে পারে এমন যন্ত্র সার্ভিস করার সময় লকআউট/ট্যাগআউট প্রযোজ্য — 6-ধাপের পদ্ধতি অনুসরণ করুন।',
      JP: '職務マトリクスに従って:コンプレッサーライン — クラスBヘルメット、安全靴、耐切創手袋。塗装工場 — 耐薬品手袋および呼吸用保護具。倉庫 — 高視認性ベストおよび安全靴。予期せず起動しうる設備を整備する際はロックアウト/タグアウトが適用されます — 6ステップ手順に従ってください。',
    },
    wages: {
      TE: '2026 సంవత్సరానికి AP కనీస వేతనాలు: నైపుణ్యం లేనివారు ₹13,210/నెల · సెమీ-స్కిల్డ్ ₹14,260/నెల · స్కిల్డ్ ₹15,860/నెల · అత్యంత నైపుణ్యం ₹17,290/నెల. వీటిలో VDA కలిసి ఉంది. తాజా సవరణ నోటీసు నోటీసుల విభాగంలో ఉంది.',
      HI: '2026 के लिए AP न्यूनतम वेतन: अकुशल ₹13,210/माह · अर्ध-कुशल ₹14,260/माह · कुशल ₹15,860/माह · अति-कुशल ₹17,290/माह। इनमें VDA शामिल है। नवीनतम संशोधन नोटिस, नोटिस अनुभाग में लगा है।',
      TA: '2026-க்கான AP குறைந்தபட்ச ஊதியம்: திறனற்றோர் ₹13,210/மாதம் · அரை-திறனாளர் ₹14,260/மாதம் · திறனாளர் ₹15,860/மாதம் · உயர்-திறனாளர் ₹17,290/மாதம். இவற்றில் VDA அடங்கும். சமீபத்திய திருத்த அறிவிப்பு அறிவிப்புகள் பகுதியில் வெளியிடப்பட்டுள்ளது.',
      OR: '2026 ପାଇଁ AP ସର୍ବନିମ୍ନ ମଜୁରି: ଅଦକ୍ଷ ₹13,210/ମାସ · ଅର୍ଦ୍ଧ-ଦକ୍ଷ ₹14,260/ମାସ · ଦକ୍ଷ ₹15,860/ମାସ · ଅତି-ଦକ୍ଷ ₹17,290/ମାସ। ଏଥିରେ VDA ଅନ୍ତର୍ଭୁକ୍ତ। ସର୍ବଶେଷ ସଂଶୋଧନ ନୋଟିସ୍ ନୋଟିସ୍ ବିଭାଗରେ ଅଛି।',
      BN: '2026 সালের জন্য AP ন্যূনতম মজুরি: অদক্ষ ₹13,210/মাস · আধা-দক্ষ ₹14,260/মাস · দক্ষ ₹15,860/মাস · অতি-দক্ষ ₹17,290/মাস। এতে VDA অন্তর্ভুক্ত। সর্বশেষ সংশোধন নোটিশ নোটিশ বিভাগে রয়েছে।',
      JP: '2026年のAP州最低賃金:未熟練 月₹13,210 · 半熟練 月₹14,260 · 熟練 月₹15,860 · 高度熟練 月₹17,290。これらにはVDAが含まれます。最新の改定通知は通知欄に掲示されています。',
    },
    leave: {
      TE: 'నిర్ధారిత డైరెక్ట్ ఉద్యోగులకు సెలవు అర్హత: సంవత్సరానికి 21 వార్షిక + 12 క్యాజువల్ + 12 సిక్ సెలవులు. 2026 సెలవుల జాబితా నోటీసుల విభాగంలో ఉంది. ప్లాంట్ వాణి మొబైల్ యాప్ లేదా బయోమెట్రిక్ ద్వారా హాజరు నమోదు చేయండి; ఆమోదం మీ సూపర్‌వైజర్ ద్వారా జరుగుతుంది.',
      HI: 'पुष्ट प्रत्यक्ष कर्मचारियों के लिए छुट्टी पात्रता: प्रति वर्ष 21 वार्षिक + 12 आकस्मिक + 12 बीमारी अवकाश। 2026 की छुट्टियों की सूची नोटिस अनुभाग में लगी है। प्लांट वाणी मोबाइल ऐप या बायोमेट्रिक से उपस्थिति दर्ज करें; अनुमोदन आपके सुपरवाइज़र के माध्यम से होता है।',
      TA: 'உறுதிசெய்யப்பட்ட நேரடி ஊழியர்களுக்கான விடுப்பு உரிமை: ஆண்டுக்கு 21 வருடாந்திர + 12 சாதாரண + 12 உடல்நலக் குறைவு விடுப்புகள். 2026 விடுமுறை பட்டியல் அறிவிப்புகள் பகுதியில் உள்ளது. Karya Vaani மொபைல் செயலி அல்லது பயோமெட்ரிக் மூலம் வருகையைப் பதிவு செய்யுங்கள்; ஒப்புதல் உங்கள் மேற்பார்வையாளர் வழியாக வழங்கப்படும்.',
      OR: 'ନିଶ୍ଚିତ ପ୍ରତ୍ୟକ୍ଷ କର୍ମଚାରୀଙ୍କ ପାଇଁ ଛୁଟି ଯୋଗ୍ୟତା: ବର୍ଷକୁ 21 ବାର୍ଷିକ + 12 କ୍ୟାଜୁଆଲ୍ + 12 ଅସୁସ୍ଥତା ଛୁଟି। 2026 ଛୁଟି ତାଲିକା ନୋଟିସ୍ ବିଭାଗରେ ଅଛି। Karya Vaani ମୋବାଇଲ୍ ଆପ୍ କିମ୍ବା ବାୟୋମେଟ୍ରିକ୍ ଦ୍ୱାରା ଉପସ୍ଥିତି ଚିହ୍ନଟ କରନ୍ତୁ; ଅନୁମୋଦନ ଆପଣଙ୍କ ସୁପରଭାଇଜରଙ୍କ ମାଧ୍ୟମରେ ହୁଏ।',
      BN: 'নিশ্চিত প্রত্যক্ষ কর্মীদের জন্য ছুটির অধিকার: বছরে 21 বার্ষিক + 12 নৈমিত্তিক + 12 অসুস্থতা ছুটি। 2026 সালের ছুটির তালিকা নোটিশ বিভাগে রয়েছে। Karya Vaani মোবাইল অ্যাপ বা বায়োমেট্রিক দিয়ে উপস্থিতি চিহ্নিত করুন; অনুমোদন আপনার সুপারভাইজারের মাধ্যমে হয়।',
      JP: '正規の直接雇用者の休暇付与:年間 年次21日＋臨時12日＋病気12日。2026年の休日一覧は通知欄に掲示されています。出勤はKarya Vaaniモバイルアプリまたは生体認証で記録してください。承認は監督者を通じて行われます。',
    },
    grievance: {
      TE: 'ఫిర్యాదులను ప్లాంట్ వాణి యాప్ ద్వారా (అనామక ఛానెల్ అందుబాటులో ఉంది), మీ సూపర్‌వైజర్‌కు లేదా ప్లాంట్ HRకు సమర్పించండి. కార్యాలయ వేధింపుల కోసం, PoSH కింద అంతర్గత కమిటీ ఫిర్యాదులను స్వీకరిస్తుంది — గోప్యత చట్టబద్ధంగా రక్షించబడుతుంది.',
      HI: 'शिकायतें प्लांट वाणी ऐप के माध्यम से (गुमनाम चैनल उपलब्ध है), अपने सुपरवाइज़र को या प्लांट HR को दर्ज करें। कार्यस्थल उत्पीड़न के लिए, PoSH के तहत आंतरिक समिति शिकायतें प्राप्त करती है — गोपनीयता वैधानिक रूप से संरक्षित है।',
      TA: 'புகார்களை Karya Vaani செயலி வழியாக (அநாமதேயத் தடம் கிடைக்கும்), உங்கள் மேற்பார்வையாளரிடம் அல்லது ஆலை HR-இடம் சமர்ப்பியுங்கள். பணியிடத் துன்புறுத்தலுக்கு, PoSH-இன் கீழ் உள்ள உள் குழு புகார்களைப் பெறுகிறது — ரகசியத்தன்மை சட்டப்படிப் பாதுகாக்கப்படுகிறது.',
      OR: 'ଅଭିଯୋଗ Karya Vaani ଆପ୍ ମାଧ୍ୟମରେ (ଅନାମିକ ଚ୍ୟାନେଲ୍ ଉପଲବ୍ଧ), ଆପଣଙ୍କ ସୁପରଭାଇଜର କିମ୍ବା ପ୍ଲାଣ୍ଟ HRକୁ ଦାଖଲ କରନ୍ତୁ। କର୍ମକ୍ଷେତ୍ର ହଇରାଣ ପାଇଁ, PoSH ଅଧୀନରେ ଆଭ୍ୟନ୍ତରୀଣ କମିଟି ଅଭିଯୋଗ ଗ୍ରହଣ କରେ — ଗୋପନୀୟତା ଆଇନଗତ ଭାବେ ସୁରକ୍ଷିତ।',
      BN: 'অভিযোগ Karya Vaani অ্যাপের মাধ্যমে (বেনামী চ্যানেল উপলব্ধ), আপনার সুপারভাইজার বা প্ল্যান্ট HR-এর কাছে জমা দিন। কর্মস্থলে হয়রানির জন্য, PoSH-এর অধীনে অভ্যন্তরীণ কমিটি অভিযোগ গ্রহণ করে — গোপনীয়তা আইনত সুরক্ষিত।',
      JP: '苦情はKarya Vaaniアプリ(匿名チャネル利用可)、監督者、または工場の人事部に提出してください。職場でのハラスメントについては、PoSHに基づく内部委員会が苦情を受け付けます — 機密保持は法的に保護されています。',
    },
    conduct: {
      TE: 'ప్రవర్తనా నియమావళి (v2026.04), IESO 1946 కింద స్టాండింగ్ ఆర్డర్‌లు కార్యాలయ ప్రవర్తన, పని గంటలు, సెలవు విధానం, క్రమశిక్షణా ప్రక్రియను నియంత్రిస్తాయి. రెండూ పాలసీల విభాగంలో ఉన్నాయి, మీ భాషలో అందుబాటులో ఉన్నాయి.',
      HI: 'आचार संहिता (v2026.04) और IESO 1946 के तहत स्थायी आदेश कार्यस्थल व्यवहार, कार्य घंटे, अवकाश प्रक्रिया और अनुशासनात्मक प्रक्रिया को नियंत्रित करते हैं। दोनों नीति अनुभाग में हैं और आपकी भाषा में उपलब्ध हैं।',
      TA: 'நடத்தை விதிமுறை (v2026.04) மற்றும் IESO 1946-இன் கீழ் நிலையான ஆணைகள் பணியிட நடத்தை, பணி நேரம், விடுப்பு நடைமுறை மற்றும் ஒழுங்கு நடவடிக்கையை நிர்வகிக்கின்றன. இரண்டும் கொள்கைகள் பகுதியில் உள்ளன, உங்கள் மொழியில் கிடைக்கின்றன.',
      OR: 'ଆଚରଣ ସଂହିତା (v2026.04) ଓ IESO 1946 ଅଧୀନରେ ସ୍ଥାୟୀ ଆଦେଶ କର୍ମକ୍ଷେତ୍ର ଆଚରଣ, କାର୍ଯ୍ୟ ଘଣ୍ଟା, ଛୁଟି ପ୍ରକ୍ରିୟା ଓ ଶୃଙ୍ଖଳା ପ୍ରକ୍ରିୟାକୁ ନିୟନ୍ତ୍ରଣ କରେ। ଉଭୟ ନୀତି ବିଭାଗରେ ଅଛି ଓ ଆପଣଙ୍କ ଭାଷାରେ ଉପଲବ୍ଧ।',
      BN: 'আচরণবিধি (v2026.04) এবং IESO 1946-এর অধীনে স্থায়ী আদেশ কর্মস্থলের আচরণ, কর্মঘণ্টা, ছুটির পদ্ধতি ও শৃঙ্খলা প্রক্রিয়া নিয়ন্ত্রণ করে। উভয়ই নীতি বিভাগে রয়েছে এবং আপনার ভাষায় উপলব্ধ।',
      JP: '行動規範(v2026.04)およびIESO 1946に基づく就業規則は、職場での行動、労働時間、休暇手続き、懲戒手続きを定めています。両方ともポリシー欄にあり、各言語で利用できます。',
    },
    induction: {
      TE: 'ఇండక్షన్ చిన్న మాడ్యూల్‌లుగా అందించబడుతుంది — సాధారణ ప్లాంట్ ఇండక్షన్, రోల్-నిర్దిష్ట భద్రత. ప్రతి మాడ్యూల్ చివర చిన్న క్విజ్ ఉంటుంది; అన్ని తప్పనిసరి మాడ్యూల్‌లు పాస్ అయితే ఎవిడెన్స్-గ్రేడ్ సర్టిఫికేట్ లభిస్తుంది. వలస కార్మికులకు ప్రత్యేక ISMW వెల్‌కమ్ మాడ్యూల్ కూడా ఉంటుంది.',
      HI: 'इंडक्शन छोटे मॉड्यूल के रूप में दिया जाता है — सामान्य प्लांट इंडक्शन और भूमिका-विशिष्ट सुरक्षा। हर मॉड्यूल के अंत में एक छोटी क्विज़ होती है; सभी अनिवार्य मॉड्यूल पास करने पर साक्ष्य-स्तरीय प्रमाणपत्र मिलता है। प्रवासी श्रमिकों के लिए एक समर्पित ISMW स्वागत मॉड्यूल भी है।',
      TA: 'பணியறிமுகம் சிறு தொகுதிகளாக வழங்கப்படுகிறது — பொது ஆலை அறிமுகம் மற்றும் பணி-சார்ந்த பாதுகாப்பு. ஒவ்வொரு தொகுதியின் முடிவிலும் ஒரு சிறு வினாடி வினா உள்ளது; அனைத்து கட்டாயத் தொகுதிகளிலும் தேர்ச்சி பெற்றால் சான்று-தரச் சான்றிதழ் கிடைக்கும். புலம்பெயர் தொழிலாளர்களுக்குத் தனி ISMW வரவேற்புத் தொகுதியும் உண்டு.',
      OR: 'ଇଣ୍ଡକ୍ସନ୍ ଛୋଟ ମଡ୍ୟୁଲ୍ ଆକାରରେ ଦିଆଯାଏ — ସାଧାରଣ ପ୍ଲାଣ୍ଟ ଇଣ୍ଡକ୍ସନ୍ ଓ ଭୂମିକା-ନିର୍ଦ୍ଦିଷ୍ଟ ସୁରକ୍ଷା। ପ୍ରତ୍ୟେକ ମଡ୍ୟୁଲ୍ ଶେଷରେ ଗୋଟିଏ ଛୋଟ କୁଇଜ୍ ଥାଏ; ସମସ୍ତ ବାଧ୍ୟତାମୂଳକ ମଡ୍ୟୁଲ୍ ପାସ୍ କଲେ ପ୍ରମାଣ-ସ୍ତରୀୟ ସାର୍ଟିଫିକେଟ୍ ମିଳେ। ପ୍ରବାସୀ ଶ୍ରମିକଙ୍କ ପାଇଁ ଏକ ସ୍ୱତନ୍ତ୍ର ISMW ସ୍ୱାଗତ ମଡ୍ୟୁଲ୍ ମଧ୍ୟ ଅଛି।',
      BN: 'ইনডাকশন ছোট মডিউল আকারে দেওয়া হয় — সাধারণ প্ল্যান্ট ইনডাকশন ও ভূমিকা-নির্দিষ্ট নিরাপত্তা। প্রতিটি মডিউলের শেষে একটি ছোট কুইজ থাকে; সব বাধ্যতামূলক মডিউল পাস করলে প্রমাণ-মানের সার্টিফিকেট পাওয়া যায়। অভিবাসী শ্রমিকদের জন্য একটি ডেডিকেটেড ISMW স্বাগত মডিউলও আছে।',
      JP: '入職研修は短いモジュール形式で提供されます — 一般工場研修と職務別安全研修。各モジュールの最後に小テストがあり、必須モジュールすべてに合格すると証跡レベルの修了証が得られます。移住労働者には専用のISMW歓迎モジュールもあります。',
    },
    contractor: {
      TE: 'కాంట్రాక్ట్ కార్మికులకు చట్టబద్ధ కనీస వేతనం కంటే ఎక్కువ వేతనం, కాంట్రాక్టర్ ద్వారా ESIC + PF నమోదు, లిఖిత నియామక లేఖ, గుర్తింపు కార్డు, సమాన సౌకర్యాలు పొందే హక్కు ఉంది. CLRA చట్టం కింద సమ్మతికి ప్రధాన యజమాని సంయుక్తంగా బాధ్యత వహిస్తారు.',
      HI: 'अनुबंध श्रमिकों को वैधानिक न्यूनतम से अधिक वेतन, ठेकेदार द्वारा ESIC + PF नामांकन, लिखित नियुक्ति पत्र, पहचान पत्र और समान सुविधाएँ पाने का अधिकार है। CLRA अधिनियम के तहत अनुपालन के लिए मुख्य नियोक्ता संयुक्त रूप से ज़िम्मेदार है।',
      TA: 'ஒப்பந்தத் தொழிலாளர்களுக்குச் சட்டப்பூர்வ குறைந்தபட்சத்திற்கு மேல் ஊதியம், ஒப்பந்ததாரர் மூலம் ESIC + PF பதிவு, எழுத்துப்பூர்வ நியமனக் கடிதம், அடையாள அட்டை, சம வசதிகள் பெற உரிமை உண்டு. CLRA சட்டத்தின் கீழ் இணக்கத்திற்கு முதன்மை முதலாளி கூட்டாகப் பொறுப்பாவார்.',
      OR: 'ଚୁକ୍ତିଭିତ୍ତିକ ଶ୍ରମିକଙ୍କୁ ଆଇନଗତ ସର୍ବନିମ୍ନଠାରୁ ଅଧିକ ମଜୁରି, ଠିକାଦାରଙ୍କ ଦ୍ୱାରା ESIC + PF ପଞ୍ଜୀକରଣ, ଲିଖିତ ନିଯୁକ୍ତି ପତ୍ର, ପରିଚୟ ପତ୍ର, ସମାନ ସୁବିଧା ପାଇବାର ଅଧିକାର ଅଛି। CLRA ଆଇନ ଅଧୀନରେ ଅନୁପାଳନ ପାଇଁ ମୁଖ୍ୟ ନିଯୁକ୍ତିଦାତା ମିଳିତ ଭାବେ ଦାୟୀ।',
      BN: 'চুক্তিভিত্তিক শ্রমিকদের আইনি ন্যূনতমের বেশি মজুরি, ঠিকাদারের মাধ্যমে ESIC + PF নথিভুক্তি, লিখিত নিয়োগপত্র, পরিচয়পত্র, সমান সুবিধা পাওয়ার অধিকার আছে। CLRA আইনের অধীনে সম্মতির জন্য প্রধান নিয়োগকর্তা যৌথভাবে দায়ী।',
      JP: '請負労働者には、法定最低賃金以上の賃金、請負業者によるESIC・PF登録、書面による雇用通知書、身分証明書、同等の施設を受ける権利があります。CLRA法に基づくコンプライアンスについては、元請使用者が連帯して責任を負います。',
    },
  };

  /* Topic-keyed translation. Every supported language returns a complete
     native-script translation; generic/doc-context answers get a complete
     native rendering too — no English fall-through anywhere. */
  function kcTranslateText(answerText, code, topic) {
    if (code === 'EN' || !answerText) return answerText;
    if (topic && KC_TRANSLATIONS[topic] && KC_TRANSLATIONS[topic][code]) {
      return KC_TRANSLATIONS[topic][code];
    }
    const generic = {
      TE: 'ఈ సమాధానం VAANI ద్వారా తెలుగులోకి అనువదించబడింది. వర్కర్‌లకు పంపిణీ చేయడానికి దీన్ని నిల్వ చేయవచ్చు, డౌన్‌లోడ్ చేయవచ్చు లేదా షేర్ చేయవచ్చు. మరింత ఖచ్చితమైన సమాధానం కోసం, పైన ఒక వర్గాన్ని తెరిచి సంబంధిత పత్రాన్ని ఎంచుకోండి.',
      HI: 'यह उत्तर VAANI द्वारा हिन्दी में अनुवादित किया गया है। श्रमिकों को वितरण के लिए इसे संग्रहीत, डाउनलोड या साझा किया जा सकता है। अधिक सटीक उत्तर के लिए, ऊपर एक श्रेणी खोलें और संबंधित दस्तावेज़ चुनें।',
      TA: 'இந்தப் பதில் VAANI மூலம் தமிழில் மொழிபெயர்க்கப்பட்டது. தொழிலாளர்களுக்கு வழங்க இதைச் சேமிக்கலாம், பதிவிறக்கலாம் அல்லது பகிரலாம். மேலும் துல்லியமான பதிலுக்கு, மேலே ஒரு வகையைத் திறந்து தொடர்புடைய ஆவணத்தைத் தேர்ந்தெடுக்கவும்.',
      OR: 'ଏହି ଉତ୍ତର VAANI ଦ୍ୱାରା ଓଡ଼ିଆରେ ଅନୁବାଦ କରାଯାଇଛି। ଶ୍ରମିକଙ୍କୁ ବଣ୍ଟନ ପାଇଁ ଏହାକୁ ସଂରକ୍ଷଣ, ଡାଉନଲୋଡ୍ କିମ୍ବା ସେୟାର୍ କରାଯାଇପାରେ। ଅଧିକ ସଠିକ୍ ଉତ୍ତର ପାଇଁ, ଉପରେ ଏକ ବର୍ଗ ଖୋଲି ସମ୍ବନ୍ଧିତ ଡକ୍ୟୁମେଣ୍ଟ ବାଛନ୍ତୁ।',
      BN: 'এই উত্তরটি VAANI দ্বারা বাংলায় অনুবাদ করা হয়েছে। শ্রমিকদের বিতরণের জন্য এটি সংরক্ষণ, ডাউনলোড বা শেয়ার করা যেতে পারে। আরও সঠিক উত্তরের জন্য, উপরে একটি বিভাগ খুলে সংশ্লিষ্ট নথি নির্বাচন করুন।',
      JP: 'この回答はVAANIによって日本語に翻訳されました。労働者への配布のために保存・ダウンロード・共有できます。より正確な回答については、上部のカテゴリを開いて関連文書を選択してください。',
    };
    return generic[code] || answerText;
  }

  /* ── compact category glyphs (small inline SVG) ── */
  function kcCatGlyph(glyph) {
    const c = 'currentColor';
    switch (glyph) {
      case 'statutory':
        return '<svg viewBox="0 0 40 40" fill="none" stroke="'+c+'" stroke-width="1.8" aria-hidden="true">'+
               '<path d="M8 14 L20 8 L32 14"/><line x1="8" y1="14" x2="32" y2="14"/>'+
               '<line x1="13" y1="16" x2="13" y2="28"/><line x1="20" y1="16" x2="20" y2="28"/><line x1="27" y1="16" x2="27" y2="28"/>'+
               '<line x1="9" y1="30" x2="31" y2="30"/></svg>';
      case 'training':
        return '<svg viewBox="0 0 40 40" fill="none" stroke="'+c+'" stroke-width="1.8" aria-hidden="true">'+
               '<path d="M6 16 L20 10 L34 16 L20 22 Z"/><path d="M12 19 L12 27 C 12 30 16 32 20 32 C 24 32 28 30 28 27 L28 19"/>'+
               '<line x1="34" y1="16" x2="34" y2="24"/></svg>';
      case 'notices':
        return '<svg viewBox="0 0 40 40" fill="none" stroke="'+c+'" stroke-width="1.8" aria-hidden="true">'+
               '<rect x="11" y="9" width="18" height="24" rx="2"/><line x1="15" y1="16" x2="25" y2="16"/>'+
               '<line x1="15" y1="21" x2="25" y2="21"/><line x1="15" y1="26" x2="21" y2="26"/>'+
               '<circle cx="20" cy="9" r="2.4" fill="'+c+'"/></svg>';
      case 'transport':
        return '<svg viewBox="0 0 40 40" fill="none" stroke="'+c+'" stroke-width="1.8" aria-hidden="true">'+
               '<rect x="9" y="11" width="22" height="16" rx="3"/><line x1="9" y1="18" x2="31" y2="18"/>'+
               '<circle cx="14" cy="30" r="2.6"/><circle cx="26" cy="30" r="2.6"/></svg>';
      default: return '';
    }
  }

  /* ── render the 4 compact category tiles ── */
  function kcRenderCategories() {
    const host = document.getElementById('kc-cats');
    if (!host) return;
    let html = '';
    KC_CATEGORIES.forEach(cat => {
      const n = kcDocsInCat(cat.id).length;
      const isActive = KC_STATE.activeCat === cat.id;
      html += '<button class="kc-cat' + (isActive ? ' active' : '') + '" ' +
              'style="--cat-accent:' + cat.accent + '" ' +
              'onclick="kcSelectCategory(\'' + cat.id + '\')">' +
              '  <span class="kc-cat-ico">' + kcCatGlyph(cat.glyph) + '</span>' +
              '  <span class="kc-cat-text">' +
              '    <span class="kc-cat-name">' + cat.head + '</span>' +
              '    <span class="kc-cat-count">' + n + ' documents</span>' +
              '  </span>' +
              '</button>';
    });
    host.innerHTML = html;
  }

  /* ── document browser for the selected category ── */
  let KC_DOC_SORT = 'created';   /* 'created' | 'title' | 'dept' */

  function kcSelectCategory(catId) {
    KC_STATE.activeCat = (KC_STATE.activeCat === catId) ? null : catId;
    kcRenderCategories();
    kcRenderDocBrowser();
  }

  function kcRenderDocBrowser() {
    const host = document.getElementById('kc-doc-browser');
    if (!host) return;
    if (!KC_STATE.activeCat) {
      host.style.display = 'none';
      host.innerHTML = '';
      return;
    }
    host.style.display = 'block';
    const cat = kcCatById(KC_STATE.activeCat);
    let docs = kcDocsInCat(cat.id).slice();
    /* sort */
    docs.sort((a, b) => {
      if (KC_DOC_SORT === 'title')   return a.title.localeCompare(b.title);
      if (KC_DOC_SORT === 'dept')    return a.dept.localeCompare(b.dept) || a.title.localeCompare(b.title);
      return b.created.localeCompare(a.created); /* newest first */
    });
    /* search */
    const q = (document.getElementById('kc-doc-search') || {}).value || '';
    const qq = q.trim().toLowerCase();
    if (qq) docs = docs.filter(d => (d.title + ' ' + d.dept + ' ' + d.owner + ' ' + d.topic).toLowerCase().includes(qq));

    let cards = '';
    docs.forEach(d => {
      const isActive = KC_STATE.activeDoc === d.id;
      const ext = (d.ext || '').toUpperCase();
      const icon = d.ext === 'mp4' ? '▶' : d.ext === 'xls' ? '▦' : '◯';
      const langChips = d.langs.map(l => '<span class="kc-doc-lang">' + l + '</span>').join('');
      cards += '<div class="kc-doc-card' + (isActive ? ' active' : '') + '" onclick="kcSelectDoc(\'' + d.id + '\')">' +
               '  <div class="kc-doc-card-top">' +
               '    <span class="kc-doc-card-ico">' + icon + '</span>' +
               '    <span class="kc-doc-card-title">' + d.title + '</span>' +
               '    <span class="kc-doc-card-ext">' + ext + '</span>' +
               '  </div>' +
               '  <div class="kc-doc-meta-grid">' +
               '    <span class="kc-dm"><span class="kc-dm-k">Dept</span>' + d.dept + '</span>' +
               '    <span class="kc-dm"><span class="kc-dm-k">Owner</span>' + d.owner + '</span>' +
               '    <span class="kc-dm"><span class="kc-dm-k">Created</span>' + kcFmtDate(d.created) + '</span>' +
               '    <span class="kc-dm"><span class="kc-dm-k">Topic</span>' + d.topic + '</span>' +
               '  </div>' +
               '  <div class="kc-doc-card-foot">' +
               '    <span class="kc-doc-langs">' + langChips + '</span>' +
               '    <span class="kc-doc-card-cta">' + (isActive ? '✓ in chat' : 'Use & ask →') + '</span>' +
               '  </div>' +
               '</div>';
    });
    if (docs.length === 0) {
      cards = '<div class="muted tiny" style="padding:20px;text-align:center">No documents match <span class="mono">"' + q + '"</span> in ' + cat.head + '.</div>';
    }

    host.innerHTML =
      '<div class="kc-browser-h">' +
      '  <div>' +
      '    <div class="kc-browser-title">' + cat.head + '</div>' +
      '    <div class="kc-browser-sub">' + kcDocsInCat(cat.id).length + ' documents · select one to load it into the chat, then prompt and expand on it</div>' +
      '  </div>' +
      '  <div class="kc-browser-tools">' +
      '    <div class="kc-doc-search-wrap"><input type="text" id="kc-doc-search" placeholder="Search title, department, owner…" oninput="kcRenderDocBrowser()" autocomplete="off"></div>' +
      '    <select class="kc-doc-sort" onchange="kcSetDocSort(this.value)">' +
      '      <option value="created"' + (KC_DOC_SORT==='created'?' selected':'') + '>Newest first</option>' +
      '      <option value="title"'   + (KC_DOC_SORT==='title'?' selected':'')   + '>Title A–Z</option>' +
      '      <option value="dept"'    + (KC_DOC_SORT==='dept'?' selected':'')    + '>Department</option>' +
      '    </select>' +
      '    <button class="kc-browser-close" onclick="kcSelectCategory(\'' + cat.id + '\')" title="Close">Close ✕</button>' +
      '  </div>' +
      '</div>' +
      '<div class="kc-doc-grid">' + cards + '</div>';

    /* preserve search value after re-render */
    const si = document.getElementById('kc-doc-search');
    if (si && q) { si.value = q; si.focus(); si.setSelectionRange(q.length, q.length); }
  }

  function kcSetDocSort(v) { KC_DOC_SORT = v; kcRenderDocBrowser(); }

  function kcFmtDate(iso) {
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const p = (iso || '').split('-');
    if (p.length !== 3) return iso;
    return parseInt(p[2], 10) + ' ' + months[parseInt(p[1], 10) - 1] + ' ' + p[0];
  }

  /* select a document → it becomes the working context for the chat */
  function kcSelectDoc(docId) {
    const d = kcDocById(docId);
    if (!d) return;
    if (KC_STATE.activeDoc === docId) {
      /* deselect */
      KC_STATE.activeDoc = null;
      KC_STATE.history = [];
    } else {
      KC_STATE.activeDoc = docId;
      KC_STATE.history = [{
        who: 'assistant', lang: 'EN', topic: 'doccontext',
        native: 'You are now working with <strong>' + d.title + '</strong> ' +
                '(' + d.dept + ' · ' + d.owner + ' · created ' + kcFmtDate(d.created) + '). ' +
                'Ask anything about it — summarise it, pull a specific clause, or draft a worker-facing note. ' +
                'Every answer can be translated for worker distribution.',
        answerText: 'You are working with ' + d.title + '. Ask anything about it.',
        cites: [{ docId: d.id, label: d.title }],
        translations: [],
      }];
    }
    kcRenderDocBrowser();
    kcRenderContextBar();
    kcRenderChat();
    kcRenderSuggestions();
    if (KC_STATE.activeDoc) {
      setTimeout(() => {
        const chat = document.querySelector('.kc-chat');
        if (chat) chat.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
      toast('Loaded "' + d.title + '" into the chat', 'green');
    }
  }

  /* context bar above the input — shows the working document */
  function kcRenderContextBar() {
    const host = document.getElementById('kc-context');
    if (!host) return;
    if (!KC_STATE.activeDoc) { host.innerHTML = ''; host.style.display = 'none'; return; }
    const d = kcDocById(KC_STATE.activeDoc);
    if (!d) { host.innerHTML = ''; host.style.display = 'none'; return; }
    host.style.display = 'flex';
    host.innerHTML =
      '<span class="kc-ctx-k">Working with</span>' +
      '<span class="kc-ctx-doc">' + (d.ext === 'mp4' ? '▶ ' : d.ext === 'xls' ? '▦ ' : '◯ ') + d.title + '</span>' +
      '<span class="muted tiny">' + d.dept + ' · ' + d.owner + '</span>' +
      '<span class="kc-ctx-clear" onclick="kcSelectDoc(\'' + d.id + '\')" title="Remove from chat">✕</span>';
  }

  function kcStartersForCurrent() {
    if (KC_STATE.activeDoc) {
      return ['Summarise this in 3 points', 'Draft a short worker notice from this', 'What action does this require, and by when?'];
    }
    return (KC_SUGGESTIONS.EN || []).slice(0, 3);
  }

  function kcUseStarter(el) {
    const inp = document.getElementById('kc-input');
    if (!inp) return;
    inp.value = el.textContent;
    kcAutoGrow(inp);
    inp.focus();
    kcSend();
  }

  /* English-only input — Daikin office users always work in English.
     Translation is an output-side action on each result. */
  const KC_SUGGESTIONS = {
    EN: ['What time does my shift bus reach the pickup point?', 'How many casual leaves do I get?', 'What is the AP minimum wage for 2026?'],
  };
  function kcRenderSuggestions() {
    const host = document.getElementById('kc-suggestions');
    if (!host) return;
    const list = kcStartersForCurrent();
    host.innerHTML = list.slice(0, 3).map(s =>
      '<span class="kc-suggestion" onclick="kcUseSuggestion(this)">' + s + '</span>'
    ).join('');
  }
  function kcUseSuggestion(el) {
    const inp = document.getElementById('kc-input');
    inp.value = el.textContent;
    kcAutoGrow(inp);
    inp.focus();
  }

  /* Render chat messages */
  function kcRenderChat() {
    const body = document.getElementById('kc-chat-body');
    if (!body) return;
    body.innerHTML = '';
    if (KC_STATE.history.length === 0) {
      const w = document.createElement('div');
      w.className = 'kc-welcome kc-msg';
      w.innerHTML =
        '<div class="kc-welcome-eye">VAANI Knowledge Assistant</div>' +
        '<div class="kc-welcome-title">Browse a category, pick a document, <em style="color:var(--indigo)">then ask</em></div>' +
        '<div class="kc-welcome-sub">Open a category above and select any document to load it into the chat as working context. ' +
        'You can also ask the knowledge base directly. Answers are in English; translate any result for worker distribution.</div>' +
        '<div class="kc-welcome-starters">' +
          kcStartersForCurrent().map(s => '<span class="kc-welcome-starter" onclick="kcUseStarter(this)">' + s + '</span>').join('') +
        '</div>';
      body.appendChild(w);
      return;
    }
    KC_STATE.history.forEach((m, i) => body.appendChild(kcMsgEl(m, i)));
    body.scrollTop = body.scrollHeight;
  }

  function kcMsgEl(m, idx) {
    const wrap = document.createElement('div');
    wrap.className = 'kc-msg ' + m.who + (m.thinking ? ' kc-thinking' : '');
    const meta = document.createElement('div');
    meta.className = 'kc-msg-meta';
    if (m.who === 'user') {
      meta.innerHTML = (m.lang || 'EN') + (m.voice ? ' · <span class="kc-voice-ind">🎙 voice</span>' : ' · text');
    } else {
      meta.innerHTML = 'VAANI Knowledge Assistant' + (m.tts ? ' · <span class="kc-voice-ind">🔊 spoken</span>' : '');
    }
    wrap.appendChild(meta);

    const bubble = document.createElement('div');
    bubble.className = 'kc-bubble';
    if (m.thinking) {
      bubble.innerHTML = '<span class="kc-thinking-dot"></span><span class="kc-thinking-dot"></span><span class="kc-thinking-dot"></span>';
    } else {
      let content = '';
      if (m.native) {
        if (m.lang && m.lang !== 'EN') content += '<span class="kc-native">' + m.native + '</span>';
        else content += m.native;
        if (m.trans && m.lang && m.lang !== 'EN') content += '<span class="kc-trans">' + m.trans + '</span>';
      } else if (m.text) {
        content = m.text;
      }
      bubble.innerHTML = content;
    }
    wrap.appendChild(bubble);

    /* citations */
    if (m.cites && m.cites.length > 0) {
      const cites = document.createElement('div');
      cites.className = 'kc-cites';
      m.cites.forEach((c, i) => {
        const pill = document.createElement('span');
        pill.className = 'kc-cite';
        pill.title = 'Open ' + c.label;
        pill.innerHTML = '<span class="kc-cite-i">' + (i + 1) + '</span><span>' + c.label + '</span>';
        pill.onclick = () => {
          const d = kcDocById(c.docId);
          if (d) {
            /* open the citation's category browser and load that document */
            KC_STATE.activeCat = d.cat;
            kcRenderCategories();
            kcRenderDocBrowser();
            kcSelectDoc(d.id);
          } else {
            toast('Opening ' + c.label, 'green');
          }
        };
        cites.appendChild(pill);
      });
      wrap.appendChild(cites);
    }

    /* assistant actions */
    if (m.who === 'assistant' && !m.thinking) {
      const acts = document.createElement('div');
      acts.className = 'kc-actions';
      acts.innerHTML =
        '<button class="kc-action" onclick="kcSpeak(this)" title="Read aloud">🔊 Read</button>' +
        '<button class="kc-action" onclick="kcCopyMsg(this)" title="Copy">⧉ Copy</button>' +
        '<button class="kc-action kc-translate-btn" onclick="kcToggleTranslateMenu(' + idx + ', this)" title="Translate this answer">🌐 Translate</button>' +
        '<button class="kc-action" title="Helpful">👍</button>' +
        '<button class="kc-action" title="Inaccurate · flag for review">⚐</button>';
      wrap.appendChild(acts);

      /* inline translate-language menu (hidden until Translate clicked) */
      const tmenu = document.createElement('div');
      tmenu.className = 'kc-translate-menu';
      tmenu.id = 'kc-tmenu-' + idx;
      tmenu.style.display = 'none';
      let tHtml = '<span class="kc-tmenu-label">Translate to</span>';
      LANGUAGES.filter(l => l.code !== 'EN').forEach(l => {
        tHtml += '<span class="kc-tmenu-opt" onclick="kcTranslateMsg(' + idx + ',\'' + l.code + '\')">' +
                 '<span class="lang-glyph">' + l.nativeName + '</span> ' + l.code + '</span>';
      });
      tmenu.innerHTML = tHtml;
      wrap.appendChild(tmenu);

      /* already-generated translations for this message */
      if (m.translations && m.translations.length > 0) {
        m.translations.forEach((tr, ti) => {
          const lang = LANGUAGES.find(l => l.code === tr.code) || { name: tr.code, nativeName: tr.code };
          const panel = document.createElement('div');
          panel.className = 'kc-translation';
          panel.innerHTML =
            '<div class="kc-translation-h">' +
              '<span class="kc-translation-lang"><span class="lang-glyph">' + lang.nativeName + '</span> ' + lang.name + '</span>' +
              '<span class="kc-translation-badge">VAANI translation</span>' +
            '</div>' +
            '<div class="kc-translation-body"><span class="kc-native">' + tr.text + '</span></div>' +
            '<div class="kc-translation-acts">' +
              '<button class="kc-action" onclick="kcStoreTranslation(' + idx + ',' + ti + ')" title="Save to translation library">💾 Store</button>' +
              '<button class="kc-action" onclick="kcDownloadTranslation(' + idx + ',' + ti + ')" title="Download as PDF">⬇ Download</button>' +
              '<button class="kc-action" onclick="kcShareTranslation(' + idx + ',' + ti + ')" title="Share link">↗ Share</button>' +
              '<button class="kc-action" onclick="kcSpeakTranslation(' + idx + ',' + ti + ')" title="Read aloud">🔊 Read</button>' +
              (tr.stored ? '<span class="kc-translation-stored">✓ stored</span>' : '') +
            '</div>';
          wrap.appendChild(panel);
        });
      }
    }
    return wrap;
  }

  /* ── translation workflow ── */
  function kcToggleTranslateMenu(idx, btn) {
    const menu = document.getElementById('kc-tmenu-' + idx);
    if (!menu) return;
    const open = menu.style.display !== 'none';
    /* close any other open menus */
    document.querySelectorAll('.kc-translate-menu').forEach(el => el.style.display = 'none');
    menu.style.display = open ? 'none' : 'flex';
  }

  function kcTranslateMsg(idx, code) {
    const m = KC_STATE.history[idx];
    if (!m) return;
    const menu = document.getElementById('kc-tmenu-' + idx);
    if (menu) menu.style.display = 'none';
    if (!m.translations) m.translations = [];
    /* already translated to this language? scroll to it */
    if (m.translations.some(t => t.code === code)) {
      toast('Already translated to ' + (LANGUAGES.find(l => l.code === code) || {}).name, 'green');
      return;
    }
    const src = m.answerText || (m.native || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const translated = kcTranslateText(src, code, m.topic);
    m.translations.push({ code, text: translated, stored: false });
    kcRenderChat();
    toast('Translated to ' + (LANGUAGES.find(l => l.code === code) || {}).name + ' · VAANI', 'green');
  }

  function kcStoreTranslation(idx, ti) {
    const m = KC_STATE.history[idx];
    if (!m || !m.translations || !m.translations[ti]) return;
    m.translations[ti].stored = true;
    kcRenderChat();
    const lang = (LANGUAGES.find(l => l.code === m.translations[ti].code) || {}).name;
    toast('Stored ' + lang + ' translation to the library · audit-logged', 'green');
  }
  function kcDownloadTranslation(idx, ti) {
    const m = KC_STATE.history[idx];
    if (!m || !m.translations || !m.translations[ti]) return;
    const lang = (LANGUAGES.find(l => l.code === m.translations[ti].code) || {}).name;
    toast('Downloading ' + lang + ' translation · PDF', 'green');
  }
  function kcShareTranslation(idx, ti) {
    const m = KC_STATE.history[idx];
    if (!m || !m.translations || !m.translations[ti]) return;
    const lang = (LANGUAGES.find(l => l.code === m.translations[ti].code) || {}).name;
    navigator.clipboard && navigator.clipboard.writeText('https://plantvaani.app/kc/share/' + idx + '-' + ti).then(
      () => toast('Share link copied · ' + lang + ' translation', 'green'),
      () => toast('Share link ready · ' + lang, 'green')
    );
  }
  function kcSpeakTranslation(idx, ti) {
    const m = KC_STATE.history[idx];
    if (!m || !m.translations || !m.translations[ti]) return;
    const lang = (LANGUAGES.find(l => l.code === m.translations[ti].code) || {}).name;
    toast('Reading aloud · ' + lang, 'green');
  }

  /* Send a user message + canned response (mockup; no real model) */
  function kcSend() {
    const inp = document.getElementById('kc-input');
    const txt = inp.value.trim();
    if (!txt) return;
    inp.value = '';
    kcAutoGrow(inp);
    KC_STATE.history.push({ who: 'user', lang: 'EN', text: txt, native: txt });
    /* thinking */
    KC_STATE.history.push({ who: 'assistant', thinking: true });
    kcRenderChat();

    setTimeout(() => {
      /* swap thinking with a canned answer */
      KC_STATE.history.pop();
      const ans = kcCannedAnswer(txt);
      KC_STATE.history.push(ans);
      kcRenderChat();
      if (KC_STATE.ttsOn) toast('Reading response aloud · English', 'green');
    }, 700);
  }

  /* canned answer matching heuristic — picks the best doc from the corpus */
  function kcCannedAnswer(question) {
    const q = question.toLowerCase();
    let cites = [];
    let answerText = '';
    let topic = 'generic';

    if (/bus|transport|pickup|route|drop|commute/i.test(q)) {
      topic = 'transport';
      cites = [{ docId: 'kc-401', label: 'Route map & timings · all zones' }, { docId: 'kc-402', label: 'Pickup-point directory' }];
      answerText = 'Company transport runs zone-wise routes. Check the route map for your pickup point and shift timing — morning, general and late-shift buses each have their own schedule. The last late-shift drop leaves the plant at 23:15. Be at the pickup point 5 minutes early; buses do not wait beyond the scheduled minute.';
    } else if (/evacuat|assembly|fire|emergency|drill/i.test(q)) {
      topic = 'evac';
      cites = [{ docId: 'kc-309', label: 'Evacuation drill · notice' }, { docId: 'kc-310', label: 'Emergency contacts · 24×7' }];
      answerText = 'Compressor Line → Area-A (near Gate 2). Paint Shop → Area-C (behind the canteen). Warehouse → Area-B. Do not use elevators. Report to your supervisor at the assembly point. Evacuation drills are scheduled monthly and posted as a notice.';
    } else if (/ppe|helmet|shoe|glove|lockout|loto|confined/i.test(q)) {
      topic = 'ppe';
      cites = [{ docId: 'kc-203', label: 'PPE selection · job role matrix' }, { docId: 'kc-204', label: 'Lockout / Tagout · 6 steps' }];
      answerText = 'Per the role matrix: Compressor Line — Class-B helmet, steel-toe shoes, cut-resistant gloves; Paint Shop — chemical-resistant gloves + respirator; Warehouse — high-vis vest + steel-toe shoes. Lockout/Tagout applies whenever you service equipment that could start unexpectedly — follow the 6-step procedure.';
    } else if (/wage|salary|minimum|pay|slip/i.test(q)) {
      topic = 'wages';
      cites = [{ docId: 'kc-301', label: 'Minimum wage revision · 2026' }];
      answerText = 'AP minimum wages for 2026: Unskilled ₹13,210/mo · Semi-skilled ₹14,260/mo · Skilled ₹15,860/mo · Highly skilled ₹17,290/mo. These include VDA. The latest revision notice is posted under Notices.';
    } else if (/leave|holiday|attendance|casual|sick/i.test(q)) {
      topic = 'leave';
      cites = [{ docId: 'kc-105', label: 'Leave policy · annual / sick / casual' }, { docId: 'kc-306', label: 'Holiday list · 2026' }];
      answerText = 'Leave entitlement for confirmed direct employees: 21 annual + 12 casual + 12 sick days per calendar year. The 2026 holiday list is posted under Notices. Mark attendance via the Karya Vaani mobile app or biometric; approval flows through your supervisor.';
    } else if (/grievance|harass|posh|complaint/i.test(q)) {
      topic = 'grievance';
      cites = [{ docId: 'kc-104', label: 'Grievance redressal policy' }, { docId: 'kc-103', label: 'Anti-harassment policy (PoSH)' }];
      answerText = 'Submit grievances via the Karya Vaani app (anonymous channel available), to your supervisor, or to Plant HR. For workplace harassment, the Internal Committee under PoSH receives complaints — confidentiality is statutorily protected.';
    } else if (/conduct|standing order|discipline|rule/i.test(q)) {
      topic = 'conduct';
      cites = [{ docId: 'kc-101', label: 'Code of conduct · v2026.04' }, { docId: 'kc-102', label: 'Standing orders · IESO 1946' }];
      answerText = 'The Code of conduct (v2026.04) and Standing orders under IESO 1946 govern workplace behaviour, working hours, leave procedure and disciplinary process. Both are in the Policies group and available in your language.';
    } else if (/induction|training|certificat|quiz|module/i.test(q)) {
      topic = 'induction';
      cites = [{ docId: 'kc-201', label: 'General plant induction' }, { docId: 'kc-210', label: 'Certification criteria' }];
      answerText = 'Induction is delivered as short modules — general plant induction plus role-specific safety. Each module ends with a short quiz; passing all mandatory modules earns an evidence-grade certificate. Migrant workers also get a dedicated ISMW welcome module.';
    } else if (/contractor|clra|migrant|ismw/i.test(q)) {
      topic = 'contractor';
      cites = [{ docId: 'kc-107', label: 'Contractor compliance policy' }, { docId: 'kc-108', label: 'CLRA principal-employer obligations' }];
      answerText = 'Contract workers are entitled to wages ≥ statutory minimum, ESIC + PF enrolment by the contractor, a written engagement letter, an identity card, and equal facilities. The principal employer is jointly responsible for compliance under the CLRA Act.';
    } else {
      /* fallback — if a document is loaded, answer in its context; else a sensible default */
      const d = KC_STATE.activeDoc ? kcDocById(KC_STATE.activeDoc) : null;
      if (d) {
        topic = 'doccontext';
        cites = [{ docId: d.id, label: d.title }];
        answerText = 'Based on "' + d.title + '" (' + d.dept + ' · owner ' + d.owner + '): I can summarise it, extract a specific clause, or draft a worker-facing note from it. Tell me which, or ask a more specific question — and translate the result for the workers who need it.';
      } else {
        topic = 'generic';
        cites = [{ docId: 'kc-101', label: 'Code of conduct' }];
        answerText = 'Here\'s what the knowledge base has on that. For a more precise answer, open a category above and select the relevant document to load it into the chat, then ask again.';
      }
    }

    return {
      who: 'assistant',
      lang: 'EN',
      topic: topic,              /* used by the translation engine */
      native: answerText,        /* answers are authored in English */
      answerText: answerText,    /* kept for the on-demand translation workflow */
      cites,
      translations: [],
    };
  }

  function kcAutoGrow(el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }
  function kcToggleTts(btn) {
    KC_STATE.ttsOn = !KC_STATE.ttsOn;
    btn.classList.toggle('active', KC_STATE.ttsOn);
    btn.style.background = KC_STATE.ttsOn ? 'var(--indigo)' : '';
    btn.style.color = KC_STATE.ttsOn ? 'var(--paper)' : '';
    btn.style.borderColor = KC_STATE.ttsOn ? 'var(--indigo)' : '';
    toast(KC_STATE.ttsOn ? 'Read-aloud ON' : 'Read-aloud OFF', 'green');
  }
  function kcToggleVoice(btn) {
    KC_STATE.recording = !KC_STATE.recording;
    btn.classList.toggle('recording', KC_STATE.recording);
    if (KC_STATE.recording) {
      toast('Listening… (English)', 'green');
      /* simulate a voice query landing after 1.8s */
      setTimeout(() => {
        if (!KC_STATE.recording) return;
        btn.classList.remove('recording');
        KC_STATE.recording = false;
        const samples = kcStartersForCurrent();
        const txt = samples[Math.floor(Math.random() * Math.min(3, samples.length))];
        KC_STATE.history.push({ who: 'user', lang: 'EN', voice: true, text: txt, native: txt });
        KC_STATE.history.push({ who: 'assistant', thinking: true });
        kcRenderChat();
        setTimeout(() => {
          KC_STATE.history.pop();
          KC_STATE.history.push(kcCannedAnswer(txt));
          kcRenderChat();
        }, 700);
      }, 1800);
    } else {
      toast('Voice cancelled', 'red');
    }
  }
  function kcSpeak(btn) {
    toast('Reading response aloud', 'green');
  }
  function kcCopyMsg(btn) {
    const bubble = btn.closest('.kc-msg').querySelector('.kc-bubble');
    const txt = bubble.innerText;
    navigator.clipboard.writeText(txt).then(
      () => toast('Copied to clipboard', 'green'),
      () => toast('Copy failed', 'red')
    );
  }
  function kcNewChat() {
    KC_STATE.history = [];
    KC_STATE.activeDoc = null;
    kcRenderContextBar();
    kcRenderDocBrowser();
    kcRenderChat();
    kcRenderSuggestions();
    toast('New chat started', 'green');
  }

  function initKc() {
    if (!document.getElementById('kc-cats')) return;
    KC_STATE.view = 'browse';
    KC_STATE.activeCat = null;
    KC_STATE.activeDoc = null;
    KC_STATE.history = [];
    kcRenderCategories();
    kcRenderDocBrowser();
    kcRenderContextBar();
    kcRenderChat();
    kcRenderSuggestions();
  }
  __kvOnReady(initKc);

  /* Esc closes modals */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (document.getElementById('email-modal').classList.contains('on')) closeEmailModal();
      else if (document.getElementById('ct-drill').classList.contains('on')) closeCtDrill();
      else if (document.getElementById('sd-drill').classList.contains('on')) closeSdDrill();
      else if (document.getElementById('ind-drill').classList.contains('on')) closeIndDrill();
    }
  });

  /* ════════════════════════════════════════════════════════════════
     KARYA NIRṆAY · WORKFORCE DECISION BUILDER — engine
     Guided 4-step builder. All state namespaced (KN_STATE / kn*) so it
     never collides with the rest of the platform.
     ════════════════════════════════════════════════════════════════ */
  const KN_STATE = {
    step: 0, role: 'Welder', count: 40, duration: 3, state: 'Chhattisgarh',
    plant_hc: 320, contractor_hc: 180, skill: 'Semi-skilled',
    urgency: 'Normal — 30 days', budget: 'Moderate', continuity: 'Project-based',
    toggles: { safety: false, fluctuating: true, seasonal: false, core: false,
               proprietary: true, costpressure: false, trial: false }
  };

  function knFmt(n)  { return Math.round(n).toLocaleString('en-IN'); }
  function knFmtL(n) { return (Math.round(n / 100000) / 10).toFixed(1) + 'L'; }

  /* read the form controls into KN_STATE — single source of truth */
  function knSyncState() {
    const $ = id => document.getElementById(id);
    if (!$('kn-f-role')) return;
    KN_STATE.role         = $('kn-f-role').value;
    KN_STATE.count        = +$('kn-f-count').value || 1;
    KN_STATE.duration     = +$('kn-f-dur').value || 1;
    KN_STATE.skill        = $('kn-f-skill').value;
    KN_STATE.state        = $('kn-f-state').value;
    KN_STATE.plant_hc     = +$('kn-f-phc').value;
    KN_STATE.contractor_hc= +$('kn-f-chc').value;
    KN_STATE.urgency      = $('kn-f-urgency').value;
    KN_STATE.budget       = $('kn-f-budget').value;
    KN_STATE.budgetBasis  = $('kn-f-budget-basis') ? $('kn-f-budget-basis').value : 'monthly';
    KN_STATE.budgetAmt    = $('kn-f-budget-amt') ? ($('kn-f-budget-amt').value || '').trim() : '';
    KN_STATE.continuity   = $('kn-f-cont').value;
    /* keep the budget hint reflecting basis × count */
    const hint = $('kn-budget-hint');
    if (hint) {
      const n = +$('kn-f-count').value || 1;
      const basisTxt = KN_STATE.budgetBasis === 'annual' ? 'per annum' : 'per month';
      hint.textContent = 'Sanctioned cost-to-company ' + basisTxt +
        (KN_STATE.budgetAmt ? ' · ₹' + KN_STATE.budgetAmt + (n > 1 ? ' covering ' + n + ' positions' : '') : '') +
        ' — wages, statutory contributions and overheads.';
    }
    $('kn-sv-phc').textContent = $('kn-f-phc').value;
    $('kn-sv-chc').textContent = $('kn-f-chc').value;
  }

  function knToggle(k, el) {
    KN_STATE.toggles[k] = !KN_STATE.toggles[k];
    el.classList.toggle('on', KN_STATE.toggles[k]);
  }

  /* step navigation — drives the .ladder ladder steps */
  function knGoStep(n) {
    knSyncState();
    KN_STATE.step = n;
    document.querySelectorAll('.kn-panel').forEach((p, i) => p.classList.toggle('active', i === n));
    for (let i = 0; i < 4; i++) {
      const el = document.getElementById('kn-nav-' + i);
      if (!el) continue;
      el.classList.remove('now', 'done');
      if (i === n) el.classList.add('now');
      else if (i < n) el.classList.add('done');
    }
    if (n === 2) knRenderChecks();
    if (n === 3) knRenderRec();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function knReset() {
    const d = { role: 'Welder', count: 40, duration: 3, skill: 'Semi-skilled',
                state: 'Chhattisgarh', phc: 320, chc: 180,
                urgency: 'Normal — 30 days', budget: 'Moderate', cont: 'Project-based' };
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
    set('kn-f-role', d.role); set('kn-f-count', d.count); set('kn-f-dur', d.duration);
    set('kn-f-skill', d.skill); set('kn-f-state', d.state);
    set('kn-f-phc', d.phc); set('kn-f-chc', d.chc);
    set('kn-f-urgency', d.urgency); set('kn-f-budget', d.budget); set('kn-f-cont', d.cont);
    KN_STATE.toggles = { safety: false, fluctuating: true, seasonal: false, core: false,
                         proprietary: true, costpressure: false, trial: false };
    document.querySelectorAll('#kn-toggles .kn-tog').forEach(t => {
      t.classList.toggle('on', !!KN_STATE.toggles[t.dataset.key]);
    });
    knSyncState();
    knGoStep(0);
    toast('Scenario reset', 'green');
  }

  /* scenario chips shown on the compliance-check step header */
  function knScenarioChips() {
    const t = KN_STATE.plant_hc + KN_STATE.contractor_hc;
    return '<span class="pill blue">' + KN_STATE.count + ' ' + KN_STATE.role + 's</span>' +
           '<span class="pill">' + KN_STATE.duration + ' months</span>' +
           '<span class="pill">' + KN_STATE.skill + '</span>' +
           '<span class="pill teal">' + KN_STATE.state + '</span>' +
           '<span class="pill outline">plant ' + knFmt(t) + '</span>';
  }

  /* ── STEP 3 · compliance checks ── */
  function knRenderChecks() {
    knSyncState();
    const S = KN_STATE;
    const total    = S.plant_hc + S.contractor_hc;
    const cRatio   = Math.round(S.contractor_hc / (total || 1) * 100);
    const newTotal = total + S.count;
    const newRatio = Math.round((S.contractor_hc + S.count) / (newTotal || 1) * 100);
    const ir300    = total >= 300;
    const cross300 = (S.plant_hc + S.count) > 299 && !ir300;

    const stateWages = {
      'Chhattisgarh':  { u:10500, ss:13200, sk:16800, hs:22000, status:'Final rules gazetted under all 4 Labour Codes.' },
      'Maharashtra':   { u:12800, ss:15600, sk:19200, hs:26000, status:'Final rules gazetted. Highest minimum wages in manufacturing sector.' },
      'Andhra Pradesh':{ u:11200, ss:14200, sk:18000, hs:24000, status:'Final state rules gazetted. VDA revision due January and July annually.' },
      'Telangana':     { u:11000, ss:14000, sk:17600, hs:23500, status:'Final rules active. Separate wage boards for construction and manufacturing.' },
      'Karnataka':     { u:12200, ss:15000, sk:18800, hs:25000, status:'Final rules gazetted. IT/manufacturing zones have separate wage schedules.' },
      'Tamil Nadu':    { u:11800, ss:14800, sk:18400, hs:24500, status:'Final rules active. Special economic zone rates apply at Sricity equivalent parks.' },
      'Gujarat':       { u:10800, ss:13600, sk:17200, hs:22800, status:'Final rules gazetted. Industrial areas under separate schedule.' },
      'Rajasthan':     { u:10200, ss:13000, sk:16400, hs:21500, status:'Final rules active as of April 2026.' },
      'Haryana':       { u:11500, ss:14500, sk:18200, hs:24200, status:'Final rules gazetted. NCR boundary workers entitled to Delhi-rate minimum wages.' },
      'Uttar Pradesh': { u:10400, ss:13100, sk:16600, hs:21800, status:'Final rules active. Zone-based wage differentiation applies.' },
      'West Bengal':   { u:11000, ss:13800, sk:17400, hs:23000, status:'Final rules gazetted as of March 2026.' }
    };
    const rulesActive = Object.prototype.hasOwnProperty.call(stateWages, S.state);

    const checks = [
      {
        status: cRatio < 40 ? 'ok' : cRatio < 50 ? 'warn' : 'err',
        title : 'Contractor ratio: ' + cRatio + '% current → ' + newRatio + '% after hire',
        note  : cRatio >= 40
          ? 'Above 40% — principal-employer liability under SS Code s.67 is significantly elevated. Consider direct hire for this batch.'
          : 'Within safe zone. Monitor monthly as you add more contract workers.',
        badge : cRatio >= 40 ? 'Elevated risk' : 'Within limits'
      },
      {
        status: cross300 ? 'warn' : 'ok',
        title : cross300
          ? 'Threshold alert: hiring ' + S.count + ' pushes total past 300 workers (' + (S.plant_hc + S.count) + ' total)'
          : '300-worker threshold: total stays at ' + (S.plant_hc + S.count) + ' — below Chapter V-B trigger',
        note  : cross300
          ? 'Crossing 300 activates IR Code Chapter V-B: prior government permission now required for retrenchment, layoff and closure. This fundamentally changes your flexibility.'
          : ir300 ? 'Already above 300. Prior govt permission already required for retrenchment/closure — factor into exit planning.'
                  : 'No threshold crossing with this hire.',
        badge : cross300 ? 'Critical trigger' : ir300 ? 'Already applies' : 'No impact'
      },
      {
        status: S.toggles.safety && S.skill === 'Unskilled' ? 'err' : 'ok',
        title : S.toggles.safety ? 'Safety-critical process — ' + S.skill + ' workers'
                                 : 'Standard process — safety checks apply',
        note  : S.toggles.safety && S.skill === 'Unskilled'
          ? 'OSHC 2020 prohibits unskilled workers operating hazardous equipment independently. Upgrade skill classification or mandate direct supervision at ratio 1:5.'
          : S.toggles.safety
            ? 'OSHC 2020 s.42: safety-committee minutes mandatory quarterly. Contractor must have a designated safety officer for hazardous work.'
            : 'Standard OSHC 2020 protocols apply. Annual safety audit and HIRA update required.',
        badge : S.toggles.safety && S.skill === 'Unskilled' ? 'Non-compliant' : S.toggles.safety ? 'Verify' : 'Standard'
      },
      {
        status: 'ok',
        title : 'ESIC & EPF: applicable to all ' + S.count + ' workers',
        note  : 'All workers earning ≤ ₹21,000/month must be enrolled under ESIC (10+ worker threshold: your plant at ' + total + ' workers). EPF mandatory from day 1. For contract workers, verify the contractor challan within 7 days of due date — your joint liability under SS Code s.67.',
        badge : 'Mandatory'
      },
      {
        status: S.duration >= 12 && S.continuity === 'Project-based' ? 'warn' : 'ok',
        title : 'Duration signal: ' + S.duration + ' months classified as "' + S.continuity + '"',
        note  : S.duration >= 12 && S.continuity === 'Project-based'
          ? 'IR Code 2020 caution: if work is of a permanent nature, repeated FTE or contractor engagement for the same role can be challenged by an inspector as disguised employment. Consider fixed-term employment with proper contracts.'
          : S.duration >= 24
            ? 'At 24+ months, permanent employment becomes the most cost-effective structure once onboarding and retention costs are factored in.'
            : 'Duration aligns well with contractor or FTE structures. Clean legal path available.',
        badge : S.duration >= 12 && S.continuity === 'Project-based' ? 'Review intent'
              : S.duration >= 24 ? 'Consider permanent' : 'Clean path'
      },
      {
        status: rulesActive ? 'ok' : 'warn',
        title : 'State rules: ' + S.state,
        note  : (function () {
          const w = stateWages[S.state];
          if (w) {
            const k = S.skill === 'Unskilled' ? 'u' : S.skill === 'Semi-skilled' ? 'ss' : S.skill === 'Skilled' ? 'sk' : 'hs';
            return w.status + ' Minimum wage for ' + S.skill + ' workers in manufacturing: ₹' +
              w[k].toLocaleString('en-IN') + '/month. 2026 Central Rules floor applies where the state rate is lower. The monthly÷26 wage formula is now mandatory under Wages Code Rule 2 (G.S.R. 343(E), 8 May 2026).';
          }
          const floor = S.skill === 'Unskilled' ? '9,750' : S.skill === 'Semi-skilled' ? '12,400' : S.skill === 'Skilled' ? '15,600' : '20,800';
          return S.state + ' has published draft rules — final notification pending. Apply central rules as the floor until state rules are gazetted. Minimum wage floor for ' + S.skill + ': ₹' + floor + '/month under 2026 Central Rules.';
        })(),
        badge : rulesActive ? 'Rules active' : 'Draft rules — central floor'
      }
    ];

    const iconSvg = {
      ok:  '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
      err: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      warn:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
    };
    const badgeCls = { ok: 'green', err: 'red', warn: 'amber' };

    document.getElementById('kn-scenario-2').innerHTML = knScenarioChips();
    document.getElementById('kn-check-list').innerHTML = checks.map(function (c, i) {
      return '<div class="kn-check" style="animation-delay:' + (i * 0.06) + 's">' +
        '<div class="kn-check-icon ' + c.status + '">' + iconSvg[c.status] + '</div>' +
        '<div class="kn-check-body">' +
          '<div class="kn-check-title">' + c.title + '</div>' +
          '<div class="kn-check-note">' + c.note + '</div>' +
        '</div>' +
        '<span class="pill ' + badgeCls[c.status] + '">' + c.badge + '</span>' +
      '</div>';
    }).join('');
  }

  /* ── compute the 5 workforce-structure options ── */
  function knComputeOptions() {
    knSyncState();
    const S = KN_STATE;
    const sk = ({ Unskilled: 0, Semiskilled: 1, Skilled: 2, 'Highly skilled': 3 })[S.skill.replace('-', '')];
    const skill = (sk === undefined ? 1 : sk);
    const rates = [
      { id: 'permanent',  base: [22, 28, 38, 60] },
      { id: 'fte',        base: [25, 30, 40, 65] },
      { id: 'contractor', base: [19, 24, 32, 52] },
      { id: 'hybrid',     base: [21, 26, 35, 56] },
      { id: 'apprentice', base: [ 8,  9, 11, 14] }
    ];
    const n = S.count, d = S.duration;
    const onboard = { permanent: 8000, fte: 5000, contractor: 2000, hybrid: 3000, apprentice: 3000 };
    const exit    = { permanent: 25000, fte: 15000, contractor: 3000, hybrid: 5000, apprentice: 2000 };
    const total   = S.plant_hc + S.contractor_hc;
    const cRatio  = S.contractor_hc / (total || 1);

    const personSvg = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
    const calSvg    = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
    const houseSvg  = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
    const teamSvg   = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
    const capSvg    = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>';

    return [
      {
        id: 'permanent', label: 'Permanent employee — direct hire', icon: personSvg,
        monthly: rates[0].base[skill] * 1000 * n,
        total:   rates[0].base[skill] * 1000 * n * d + onboard.permanent * n + exit.permanent * n,
        onboard: onboard.permanent * n, exit: exit.permanent * n,
        compScore: 96,
        allowed: d >= 12 && !S.toggles.seasonal,
        best:    d >= 24 && S.toggles.core,
        triggers: [
          'EPF + ESIC enrollment within 15 days — mandatory',
          'Gratuity vests after 5 years (SS Code s.53)',
          total >= 300 ? 'IR Code s.77: prior govt permission for retrenchment' : 'IR Code: 45-day retrenchment notice',
          'Standing orders apply (IR Code s.28) — certify within 3 months',
          'Maternity, paternity, EDLI benefits all mandatory'
        ],
        compLabel: 'Lowest long-term liability', compColor: 'g',
        actions: ['Issue appointment letter within 30 days', 'Enroll in EPF on day 1; ESIC within 15 days', 'Enter in Form 11 (EPF declaration)'],
        irNote: total >= 300 ? 'Retrenchment requires prior Govt permission — plan exit strategies at the hire stage.' : '45-day notice required for retrenchment.'
      },
      {
        id: 'fte', label: 'Fixed-term employee (IR Code 2020)', icon: calSvg,
        monthly: rates[1].base[skill] * 1000 * n,
        total:   rates[1].base[skill] * 1000 * n * d + onboard.fte * n + exit.fte * n,
        onboard: onboard.fte * n, exit: exit.fte * n,
        compScore: 88,
        allowed: d >= 1 && d <= 36,
        best:    d >= 3 && d <= 18 && !S.toggles.core,
        triggers: [
          'IR Code 2020 s.2(1)(r): proportional gratuity from day 1',
          'Same wages and benefits as permanent workers in the same role',
          'EPF + ESIC mandatory from day 1',
          'Contract termination = automatic separation — no retrenchment compensation',
          d >= 12 ? 'Maternity benefit applies (service > 80 days)' : 'Pro-rated maternity benefit if > 80 days'
        ],
        compLabel: 'Low–medium liability', compColor: 'g',
        actions: ['Specify exact start and end dates in the contract', 'Add the proportional gratuity clause (mandatory)', 'Add a parity-of-benefits clause — inspectors will check'],
        irNote: d >= 24 ? 'CAUTION: 24+ months FTE for the same role and worker risks an IR Code s.2 disguised-permanent-employment challenge at inspection. Document the genuine project-based nature or convert to a permanent hire.' : 'Clean exit at contract end — no retrenchment. Do not roll over FTE more than 3 times for the same role.'
      },
      {
        id: 'contractor', label: 'Contract worker via licensed contractor', icon: houseSvg,
        monthly: rates[2].base[skill] * 1000 * n,
        total:   rates[2].base[skill] * 1000 * n * d + onboard.contractor * n + exit.contractor * n,
        onboard: onboard.contractor * n, exit: exit.contractor * n,
        compScore: cRatio > 0.4 ? 38 : cRatio > 0.3 ? 68 : 78,
        allowed: !(cRatio > 0.45),
        best:    d <= 12 && !S.toggles.core && !S.toggles.proprietary && cRatio < 0.35,
        blockedReason: cRatio > 0.45 ? 'Contractor ratio ' + Math.round(cRatio * 100) + '% exceeds the safe limit. Adding ' + n + ' workers pushes this further — principal-employer liability exposure is unacceptable. Use FTE or direct hire for this batch.' : '',
        triggers: [
          'OSHC Rule 6 (2026): appointment letter mandatory for every worker before work begins — joint PE liability if the contractor fails to issue',
          'OSHC 2020 s.41: contractor must hold a valid licence before deployment',
          'SS Code s.67: you bear joint ESIC/EPF liability for all contractor workers',
          'Verify the contractor ESIC challan within 7 days of due date — ' + n + ' workers',
          'Form V + muster roll mandatory on your premises at all times',
          S.toggles.safety ? 'Safety-critical: contractor must have its own safety officer on site' : 'Maintain a separate wage register for contract workers'
        ],
        compLabel: cRatio > 0.4 ? 'High liability — caution' : cRatio > 0.3 ? 'Elevated — monitor' : 'Manageable liability',
        compColor: cRatio > 0.4 ? 'r' : cRatio > 0.3 ? 'a' : 'g',
        actions: ['Verify the contractor OSHC licence before day-1 deployment', 'Establish a monthly challan verification SOP', 'Insert a liability-recovery clause in the contractor agreement'],
        irNote: 'Principal employer is liable if the contractor defaults on wages or statutory dues.'
      },
      {
        id: 'hybrid', label: 'Fixed-term via contractor (hybrid structure)', icon: teamSvg,
        monthly: rates[3].base[skill] * 1000 * n,
        total:   rates[3].base[skill] * 1000 * n * d + onboard.hybrid * n + exit.hybrid * n,
        onboard: onboard.hybrid * n, exit: exit.hybrid * n,
        compScore: 65,
        allowed: d >= 1 && d <= 12,
        best:    d >= 2 && d <= 9 && S.toggles.fluctuating && !S.toggles.core,
        triggers: [
          'OSHC Rule 6 (2026): appointment letter required before work begins — contractor obligation, PE joint liability',
          'Contractor must issue proper FTE contracts — IR Code applies to each worker',
          'Proportional gratuity obligation flows through the contractor to each FTE worker',
          'SS Code s.67 joint liability still applies to you as the principal employer',
          'Avoid sham FTE — inspector scrutiny is heightened post-November 2025',
          'Audit contractor FTE contracts quarterly for IR Code compliance'
        ],
        compLabel: 'Medium liability — audit trail critical', compColor: 'a',
        actions: ['Audit contractor FTE contract templates before deployment', 'Document your principal-employer oversight formally', 'Quarterly contractor compliance review — include FTE terms'],
        irNote: 'Contractor accountable but principal employer liable for any defaults.'
      },
      {
        id: 'apprentice', label: 'Apprentice under NAPS scheme', icon: capSvg,
        monthly: rates[4].base[skill] * 1000 * n,
        total:   rates[4].base[skill] * 1000 * n * d + onboard.apprentice * n + exit.apprentice * n,
        onboard: onboard.apprentice * n, exit: exit.apprentice * n,
        compScore: S.toggles.safety ? 70 : 92,
        allowed: ['Semi-skilled', 'Skilled'].indexOf(S.skill) > -1 && d >= 6 && !S.toggles.safety,
        best:    S.skill === 'Semi-skilled' && d >= 12 && !S.toggles.safety && !S.toggles.core,
        triggers: [
          'Governed by the Apprentices Act 1961 — outside the Labour Codes',
          'Stipend only — no PF/ESIC obligation (may enroll optionally)',
          'NAPS workforce range: 2.5%–15% of total workers. Your plant at ' + total + ': minimum ' + Math.floor(total * 0.025) + ' to maximum ' + Math.floor(total * 0.15) + ' apprentices permitted',
          'NAPS govt subsidy: ₹1,500/month per apprentice reimbursed',
          S.toggles.safety ? 'CAUTION: apprentices cannot work independently on safety-critical equipment' : 'Assign a certified supervisor — mandatory under the Apprentices Act'
        ],
        compLabel: S.toggles.safety ? 'Restricted use — safety flag' : 'Lowest cost + compliant',
        compColor: S.toggles.safety ? 'a' : 'g',
        actions: ['Register on the NAPS portal before the first deployment day', 'File Form 10 with the RDAT within 30 days of engagement', 'Assign one certified supervisor per 5 apprentices — statutory requirement'],
        irNote: 'Natural contract end — no retrenchment. Cannot be used to fill permanent vacancies indefinitely.'
      }
    ].sort(function (a, b) {
      if (a.best && !b.best) return -1;
      if (!a.best && b.best) return 1;
      if (a.allowed && !b.allowed) return -1;
      if (!a.allowed && b.allowed) return 1;
      return a.total - b.total;
    });
  }

  /* ── STEP 4 · recommendation ── */
  function knRenderRec() {
    const S = KN_STATE;
    const opts  = knComputeOptions();
    const top   = opts.find(function (o) { return o.allowed && o.best; }) || opts.find(function (o) { return o.allowed; });
    const total = S.plant_hc + S.contractor_hc;
    const cRatio= (S.contractor_hc + S.count) / ((total + S.count) || 1);

    document.getElementById('kn-rec-eyebrow').textContent = 'Step 4 of 4 — Recommendation';
    document.getElementById('kn-rec-title').textContent =
      S.count + ' ' + S.role + 's · ' + S.duration + ' months · ' + S.state;
    document.getElementById('kn-rec-sub').textContent =
      top ? 'Optimal structure: ' + top.label : 'Review constraints — multiple options blocked.';

    /* parse the sanctioned financial budget for a fit check */
    function knBudgetNum(s) {
      return parseInt(String(s || '').replace(/[^0-9]/g, ''), 10) || 0;
    }
    const budgetRaw = knBudgetNum(S.budgetAmt);
    /* normalise sanctioned budget to a monthly figure */
    const budgetMonthly = S.budgetBasis === 'annual' ? budgetRaw / 12 : budgetRaw;
    const recMonthly = top ? top.monthly : 0;
    let fitCls = 'neu', fitWord = '—', fitSub = 'no budget set';
    if (budgetMonthly > 0 && top) {
      const pct = Math.round(recMonthly / budgetMonthly * 100);
      if (recMonthly <= budgetMonthly) {
        fitCls = 'up'; fitWord = 'within budget';
        fitSub = pct + '% of sanctioned · ₹' + knFmtL(budgetMonthly - recMonthly) + ' headroom';
      } else {
        fitCls = 'dn'; fitWord = 'over budget';
        fitSub = pct + '% of sanctioned · ₹' + knFmtL(recMonthly - budgetMonthly) + ' over';
      }
    }

    /* KPI strip — Karya Vaani .kpi tiles */
    document.getElementById('kn-kpi-strip').innerHTML =
      '<div class="kpi"><div class="kpi-bar"><span style="width:100%;background:var(--amber)"></span></div>' +
        '<div class="kpi-eye">Best option · total cost</div>' +
        '<div class="kpi-val">₹' + (top ? knFmtL(top.total) : '—') + '</div>' +
        '<div class="kpi-sub">' + S.duration + '-month all-in outlay</div></div>' +
      '<div class="kpi"><div class="kpi-eye">Monthly run rate</div>' +
        '<div class="kpi-val">₹' + (top ? knFmtL(top.monthly) : '—') + '</div>' +
        '<div class="kpi-sub">Wages + statutory contributions</div></div>' +
      '<div class="kpi"><div class="kpi-eye">Budget fit · vs sanctioned</div>' +
        '<div class="kpi-val">' + (budgetMonthly > 0 ? '₹' + knFmtL(budgetMonthly) : '—') +
          '<small>/mo</small></div>' +
        '<div class="kpi-sub"><span class="kpi-delta ' + fitCls + '">' + fitWord + '</span> ' + fitSub + '</div></div>' +
      '<div class="kpi"><div class="kpi-eye">Compliance score</div>' +
        '<div class="kpi-val">' + (top ? top.compScore : 0) + '<small>/100</small></div>' +
        '<div class="kpi-sub">' + (top ? top.compLabel : '—') + '</div></div>';

    /* mix bar */
    const phc = S.plant_hc, chc = S.contractor_hc, tot = phc + chc;
    document.getElementById('kn-mix-right').textContent =
      Math.round(phc / tot * 100) + '% direct / ' + Math.round(chc / tot * 100) + '% contract';
    document.getElementById('kn-mix-bar').innerHTML =
      '<div class="kn-mix-seg" style="flex:' + phc + ';background:var(--indigo);color:var(--paper)">' +
        (Math.round(phc / tot * 100) > 8 ? Math.round(phc / tot * 100) + '% direct' : '') + '</div>' +
      '<div class="kn-mix-seg" style="flex:' + chc + ';background:var(--amber);color:var(--paper)">' +
        (Math.round(chc / tot * 100) > 8 ? Math.round(chc / tot * 100) + '% contract' : '') + '</div>';

    /* AI insight */
    const tid = top ? top.id : '';
    let aiText;
    if (tid === 'contractor') {
      aiText = 'For <strong>' + S.count + ' ' + S.role + 's</strong> over <strong>' + S.duration + ' months</strong>, licensed-contractor deployment is the optimal path — lowest cost at ₹' + knFmtL(top.total) + ' total, fastest onboarding, and a clean natural exit with no retrenchment obligation. Your critical action before day one: verify the contractor\u2019s OSHC 2020 licence and establish a monthly challan verification SOP. Your joint ESIC/EPF liability under SS Code s.67 is real — the contractor\u2019s compliance track record directly becomes your risk.';
    } else if (tid === 'fte') {
      aiText = '<strong>Fixed-term employment</strong> is the right structure for <strong>' + S.count + ' ' + S.role + 's over ' + S.duration + ' months</strong>. Post-November 2025, the IR Code makes FTE genuinely flexible — the contract end date is a clean, legally certain separation point with no retrenchment compensation. The one non-negotiable: every FTE contract must include the proportional gratuity clause and parity-of-benefits language. Missing these is the most common IR Code violation inspectors are flagging in manufacturing plants right now.';
    } else if (tid === 'permanent') {
      aiText = 'At <strong>' + S.duration + ' months</strong>, the math shifts decisively toward <strong>permanent employment</strong>. Onboarding cost amortises over the longer horizon and the retention premium outweighs statutory obligations. With <strong>' + (total >= 300 ? 'your plant already above the 300-worker threshold, you already carry IR Code Chapter V-B obligations — adding permanent workers does not change the calculus materially.' : 'your plant at ' + total + ' workers, you are below the 300-worker threshold — permanent hire still gives you manageable retrenchment obligations.') + '</strong>';
    } else if (tid === 'apprentice') {
      aiText = '<strong>NAPS apprenticeship</strong> is the highest-value structure for <strong>' + S.count + ' ' + S.skill + ' ' + S.role + 's over ' + S.duration + ' months</strong>. The NAPS subsidy of ₹1,500/month per apprentice reduces your effective monthly cost significantly. Two mandatory actions before deployment: register on the NAPS portal and file Form 10 with the RDAT within 30 days. Assign one certified supervisor per five apprentices — this is a statutory requirement, not a recommendation.';
    } else if (tid === 'hybrid') {
      aiText = 'The <strong>hybrid fixed-term-via-contractor</strong> model suits your ' + S.duration + '-month demand given the demand fluctuation you indicated. Ensure the contractor issues proper FTE contracts for each worker — sham FTE arrangements are under heightened OSHC inspector scrutiny post-November 2025. Quarterly audits of contractor compliance are non-negotiable with this structure.';
    } else {
      aiText = 'Multiple structures are blocked for this scenario — most often a contractor ratio above the safe limit or a duration that does not fit any clean legal path. Revisit Steps 1–2 and adjust the duration, the headcount, or the current contractor base to open a compliant route.';
    }
    document.getElementById('kn-ai-block').innerHTML =
      '<div class="kn-ai">' +
        '<div class="kn-ai-label"><div class="kn-ai-dot"></div> Karya Vaani decision engine · recommendation</div>' +
        '<div class="kn-ai-text">' + aiText + '</div>' +
      '</div>';

    /* option cards */
    document.getElementById('kn-wf-cards').innerHTML = opts.map(function (o) {
      const isBest = o.best && o.allowed;
      const fillColor = o.compScore > 80 ? 'var(--green)' : o.compScore > 60 ? 'var(--amber)' : 'var(--red)';
      return '<div class="kn-wf-card ' + (isBest ? 'best' : !o.allowed ? 'blocked' : '') + '">' +
        '<div class="kn-wf-banner">' +
          '<div class="kn-wf-name">' + o.icon + ' ' + o.label + '</div>' +
          '<div class="kn-wf-banner-tags">' +
            (isBest ? '<span class="kn-wf-tag best">★ Best fit</span>' : '') +
            (!o.allowed ? '<span class="kn-wf-tag blocked">Not recommended</span>' : '') +
            '<span class="kn-wf-tag ' + o.compColor + '">' + o.compLabel + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="kn-wf-body">' +
          (o.blockedReason ? '<div class="kn-blocked-notice">' + o.blockedReason + '</div>' : '') +
          '<div class="kn-wf-metrics">' +
            '<div class="kn-wf-metric"><div class="kn-wf-metric-l">Monthly cost</div>' +
              '<div class="kn-wf-metric-v">₹' + knFmt(Math.round(o.monthly / 1000)) + 'K</div></div>' +
            '<div class="kn-wf-metric"><div class="kn-wf-metric-l">' + S.duration + '-month total</div>' +
              '<div class="kn-wf-metric-v ' + (o.best ? 'g' : '') + '">₹' + knFmtL(o.total) + '</div></div>' +
            '<div class="kn-wf-metric"><div class="kn-wf-metric-l">Onboarding</div>' +
              '<div class="kn-wf-metric-v">₹' + knFmt(Math.round(o.onboard / 1000)) + 'K</div></div>' +
            '<div class="kn-wf-metric"><div class="kn-wf-metric-l">Exit cost</div>' +
              '<div class="kn-wf-metric-v">₹' + knFmt(Math.round(o.exit / 1000)) + 'K</div></div>' +
          '</div>' +
          '<div class="kn-wf-seclabel">Labour Code obligations triggered</div>' +
          '<div class="kn-trigger-list">' +
            o.triggers.map(function (t) {
              return '<div class="kn-trigger"><div class="kn-trigger-dot"></div><span>' + t + '</span></div>';
            }).join('') +
          '</div>' +
          '<div class="kn-comp-track"><div class="kn-comp-fill" style="width:' + o.compScore + '%;background:' + fillColor + '"></div></div>' +
          (o.allowed ?
            '<div class="kn-actions">' +
              '<div class="kn-wf-seclabel">Actions if you choose this path</div>' +
              o.actions.map(function (a) {
                return '<div class="kn-action"><span class="kn-action-arrow">→</span><span>' + a + '</span></div>';
              }).join('') +
              '<div class="kn-irnote"><strong>IR Code note:</strong> ' + o.irNote + '</div>' +
            '</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ── export decision memo (plain-text, via mail-client-free download) ── */
  function knExport() {
    const S = KN_STATE;
    const opts = knComputeOptions();
    const top  = opts.find(function (o) { return o.allowed && o.best; }) || opts.find(function (o) { return o.allowed; });
    const lines = [
      'KARYA VAANI · KARYA NIRṆAY — WORKFORCE DECISION MEMO',
      'Generated ' + new Date().toLocaleString('en-IN'),
      '',
      'SCENARIO',
      '  Role / volume   : ' + S.count + ' × ' + S.role + ' (' + S.skill + ')',
      '  Duration        : ' + S.duration + ' months',
      '  Deployment state: ' + S.state,
      '  Current plant   : ' + S.plant_hc + ' direct / ' + S.contractor_hc + ' contract',
      '  Urgency         : ' + S.urgency,
      '  Budget stance   : ' + S.budget,
      '  Financial budget: ₹' + (S.budgetAmt || '—') + ' ' +
        (S.budgetBasis === 'annual' ? 'per annum' : 'per month'),
      '  Work continuity : ' + S.continuity,
      '',
      'RECOMMENDED STRUCTURE',
      '  ' + (top ? top.label : 'No compliant structure — revise constraints'),
      top ? '  ' + S.duration + '-month total cost : ₹' + knFmtL(top.total) : '',
      top ? '  Compliance score      : ' + top.compScore + '/100' : '',
      '',
      'This memo is indicative. Verify against the current Rule library bundle before action.'
    ].filter(Boolean);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = 'karya-nirnay-decision-memo.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Decision memo exported', 'green');
  }

  /* init the builder once the DOM is ready */
  function initKn() {
    if (!document.getElementById('kn-panel-0')) return;
    knSyncState();
    document.querySelectorAll('#kn-toggles .kn-tog').forEach(function (t) {
      t.classList.toggle('on', !!KN_STATE.toggles[t.dataset.key]);
    });
  }
  __kvOnReady(initKn);

  /* ════════════════════════════════════════════════════════════════
     VAANI TRANSLATION & BROADCASTING — engine
     Merged workflow: compose (email-style) → translate into two Indian
     languages with voice playback → broadcast to a targeted audience
     (department, location, supervisors…) with live ACK tracking.
     All state namespaced (VB_STATE / vb*).
     ════════════════════════════════════════════════════════════════ */

  /* supported Indian languages for the demo picker */
  const VB_LANGS = [
    { code: 'TE', name: 'Telugu',    glyph: 'తె' },
    { code: 'HI', name: 'Hindi',     glyph: 'हि' },
    { code: 'TA', name: 'Tamil',     glyph: 'த' },
    { code: 'OR', name: 'Odia',      glyph: 'ଓ' },
    { code: 'BN', name: 'Bengali',   glyph: 'বা' },
    { code: 'MR', name: 'Marathi',   glyph: 'म' }
  ];

  /* worker pool — used both for the named demo rows and to size audiences.
     `dept` and `super` drive the audience groups. */
  let VB_WORKERS = (window.__KVDATA && window.__KVDATA.broadcastWorkers) || [];

  /* audience groups — each resolves to a set of worker ids.
     headcount carries the production-scale number; `ids` is the demo subset
     actually shown row-by-row so the live broadcast stays demo-sized. */
  let VB_AUDIENCES = (window.__KVDATA && window.__KVDATA.broadcastAudiences) || [];

  /* preset messages — subject + body */
  const VB_PRESETS = {
    rain: {
      subject: 'Heavy rain — suspend outdoor work',
      body: 'Heavy rain expected this afternoon. All outdoor work to be suspended from 14:00. Move to the nearest covered area when the hooter sounds. Supervisors, please confirm headcount on WhatsApp.'
    },
    evac: {
      subject: 'Evacuation drill — assembly points',
      body: 'Evacuation drill at 15:30 today. Compressor Line proceed to Assembly Area-A near Gate 2. Paint Shop proceed to Area-C behind the canteen. Do not use the elevators. Report to your supervisor at the assembly point.'
    },
    ppe: {
      subject: 'PPE reminder — Compressor Line',
      body: 'PPE reminder for the Compressor Line. Class-B helmet, steel-toe shoes and cut-resistant gloves are mandatory before entering the shop floor. Lockout/Tagout applies whenever you service equipment. Acknowledge that you have read this.'
    },
    heat: {
      subject: 'Heat advisory — summer shift',
      body: 'Heat advisory in effect for the summer shift. Drink water every 30 minutes from the marked stations. Take your rest break in the cooled rest area. Report any dizziness or cramps to your supervisor immediately. Acknowledge that you have read this.'
    },
    roster: {
      subject: 'Shift roster change — effective Monday',
      body: 'The shift roster changes from Monday. General shift moves to 07:00–15:30. Check your updated shift and team on the notice board or the Karya Vaani app. Supervisors will confirm your shift in person. Reply on WhatsApp if your shift is unclear.'
    },
    wage: {
      subject: 'Minimum wage revision — 2026',
      body: 'The 2026 minimum wage revision is now in effect. The revised rates and the VDA component are posted on the notice board and in the Karya Vaani app. Your next pay slip will reflect the new rate. Contact Plant HR if you have any questions.'
    },
    holiday: {
      subject: 'Holiday — plant closed',
      body: 'The plant will remain closed on the declared holiday. No shift will operate. Company transport will not run on that day. The full 2026 holiday list is posted on the notice board. Acknowledge that you have read this.'
    },
    induction: {
      subject: 'Induction training — new joiners',
      body: 'New joiners must complete the general plant induction module before reaching the shop floor. The module is short and ends with a quiz. Passing all mandatory modules earns your safety certificate. Speak to your supervisor to schedule your session.'
    },
    fire: {
      subject: 'Fire-safety reminder — all zones',
      body: 'Fire-safety reminder for all zones. Know the two nearest exits from your work area and keep them clear at all times. On the fire alarm, stop work, switch off your machine, and walk — do not run — to your assembly point. Do not use the lifts. Acknowledge that you have read this.'
    },
    transport: {
      subject: 'Transport schedule update',
      body: 'The company transport schedule has been updated. Check your pickup point and timing on the notice board or the Karya Vaani app. Morning, general and late-shift buses each run on their own schedule. Be at your pickup point 5 minutes early — buses do not wait beyond the scheduled minute.'
    }
  };

  /* ── Knowledge Center documents offered as broadcast templates ──
     Each maps a KC doc id to a worker-facing subject + body. Selecting
     one in the Template dropdown loads it just like a built-in preset. */
  const VB_KC_TEMPLATES = {
    'kc-301': {
      subject: 'Minimum wage revision · 2026',
      body: 'The 2026 minimum wage revision is now notified. AP rates: unskilled ₹13,210, semi-skilled ₹14,260, skilled ₹15,860, highly skilled ₹17,290 per month, inclusive of VDA. The revision notice is posted on the notice board. Your next pay slip reflects the new rate. Contact Plant HR with any questions.'
    },
    'kc-305': {
      subject: 'Shift roster change · May',
      body: 'The May shift roster has changed. Check your updated shift and team on the notice board or the Karya Vaani app. Your supervisor will confirm your shift in person. Reply on WhatsApp if your shift timing is unclear to you.'
    },
    'kc-306': {
      subject: 'Holiday list · 2026',
      body: 'The 2026 holiday list is now published and posted on the notice board. On declared holidays the plant remains closed and company transport does not run. Plan your leave around these dates. Acknowledge that you have read this.'
    },
    'kc-307': {
      subject: 'Paint Shop Zone-3 · safety alert',
      body: 'Safety alert for Paint Shop Zone-3. A repeat near-miss pattern has been identified in this zone. Wear your chemical-resistant gloves and respirator at all times. Follow the solvent-handling procedure. Report any unsafe condition to your supervisor immediately. Acknowledge that you have read this.'
    },
    'kc-308': {
      subject: 'Heat advisory · summer shift',
      body: 'Heat advisory in effect for the summer shift. Drink water every 30 minutes from the marked stations. Take your rest break in the cooled rest area. Report any dizziness, headache or cramps to your supervisor at once. Acknowledge that you have read this.'
    },
    'kc-309': {
      subject: 'Evacuation drill · notice',
      body: 'An evacuation drill is scheduled. On the alarm, stop work and walk to your assembly point — Compressor Line to Area-A near Gate 2, Paint Shop to Area-C behind the canteen, Warehouse to Area-B. Do not use the lifts. Report to your supervisor at the assembly point.'
    },
    'kc-401': {
      subject: 'Bus route map & timings · all zones',
      body: 'The company bus route map and timings for all zones are updated. Check your pickup point and shift timing on the notice board or the Karya Vaani app. Morning, general and late-shift buses run on separate schedules. Be at your pickup point 5 minutes early.'
    },
    'kc-405': {
      subject: 'Shift transport schedule',
      body: 'The shift transport schedule has been updated. Your pickup point and timing depend on your shift — check the schedule on the notice board or the Karya Vaani app. The last late-shift drop leaves the plant at 23:15. Buses do not wait beyond the scheduled minute.'
    }
  };

  /* template option labels for the dropdown */
  const VB_PRESET_LABELS = {
    rain: 'Heavy rain — suspend outdoor work',
    evac: 'Evacuation drill — assembly points',
    ppe: 'PPE reminder — Compressor Line',
    heat: 'Heat advisory — summer shift',
    fire: 'Fire-safety reminder — all zones',
    roster: 'Shift roster change',
    wage: 'Minimum wage revision — 2026',
    holiday: 'Holiday — plant closed',
    induction: 'Induction training — new joiners',
    transport: 'Transport schedule update'
  };

  /* curated VAANI translations — every preset in every supported language */
  const VB_TRANSLATIONS = {
    rain: {
      TE: 'ఈ మధ్యాహ్నం భారీ వర్షం అంచనా. 14:00 నుండి అన్ని బహిరంగ పనులు నిలిపివేయాలి. హూటర్ మోగగానే సమీప కవర్ ఉన్న ప్రాంతానికి వెళ్లండి. సూపర్‌వైజర్లు దయచేసి వాట్సాప్‌లో హాజరు సంఖ్యను నిర్ధారించండి.',
      HI: 'आज दोपहर भारी बारिश की संभावना है। 14:00 बजे से सभी बाहरी काम बंद कर दें। हूटर बजते ही नज़दीकी ढके हुए क्षेत्र में चले जाएँ। सुपरवाइज़र कृपया व्हाट्सऐप पर हेडकाउंट की पुष्टि करें।',
      TA: 'இன்று பிற்பகல் கனமழை எதிர்பார்க்கப்படுகிறது. 14:00 மணி முதல் அனைத்து வெளிப்புறப் பணிகளும் நிறுத்தப்பட வேண்டும். ஹூட்டர் ஒலித்தவுடன் அருகிலுள்ள மூடப்பட்ட பகுதிக்குச் செல்லுங்கள். மேற்பார்வையாளர்களே, வாட்ஸ்அப்பில் ஆட்தொகையை உறுதிப்படுத்துங்கள்.',
      OR: 'ଆଜି ଅପରାହ୍ନରେ ପ୍ରବଳ ବର୍ଷା ଆଶଙ୍କା। 14:00ରୁ ସମସ୍ତ ବାହ୍ୟ କାର୍ଯ୍ୟ ବନ୍ଦ କରାଯିବ। ହୁଟର୍ ବାଜିବା ମାତ୍ରେ ନିକଟସ୍ଥ ଆଚ୍ଛାଦିତ ସ୍ଥାନକୁ ଯାଆନ୍ତୁ। ସୁପରଭାଇଜରମାନେ ଦୟାକରି ହ୍ୱାଟସ୍‌ଆପ୍‌ରେ ହେଡକାଉଣ୍ଟ ନିଶ୍ଚିତ କରନ୍ତୁ।',
      BN: 'আজ বিকেলে ভারী বৃষ্টির সম্ভাবনা। 14:00 থেকে সমস্ত বাইরের কাজ বন্ধ রাখতে হবে। হুটার বাজলে নিকটতম ঢাকা জায়গায় চলে যান। সুপারভাইজাররা অনুগ্রহ করে হোয়াটসঅ্যাপে হেডকাউন্ট নিশ্চিত করুন।',
      MR: 'आज दुपारी जोरदार पावसाची शक्यता आहे. 14:00 पासून सर्व बाहेरील कामे थांबवावीत. हूटर वाजताच जवळच्या आच्छादित जागी जा. पर्यवेक्षकांनी कृपया व्हॉट्सअ‍ॅपवर हेडकाउंटची पुष्टी करावी.'
    },
    evac: {
      TE: 'ఈ రోజు 15:30కి తరలింపు డ్రిల్. కంప్రెసర్ లైన్ గేట్ 2 వద్ద ఉన్న అసెంబ్లీ ఏరియా-Aకి వెళ్లండి. పెయింట్ షాప్ క్యాంటీన్ వెనుక ఏరియా-Cకి వెళ్లండి. లిఫ్ట్‌లు వాడకండి. అసెంబ్లీ పాయింట్ వద్ద మీ సూపర్‌వైజర్‌కు రిపోర్ట్ చేయండి.',
      HI: 'आज 15:30 बजे निकासी ड्रिल। कंप्रेसर लाइन गेट 2 के पास असेंबली एरिया-A में जाएँ। पेंट शॉप कैंटीन के पीछे एरिया-C में जाएँ। लिफ्ट का उपयोग न करें। असेंबली पॉइंट पर अपने सुपरवाइज़र को रिपोर्ट करें।',
      TA: 'இன்று 15:30 மணிக்கு வெளியேற்றப் பயிற்சி. கம்ப்ரசர் லைன் நுழைவாயில் 2 அருகிலுள்ள ஒன்றுகூடும் பகுதி-Aக்குச் செல்லுங்கள். பெயிண்ட் ஷாப் உணவகத்திற்குப் பின்னால் உள்ள பகுதி-Cக்குச் செல்லுங்கள். மின் தூக்கிகளைப் பயன்படுத்த வேண்டாம். ஒன்றுகூடும் இடத்தில் உங்கள் மேற்பார்வையாளரிடம் தெரிவியுங்கள்.',
      OR: 'ଆଜି 15:30ରେ ନିଷ୍କାସନ ଡ୍ରିଲ୍। କମ୍ପ୍ରେସର୍ ଲାଇନ୍ ଗେଟ୍ 2 ନିକଟସ୍ଥ ଆସେମ୍ବଲି ଏରିଆ-Aକୁ ଯାଆନ୍ତୁ। ପେଣ୍ଟ ସପ୍ କ୍ୟାଣ୍ଟିନ୍ ପଛ ଏରିଆ-Cକୁ ଯାଆନ୍ତୁ। ଲିଫ୍ଟ ବ୍ୟବହାର କରନ୍ତୁ ନାହିଁ। ଆସେମ୍ବଲି ପଏଣ୍ଟରେ ଆପଣଙ୍କ ସୁପରଭାଇଜରଙ୍କୁ ରିପୋର୍ଟ କରନ୍ତୁ।',
      BN: 'আজ 15:30-এ সরিয়ে নেওয়ার মহড়া। কম্প্রেসর লাইন গেট 2-এর কাছে অ্যাসেম্বলি এরিয়া-A-তে যান। পেইন্ট শপ ক্যান্টিনের পিছনে এরিয়া-C-তে যান। লিফট ব্যবহার করবেন না। অ্যাসেম্বলি পয়েন্টে আপনার সুপারভাইজারকে জানান।',
      MR: 'आज 15:30 वाजता निर्वासन कवायत. कंप्रेसर लाइन गेट 2 जवळील असेंब्ली एरिया-A कडे जा. पेंट शॉप कॅन्टीनच्या मागील एरिया-C कडे जा. लिफ्ट वापरू नका. असेंब्ली पॉइंटवर तुमच्या पर्यवेक्षकाला कळवा.'
    },
    ppe: {
      TE: 'కంప్రెసర్ లైన్‌కు PPE రిమైండర్. షాప్ ఫ్లోర్‌లోకి ప్రవేశించే ముందు క్లాస్-B హెల్మెట్, స్టీల్-టో షూస్, కట్-రెసిస్టెంట్ గ్లోవ్స్ తప్పనిసరి. పరికరాలను సర్వీస్ చేసేటప్పుడు లాకౌట్/ట్యాగౌట్ వర్తిస్తుంది. మీరు దీన్ని చదివినట్లు నిర్ధారించండి.',
      HI: 'कंप्रेसर लाइन के लिए PPE अनुस्मारक। शॉप फ्लोर में प्रवेश से पहले क्लास-B हेलमेट, स्टील-टो जूते और कट-रेसिस्टेंट दस्ताने अनिवार्य हैं। उपकरण की सर्विस करते समय लॉकआउट/टैगआउट लागू होता है। पुष्टि करें कि आपने इसे पढ़ लिया है।',
      TA: 'கம்ப்ரசர் லைனுக்கான PPE நினைவூட்டல். ஷாப் ஃப்ளோருக்குள் நுழைவதற்கு முன் வகுப்பு-B தலைக்கவசம், எஃகு-முனை காலணிகள், வெட்டு-எதிர்ப்புக் கையுறைகள் கட்டாயம். உபகரணத்தைப் பராமரிக்கும்போது லாக்அவுட்/டேக்அவுட் பொருந்தும். இதைப் படித்ததாக உறுதிப்படுத்துங்கள்.',
      OR: 'କମ୍ପ୍ରେସର୍ ଲାଇନ୍ ପାଇଁ PPE ସ୍ମାରକ। ସପ୍ ଫ୍ଲୋରରେ ପ୍ରବେଶ ପୂର୍ବରୁ କ୍ଲାସ୍-B ହେଲମେଟ୍, ଷ୍ଟିଲ୍-ଟୋ ଜୋତା ଓ କଟ୍-ରେସିଷ୍ଟାଣ୍ଟ ଗ୍ଲୋଭ୍ସ ବାଧ୍ୟତାମୂଳକ। ଉପକରଣ ସର୍ଭିସ୍ କଲାବେଳେ ଲକଆଉଟ୍/ଟ୍ୟାଗଆଉଟ୍ ପ୍ରଯୁଜ୍ୟ। ଆପଣ ଏହା ପଢ଼ିଛନ୍ତି ବୋଲି ନିଶ୍ଚିତ କରନ୍ତୁ।',
      BN: 'কম্প্রেসর লাইনের জন্য PPE অনুস্মারক। শপ ফ্লোরে প্রবেশের আগে ক্লাস-B হেলমেট, স্টিল-টো জুতা ও কাট-রেসিস্ট্যান্ট গ্লাভস বাধ্যতামূলক। যন্ত্র সার্ভিস করার সময় লকআউট/ট্যাগআউট প্রযোজ্য। আপনি এটি পড়েছেন বলে নিশ্চিত করুন।',
      MR: 'कंप्रेसर लाइनसाठी PPE स्मरणपत्र. शॉप फ्लोरमध्ये प्रवेश करण्यापूर्वी क्लास-B हेल्मेट, स्टील-टो शूज आणि कट-रेझिस्टंट हातमोजे अनिवार्य आहेत. उपकरणांची सर्व्हिस करताना लॉकआउट/टॅगआउट लागू होतो. तुम्ही हे वाचले असल्याची पुष्टी करा.'
    },
    heat: {
      TE: 'వేసవి షిఫ్ట్‌కు హీట్ అడ్వైజరీ అమల్లో ఉంది. గుర్తించిన స్టేషన్ల నుండి ప్రతి 30 నిమిషాలకు నీరు తాగండి. చల్లని విశ్రాంతి ప్రాంతంలో మీ విశ్రాంతి విరామం తీసుకోండి. తల తిరగడం లేదా తిమ్మిరి అనిపిస్తే వెంటనే మీ సూపర్‌వైజర్‌కు తెలియజేయండి.',
      HI: 'गर्मी की शिफ्ट के लिए हीट एडवाइज़री लागू है। चिह्नित स्टेशनों से हर 30 मिनट में पानी पिएँ। ठंडे विश्राम क्षेत्र में अपना ब्रेक लें। चक्कर या ऐंठन महसूस होने पर तुरंत अपने सुपरवाइज़र को बताएँ।'
    },
    roster: {
      TE: 'సోమవారం నుండి షిఫ్ట్ రోస్టర్ మారుతుంది. జనరల్ షిఫ్ట్ 07:00–15:30కి మారుతుంది. మీ నవీకరించిన షిఫ్ట్, టీమ్‌ను నోటీసు బోర్డు లేదా కార్య వాణి యాప్‌లో చూడండి. మీ షిఫ్ట్ స్పష్టంగా లేకపోతే వాట్సాప్‌లో సమాధానం ఇవ్వండి.',
      HI: 'सोमवार से शिफ्ट रोस्टर बदल रहा है। जनरल शिफ्ट 07:00–15:30 हो जाएगी। अपनी अद्यतन शिफ्ट और टीम नोटिस बोर्ड या कार्य वाणी ऐप पर देखें। शिफ्ट स्पष्ट न हो तो व्हाट्सऐप पर उत्तर दें।'
    },
    wage: {
      TE: '2026 కనీస వేతన సవరణ ఇప్పుడు అమల్లో ఉంది. సవరించిన రేట్లు, VDA భాగం నోటీసు బోర్డు, కార్య వాణి యాప్‌లో ఉన్నాయి. మీ తదుపరి పే స్లిప్‌లో కొత్త రేటు కనిపిస్తుంది. సందేహాలుంటే ప్లాంట్ HRను సంప్రదించండి.',
      HI: '2026 न्यूनतम वेतन संशोधन अब लागू है। संशोधित दरें और VDA घटक नोटिस बोर्ड और कार्य वाणी ऐप पर हैं। आपकी अगली पे स्लिप में नई दर दिखेगी। प्रश्न हों तो प्लांट HR से संपर्क करें।'
    },
    holiday: {
      TE: 'ప్రకటిత సెలవు రోజున ప్లాంట్ మూసివేయబడుతుంది. ఏ షిఫ్ట్ నడవదు. ఆ రోజు కంపెనీ రవాణా ఉండదు. పూర్తి 2026 సెలవుల జాబితా నోటీసు బోర్డులో ఉంది. మీరు దీన్ని చదివినట్లు నిర్ధారించండి.',
      HI: 'घोषित अवकाश के दिन प्लांट बंद रहेगा। कोई शिफ्ट नहीं चलेगी। उस दिन कंपनी परिवहन नहीं चलेगा। पूरी 2026 अवकाश सूची नोटिस बोर्ड पर है। पुष्टि करें कि आपने इसे पढ़ लिया है।'
    },
    induction: {
      TE: 'కొత్త జాయినర్లు షాప్ ఫ్లోర్‌కు చేరుకునే ముందు సాధారణ ప్లాంట్ ఇండక్షన్ మాడ్యూల్‌ను పూర్తి చేయాలి. మాడ్యూల్ చిన్నది, చివర క్విజ్ ఉంటుంది. అన్ని తప్పనిసరి మాడ్యూల్‌లు పాస్ అయితే భద్రతా సర్టిఫికేట్ లభిస్తుంది. సెషన్ షెడ్యూల్ చేయడానికి మీ సూపర్‌వైజర్‌తో మాట్లాడండి.',
      HI: 'नए जॉइनर्स को शॉप फ्लोर पर पहुँचने से पहले सामान्य प्लांट इंडक्शन मॉड्यूल पूरा करना होगा। मॉड्यूल छोटा है और अंत में क्विज़ होती है। सभी अनिवार्य मॉड्यूल पास करने पर सुरक्षा प्रमाणपत्र मिलता है। सत्र निर्धारित करने के लिए अपने सुपरवाइज़र से बात करें।'
    },
    fire: {
      TE: 'అన్ని జోన్‌లకు అగ్నిమాపక భద్రతా రిమైండర్. మీ పని ప్రాంతం నుండి దగ్గరి రెండు నిష్క్రమణ మార్గాలను తెలుసుకోండి, వాటిని ఎల్లప్పుడూ ఖాళీగా ఉంచండి. ఫైర్ అలారం మోగితే పని ఆపండి, మీ యంత్రాన్ని ఆఫ్ చేయండి, పరిగెత్తకుండా నడుచుకుంటూ మీ అసెంబ్లీ పాయింట్‌కు వెళ్లండి. లిఫ్ట్‌లు వాడకండి. మీరు దీన్ని చదివినట్లు నిర్ధారించండి.',
      HI: 'सभी ज़ोन के लिए अग्नि-सुरक्षा अनुस्मारक। अपने कार्य क्षेत्र से नज़दीकी दो निकास जानें और उन्हें हमेशा खुला रखें। फायर अलार्म बजने पर काम रोकें, अपनी मशीन बंद करें, और दौड़े बिना — चलते हुए — अपने असेंबली पॉइंट पर जाएँ। लिफ्ट का उपयोग न करें। पुष्टि करें कि आपने इसे पढ़ लिया है।'
    },
    transport: {
      TE: 'కంపెనీ రవాణా షెడ్యూల్ నవీకరించబడింది. మీ పికప్ పాయింట్, సమయాన్ని నోటీసు బోర్డు లేదా కార్య వాణి యాప్‌లో చూడండి. ఉదయం, జనరల్, లేట్-షిఫ్ట్ బస్సులు వేటి షెడ్యూల్‌లో అవి నడుస్తాయి. మీ పికప్ పాయింట్‌కు 5 నిమిషాలు ముందుగా చేరుకోండి — బస్సులు షెడ్యూల్ సమయం దాటి వేచి ఉండవు.',
      HI: 'कंपनी परिवहन शेड्यूल अपडेट किया गया है। अपना पिकअप पॉइंट और समय नोटिस बोर्ड या कार्य वाणी ऐप पर देखें। सुबह, जनरल और लेट-शिफ्ट बसें अपने-अपने शेड्यूल पर चलती हैं। अपने पिकअप पॉइंट पर 5 मिनट पहले पहुँचें — बसें निर्धारित समय से आगे इंतज़ार नहीं करतीं।'
    }
  };

  const VB_STATE = {
    step: 0,
    preset: 'rain',
    subject: VB_PRESETS.rain.subject,
    source: VB_PRESETS.rain.body,
    langs: ['TE', 'HI'],          /* exactly two */
    audiences: ['production'],    /* selected audience group ids */
    translations: null,           /* { TE:'…', HI:'…' } once translated */
    sent: false,
    msgId: null,
    rows: [],                     /* per-worker delivery state */
    playing: null                 /* language code currently "playing" */
  };

  function vbLang(code) { return VB_LANGS.find(function (l) { return l.code === code; }) || { code: code, name: code, glyph: code }; }
  function vbAud(id)    { return VB_AUDIENCES.find(function (a) { return a.id === id; }); }

  /* resolve selected audiences → unique worker objects + total headcount */
  function vbResolveRecipients() {
    const ids = {};
    let headcount = 0;
    VB_STATE.audiences.forEach(function (aid) {
      const a = vbAud(aid);
      if (!a) return;
      headcount += a.headcount;
      a.ids.forEach(function (wid) { ids[wid] = true; });
    });
    /* 'all' supersedes everything for headcount display */
    if (VB_STATE.audiences.indexOf('all') > -1) headcount = vbAud('all').headcount;
    const workers = VB_WORKERS.filter(function (w) { return ids[w.id]; });
    return { workers: workers, headcount: headcount };
  }

  /* ── audience picker (To: field) ── */
  function vbRenderAudChips() {
    const wrap = document.getElementById('vb-aud-chips');
    if (!wrap) return;
    let html = VB_STATE.audiences.map(function (aid) {
      const a = vbAud(aid);
      if (!a) return '';
      return '<span class="vbm-chip">' + a.name +
        '<span class="vbm-chip-count">' + a.headcount.toLocaleString('en-IN') + '</span>' +
        '<span class="vbm-chip-x" onclick="vbRemoveAud(\'' + aid + '\')" title="Remove">✕</span></span>';
    }).join('');
    html += '<button class="vbm-addbtn" onclick="vbToggleAudPop(event)">+ Add audience</button>';
    wrap.innerHTML = html;
  }

  function vbToggleAudPop(ev) {
    if (ev) ev.stopPropagation();
    const pop = document.getElementById('vb-aud-pop');
    if (pop.style.display === 'block') { pop.style.display = 'none'; return; }
    /* group the audiences by kind */
    const kinds = [];
    VB_AUDIENCES.forEach(function (a) { if (kinds.indexOf(a.kind) < 0) kinds.push(a.kind); });
    pop.innerHTML = kinds.map(function (kind) {
      const items = VB_AUDIENCES.filter(function (a) { return a.kind === kind; });
      return '<div class="vbm-aud-grouplabel">' + kind + '</div>' +
        items.map(function (a) {
          const on = VB_STATE.audiences.indexOf(a.id) > -1;
          return '<div class="vbm-aud-item ' + (on ? 'on' : '') + '" onclick="vbPickAud(\'' + a.id + '\')">' +
            '<span class="vbm-aud-check">' + (on ? '✓' : '') + '</span>' +
            '<span class="vbm-aud-main"><span class="vbm-aud-name">' + a.name + '</span>' +
            '<span class="vbm-aud-sub">' + a.sub + '</span></span>' +
            '<span class="vbm-aud-cnt">' + a.headcount.toLocaleString('en-IN') + '</span>' +
          '</div>';
        }).join('');
    }).join('');
    pop.style.display = 'block';
  }

  function vbPickAud(aid) {
    const i = VB_STATE.audiences.indexOf(aid);
    if (i > -1) {
      VB_STATE.audiences.splice(i, 1);
    } else {
      /* 'Entire location' is exclusive — it covers everyone */
      if (aid === 'all') VB_STATE.audiences = [];
      else VB_STATE.audiences = VB_STATE.audiences.filter(function (x) { return x !== 'all'; });
      VB_STATE.audiences.push(aid);
    }
    vbRenderAudChips();
    vbToggleAudPop();   /* re-render the open popover */
    vbToggleAudPop();
  }

  function vbRemoveAud(aid) {
    VB_STATE.audiences = VB_STATE.audiences.filter(function (x) { return x !== aid; });
    vbRenderAudChips();
  }

  /* close the popover on an outside click */
  document.addEventListener('click', function (e) {
    const pop = document.getElementById('vb-aud-pop');
    if (!pop || pop.style.display !== 'block') return;
    if (!pop.contains(e.target) && !(e.target.classList && e.target.classList.contains('vbm-addbtn'))) {
      pop.style.display = 'none';
    }
  });

  /* ── language picker (exactly two) ── */
  function vbRenderLangs() {
    const wrap = document.getElementById('vb-langs');
    if (!wrap) return;
    wrap.innerHTML = VB_LANGS.map(function (l) {
      const on = VB_STATE.langs.indexOf(l.code) > -1;
      const locked = !on && VB_STATE.langs.length >= 2;
      return '<span class="lang-chip vb-lang-chip ' + (on ? 'on' : '') + (locked ? ' locked' : '') +
        '" onclick="vbToggleLang(\'' + l.code + '\')">' + l.glyph + '&nbsp;' + l.name + '</span>';
    }).join('');
  }

  function vbToggleLang(code) {
    const i = VB_STATE.langs.indexOf(code);
    if (i > -1) {
      VB_STATE.langs.splice(i, 1);
    } else {
      if (VB_STATE.langs.length >= 2) {
        toast('Pick exactly two languages — deselect one first', 'red');
        return;
      }
      VB_STATE.langs.push(code);
    }
    vbMarkDirty();
    vbRenderLangs();
  }

  function vbApplyPreset() {
    const v = document.getElementById('vb-preset').value;
    VB_STATE.preset = v;
    if (v === 'custom') { vbMarkDirty(); return; }
    /* Knowledge Center document template */
    if (v.indexOf('kc-') === 0 && VB_KC_TEMPLATES[v]) {
      document.getElementById('vb-source').value = VB_KC_TEMPLATES[v].body;
      document.getElementById('vb-subject').value = VB_KC_TEMPLATES[v].subject;
      VB_STATE.source = VB_KC_TEMPLATES[v].body;
      VB_STATE.subject = VB_KC_TEMPLATES[v].subject;
      const doc = (typeof kcDocById === 'function') ? kcDocById(v) : null;
      const hint = document.getElementById('vb-template-hint');
      if (hint && doc) hint.textContent = 'Loaded from Knowledge Center · ' + doc.title + ' · ' + doc.dept + ' · owner ' + doc.owner;
      vbMarkDirty();
      VB_STATE.preset = v;  /* keep KC id as the preset so the dropdown stays put */
      return;
    }
    /* built-in preset */
    if (VB_PRESETS[v]) {
      /* the transport template is generated live from the weekly plan */
      if (v === 'transport' && typeof trBroadcastBody === 'function') {
        VB_PRESETS.transport = {
          subject: 'Weekly transport schedule · ' + trWeekLabel(),
          body: trBroadcastBody()
        };
        const hint = document.getElementById('vb-template-hint');
        if (hint) hint.textContent = 'Generated live from the Transport Schedule — this week\u2019s 5-bus plan.';
      }
      document.getElementById('vb-source').value = VB_PRESETS[v].body;
      document.getElementById('vb-subject').value = VB_PRESETS[v].subject;
      VB_STATE.source = VB_PRESETS[v].body;
      VB_STATE.subject = VB_PRESETS[v].subject;
    }
    vbMarkDirty();
  }

  /* source edited / language changed → translation is stale */
  function vbMarkDirty() {
    VB_STATE.source = document.getElementById('vb-source').value;
    VB_STATE.subject = document.getElementById('vb-subject').value;
    VB_STATE.translations = null;
    const out = document.getElementById('vb-translation-out');
    if (out) out.style.display = 'none';
    const next = document.getElementById('vb-step1-next');
    if (next) next.disabled = true;
    /* detect whether the body still matches a known preset or KC template */
    let matched = 'custom';
    Object.keys(VB_PRESETS).forEach(function (k) {
      if (VB_PRESETS[k].body === VB_STATE.source.trim()) matched = k;
    });
    Object.keys(VB_KC_TEMPLATES).forEach(function (k) {
      if (VB_KC_TEMPLATES[k].body === VB_STATE.source.trim()) matched = k;
    });
    VB_STATE.preset = matched;
    const sel = document.getElementById('vb-preset');
    if (sel && sel.value !== matched) sel.value = matched;
  }

  /* ── VAANI engine wiring (real open-source models) ──
     Talks to the self-hosted vaani-engine service (IndicTrans2 + MMS/IndicF5).
     If the engine is unreachable the UI falls back to the curated/mock path so
     the demo never hard-breaks — but with the engine running, translation and
     voice are genuinely produced by open-source Indian-language models.
     Configure the host via window.VAANI_ENGINE_URL (default localhost:5060). */
  window.VAANI_ENGINE_URL = window.VAANI_ENGINE_URL || 'http://localhost:5060';
  /* Set window.VAANI_API_KEY (e.g. in index.html) when the engine has auth on. */
  const VB_AUDIO_CACHE = {};   /* code -> object URL (for inline playback) */
  const VB_VOICE_CACHE = {};   /* code -> synthesised WAV Blob (the real voice file) */
  let vbTtsChain = Promise.resolve();   /* serialises every TTS request — the voice model is single-worker */

  function vbEngineUrl(path) { return window.VAANI_ENGINE_URL.replace(/\/$/, '') + path; }
  function vbEngineHeaders() {
    const h = { 'Content-Type': 'application/json' };
    if (window.VAANI_API_KEY) h['x-api-key'] = window.VAANI_API_KEY;
    return h;
  }

  /* POST /translate → resolves to { code: text } */
  function vbEngineTranslate(text, codes) {
    return fetch(vbEngineUrl('/translate'), {
      method: 'POST',
      headers: vbEngineHeaders(),
      body: JSON.stringify({ text: text, targets: codes })
    }).then(function (r) {
      if (!r.ok) throw new Error('translate ' + r.status);
      return r.json();
    }).then(function (j) { return j.translations || {}; });
  }

  /* Low-level TTS call → audio/wav Blob. Goes through the backend proxy
     (/api/tts) so the voice-service address stays server-side and we avoid
     mixed-content / CORS. The model synthesises speech for the supplied
     (already-translated) text. */
  function vbEngineTts(text, code) {
    return fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text })
    }).then(function (r) {
      if (!r.ok) throw new Error('tts ' + r.status);
      return r.blob();
    });
  }

  /* Get the synthesised voice Blob for a language, generating it once and
     caching it. All requests are queued onto vbTtsChain so they hit the
     single-worker voice model strictly one at a time (sequential). The cached
     blob is reused for playback, download AND the email attachment. */
  function vbGetVoice(code) {
    if (VB_VOICE_CACHE[code]) return Promise.resolve(VB_VOICE_CACHE[code]);
    const text = (VB_STATE.translations && VB_STATE.translations[code]) || '';
    if (!text) return Promise.reject(new Error('no translated text for ' + code));
    const run = vbTtsChain.then(function () {
      if (VB_VOICE_CACHE[code]) return VB_VOICE_CACHE[code];   // filled while queued
      return vbEngineTts(text, code).then(function (blob) {
        VB_VOICE_CACHE[code] = blob;
        return blob;
      });
    });
    vbTtsChain = run.catch(function () {});   // keep the queue alive after a failure
    return run;
  }

  /* discard cached voice audio when the translation changes */
  function vbClearAudioCache() {
    Object.keys(VB_AUDIO_CACHE).forEach(function (k) {
      try { URL.revokeObjectURL(VB_AUDIO_CACHE[k]); } catch (e) {}
      delete VB_AUDIO_CACHE[k];
    });
    Object.keys(VB_VOICE_CACHE).forEach(function (k) { delete VB_VOICE_CACHE[k]; });
  }

  /* NLLB-style language codes the VAANI translation service expects.
     Maps our short UI codes → the model's language identifiers. */
  const VB_NLLB = {
    TE: 'tel_Telu', HI: 'hin_Deva', TA: 'tam_Taml',
    OR: 'ory_Orya', BN: 'ben_Beng', MR: 'mar_Deva'
  };

  /* call the live VAANI translation service for one target language.
     Goes through the backend proxy (/api/translate) so the service address
     stays server-side and we avoid mixed-content / CORS issues. */
  async function vbTranslateOne(text, code) {
    // Call backend proxy with frontend language code(s) in `targets` as the
    // VAANI engine expects. The engine maps frontend codes (TE/HI/...) to the
    // internal model identifiers.
    const resp = await fetch('/api/translate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: text, targets: [code] })
    });
    const json = await resp.json().catch(function () { return {}; });
    // The proxy returns the flat single-target shape { success, translation }
    // for one target; tolerate the multi shape { translations: { code } } too.
    const translated = json.translation || (json.translations && json.translations[code]);
    if (!resp.ok || json.success === false || !translated) {
      throw new Error(json.error || ('HTTP ' + resp.status));
    }
    return translated;
  }

  /* curated / simulated rendering used as a graceful fallback when the live
     service is unreachable, so the demo still works fully offline. */
  function vbSimTranslate(code) {
    if (VB_STATE.preset !== 'custom' && VB_TRANSLATIONS[VB_STATE.preset]) {
      return VB_TRANSLATIONS[VB_STATE.preset][code];
    }
    return VB_STATE.source + '  〔' + vbLang(code).name + ' · VAANI Mayura v1〕';
  }

  /* ── translate via the live VAANI service (graceful fallback on failure) ── */
  async function vbTranslate() {
    VB_STATE.source = document.getElementById('vb-source').value.trim();
    VB_STATE.subject = document.getElementById('vb-subject').value.trim();
    if (!VB_STATE.source) { toast('Write a message to translate', 'red'); return; }
    if (VB_STATE.langs.length !== 2) { toast('Pick exactly two target languages', 'red'); return; }
    if (!VB_STATE.audiences.length) { toast('Add at least one audience', 'red'); return; }

    const btn = document.getElementById('vb-translate-btn');
    btn.disabled = true;
    btn.textContent = 'Translating…';

    const out = {};
    let failed = 0;
    // Translate sequentially — the Python service runs a single GPU worker so
    // parallel requests simply queue behind each other, and the second one hits
    // Nginx's proxy_read_timeout before the GPU finishes.  Sequential calls
    // keep each round-trip within the timeout window.
    for (const code of VB_STATE.langs) {
      try {
        out[code] = await vbTranslateOne(VB_STATE.source, code);
      } catch (err) {
        failed++;
        out[code] = vbSimTranslate(code);
      }
    }

    VB_STATE.translations = out;
    vbClearAudioCache();   /* text changed → drop any previously synthesised voices */
    btn.disabled = false;
    btn.textContent = 'Re-translate via VAANI';
    vbRenderTranslations();
    document.getElementById('vb-step1-next').disabled = false;

    const names = VB_STATE.langs.map(function (c) { return vbLang(c).name; }).join(' & ');
    if (failed === 0) {
      toast('Translated into ' + names, 'green');
    } else if (failed < VB_STATE.langs.length) {
      toast('Partly translated — service unavailable for one language, used fallback', 'amber');
    } else {
      toast('Translation service unreachable — showing fallback rendering', 'amber');
    }
  }

  function vbRenderTranslations() {
    const out = document.getElementById('vb-translation-out');
    out.style.display = 'block';
    document.getElementById('vb-translation-cards').innerHTML = VB_STATE.langs.map(function (code) {
      const l = vbLang(code);
      return '<div class="vb-tcard" id="vb-tcard-' + code + '">' +
        '<div class="vb-tcard-h">' +
          '<span class="vb-tcard-lang"><span class="vb-tcard-glyph">' + l.glyph + '</span>' + l.name + '</span>' +
          '<span class="vb-voice-grp">' +
            '<span class="vb-voice" id="vb-voice-' + code + '" onclick="vbPlayVoice(\'' + code + '\')">' +
              '<span class="vb-voice-ico" id="vb-voice-ico-' + code + '">▶</span>' +
              '<span id="vb-voice-label-' + code + '">Play voice</span>' +
            '</span>' +
            '<span class="vb-voice-dl" id="vb-voice-dl-' + code + '" onclick="vbDownloadVoice(\'' + code + '\')" title="Download voice note">' +
              '<span class="vb-voice-ico">⬇</span>' +
              '<span id="vb-voice-dl-label-' + code + '">Download</span>' +
            '</span>' +
          '</span>' +
        '</div>' +
        '<div class="vb-tcard-body">' + VB_STATE.translations[code] + '</div>' +
        '<div class="vb-voice-track" id="vb-voice-track-' + code + '" style="display:none;margin:2px 18px 8px"><span></span></div>' +
        '<div class="vb-tcard-foot">VAANI · open-source voice (IndicTrans2 + MMS-TTS / IndicF5) — Play to hear it aloud, or Download the .wav voice note</div>' +
      '</div>';
    }).join('');
    /* one-time capability hint */
    if (!window.speechSynthesis) {
      const note = document.createElement('div');
      note.className = 'vb-voice-hint';
      note.textContent = 'This browser has no speech engine — the downloaded voice note will still play in any media player.';
      document.getElementById('vb-translation-cards').appendChild(note);
    }
  }

  /* map our language codes to BCP-47 locales for the speech engine */
  const VB_LOCALE = { TE: 'te-IN', HI: 'hi-IN', TA: 'ta-IN', OR: 'or-IN', BN: 'bn-IN', MR: 'mr-IN' };

  /* pick the best-matching installed voice for a locale */
  function vbVoiceFor(locale) {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    const lang2 = locale.split('-')[0];
    return voices.find(function (v) { return v.lang === locale; }) ||
           voices.find(function (v) { return v.lang && v.lang.indexOf(lang2) === 0; }) ||
           null;
  }

  /* ── voice playback — genuinely speaks the translated text aloud ──
     Broadcast-quality delivery: the message is split into sentences and
     spoken as separate utterances with measured pacing, brief pauses and
     gentle pitch variation, so it reads like a professional announcement
     rather than a fast, flat monotone. */
  function vbPlayVoice(code) {
    if (VB_STATE.playing && VB_STATE.playing !== code) vbStopVoice(VB_STATE.playing);
    if (VB_STATE.playing === code) { vbStopVoice(code); return; }
    if (!VB_STATE.translations || !VB_STATE.translations[code]) return;

    VB_STATE.playing = code;
    const chip  = document.getElementById('vb-voice-' + code);
    const ico   = document.getElementById('vb-voice-ico-' + code);
    const label = document.getElementById('vb-voice-label-' + code);
    const track = document.getElementById('vb-voice-track-' + code);
    const bar   = track ? track.firstElementChild : null;
    if (chip)  chip.classList.add('playing');
    if (ico)   ico.innerHTML = '<span class="vb-eq"><span></span><span></span><span></span><span></span></span>';
    if (label) label.textContent = 'Loading · ' + vbLang(code).name;
    if (track) track.style.display = 'block';

    const text = VB_STATE.translations[code];

    /* Preferred path: real synthesised voice from the VAANI engine. */
    const cached = VB_AUDIO_CACHE[code]
      ? Promise.resolve(VB_AUDIO_CACHE[code])
      : vbGetVoice(code).then(function (blob) {
          const url = URL.createObjectURL(blob);
          VB_AUDIO_CACHE[code] = url;
          return url;
        });

    cached.then(function (url) {
      if (VB_STATE.playing !== code) return;           /* user stopped meanwhile */
      const audio = new Audio(url);
      if (chip) chip._audio = audio;
      if (label) label.textContent = 'Playing · ' + vbLang(code).name;
      audio.ontimeupdate = function () {
        if (bar && audio.duration) bar.style.width = Math.min(99, audio.currentTime / audio.duration * 100) + '%';
      };
      audio.onended = function () { if (bar) bar.style.width = '100%'; vbStopVoice(code); };
      audio.onerror = function () { vbPlayVoiceSpeech(code); };
      audio.play().catch(function () { vbPlayVoiceSpeech(code); });
      toast('Playing voice note · ' + vbLang(code).name + ' · VAANI', 'green');
    }).catch(function () {
      /* engine unreachable — fall back to the browser speech engine */
      vbPlayVoiceSpeech(code);
    });
  }

  /* Fallback playback using the browser's built-in speech engine. Assumes the
     UI/“playing” state has already been started by vbPlayVoice. */
  function vbPlayVoiceSpeech(code) {
    VB_STATE.playing = code;
    const chip  = document.getElementById('vb-voice-' + code);
    const ico   = document.getElementById('vb-voice-ico-' + code);
    const label = document.getElementById('vb-voice-label-' + code);
    const track = document.getElementById('vb-voice-track-' + code);
    const bar   = track ? track.firstElementChild : null;
    if (chip)  chip.classList.add('playing');
    if (track) track.style.display = 'block';

    const text   = VB_STATE.translations[code];
    const locale = VB_LOCALE[code] || 'en-IN';

    if (window.speechSynthesis && window.SpeechSynthesisUtterance) {
      window.speechSynthesis.cancel();
      const v = vbVoiceFor(locale);

      /* split into sentence-level phrases for natural, paced delivery */
      const phrases = text.split(/([।.!?])\s+/).reduce(function (acc, part, i) {
        if (i % 2 === 0) acc.push(part);
        else acc[acc.length - 1] += part;
        return acc;
      }, []).filter(function (s) { return s && s.trim(); });
      const total = phrases.length || 1;
      const t0 = Date.now();
      /* estimated duration — slow announcer pace + a beat between phrases */
      const estMs = Math.max(4000, text.length * 135 + total * 420);
      if (chip) chip._timer = setInterval(function () {
        const pct = Math.min(99, (Date.now() - t0) / estMs * 100);
        if (bar) bar.style.width = pct + '%';
      }, 60);

      let idx = 0;
      function speakNext() {
        if (VB_STATE.playing !== code || idx >= phrases.length) {
          if (idx >= phrases.length && bar) bar.style.width = '100%';
          if (idx >= phrases.length) vbStopVoice(code);
          return;
        }
        const u = new SpeechSynthesisUtterance(phrases[idx].trim());
        u.lang = locale;
        if (v) u.voice = v;
        /* measured, professional pace; first phrase a touch slower for weight */
        u.rate = idx === 0 ? 0.78 : 0.84;
        /* gentle pitch contour — a subtle lift mid-message keeps it from
           going flat, then settles for a calm, authoritative close */
        u.pitch = idx === 0 ? 0.96 : (idx === total - 1 ? 0.92 : 1.02);
        u.volume = 1.0;
        u.onend = function () {
          idx++;
          /* a short, deliberate pause between sentences */
          VB_STATE._phraseTimer = setTimeout(speakNext, 360);
        };
        u.onerror = function () { idx++; speakNext(); };
        window.speechSynthesis.speak(u);
      }
      speakNext();

      toast('Engine offline — using browser voice · ' + vbLang(code).name, 'amber');
      if (!v) {
        toast(vbLang(code).name + ' voice not installed in this browser', 'amber');
      }
    } else {
      /* no speech engine — animated fallback only */
      const t0 = Date.now(), dur = 3400;
      if (chip) chip._timer = setInterval(function () {
        const pct = Math.min(100, (Date.now() - t0) / dur * 100);
        if (bar) bar.style.width = pct + '%';
        if (pct >= 100) vbStopVoice(code);
      }, 60);
      toast('No speech engine in this browser — download the voice note instead', 'amber');
    }
  }

  function vbStopVoice(code) {
    const chip  = document.getElementById('vb-voice-' + code);
    const ico   = document.getElementById('vb-voice-ico-' + code);
    const label = document.getElementById('vb-voice-label-' + code);
    const track = document.getElementById('vb-voice-track-' + code);
    if (chip && chip._timer) { clearInterval(chip._timer); chip._timer = null; }
    if (chip && chip._audio) { try { chip._audio.pause(); } catch (e) {} chip._audio = null; }
    if (VB_STATE._phraseTimer) { clearTimeout(VB_STATE._phraseTimer); VB_STATE._phraseTimer = null; }
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    if (chip)  chip.classList.remove('playing');
    if (ico)   ico.textContent = '▶';
    if (label) label.textContent = 'Play voice';
    if (track) {
      track.style.display = 'none';
      if (track.firstElementChild) track.firstElementChild.style.width = '0%';
    }
    if (VB_STATE.playing === code) VB_STATE.playing = null;
  }

  /* ── download the voice note as a real, playable WAV file ──
     Fetches genuine synthesised speech from the VAANI engine (MMS-TTS /
     IndicF5). If the engine is unreachable it falls back to a synthetic
     placeholder tone so the demo still yields a downloadable file — that
     fallback is clearly labelled so it is never mistaken for real audio. */
  function vbDownloadVoice(code) {
    if (!VB_STATE.translations || !VB_STATE.translations[code]) return;
    const lang = vbLang(code);
    const text = VB_STATE.translations[code];
    const fname = 'karya-vaani-voice-' + lang.name.toLowerCase() + '.wav';
    const dlLabel = document.getElementById('vb-voice-dl-label-' + code);
    if (dlLabel) dlLabel.textContent = 'Preparing…';

    vbGetVoice(code)
      .then(function (wavBlob) {
        vbSaveBlob(wavBlob, fname);
        if (dlLabel) dlLabel.textContent = 'Download';
        toast('Voice note downloaded · ' + lang.name + ' · VAANI (' + fname + ')', 'green');
      })
      .catch(function () {
        /* engine offline — synthesise a clearly-labelled placeholder tone */
        const wav = vbBuildWav(text);
        vbSaveBlob(wav, 'PLACEHOLDER-' + fname);
        if (dlLabel) dlLabel.textContent = 'Download';
        toast('Engine offline — saved a placeholder tone, not real voice · ' + lang.name, 'amber');
      });
  }

  /* attempt to record the live speech engine into a WAV blob */
  function vbCaptureSpeech(code, text) {
    return new Promise(function (resolve, reject) {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance ||
          !window.MediaRecorder || !navigator.mediaDevices) { reject(); return; }
      /* MediaRecorder cannot tap the speech engine output directly in most
         browsers, so we treat this path as unavailable and fall back. */
      reject();
    });
  }

  /* build a valid 16-bit PCM WAV — a slower, expressive spoken-cadence
     envelope with a sentence-level pitch contour, so the downloaded file
     sounds like a measured announcement rather than a fast monotone */
  function vbBuildWav(text) {
    const sr = 22050;
    const words = text.split(/\s+/).filter(Boolean);
    /* generous per-word duration → measured, professional pace */
    const wordDur = 0.46;
    const dur = Math.min(26, Math.max(4, words.length * wordDur));
    const n = Math.floor(sr * dur);
    const data = new Float32Array(n);
    /* sentence boundaries drive an intonation contour (lift then settle) */
    const sentCount = Math.max(1, (text.match(/[।.!?]/g) || []).length);
    for (let i = 0; i < n; i++) {
      const t = i / sr;
      const wi = Math.min(words.length - 1, Math.floor(t / wordDur));
      const local = (t % wordDur) / wordDur;            /* 0..1 within a word */
      const progress = wi / Math.max(1, words.length - 1);   /* 0..1 overall */
      /* syllable envelope — smooth rise, sustain, fall, then a clear gap */
      let env;
      if (local < 0.16) env = local / 0.16;
      else if (local < 0.62) env = 1;
      else if (local < 0.78) env = 1 - (local - 0.62) / 0.16;
      else env = 0;                                     /* pause between words */
      /* pitch contour: gentle rise through the first half, settle toward a
         calm, authoritative close — plus per-word variation for cadence */
      const contour = Math.sin(progress * Math.PI) * 18;          /* phrase arc */
      const wordVar = ((words[wi].length % 5) - 2) * 6;           /* word lilt */
      const f0 = 124 + contour + wordVar;
      /* light vibrato for a warmer, less synthetic timbre */
      const vib = 1 + Math.sin(2 * Math.PI * 5 * t) * 0.012;
      const ff = f0 * vib;
      /* three harmonics → fuller, voiced tone */
      let s = Math.sin(2 * Math.PI * ff * t) * 0.58
            + Math.sin(2 * Math.PI * ff * 2 * t) * 0.24
            + Math.sin(2 * Math.PI * ff * 3 * t) * 0.10;
      data[i] = s * env * 0.42;
    }
    /* gentle fade-in / fade-out so it opens and closes cleanly */
    const fade = Math.floor(sr * 0.05);
    for (let i = 0; i < fade; i++) {
      data[i] *= i / fade;
      data[n - 1 - i] *= i / fade;
    }
    /* encode WAV (mono, 16-bit PCM) */
    const buf = new ArrayBuffer(44 + n * 2);
    const dv = new DataView(buf);
    function ws(off, str) { for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i)); }
    ws(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); ws(8, 'WAVE');
    ws(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, 1, true); dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
    ws(36, 'data'); dv.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) {
      let v = Math.max(-1, Math.min(1, data[i]));
      dv.setInt16(44 + i * 2, v * 32767, true);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }

  function vbSaveBlob(blob, fname) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fname;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ── step navigation ── */
  function vbGoStep(n) {
    if (n > 0 && !VB_STATE.translations) {
      toast('Translate the message before continuing', 'red');
      n = 0;
    }
    if (n > 0 && VB_STATE.playing) vbStopVoice(VB_STATE.playing);
    VB_STATE.step = n;
    document.querySelectorAll('.vb-panel').forEach(function (p, i) { p.classList.toggle('active', i === n); });
    for (let i = 0; i < 3; i++) {
      const el = document.getElementById('vb-nav-' + i);
      if (!el) continue;
      el.classList.remove('now', 'done');
      if (i === n) el.classList.add('now');
      else if (i < n) el.classList.add('done');
    }
    /* step 4 (chat analytics) is a navigation handoff — keep it neutral
       unless the broadcast step has been reached, at which point it
       lights as "available next". */
    const step4 = document.getElementById('vb-nav-3');
    if (step4) {
      step4.classList.remove('now', 'done');
      if (n === 2) step4.classList.add('done');   /* broadcast reached → analytics available */
    }
    if (n === 1) vbRenderRecipients();
    if (n === 2) vbRenderBroadcast();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* step 4 · navigate to the standalone Chat analytics section */
  function vbGoToChatAnalytics() {
    if (typeof nav === 'function') {
      // Chat analytics now lives under the Analytics hub's chat tab.
      const item = document.querySelector('[data-onclick="nav(\'analytics\', this)"]');
      nav('analytics', item || null);
      const cur = document.getElementById('current-label');
      if (cur) cur.textContent = 'Analytics';
      if (typeof anTab === 'function') anTab('chat');
    }
  }

  /* ── step 2 · resolved recipients ── */
  function vbRenderRecipients() {
    const res = vbResolveRecipients();
    const langSet = VB_STATE.langs;

    /* audience recap card */
    document.getElementById('vb-aud-recap').innerHTML = VB_STATE.audiences.map(function (aid) {
      const a = vbAud(aid);
      return '<div class="row-between"><span>' + a.name + '<div class="tiny muted">' + a.kind + ' · ' + a.sub + '</div></span>' +
        '<span class="mono t-strong">' + a.headcount.toLocaleString('en-IN') + '</span></div>';
    }).join('') +
    '<hr class="div" style="margin:8px 0"><div class="row-between"><span class="t-strong">Total reach</span>' +
    '<span class="mono t-strong">' + res.headcount.toLocaleString('en-IN') + '</span></div>';

    document.getElementById('vb-aud-summary').textContent =
      'Targeting ' + res.headcount.toLocaleString('en-IN') + ' workers · ' +
      res.workers.length + ' shown in this demo group';

    /* recipient rows — the demo subset */
    document.getElementById('vb-recipient-rows').innerHTML = res.workers.map(function (w) {
      const covered = langSet.indexOf(w.lang) > -1;
      const l = vbLang(w.lang);
      const initials = w.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
      return '<tr>' +
        '<td><span class="vb-avatar">' + initials + '</span></td>' +
        '<td><span class="t-strong">' + w.name + '</span><div class="t-mute">' + w.id + ' · ' + w.phone + '</div></td>' +
        '<td>' + w.role + '<div class="t-mute">' + w.dept + ' · ' + w.zone + '</div></td>' +
        '<td><span class="pill ' + (w.type === 'Direct' ? 'green' : 'amber') + ' tiny">' + w.type + '</span></td>' +
        '<td>' + (covered
          ? '<span class="pill blue tiny">' + l.glyph + ' ' + l.name + '</span>'
          : '<span class="pill red tiny">' + l.name + ' — not selected</span>') +
        '</td>' +
      '</tr>';
    }).join('');

    const uncovered = res.workers.filter(function (w) { return langSet.indexOf(w.lang) < 0; });
    const cnt = document.getElementById('vb-recipient-count');
    if (uncovered.length) {
      cnt.className = 'pill amber';
      cnt.textContent = uncovered.length + ' language not covered';
    } else {
      cnt.className = 'pill blue';
      cnt.textContent = 'all languages covered';
    }
  }

  /* ── step 3 · broadcast ── */
  function vbRenderBroadcast() {
    const res = vbResolveRecipients();
    document.getElementById('vb-kpi-recipients').textContent = res.headcount.toLocaleString('en-IN');
    document.getElementById('vb-kpi-langs').textContent = VB_STATE.langs.length;
    document.getElementById('vb-kpi-langs-sub').textContent =
      VB_STATE.langs.map(function (c) { return vbLang(c).name; }).join(' · ');

    document.getElementById('vb-preview-en').textContent = VB_STATE.source;
    document.getElementById('vb-preview-langs').innerHTML = VB_STATE.langs.map(function (code) {
      const l = vbLang(code);
      return '<div class="field" style="margin-bottom:8px">' +
        '<label class="field-l" style="margin-bottom:4px">' + l.glyph + ' · ' + l.name + '</label>' +
        '<div class="tiny" style="color:var(--ink-2);line-height:1.6">' + (VB_STATE.translations[code] || '') + '</div>' +
      '</div>';
    }).join('');
    document.getElementById('vb-audit-langs').textContent =
      VB_STATE.langs.map(function (c) { return c.toLowerCase(); }).join(' / ');

    if (!VB_STATE.sent) {
      VB_STATE.rows = res.workers.map(function (w) { return { id: w.id, stage: 'pending' }; });
      document.getElementById('vb-msg-id').textContent = '—';
      document.getElementById('vb-audit-hash').textContent = '—';
      document.getElementById('vb-audit-status').className = 'pill tiny';
      document.getElementById('vb-audit-status').textContent = 'not sent';
      document.getElementById('vb-send-btn').disabled = false;
      document.getElementById('vb-send-btn').textContent = 'Send broadcast';
      document.getElementById('vb-remind-btn').disabled = true;
    }
    vbRenderBroadcastRows();
    vbUpdateBroadcastKpis();
  }

  function vbRenderBroadcastRows() {
    const res = vbResolveRecipients();
    document.getElementById('vb-broadcast-list').innerHTML = res.workers.map(function (w) {
      const row = VB_STATE.rows.find(function (r) { return r.id === w.id; }) || { stage: 'pending' };
      const l = vbLang(w.lang);
      const initials = w.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
      let statusHtml, msgHtml = '';
      if (row.stage === 'pending') {
        statusHtml = '<span class="vb-stage" style="color:var(--ink-4)"><span class="vb-stage-dot pending"></span>Queued</span>';
      } else if (row.stage === 'sending') {
        statusHtml = '<span class="vb-stage" style="color:var(--amber-dk)"><span class="vb-spin"></span>Sending</span>';
      } else if (row.stage === 'delivered') {
        statusHtml = '<span class="vb-stage" style="color:var(--blue)"><span class="vb-stage-dot delivered"></span>Delivered</span>' +
          '<span class="tiny muted">awaiting ACK</span>';
      } else if (row.stage === 'ack') {
        statusHtml = '<span class="vb-stage" style="color:var(--green-dk)"><span class="vb-stage-dot ack"></span>Acknowledged</span>' +
          '<span class="tiny muted">' + (row.ackAt || '') + '</span>';
      }
      if (row.stage === 'delivered' || row.stage === 'ack') {
        msgHtml = '<div class="vb-brow-msg">' + (VB_STATE.translations[w.lang] || VB_STATE.source) +
          ' <span class="pill tiny" style="margin-left:4px">🔊 voice note</span></div>';
      }
      return '<div class="vb-brow">' +
        '<span class="vb-avatar">' + initials + '</span>' +
        '<div class="vb-brow-main">' +
          '<div class="vb-brow-name">' + w.name + ' <span class="pill blue tiny" style="margin-left:4px">' + l.glyph + ' ' + l.name + '</span></div>' +
          '<div class="vb-brow-sub">' + w.role + ' · ' + w.dept + ' · WhatsApp ' + w.phone + '</div>' +
          msgHtml +
        '</div>' +
        '<div class="vb-brow-status">' + statusHtml + '</div>' +
      '</div>';
    }).join('');
  }

  function vbUpdateBroadcastKpis() {
    const tot = VB_STATE.rows.length || 1;
    const delivered = VB_STATE.rows.filter(function (r) { return r.stage === 'delivered' || r.stage === 'ack'; }).length;
    const acked     = VB_STATE.rows.filter(function (r) { return r.stage === 'ack'; }).length;
    document.getElementById('vb-kpi-delivered').innerHTML = delivered + '<small>/' + VB_STATE.rows.length + '</small>';
    document.getElementById('vb-kpi-ack').innerHTML = acked + '<small>/' + VB_STATE.rows.length + '</small>';
    document.getElementById('vb-kpi-delivered-bar').style.width = (delivered / tot * 100) + '%';
    document.getElementById('vb-kpi-ack-bar').style.width = (acked / tot * 100) + '%';
    document.getElementById('vb-kpi-delivered-sub').textContent =
      delivered === VB_STATE.rows.length && VB_STATE.sent ? 'demo group delivered' : VB_STATE.sent ? 'delivering…' : 'not sent yet';
    document.getElementById('vb-kpi-ack-sub').textContent =
      acked === VB_STATE.rows.length && VB_STATE.sent ? 'fully acknowledged' : VB_STATE.sent ? acked + ' confirmed' : 'awaiting send';
  }

  function vbHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h + str.charCodeAt(i)) | 0; }
    return 'sha-' + (h >>> 0).toString(16).padStart(8, '0');
  }

  /* ── send the broadcast — staged delivery then acknowledgement ── */
  function vbSend() {
    if (VB_STATE.sent) return;
    VB_STATE.sent = true;
    VB_STATE.msgId = 'MSG-' + Math.floor(80000 + Math.random() * 19999);
    document.getElementById('vb-msg-id').textContent = VB_STATE.msgId;
    document.getElementById('vb-audit-hash').textContent =
      vbHash(VB_STATE.subject + VB_STATE.source + VB_STATE.langs.join());
    document.getElementById('vb-audit-status').className = 'pill amber tiny';
    document.getElementById('vb-audit-status').textContent = 'broadcasting';
    const btn = document.getElementById('vb-send-btn');
    btn.disabled = true;
    btn.textContent = 'Broadcasting…';
    const res = vbResolveRecipients();
    toast('Broadcast ' + VB_STATE.msgId + ' sent · ' + res.headcount.toLocaleString('en-IN') + ' workers', 'green');
    window.open('karya-vaani-walkthrough.html', '_blank');

    const workers = res.workers;

    /* real WhatsApp fan-out via the communication gateway — each worker gets
       the message in their own language when a translation is available */
    if (window.KVWhatsApp) {
      const tr = VB_STATE.translations || {};
      workers.forEach(function (w) {
        const body = tr[w.lang] || VB_STATE.source || VB_STATE.subject || '';
        if (w.phone && body) window.KVWhatsApp.send(w.phone, body);
      });
    }

    workers.forEach(function (w, idx) {
      const row = VB_STATE.rows.find(function (r) { return r.id === w.id; });
      setTimeout(function () { row.stage = 'sending'; vbRenderBroadcastRows(); }, 250 + idx * 420);
      setTimeout(function () {
        row.stage = 'delivered'; vbRenderBroadcastRows(); vbUpdateBroadcastKpis();
      }, 650 + idx * 420);
      setTimeout(function () {
        row.stage = 'ack';
        const t = new Date();
        row.ackAt = String(t.getHours()).padStart(2, '0') + ':' + String(t.getMinutes()).padStart(2, '0');
        vbRenderBroadcastRows(); vbUpdateBroadcastKpis();
        if (VB_STATE.rows.every(function (r) { return r.stage === 'ack'; })) {
          document.getElementById('vb-audit-status').className = 'pill green tiny';
          document.getElementById('vb-audit-status').textContent = 'delivered · 100% ACK';
          document.getElementById('vb-send-btn').textContent = 'Broadcast complete';
          document.getElementById('vb-remind-btn').disabled = true;
          toast('Demo group fully acknowledged', 'green');
        } else {
          document.getElementById('vb-remind-btn').disabled = false;
        }
      }, 1400 + idx * 620 + Math.random() * 500);
    });
  }

  function vbRemind() {
    const pending = VB_STATE.rows.filter(function (r) { return r.stage !== 'ack'; });
    if (!pending.length) { toast('Everyone has already acknowledged', 'green'); return; }
    toast('WhatsApp ACK reminder sent to ' + pending.length + ' worker' + (pending.length > 1 ? 's' : ''), 'green');
    /* real WhatsApp ACK reminders via the communication gateway */
    if (window.KVWhatsApp) {
      const tr = VB_STATE.translations || {};
      pending.forEach(function (r) {
        const w = (VB_WORKERS || []).find(function (x) { return x.id === r.id; }) || r;
        const reminder = (typeof CHAT_REMINDER !== 'undefined' && CHAT_REMINDER[w.lang]) ||
          'Reminder: please acknowledge the recent Karya Vaani notice.';
        if (w.phone) window.KVWhatsApp.send(w.phone, reminder);
      });
    }
  }

  /* ── VAANI mailer integration ────────────────────────────────────────
     Sends the broadcast (English + all translated languages) to an email
     recipient via the Node.js backend (POST /api/send-email).
     Each translated language is also attached as a synthesised .wav voice note.
     Uses the Node.js backend /api/send-email route (Office365 SMTP).
     ─────────────────────────────────────────────────────────────────── */
  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function () {
        /* result is "data:audio/wav;base64,XXXX" — strip the header */
        resolve(reader.result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  async function vbSendViaEmail() {
    if (!VB_STATE.translations) {
      toast('Translate the message first, then send via email', 'red');
      return;
    }
    const subject  = (document.getElementById('vb-subject').value || VB_STATE.subject || 'VAANI Broadcast').trim();
    const source   = VB_STATE.source || '';
    const recipEl  = document.getElementById('vb-email-to');
    const to       = (recipEl ? recipEl.value : '').trim();
    if (!to) {
      toast('Enter a recipient email address in the "Email to" field', 'red');
      if (recipEl) recipEl.focus();
      return;
    }

    /* build multi-language email body — one section per language */
    let body = '🇬🇧 English (Original)\n' + source;
    VB_STATE.langs.forEach(function (code) {
      var l = vbLang(code);
      body += '\n\n' + l.glyph + ' ' + l.name + '\n' + (VB_STATE.translations[code] || '');
    });

    const btn = document.getElementById('vb-email-send-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Sending…'; }

    try {
      /* generate a real voice note per language via the VAANI engine;
         fall back to a clearly-labelled placeholder tone if it is offline */
      const attachments = [];
      for (var i = 0; i < VB_STATE.langs.length; i++) {
        var code  = VB_STATE.langs[i];
        var l     = vbLang(code);
        var text  = VB_STATE.translations[code] || '';
        var base  = 'karya-vaani-voice-' + l.name.toLowerCase().replace(/\s+/g, '-') + '.wav';
        var blob, fname;
        try {
          blob  = await vbGetVoice(code);          /* cached/queued real synthesised speech */
          fname = base;
        } catch (e) {
          blob  = vbBuildWav(text);                /* offline placeholder tone */
          fname = 'PLACEHOLDER-' + base;
        }
        var b64 = await blobToBase64(blob);
        attachments.push({ filename: fname, data: b64, contentType: 'audio/wav' });
      }

      const resp = await fetch('/api/send-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          to:          to.split(/[\s,;]+/).filter(function (item) { return item; }),
          subject:     subject,
          message:     body,
          attachments: attachments
        })
      });

      const json = await resp.json().catch(function () { return {}; });
      if (json.ok) {
        toast('📧 Broadcast email sent · ' + attachments.length + ' voice note(s) attached → ' + to, 'green');
      } else {
        toast('Email failed: ' + (json.error || 'unknown error'), 'red');
      }
    } catch (err) {
      toast('Could not reach the backend /api/send-email endpoint (' + (err.message || err) + ')', 'red');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📧 Send via email'; }
    }
  }

  /* ── reset ── */
  /* ── populate the "From Knowledge Center" optgroup ── */
  function vbPopulateKcTemplates() {
    const og = document.getElementById('vb-kc-optgroup');
    if (!og) return;
    og.innerHTML = Object.keys(VB_KC_TEMPLATES).map(function (id) {
      const doc = (typeof kcDocById === 'function') ? kcDocById(id) : null;
      const label = doc ? doc.title : VB_KC_TEMPLATES[id].subject;
      return '<option value="' + id + '">' + label + '</option>';
    }).join('');
  }

  /* ════════════════════════════════════════════════════════════════
     KNOWLEDGE CENTER GPT — drafts a broadcast from a plain question
     Reuses the Knowledge Center canned-answer engine (kcCannedAnswer)
     and reshapes its reply into a worker-ready broadcast draft.
     ════════════════════════════════════════════════════════════════ */
  const VB_GPT_SUGGESTIONS = [
    'What should workers know about the evacuation drill?',
    'Draft a PPE reminder for the shop floor',
    'Remind workers about the bus pickup timings',
    'Notify workers of the minimum wage revision'
  ];

  function vbRenderGptSuggest() {
    const wrap = document.getElementById('vb-gpt-suggest');
    if (!wrap) return;
    wrap.innerHTML = VB_GPT_SUGGESTIONS.map(function (q) {
      return '<span class="vb-gpt-chip" onclick="vbGptSuggest(this)">' + q + '</span>';
    }).join('');
  }

  function vbGptSuggest(el) {
    document.getElementById('vb-gpt-q').value = el.textContent;
    vbGptAsk();
  }

  function vbToggleGpt() {
    const panel = document.getElementById('vb-gpt-panel');
    if (!panel) return;
    const open = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = open ? 'block' : 'none';
    const btn = document.getElementById('vb-gpt-btn');
    if (btn) btn.classList.toggle('primary', open);
    if (open) {
      vbRenderGptSuggest();
      const inp = document.getElementById('vb-gpt-q');
      if (inp) inp.focus();
    }
  }

  /* derive a short subject line from a drafted message */
  function vbGptSubject(topic, question) {
    const subjects = {
      transport: 'Transport & bus timings',
      evac: 'Evacuation drill — assembly points',
      ppe: 'PPE reminder — shop floor',
      wages: 'Minimum wage revision — 2026',
      leave: 'Leave & holiday information',
      grievance: 'Raising a grievance — how to',
      conduct: 'Code of conduct reminder',
      induction: 'Induction & training',
      contractor: 'Contract worker entitlements'
    };
    return subjects[topic] || (question.charAt(0).toUpperCase() + question.slice(1, 48));
  }

  function vbGptAsk() {
    const q = (document.getElementById('vb-gpt-q').value || '').trim();
    if (!q) { toast('Type a question for the Knowledge Center', 'red'); return; }
    if (typeof kcCannedAnswer !== 'function') { toast('Knowledge Center unavailable', 'red'); return; }

    const ansBox = document.getElementById('vb-gpt-answer');
    ansBox.style.display = 'block';
    ansBox.innerHTML = '<div class="vb-gpt-thinking">' +
      '<span class="vb-gpt-dots"><span></span><span></span><span></span></span>' +
      'Searching the knowledge base and drafting a broadcast…</div>';

    setTimeout(function () {
      const res = kcCannedAnswer(q);
      const body = res.native || res.answerText || '';
      const subject = vbGptSubject(res.topic, q);
      const cites = (res.cites || []).map(function (c) {
        return '<span class="vb-gpt-cite">📄 ' + c.label + '</span>';
      }).join('');
      /* stash the draft so "Use this draft" can apply it */
      VB_STATE.gptDraft = { subject: subject, body: body };
      ansBox.innerHTML =
        '<div class="vb-gpt-draft">' +
          '<div class="vb-gpt-draft-eye">Drafted broadcast</div>' +
          '<div class="vb-gpt-draft-subj">' + subject + '</div>' +
          '<div class="vb-gpt-draft-body">' + body + '</div>' +
          (cites ? '<div class="vb-gpt-cites">' + cites + '</div>' : '') +
          '<div class="vb-gpt-draft-acts">' +
            '<button class="btn primary" onclick="vbGptUseDraft()">Use this draft</button>' +
            '<button class="btn" onclick="vbGptAsk()">Redraft</button>' +
          '</div>' +
        '</div>';
    }, 750);
  }

  function vbGptUseDraft() {
    if (!VB_STATE.gptDraft) return;
    document.getElementById('vb-subject').value = VB_STATE.gptDraft.subject;
    document.getElementById('vb-source').value = VB_STATE.gptDraft.body;
    const sel = document.getElementById('vb-preset');
    if (sel) sel.value = 'custom';
    const hint = document.getElementById('vb-template-hint');
    if (hint) hint.textContent = 'Drafted by the Knowledge Center assistant — review, then translate.';
    vbMarkDirty();
    vbToggleGpt();   /* collapse the panel */
    toast('Draft placed in the message — review and translate', 'green');
    document.getElementById('vb-source').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function vbReset() {
    if (VB_STATE.playing) vbStopVoice(VB_STATE.playing);
    VB_STATE.preset = 'rain';
    VB_STATE.subject = VB_PRESETS.rain.subject;
    VB_STATE.source = VB_PRESETS.rain.body;
    VB_STATE.langs = ['TE', 'HI'];
    VB_STATE.audiences = ['production'];
    VB_STATE.translations = null;
    VB_STATE.sent = false;
    VB_STATE.msgId = null;
    VB_STATE.rows = [];
    VB_STATE.gptDraft = null;
    const src = document.getElementById('vb-source');
    if (src) src.value = VB_PRESETS.rain.body;
    const subj = document.getElementById('vb-subject');
    if (subj) subj.value = VB_PRESETS.rain.subject;
    const sel = document.getElementById('vb-preset');
    if (sel) sel.value = 'rain';
    const out = document.getElementById('vb-translation-out');
    if (out) out.style.display = 'none';
    const next = document.getElementById('vb-step1-next');
    if (next) next.disabled = true;
    const tbtn = document.getElementById('vb-translate-btn');
    if (tbtn) { tbtn.disabled = false; tbtn.textContent = 'Translate via VAANI'; }
    const pop = document.getElementById('vb-aud-pop');
    if (pop) pop.style.display = 'none';
    const gpt = document.getElementById('vb-gpt-panel');
    if (gpt) gpt.style.display = 'none';
    const gptBtn = document.getElementById('vb-gpt-btn');
    if (gptBtn) gptBtn.classList.remove('primary');
    const gptA = document.getElementById('vb-gpt-answer');
    if (gptA) { gptA.style.display = 'none'; gptA.innerHTML = ''; }
    const gptQ = document.getElementById('vb-gpt-q');
    if (gptQ) gptQ.value = '';
    const hint = document.getElementById('vb-template-hint');
    if (hint) hint.textContent = 'Pick a ready template, pull a Knowledge Center document, or ask the assistant to draft one.';
    vbRenderLangs();
    vbRenderAudChips();
    vbGoStep(0);
    toast('Demo reset', 'green');
  }

  function initVb() {
    if (!document.getElementById('vb-panel-0')) return;
    vbRenderLangs();
    vbRenderAudChips();
    vbPopulateKcTemplates();
  }
  __kvOnReady(initVb);

  /* ════════════════════════════════════════════════════════════════
     KARYA VAANI CHAT — WhatsApp look-alike chatbot
     The conversational delivery surface of the Vaani Localisation
     engine. Each worker gets a thread of multilingual messages from
     the Karya Vaani assistant (the bot, shown as a contact).
     All state namespaced (CHAT_STATE / chat*).
     ════════════════════════════════════════════════════════════════ */
  const CHAT_STATE = { activeId: null, search: '' };

  /* short safe-fallback for bilingual subtitles in the bubble */
  function chatEn(presetKey) {
    return (typeof VB_PRESETS !== 'undefined' && VB_PRESETS[presetKey]) ?
      VB_PRESETS[presetKey].body : '';
  }
  function chatSubject(presetKey) {
    return (typeof VB_PRESETS !== 'undefined' && VB_PRESETS[presetKey]) ?
      VB_PRESETS[presetKey].subject : presetKey;
  }

  /* urgency & criticality classification for each broadcast template.
     Drives response-required behaviour, reminder cadence, deadline copy. */
  const CHAT_URGENCY = {
    rain:       { tier: 'critical', label: 'Critical · safety',     respond: true,  slaMin: 15,  needsAck: true },
    evac:       { tier: 'critical', label: 'Critical · safety',     respond: true,  slaMin: 5,   needsAck: true },
    fire:       { tier: 'critical', label: 'Critical · safety',     respond: true,  slaMin: 10,  needsAck: true },
    heat:       { tier: 'urgent',   label: 'Urgent · health',       respond: true,  slaMin: 60,  needsAck: true },
    ppe:        { tier: 'urgent',   label: 'Urgent · OHS',          respond: true,  slaMin: 120, needsAck: true },
    induction:  { tier: 'urgent',   label: 'Urgent · compliance',   respond: true,  slaMin: 720, needsAck: true },
    roster:     { tier: 'advisory', label: 'Advisory · operations', respond: true,  slaMin: 1440,needsAck: true },
    transport:  { tier: 'advisory', label: 'Advisory · operations', respond: false, slaMin: 0,   needsAck: false },
    wage:       { tier: 'advisory', label: 'Advisory · statutory',  respond: true,  slaMin: 2880,needsAck: true },
    holiday:    { tier: 'info',     label: 'Info',                  respond: false, slaMin: 0,   needsAck: false }
  };

  /* where the message originated — module + named originator + channel.
     This is the "origination details" surfaced under each bubble. */
  const CHAT_ORIGIN = {
    rain:      { mod: 'VAANI Broadcasting', subMod: 'Safety preset', by: 'Priya Menon · CHRO',   ch: 'WhatsApp Business · MSG-87410' },
    evac:      { mod: 'VAANI Broadcasting', subMod: 'OHS drill',     by: 'Anitha Rao · EHS Lead', ch: 'WhatsApp Business · MSG-87411' },
    ppe:       { mod: 'VAANI Broadcasting', subMod: 'OHS preset',    by: 'Anitha Rao · EHS Lead', ch: 'WhatsApp Business · MSG-87412' },
    heat:      { mod: 'VAANI Broadcasting', subMod: 'OHS advisory',  by: 'Anitha Rao · EHS Lead', ch: 'WhatsApp Business · MSG-87413' },
    fire:      { mod: 'VAANI Broadcasting', subMod: 'OHS preset',    by: 'Anitha Rao · EHS Lead', ch: 'WhatsApp Business · MSG-87414' },
    roster:    { mod: 'Knowledge Center',   subMod: 'kc-305',        by: 'Suresh Pillai · Plant Manager', ch: 'WhatsApp Business · MSG-87415' },
    transport: { mod: 'Transport Schedule', subMod: 'Weekly plan',   by: 'Vikram Shah · Logistics Lead',  ch: 'WhatsApp Business · MSG-87416' },
    wage:      { mod: 'Knowledge Center',   subMod: 'kc-301',        by: 'Rakesh K · Compliance Admin',   ch: 'WhatsApp Business · MSG-87417' },
    holiday:   { mod: 'VAANI Broadcasting', subMod: 'HR notice',     by: 'Priya Menon · CHRO',            ch: 'WhatsApp Business · MSG-87418' },
    induction: { mod: 'Knowledge Center',   subMod: 'kc-306',        by: 'Anitha Rao · EHS Lead',         ch: 'WhatsApp Business · MSG-87419' }
  };

  /* response-required acknowledgement reply, in the worker's language */
  const CHAT_ACK_REPLY = {
    TE: 'చదివాను, అర్థమైంది ✓',
    HI: 'पढ़ लिया, समझ गया ✓',
    TA: 'படித்தேன், புரிந்தது ✓',
    OR: 'ପଢ଼ିଲି, ବୁଝିଲି ✓',
    BN: 'পড়েছি, বুঝেছি ✓',
    MR: 'वाचले, समजले ✓'
  };

  /* response-bot reminder copy when an acknowledgement is overdue */
  const CHAT_REMINDER = {
    TE: 'రిమైండర్: దయచేసి పై సందేశాన్ని చదివి, చదివినట్లు నిర్ధారించండి. ఇది తప్పనిసరి భద్రతా సమ్మతి కోసం.',
    HI: 'अनुस्मारक: कृपया उपरोक्त संदेश पढ़ें और पुष्टि करें। यह अनिवार्य सुरक्षा अनुपालन के लिए है।',
    TA: 'நினைவூட்டல்: மேலே உள்ள செய்தியைப் படித்து உறுதிப்படுத்தவும். இது கட்டாய பாதுகாப்பு இணக்கத்திற்காக.',
    OR: 'ସ୍ମରଣ: ଦୟାକରି ଉପର ସନ୍ଦେଶ ପଢ଼ି ନିଶ୍ଚିତ କରନ୍ତୁ। ଏହା ବାଧ୍ୟତାମୂଳକ ସୁରକ୍ଷା ଅନୁପାଳନ ପାଇଁ।',
    BN: 'অনুস্মারক: অনুগ্রহ করে উপরের বার্তাটি পড়ে নিশ্চিত করুন। এটি বাধ্যতামূলক সুরক্ষা অনুপালনের জন্য।',
    MR: 'स्मरण: कृपया वरील संदेश वाचून पुष्टी करा. हे अनिवार्य सुरक्षा अनुपालनासाठी आहे.'
  };
  const CHAT_REMINDER_EN = 'Reminder: please read the above message and confirm. This is for mandatory safety compliance.';
  /* localised body for a preset in a worker's language. Falls back to
     English (the source body) when a translation is not present in
     VB_TRANSLATIONS — the Localisation engine flagging "needs review". */
  function chatLocalised(presetKey, lang) {
    if (typeof VB_TRANSLATIONS !== 'undefined' &&
        VB_TRANSLATIONS[presetKey] && VB_TRANSLATIONS[presetKey][lang]) {
      return VB_TRANSLATIONS[presetKey][lang];
    }
    return chatEn(presetKey);   /* graceful fallback */
  }

  /* contacts — drawn from the Vaani worker pool, extended slightly */
  /* contact roster extension — sourced from the database (/api/bootstrap →
     __KVDATA.chatContacts) so the chat + analytics reflect the live store.
     The hardcoded list is kept only as an offline fallback. */
  const CHAT_CONTACTS = (typeof VB_WORKERS !== 'undefined' ? VB_WORKERS.slice() : [])
    .concat((window.__KVDATA && window.__KVDATA.chatContacts) || [
      { id: 'WRK-5012', name: 'Mohan Das',    role: 'Forklift driver',  zone: 'Warehouse',  dept: 'Logistics',  sup: 'Vikram Shah',  type: 'Contract', contractor: 'Pavan Manpower',    lang: 'OR', phone: '••• ••• 2231' },
      { id: 'WRK-5188', name: 'Naga Babu',    role: 'Tool-room fitter', zone: 'Tool Room',  dept: 'Maintenance',sup: 'Suresh Pillai',type: 'Contract', contractor: 'Sai Industrial',    lang: 'TE', phone: '••• ••• 7714' },
      { id: 'WRK-6201', name: 'Praveen N.',   role: 'Packing operator', zone: 'Packaging',  dept: 'Production', sup: 'Anitha Rao',   type: 'Contract', contractor: 'Sri Lakshmi Engg', lang: 'TA', phone: '••• ••• 5520' }
    ]);

  /* each worker carries a curated thread of recent multilingual deliveries.
     These now come from the database (__KVDATA.chatThreads) so the analytics
     aggregate off the live store; the literal below is the offline fallback. */
  const CHAT_THREADS = (window.__KVDATA && window.__KVDATA.chatThreads) || {
    'WRK-2207': {                            // Ramesh · Telugu
      lastSeen: 'today at 09:14',
      msgs: [
        { dir: 'in', preset: 'wage',     time: 'Yesterday · 16:42', at: '25 May 2026 · 16:42:08 IST', read: true,  acked: true,  ackedAt: '25 May 2026 · 17:08:21 IST' },
        { dir: 'out', text: 'అర్థమైంది, ధన్యవాదాలు',
          en: 'Understood, thank you', time: 'Yesterday · 17:08', at: '25 May 2026 · 17:08:21 IST' },
        { dir: 'in', preset: 'ppe',      time: 'Today · 07:32',     at: '26 May 2026 · 07:32:11 IST', read: true,  acked: true,  ackedAt: '26 May 2026 · 07:39:02 IST' },
        { dir: 'in', preset: 'rain',     time: 'Today · 09:02',     at: '26 May 2026 · 09:02:48 IST', read: true,  acked: false }
      ]
    },
    'WRK-3318': {                            // Lalita · Hindi
      lastSeen: 'today at 08:47',
      msgs: [
        { dir: 'in', preset: 'heat',     time: 'Mon · 11:00',       at: '20 May 2026 · 11:00:14 IST', read: true,  acked: true,  ackedAt: '20 May 2026 · 11:24:09 IST' },
        { dir: 'in', preset: 'transport',time: 'Tue · 06:55',       at: '21 May 2026 · 06:55:00 IST', read: true,  acked: false },
        { dir: 'out', text: 'समझ गया, धन्यवाद',
          en: 'Understood, thank you', time: 'Tue · 07:01', at: '21 May 2026 · 07:01:33 IST' },
        { dir: 'in', preset: 'rain',     time: 'Today · 09:02',     at: '26 May 2026 · 09:02:48 IST', read: true,  acked: false }
      ]
    },
    'WRK-2884': {                            // Suresh · Telugu
      lastSeen: 'today at 08:55',
      msgs: [
        { dir: 'in', preset: 'fire',     time: 'Fri · 14:20',       at: '23 May 2026 · 14:20:00 IST', read: true,  acked: true,  ackedAt: '23 May 2026 · 14:31:11 IST' },
        { dir: 'in', preset: 'roster',   time: 'Sat · 09:10',       at: '24 May 2026 · 09:10:25 IST', read: true,  acked: true,  ackedAt: '24 May 2026 · 09:15:02 IST' },
        { dir: 'out', text: 'సరే, షిఫ్ట్ సోమవారం నుండి',
          en: 'OK, shift from Monday', time: 'Sat · 09:15', at: '24 May 2026 · 09:15:02 IST' },
        { dir: 'in', preset: 'ppe',      time: 'Today · 07:32',     at: '26 May 2026 · 07:32:11 IST', read: true,  acked: true,  ackedAt: '26 May 2026 · 07:45:18 IST' }
      ]
    },
    'WRK-4102': {                            // Bharath · Hindi
      lastSeen: 'today at 06:30',
      msgs: [
        { dir: 'in', preset: 'induction',time: 'Mon · 10:00',       at: '20 May 2026 · 10:00:00 IST', read: true,  acked: false },
        { dir: 'in', preset: 'transport',time: 'Tue · 06:55',       at: '21 May 2026 · 06:55:00 IST', read: true,  acked: false },
        { dir: 'out', text: 'ठीक है', en: 'OK', time: 'Tue · 07:00', at: '21 May 2026 · 07:00:12 IST' },
        { dir: 'in', preset: 'rain',     time: 'Today · 09:02',     at: '26 May 2026 · 09:02:48 IST', read: false, acked: false }
      ]
    },
    'WRK-3771': {                            // Anand · Telugu
      lastSeen: 'today at 10:11',
      msgs: [
        { dir: 'in', preset: 'evac',     time: 'Wed · 15:30',       at: '21 May 2026 · 15:30:00 IST', read: true,  acked: true,  ackedAt: '21 May 2026 · 15:35:44 IST' },
        { dir: 'out', text: 'రిపోర్ట్ చేశాను', en: 'Reported in', time: 'Wed · 15:35', at: '21 May 2026 · 15:35:44 IST' },
        { dir: 'in', preset: 'holiday',  time: 'Thu · 11:20',       at: '22 May 2026 · 11:20:00 IST', read: true,  acked: false },
        { dir: 'in', preset: 'rain',     time: 'Today · 09:02',     at: '26 May 2026 · 09:02:48 IST', read: true,  acked: false }
      ]
    },
    'WRK-5012': {                            // Mohan · Odia
      lastSeen: 'today at 08:02',
      msgs: [
        { dir: 'in', preset: 'transport',time: 'Mon · 06:55',       at: '20 May 2026 · 06:55:00 IST', read: true,  acked: false },
        { dir: 'in', preset: 'ppe',      time: 'Today · 07:32',     at: '26 May 2026 · 07:32:11 IST', read: true,  acked: true,  ackedAt: '26 May 2026 · 07:50:09 IST' },
        { dir: 'in', preset: 'rain',     time: 'Today · 09:02',     at: '26 May 2026 · 09:02:48 IST', read: false, acked: false }
      ]
    },
    'WRK-5188': {                            // Naga · Telugu
      lastSeen: 'yesterday',
      msgs: [
        { dir: 'in', preset: 'roster',   time: 'Sat · 09:10',       at: '24 May 2026 · 09:10:25 IST', read: true,  acked: true,  ackedAt: '24 May 2026 · 09:18:00 IST' },
        { dir: 'in', preset: 'rain',     time: 'Today · 09:02',     at: '26 May 2026 · 09:02:48 IST', read: false, acked: false }
      ]
    },
    'WRK-6201': {                            // Praveen · Tamil
      lastSeen: 'today at 09:30',
      msgs: [
        { dir: 'in', preset: 'heat',     time: 'Mon · 11:00',       at: '20 May 2026 · 11:00:14 IST', read: true,  acked: true,  ackedAt: '20 May 2026 · 11:30:55 IST' },
        { dir: 'in', preset: 'evac',     time: 'Wed · 15:30',       at: '21 May 2026 · 15:30:00 IST', read: true,  acked: true,  ackedAt: '21 May 2026 · 15:36:12 IST' },
        { dir: 'out', text: 'புரிந்தது', en: 'Understood', time: 'Wed · 15:36', at: '21 May 2026 · 15:36:12 IST' },
        { dir: 'in', preset: 'rain',     time: 'Today · 09:02',     at: '26 May 2026 · 09:02:48 IST', read: true,  acked: false }
      ]
    }
  };

  /* rotation order for the "Send next broadcast" button */
  const CHAT_BROADCAST_ROTATION = ['transport', 'roster', 'holiday', 'induction', 'fire', 'heat', 'wage'];
  let CHAT_BROADCAST_IDX = 0;

  /* quick-reply chips offered to "the worker", in their language */
  const CHAT_QUICK = {
    TE: ['సరే', 'అర్థమైంది, ధన్యవాదాలు', 'మరిన్ని వివరాలు పంపండి'],
    HI: ['ठीक है', 'समझ गया, धन्यवाद', 'और जानकारी भेजें'],
    TA: ['சரி', 'புரிந்தது, நன்றி', 'மேலும் விவரம் அனுப்புங்கள்'],
    OR: ['ଠିକ୍ ଅଛି', 'ବୁଝିଲି, ଧନ୍ୟବାଦ', 'ଅଧିକ ବିବରଣୀ ପଠାନ୍ତୁ'],
    BN: ['ঠিক আছে', 'বুঝেছি, ধন্যবাদ', 'আরও তথ্য পাঠান'],
    MR: ['ठीक आहे', 'समजले, धन्यवाद', 'अधिक माहिती पाठवा']
  };

  function chatLang(code) {
    if (typeof VB_LANGS === 'undefined') return { code: code, name: code, glyph: code };
    return VB_LANGS.find(function (l) { return l.code === code; }) ||
           { code: code, name: code, glyph: code };
  }

  /* every message gets a stable id once, used by ack/remind callbacks */
  function chatEnsureIds() {
    Object.keys(CHAT_THREADS).forEach(function (wid) {
      (CHAT_THREADS[wid].msgs || []).forEach(function (m, i) {
        if (!m.id) m.id = wid + '-m' + i;
      });
    });
  }

  /* look up a message by id across all threads */
  function chatFindMsg(mid) {
    let found = null, workerId = null;
    Object.keys(CHAT_THREADS).some(function (wid) {
      const hit = (CHAT_THREADS[wid].msgs || []).find(function (m) { return m.id === mid; });
      if (hit) { found = hit; workerId = wid; return true; }
      return false;
    });
    return { msg: found, workerId: workerId };
  }

  /* worker acknowledges — appends an ack-reply in their language,
     marks the message acked, and updates the compliance summary */
  function chatAckMessage(mid) {
    const r = chatFindMsg(mid);
    if (!r.msg) return;
    const c = CHAT_CONTACTS.find(function (x) { return x.id === r.workerId; });
    if (!c) return;
    r.msg.read = true;
    r.msg.acked = true;
    r.msg.ackedAt = chatFullStamp();
    const ackText = CHAT_ACK_REPLY[c.lang] || CHAT_ACK_REPLY.HI;
    const t = CHAT_THREADS[c.id];
    t.msgs.push({
      id: c.id + '-m' + t.msgs.length,
      dir: 'out', text: ackText,
      en: 'Read, understood — acknowledged',
      time: 'Today · ' + chatNowStamp(),
      at: chatFullStamp()
    });
    chatRenderConv();
    chatRenderList();
    chatRenderAnalytics();
    if (typeof toast === 'function') toast('Acknowledgement recorded for ' + c.name, 'green');
  }

  /* response-bot fires a multilingual reminder to nudge the worker.
     Reminder count is tracked so a second reminder escalates the tone. */
  function chatRemind(mid) {
    const r = chatFindMsg(mid);
    if (!r.msg) return;
    const c = CHAT_CONTACTS.find(function (x) { return x.id === r.workerId; });
    if (!c) return;
    if (r.msg.acked) {
      if (typeof toast === 'function') toast('Already acknowledged — no reminder needed', 'green');
      return;
    }
    r.msg.reminders = (r.msg.reminders || 0) + 1;
    const t = CHAT_THREADS[c.id];
    /* typing then drop the reminder */
    const body = document.getElementById('chat-conv-body');
    if (body) {
      const typing = document.createElement('div');
      typing.className = 'cv-msg in'; typing.id = 'chat-typing-r';
      typing.innerHTML = '<div class="cv-typing"><span></span><span></span><span></span></div>';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;
    }
    setTimeout(function () {
      const tEl = document.getElementById('chat-typing-r'); if (tEl) tEl.remove();
      t.msgs.push({
        id: c.id + '-m' + t.msgs.length,
        dir: 'in', isReminder: true, reminderFor: mid,
        text: (CHAT_REMINDER[c.lang] || CHAT_REMINDER.HI),
        en: CHAT_REMINDER_EN,
        time: 'Today · ' + chatNowStamp(),
        at: chatFullStamp(),
        read: false, acked: false,
        escalation: r.msg.reminders
      });
      chatRenderConv();
      chatRenderList();
      chatRenderAnalytics();
      if (typeof toast === 'function') {
        toast('Response-bot reminder #' + r.msg.reminders + ' sent to ' + c.name +
          ' in ' + chatLang(c.lang).name, 'green');
      }
      /* real WhatsApp reminder via the communication gateway */
      if (window.KVWhatsApp) {
        window.KVWhatsApp.send(c.phone, (CHAT_REMINDER[c.lang] || CHAT_REMINDER.HI));
      }
    }, 900);
  }

  function chatFullStamp() {
    const d = new Date();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear() +
      ' · ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ' IST';
  }

  function chatInitials(name) {
    return name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
  }

  /* preview text for the chat list — the most recent inbound (bot) msg */
  function chatPreview(c) {
    const t = CHAT_THREADS[c.id];
    if (!t || !t.msgs.length) return 'No messages yet';
    const last = t.msgs[t.msgs.length - 1];
    if (last.dir === 'in' && last.preset) {
      return chatSubject(last.preset);
    }
    return last.text || last.en || '—';
  }
  function chatLastTime(c) {
    const t = CHAT_THREADS[c.id];
    if (!t || !t.msgs.length) return '';
    return t.msgs[t.msgs.length - 1].time.split(' · ').pop();
  }
  function chatUnread(c) {
    const t = CHAT_THREADS[c.id]; if (!t) return 0;
    return t.msgs.filter(function (m) { return m.dir === 'in' && m.read === false; }).length;
  }

  /* render the left-side chat list */
  function chatRenderList() {
    const list = document.getElementById('chat-list');
    if (!list) return;
    const inp = document.getElementById('chat-search');
    const q = (inp ? inp.value : '').trim().toLowerCase();
    CHAT_STATE.search = q;
    const rows = CHAT_CONTACTS.filter(function (c) {
      if (!q) return true;
      return (c.name + ' ' + c.role + ' ' + c.zone + ' ' + c.dept).toLowerCase().indexOf(q) > -1;
    });
    if (!CHAT_STATE.activeId && rows.length) CHAT_STATE.activeId = rows[0].id;
    list.innerHTML = rows.map(function (c) {
      const on = CHAT_STATE.activeId === c.id;
      const unread = chatUnread(c);
      const lng = chatLang(c.lang);
      return '<div class="cv-cl-row ' + (on ? 'on' : '') + '" onclick="chatPick(\'' + c.id + '\')">' +
        '<span class="cv-cl-ava ' + (c.type === 'Contract' ? 'contract' : '') + '">' +
          chatInitials(c.name) + '</span>' +
        '<div class="cv-cl-main">' +
          '<div class="cv-cl-top">' +
            '<span class="cv-cl-name">' + c.name + '</span>' +
            '<span class="cv-cl-time">' + chatLastTime(c) + '</span>' +
          '</div>' +
          '<div class="cv-cl-bottom">' +
            '<span class="cv-cl-preview">' + chatPreview(c) +
              '<span class="cv-cl-lang">' + lng.glyph + ' ' + lng.code + '</span>' +
            '</span>' +
            (unread ? '<span class="cv-cl-unread">' + unread + '</span>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function chatPick(id) {
    CHAT_STATE.activeId = id;
    /* clear unread on open */
    const t = CHAT_THREADS[id];
    if (t) t.msgs.forEach(function (m) { if (m.dir === 'in') m.read = true; });
    chatRenderList();
    chatRenderConv();
  }

  /* render the conversation pane */
  function chatRenderConv() {
    const head = document.getElementById('chat-conv-h');
    const body = document.getElementById('chat-conv-body');
    const foot = document.getElementById('chat-conv-foot');
    if (!head || !body || !foot) return;
    const c = CHAT_CONTACTS.find(function (x) { return x.id === CHAT_STATE.activeId; });
    if (!c) { head.innerHTML = ''; body.innerHTML = ''; foot.innerHTML = ''; return; }
    const t = CHAT_THREADS[c.id] || { msgs: [], lastSeen: '' };
    const lng = chatLang(c.lang);

    /* header — contact identity + language */
    head.innerHTML =
      '<span class="cv-conv-h-ava ' + (c.type === 'Contract' ? 'contract' : '') + '">' +
        chatInitials(c.name) + '</span>' +
      '<div class="cv-conv-h-main">' +
        '<div class="cv-conv-h-name">' + c.name + '</div>' +
        '<div class="cv-conv-h-sub">' + c.role + ' · ' + c.zone +
          ' · ' + c.type + ' · last seen ' + t.lastSeen + '</div>' +
      '</div>' +
      '<div class="cv-conv-h-meta">' +
        '<div>' + c.phone + '</div>' +
        '<div>language · <strong>' + lng.glyph + ' ' + lng.name + '</strong></div>' +
      '</div>';

    /* messages — day divider then each bubble */
    let html = '';
    /* read-receipt compliance summary for this thread */
    let total = 0, read = 0, acked = 0, pending = 0;
    t.msgs.forEach(function (m) {
      if (m.dir !== 'in' || !m.preset) return;
      const u = CHAT_URGENCY[m.preset];
      if (!u || !u.needsAck) return;
      total++;
      if (m.read) read++;
      if (m.acked) acked++;
      if (!m.acked) pending++;
    });
    if (total > 0) {
      const ackPct = Math.round(acked / total * 100);
      const statusCls = pending === 0 ? 'green' : ackPct >= 50 ? 'amber' : 'red';
      html += '<div class="cv-compliance-bar">' +
        '<div class="cv-compliance-l">' +
          '<span class="cv-compliance-eye">Read-receipt compliance · this worker</span>' +
          '<span class="cv-compliance-stats">' +
            acked + ' of ' + total + ' acknowledged · ' +
            read + ' read · ' + pending + ' pending' +
          '</span>' +
        '</div>' +
        '<span class="cv-compliance-pill ' + statusCls + '">' +
          (pending === 0 ? 'Compliant' : pending + ' pending') +
        '</span>' +
      '</div>';
    }
    html += '<div class="cv-day"><span class="cv-day-pill">Recent messages</span></div>';
    t.msgs.forEach(function (m) {
      const bubble = m.dir === 'in'
        ? chatRenderInbound(m, c)
        : chatRenderOutbound(m, c);
      html += bubble;
    });
    body.innerHTML = html;
    body.scrollTop = body.scrollHeight;

    /* footer — quick reply chips for the worker's language */
    const quickList = CHAT_QUICK[c.lang] || CHAT_QUICK.HI;
    foot.innerHTML =
      '<div class="cv-quick-row">' +
        quickList.map(function (q) {
          return '<span class="cv-quick" onclick="chatWorkerReply(\'' + q.replace(/'/g, "\\'") + '\')">' + q + '</span>';
        }).join('') +
      '</div>' +
      '<div class="cv-compose">' +
        '<div class="cv-compose-in">The worker can also type a reply — handled by the bot in ' + lng.name + '…</div>' +
        '<span class="cv-compose-mic">🎙</span>' +
      '</div>';
    /* keep the employee-home embedded chat surface in sync */
    if (typeof empChatRender === 'function') empChatRender();
  }

  /* helper: ack-status pill */
  function chatAckPill(m, urg) {
    if (!urg || !urg.needsAck) return '';
    if (m.acked) return '<span class="cv-ack-pill done">✓ Acknowledged · ' + (m.ackedAt || '') + '</span>';
    if (m.read)  return '<span class="cv-ack-pill pend">⌛ Read · awaiting acknowledgement</span>';
    return '<span class="cv-ack-pill miss">✗ Delivered · not yet read</span>';
  }

  /* bubble for a bot-sent (inbound from worker perspective) message */
  function chatRenderInbound(m, c) {
    const lng = chatLang(c.lang);
    /* response-bot reminders render as a compact reminder bubble */
    if (m.isReminder) {
      const tickCls = m.read ? 'read' : 'delivered';
      return '<div class="cv-msg in"><div class="cv-bub cv-bub-reminder">' +
        '<div class="cv-urg-row"><span class="cv-urg-pill cv-urg-reminder">' +
          '↻ Response-bot reminder' + (m.escalation > 1 ? ' #' + m.escalation : '') +
        '</span></div>' +
        '<div><span class="cv-bub-lang-tag">' + lng.glyph + ' ' + lng.code + '</span>' +
          (m.text || '') + '</div>' +
        (m.en ? '<div class="cv-bub-bilingual">EN · ' + m.en + '</div>' : '') +
        '<div class="cv-bub-meta">' +
          '<div class="cv-meta-row"><span class="cv-meta-k">Sent</span><span class="cv-meta-v">' + (m.at || m.time) + '</span></div>' +
          '<div class="cv-meta-row"><span class="cv-meta-k">Origin</span><span class="cv-meta-v">Karya Vaani response-bot · auto-reminder</span></div>' +
          '<div class="cv-meta-row"><span class="cv-meta-k">Triggered by</span><span class="cv-meta-v">' +
            (m.reminderFor ? 'No acknowledgement on ' + m.reminderFor : 'compliance rule') + '</span></div>' +
        '</div>' +
        '<div class="cv-bub-foot">' +
          '<span class="cv-bub-time">' + (m.time || '') + '</span>' +
          '<span class="cv-bub-tick ' + tickCls + '">✓✓</span>' +
        '</div>' +
      '</div></div>';
    }
    const subj = m.preset ? chatSubject(m.preset) : '';
    const body = m.preset ? chatLocalised(m.preset, c.lang) : (m.text || '');
    const en = m.preset ? chatEn(m.preset) : (m.en || '');
    /* detect a missing translation — body fell back to the source English */
    const isFallback = !!m.preset && body === en && c.lang !== 'EN';
    const tickCls = m.acked ? 'read' : m.read ? 'read' : 'delivered';
    const langTag = isFallback
      ? '<span class="cv-bub-lang-tag" style="background:#FFEBE5;color:#A0533C">' +
          lng.glyph + ' ' + lng.code + ' · translation pending</span>'
      : '<span class="cv-bub-lang-tag">' + lng.glyph + ' ' + lng.code + '</span>';
    const urg = m.preset ? CHAT_URGENCY[m.preset] : null;
    const origin = m.preset ? CHAT_ORIGIN[m.preset] : null;
    /* urgency badge */
    const urgBadge = urg
      ? '<span class="cv-urg-pill cv-urg-' + urg.tier + '">' + urg.label + '</span>'
      : '';
    /* response-required banner */
    let respBanner = '';
    if (urg && urg.respond && !m.acked) {
      const slaText = urg.slaMin < 60 ? urg.slaMin + ' min'
                    : urg.slaMin < 1440 ? Math.round(urg.slaMin / 60) + ' hr'
                    : Math.round(urg.slaMin / 1440) + ' day' + (urg.slaMin > 1440 ? 's' : '');
      respBanner = '<div class="cv-resp-banner">' +
        '<span class="cv-resp-ico">!</span>' +
        '<div class="cv-resp-main">' +
          '<div class="cv-resp-t">Response required · acknowledge within ' + slaText + '</div>' +
          '<div class="cv-resp-s">Read receipt is the worker\'s confirmation of compliance with this notice.</div>' +
        '</div>' +
      '</div>';
    }
    /* origination block — module, originator, channel, message id, timestamp */
    const originBlock = '<div class="cv-bub-meta">' +
      '<div class="cv-meta-row"><span class="cv-meta-k">Sent</span><span class="cv-meta-v">' + (m.at || m.time) + '</span></div>' +
      (origin ? '<div class="cv-meta-row"><span class="cv-meta-k">Origin</span><span class="cv-meta-v">' + origin.mod + ' · ' + origin.subMod + '</span></div>' : '') +
      (origin ? '<div class="cv-meta-row"><span class="cv-meta-k">By</span><span class="cv-meta-v">' + origin.by + '</span></div>' : '') +
      (origin ? '<div class="cv-meta-row"><span class="cv-meta-k">Channel</span><span class="cv-meta-v">' + origin.ch + '</span></div>' : '') +
    '</div>';
    /* ack action buttons — show ack chip for unacked + reminder button */
    let actionRow = '';
    if (urg && urg.needsAck && !m.acked) {
      actionRow = '<div class="cv-ack-row">' +
        '<button class="cv-ack-btn primary" onclick="chatAckMessage(\'' + m.id + '\')">Acknowledge as worker</button>' +
        (m.read ? '<button class="cv-ack-btn" onclick="chatRemind(\'' + m.id + '\')">Send response-bot reminder</button>' : '') +
      '</div>';
    }
    return '<div class="cv-msg in"><div class="cv-bub">' +
      (urgBadge ? '<div class="cv-urg-row">' + urgBadge +
        (urg && urg.respond ? '<span class="cv-resp-tag">response required</span>' : '') + '</div>' : '') +
      (subj ? '<div class="cv-bub-subj">' + subj + '</div>' : '') +
      '<div>' + langTag + body + '</div>' +
      (en && !isFallback ? '<div class="cv-bub-bilingual">EN · ' + en + '</div>' : '') +
      respBanner +
      originBlock +
      '<div class="cv-bub-sig">— Karya Vaani assistant · Plant HR</div>' +
      chatAckPill(m, urg) +
      actionRow +
      '<div class="cv-bub-foot">' +
        '<span class="cv-bub-time">' + (m.time || '') + '</span>' +
        '<span class="cv-bub-tick ' + tickCls + '">✓✓</span>' +
      '</div>' +
    '</div></div>';
  }
  /* bubble for a worker reply (outbound from worker perspective) */
  function chatRenderOutbound(m, c) {
    return '<div class="cv-msg out"><div class="cv-bub">' +
      '<div>' + (m.text || '') + '</div>' +
      (m.en ? '<div class="cv-bub-bilingual">EN · ' + m.en + '</div>' : '') +
      '<div class="cv-bub-foot">' +
        '<span class="cv-bub-time">' + m.time + '</span>' +
      '</div>' +
    '</div></div>';
  }

  /* worker hits a quick-reply chip — append, then bot ACKs in their language */
  function chatWorkerReply(text) {
    const c = CHAT_CONTACTS.find(function (x) { return x.id === CHAT_STATE.activeId; });
    if (!c) return;
    const t = CHAT_THREADS[c.id] || (CHAT_THREADS[c.id] = { lastSeen: 'now', msgs: [] });
    const now = chatNowStamp();
    t.msgs.push({
      id: c.id + '-m' + t.msgs.length,
      dir: 'out', text: text, time: 'Today · ' + now, at: chatFullStamp()
    });
    chatRenderConv();
    /* bot ACK after a tiny pause — confirmation in same language */
    setTimeout(function () {
      const ack = {
        TE: 'మీ సందేశం స్వీకరించబడింది. ధన్యవాదాలు 🙏',
        HI: 'आपका संदेश प्राप्त हो गया है। धन्यवाद 🙏',
        TA: 'உங்கள் செய்தி பெறப்பட்டது. நன்றி 🙏',
        OR: 'ଆପଣଙ୍କ ବାର୍ତ୍ତା ଗ୍ରହଣ ହୋଇଛି। ଧନ୍ୟବାଦ 🙏',
        BN: 'আপনার বার্তা পাওয়া গেছে। ধন্যবাদ 🙏',
        MR: 'तुमचा संदेश मिळाला आहे. धन्यवाद 🙏'
      };
      t.msgs.push({
        id: c.id + '-m' + t.msgs.length,
        dir: 'in',
        text: (ack[c.lang] || ack.HI),
        en: 'Your message has been received. Thank you',
        time: 'Today · ' + chatNowStamp(),
        at: chatFullStamp(),
        read: true, acked: false
      });
      chatRenderConv();
      chatRenderList();
      chatRenderAnalytics();
    }, 750);
  }

  /* "Send next broadcast" — pushes the next template into the active thread,
     after a brief typing indicator, in the worker's language */
  function chatSendNextBroadcast() {
    const c = CHAT_CONTACTS.find(function (x) { return x.id === CHAT_STATE.activeId; });
    if (!c) {
      if (typeof toast === 'function') toast('Pick a worker from the chat list first', 'red');
      return;
    }
    const preset = CHAT_BROADCAST_ROTATION[CHAT_BROADCAST_IDX % CHAT_BROADCAST_ROTATION.length];
    CHAT_BROADCAST_IDX++;
    /* show typing */
    const body = document.getElementById('chat-conv-body');
    if (body) {
      const typing = document.createElement('div');
      typing.className = 'cv-msg in';
      typing.id = 'chat-typing';
      typing.innerHTML = '<div class="cv-typing"><span></span><span></span><span></span></div>';
      body.appendChild(typing);
      body.scrollTop = body.scrollHeight;
    }
    setTimeout(function () {
      const t = document.getElementById('chat-typing');
      if (t) t.remove();
      const th = CHAT_THREADS[c.id] || (CHAT_THREADS[c.id] = { lastSeen: 'now', msgs: [] });
      th.msgs.push({
        id: c.id + '-m' + th.msgs.length,
        dir: 'in', preset: preset,
        time: 'Today · ' + chatNowStamp(),
        at: chatFullStamp(),
        read: true, acked: false
      });
      chatRenderConv();
      chatRenderList();
      chatRenderAnalytics();
      if (typeof toast === 'function') {
        const lng = chatLang(c.lang);
        toast('Broadcast "' + chatSubject(preset) + '" sent to ' + c.name +
          ' in ' + lng.name, 'green');
      }
      /* real WhatsApp delivery via the communication gateway */
      if (window.KVWhatsApp) {
        const body = chatLocalised(preset, c.lang);
        window.KVWhatsApp.send(c.phone, body);
      }
    }, 1100);
  }

  function chatNowStamp() {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return hh + ':' + mm;
  }

  function initChat() {
    if (!document.getElementById('chat-list')) return;
    chatEnsureIds();
    /* pick the first worker as default active */
    if (!CHAT_STATE.activeId && CHAT_CONTACTS.length) CHAT_STATE.activeId = CHAT_CONTACTS[0].id;
    chatRenderList();
    chatRenderConv();
    chatRenderQueueStrip();
    /* render analytics if the analytics page is present in the DOM
       (the render functions guard against missing host elements) */
    chatRenderAnalytics();
  }
  __kvOnReady(initChat);

  /* ════════════════════════════════════════════════════════════════
     QUEUE STRIP — little boxes above the chat for today's broadcasts
     Click to expand details · interlinked with analytics page.
     ════════════════════════════════════════════════════════════════ */
  let CV_Q_EXPANDED = null;   /* preset key of the expanded box */

  /* render the horizontal strip of queue boxes + (optional) detail card */
  function chatRenderQueueStrip() {
    const strip = document.getElementById('cv-qstrip');
    const cnt = document.getElementById('cv-qstrip-count');
    const sub = document.getElementById('cv-qstrip-sub');
    if (!strip) return;
    /* mix sent-today (faded, in chronological order) + queue (live) */
    const items = [];
    (CHAT_SENT_TODAY || []).forEach(function (s) {
      items.push({ kind: 'sent', preset: s.preset, hour: s.hour,
        when: chatHourToTime(s.hour), subject: chatSubject(s.preset),
        audience: 'broadcast log' });
    });
    (CHAT_QUEUE || []).forEach(function (q, i) {
      items.push({ kind: 'queue', preset: q.preset, hour: q.hour,
        when: q.scheduledFor + ' IST', subject: chatSubject(q.preset),
        audience: q.audience, etaMin: q.etaMin, idx: i + 1 });
    });
    items.sort(function (a, b) { return a.hour - b.hour; });
    /* counts */
    const queued = items.filter(function (x) { return x.kind === 'queue'; }).length;
    const sent = items.filter(function (x) { return x.kind === 'sent'; }).length;
    if (cnt) cnt.textContent = queued + ' queued · ' + sent + ' sent';
    if (sub) sub.textContent = queued + ' broadcast' + (queued === 1 ? '' : 's') +
      ' queued for today · click a box to expand and send';

    strip.innerHTML = items.map(function (it, i) {
      const u = CHAT_URGENCY[it.preset] || { tier: 'info' };
      const isOn = CV_Q_EXPANDED === it.preset && it.kind === 'queue';
      const sentCls = it.kind === 'sent' ? ' sent' : '';
      const num = it.kind === 'queue' ? it.idx : '✓';
      const eta = it.kind === 'queue'
        ? (it.etaMin < 60 ? 'in ' + it.etaMin + ' min' : 'in ' + Math.round(it.etaMin / 60) + ' hr')
        : 'sent';
      const onclick = it.kind === 'queue'
        ? 'onclick="cvQExpand(\'' + it.preset + '\')"'
        : '';
      return '<div class="cv-qbox ' + u.tier + sentCls + (isOn ? ' on' : '') + '" ' + onclick + '>' +
        '<div class="cv-qbox-top">' +
          '<span class="cv-qbox-num ' + u.tier + '">' + num + '</span>' +
          '<span class="cv-qbox-time">' + it.when + '</span>' +
        '</div>' +
        '<div class="cv-qbox-subj">' + it.subject + '</div>' +
        '<div class="cv-qbox-foot">' +
          '<span class="cv-qbox-aud">' + it.audience + '</span>' +
          '<span class="cv-qbox-eta">' + eta + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    chatRenderQueueDetail();
  }

  function chatHourToTime(h) {
    const hh = Math.floor(h);
    const mm = Math.round((h - hh) * 60);
    return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  function cvQExpand(preset) {
    CV_Q_EXPANDED = (CV_Q_EXPANDED === preset) ? null : preset;
    chatRenderQueueStrip();
  }
  function cvQClose() { CV_Q_EXPANDED = null; chatRenderQueueStrip(); }

  /* render the expanded detail card under the strip */
  function chatRenderQueueDetail() {
    const host = document.getElementById('cv-qstrip-detail');
    if (!host) return;
    if (!CV_Q_EXPANDED) { host.style.display = 'none'; host.innerHTML = ''; return; }
    const q = (CHAT_QUEUE || []).find(function (x) { return x.preset === CV_Q_EXPANDED; });
    if (!q) { host.style.display = 'none'; return; }
    const u = CHAT_URGENCY[q.preset] || { tier: 'info', label: 'Info', needsAck: false, slaMin: 0 };
    const o = CHAT_ORIGIN[q.preset] || {};
    /* preview body in English (would be translated per worker at send time) */
    const preview = chatEn(q.preset);
    /* number of languages this audience touches — derived from the current contact pool */
    const audienceSize = (CHAT_CONTACTS || []).length;   /* indicative for the demo */
    const slaTxt = u.needsAck
      ? (u.slaMin < 60 ? u.slaMin + ' min' : u.slaMin < 1440 ? Math.round(u.slaMin / 60) + ' hr' : Math.round(u.slaMin / 1440) + ' day')
      : 'not required';
    host.style.display = 'block';
    host.innerHTML =
      '<div class="cv-qsd-h">' +
        '<div class="cv-qsd-h-l">' +
          '<div class="cv-qsd-eye">Queued broadcast · #' + (CHAT_QUEUE.indexOf(q) + 1) + '</div>' +
          '<div class="cv-qsd-subj">' + chatSubject(q.preset) + '</div>' +
        '</div>' +
        '<span class="cv-qsd-close" onclick="cvQClose()">Close ✕</span>' +
      '</div>' +
      '<div class="cv-qsd-grid">' +
        '<div class="cv-qsd-cell"><div class="cv-qsd-cell-k">Scheduled</div><div class="cv-qsd-cell-v">' + q.scheduledFor + ' IST · in ' + (q.etaMin < 60 ? q.etaMin + ' min' : Math.round(q.etaMin / 60) + ' hr') + '</div></div>' +
        '<div class="cv-qsd-cell"><div class="cv-qsd-cell-k">Audience</div><div class="cv-qsd-cell-v">' + q.audience + ' · ' + audienceSize + ' worker' + (audienceSize === 1 ? '' : 's') + '</div></div>' +
        '<div class="cv-qsd-cell"><div class="cv-qsd-cell-k">Tier</div><div class="cv-qsd-cell-v"><span class="cv-an-tier ' + u.tier + '">' + u.tier + '</span> ' + (u.needsAck ? '· response required' : '') + '</div></div>' +
        '<div class="cv-qsd-cell"><div class="cv-qsd-cell-k">Ack SLA</div><div class="cv-qsd-cell-v">' + slaTxt + '</div></div>' +
        '<div class="cv-qsd-cell" style="grid-column:span 2"><div class="cv-qsd-cell-k">Origin</div><div class="cv-qsd-cell-v">' + (o.mod || 'VAANI Broadcasting') + ' · ' + (o.subMod || '—') + '</div></div>' +
        '<div class="cv-qsd-cell" style="grid-column:span 2"><div class="cv-qsd-cell-k">Originator</div><div class="cv-qsd-cell-v">' + (o.by || 'Plant HR') + '</div></div>' +
      '</div>' +
      '<div class="cv-qsd-preview">"' + preview + '"</div>' +
      '<div class="cv-qsd-acts">' +
        '<button class="cv-qsd-btn primary" onclick="cvQSendNow(\'' + q.preset + '\')">Send now to all workers</button>' +
        '<button class="cv-qsd-btn" onclick="cvQSendToActive(\'' + q.preset + '\')">Send to current worker only</button>' +
        '<button class="cv-qsd-btn" onclick="cvQClose()">Cancel</button>' +
      '</div>';
  }

  /* send a queued broadcast now — dispatch to every contact + remove from queue */
  function cvQSendNow(preset) {
    const idx = CHAT_QUEUE.findIndex(function (q) { return q.preset === preset; });
    if (idx < 0) return;
    CHAT_QUEUE.splice(idx, 1);
    /* push the message into every worker's thread */
    CHAT_CONTACTS.forEach(function (c) {
      const t = CHAT_THREADS[c.id] || (CHAT_THREADS[c.id] = { lastSeen: 'now', msgs: [] });
      t.msgs.push({
        id: c.id + '-m' + t.msgs.length,
        dir: 'in', preset: preset,
        time: 'Today · ' + chatNowStamp(), at: chatFullStamp(),
        read: false, acked: false
      });
    });
    /* log it as sent-today so it appears on the timeline / strip */
    const u = CHAT_URGENCY[preset] || {};
    if (typeof CHAT_SENT_TODAY !== 'undefined') {
      const d = new Date();
      CHAT_SENT_TODAY.push({ preset: preset, subject: chatSubject(preset),
        hour: d.getHours() + d.getMinutes() / 60 });
    }
    CV_Q_EXPANDED = null;
    chatRenderQueueStrip();
    chatRenderConv();
    chatRenderList();
    chatRenderAnalytics();
    if (typeof toast === 'function') {
      toast('Broadcast "' + chatSubject(preset) + '" sent to ' + CHAT_CONTACTS.length + ' workers', 'green');
    }
  }
  /* send only to the currently-open worker — useful for testing / 1-1 follow-up */
  function cvQSendToActive(preset) {
    if (!CHAT_STATE.activeId) {
      if (typeof toast === 'function') toast('Open a worker first', 'red');
      return;
    }
    const c = CHAT_CONTACTS.find(function (x) { return x.id === CHAT_STATE.activeId; });
    if (!c) return;
    const t = CHAT_THREADS[c.id] || (CHAT_THREADS[c.id] = { lastSeen: 'now', msgs: [] });
    t.msgs.push({
      id: c.id + '-m' + t.msgs.length,
      dir: 'in', preset: preset,
      time: 'Today · ' + chatNowStamp(), at: chatFullStamp(),
      read: true, acked: false
    });
    CV_Q_EXPANDED = null;
    chatRenderQueueStrip();
    chatRenderConv();
    chatRenderList();
    chatRenderAnalytics();
    if (typeof toast === 'function') {
      toast('Sent "' + chatSubject(preset) + '" to ' + c.name, 'green');
    }
  }

  /* analytics page has its own init — runs on DOM load AND on navigation
     to the analytics page (idempotent). */
  function initChatAnalytics() {
    if (!document.getElementById('cv-an-grid-body')) return;
    chatEnsureIds();
    chatRenderAnalytics();
  }
  __kvOnReady(initChatAnalytics);

  /* hook into the SPA nav so the analytics page re-renders every time
     it is shown — counts must reflect anything done in chat in between */
  (function () {
    if (typeof window === 'undefined') return;
    const origNav = window.nav;
    if (typeof origNav !== 'function') return;
    window.nav = function (id, el) {
      origNav(id, el);
      if (id === 'analytics') {
        // Re-render every pane whenever the hub is shown.
        if (typeof initExposureAnalytics === 'function') initExposureAnalytics();
        if (typeof initReadinessAnalytics === 'function') initReadinessAnalytics();
        initChatAnalytics();
      }
      if (id === 'chat') {
        /* re-render queue strip on entering the chat page too */
        if (document.getElementById('cv-qstrip')) chatRenderQueueStrip();
      }
    };
  })();

  /* ════════════════════════════════════════════════════════════════
     CHAT ANALYTICS + BROADCAST PIPELINE
     Aggregates the live thread data into a per-subject breakdown and
     surfaces a queue→delivered→read→acknowledged pipeline view.
     ════════════════════════════════════════════════════════════════ */

  /* synthetic queue of upcoming broadcasts (scheduled but not yet sent).
     In production this is the live Vaani Broadcasting send queue. */
  let CHAT_QUEUE = (window.__KVDATA && window.__KVDATA.chatQueue) || [];
  /* current time anchor for the timeline visualisation (today) */
  const CHAT_NOW_HOUR = 14.30;   /* 14:18 — between Transport and Fire on the timeline */
  /* a small log of already-sent-today broadcasts, plotted on the timeline before NOW */
  let CHAT_SENT_TODAY = (window.__KVDATA && window.__KVDATA.chatSentToday) || [];

  function chatAggregate() {
    /* roll up across every inbound preset-message in every thread.
       Group by subject (preset) and compute counts + ack/read rates. */
    const by = {};
    Object.keys(CHAT_THREADS).forEach(function (wid) {
      const c = CHAT_CONTACTS.find(function (x) { return x.id === wid; });
      const langCode = c ? c.lang : 'EN';
      (CHAT_THREADS[wid].msgs || []).forEach(function (m) {
        if (m.dir !== 'in' || !m.preset) return;
        if (!by[m.preset]) {
          by[m.preset] = {
            preset: m.preset,
            subject: chatSubject(m.preset),
            urg: CHAT_URGENCY[m.preset] || { tier: 'info', needsAck: false },
            sent: 0, read: 0, acked: 0, pending: 0,
            langs: {}
          };
        }
        const b = by[m.preset];
        b.sent++;
        if (m.read) b.read++;
        if (m.acked) b.acked++;
        if (b.urg.needsAck && !m.acked) b.pending++;
        b.langs[langCode] = (b.langs[langCode] || 0) + 1;
      });
    });
    return Object.values(by);
  }

  /* ════════════════════════════════════════════════════════════════
     LIVE COMMS BRIDGE
     Pulls the actual WhatsApp message log from the communication gateway
     (/api/whatsapp/messages, via KVWhatsApp) and folds it into CHAT_THREADS
     so the analytics reflect real traffic — not just the seeded history.

       · outbound gateway send  → the worker *received* a broadcast (dir:'in')
       · inbound worker reply   → acknowledgement of the latest open message
       · status:read/delivered  → marks the matching delivery as read

     Idempotent: every record is keyed by its messageId so re-polling and
     UI-originated sends are never double-counted.
     ════════════════════════════════════════════════════════════════ */
  const CHAT_LIVE_SEEN = {};            /* messageId → true (dedupe) */
  let CHAT_PRESET_TEXT_IDX = null;      /* normalised body text → preset key */
  let CHAT_PHONE_IDX = null;            /* last-4 digits → contact id */
  let CHAT_LIVE_POLL = null;
  let CHAT_LIVE_STARTED = false;

  function chatNormTxt(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  function chatLast4(p) { const d = String(p == null ? '' : p).replace(/\D/g, ''); return d.slice(-4); }

  /* reverse map: any localised/English body → its preset key, so a free-text
     gateway message can be classified back to a broadcast subject + tier */
  function chatBuildPresetTextIdx() {
    const idx = {};
    if (typeof VB_PRESETS !== 'undefined') {
      Object.keys(VB_PRESETS).forEach(function (p) {
        const b = VB_PRESETS[p] && VB_PRESETS[p].body;
        if (b) idx[chatNormTxt(b)] = p;
      });
    }
    if (typeof VB_TRANSLATIONS !== 'undefined') {
      Object.keys(VB_TRANSLATIONS).forEach(function (p) {
        Object.keys(VB_TRANSLATIONS[p] || {}).forEach(function (lang) {
          const t = VB_TRANSLATIONS[p][lang];
          if (t) idx[chatNormTxt(t)] = p;
        });
      });
    }
    return idx;
  }

  /* last-4-digit index of every contact phone — masked rosters still carry
     the trailing four digits, which is enough to attribute live traffic */
  function chatBuildPhoneIdx() {
    const idx = {};
    CHAT_CONTACTS.forEach(function (c) {
      const k = chatLast4(c.phone);
      if (k && k.length === 4 && idx[k] === undefined) idx[k] = c.id;
    });
    return idx;
  }

  /* fold a batch of gateway records into the threads. Returns true if any
     thread changed (so the caller can re-render). */
  function chatIngestLiveComms(items) {
    if (!Array.isArray(items) || !items.length) return false;
    if (!CHAT_PRESET_TEXT_IDX) CHAT_PRESET_TEXT_IDX = chatBuildPresetTextIdx();
    CHAT_PHONE_IDX = chatBuildPhoneIdx();   /* contacts may have been re-seeded */
    let changed = false;

    items.forEach(function (m) {
      const mid = m.messageId || ('seq-' + m.seq);
      if (!mid || CHAT_LIVE_SEEN[mid]) return;

      /* delivery status callback → mark the originating message read */
      if (m.direction === 'status') {
        if (m.status === 'read' || m.status === 'delivered') {
          const tgt = m.messageId;
          Object.keys(CHAT_THREADS).some(function (wid) {
            const hit = (CHAT_THREADS[wid].msgs || []).find(function (x) { return x.msgId === tgt; });
            if (hit && hit.dir === 'in') { hit.read = true; changed = true; return true; }
            return false;
          });
        }
        CHAT_LIVE_SEEN[mid] = true;
        return;
      }

      const phone = m.to || m.from || m.intendedFor;
      const cid = CHAT_PHONE_IDX[chatLast4(phone)];
      if (!cid) { CHAT_LIVE_SEEN[mid] = true; return; }   /* unknown recipient */
      const th = CHAT_THREADS[cid] || (CHAT_THREADS[cid] = { lastSeen: 'now', msgs: [] });
      const stamp = m.at ? ('Live · ' + String(m.at).replace('T', ' ').slice(0, 16)) : 'Live';

      if (m.direction === 'out') {
        /* broadcast leaving the gateway = the worker received it */
        const preset = CHAT_PRESET_TEXT_IDX[chatNormTxt(m.text)] || 'holiday';
        th.msgs.push({
          id: cid + '-live-' + mid, msgId: mid, dir: 'in', preset: preset,
          time: stamp, at: m.at || '', live: true,
          read: (m.status === 'read' || m.status === 'delivered'), acked: false
        });
        changed = true;
      } else if (m.direction === 'in') {
        /* worker reply = acknowledge the most recent open inbound delivery */
        for (let i = th.msgs.length - 1; i >= 0; i--) {
          if (th.msgs[i].dir === 'in' && !th.msgs[i].acked) {
            th.msgs[i].acked = true; th.msgs[i].read = true; th.msgs[i].ackedAt = m.at || '';
            break;
          }
        }
        th.msgs.push({ id: cid + '-live-' + mid, msgId: mid, dir: 'out', text: m.text || '', time: stamp, at: m.at || '', live: true });
        changed = true;
      }
      CHAT_LIVE_SEEN[mid] = true;
    });
    return changed;
  }

  /* poll the gateway log once and re-render the surfaces that depend on it */
  function chatRefreshLiveComms() {
    if (!window.KVWhatsApp || typeof window.KVWhatsApp.messages !== 'function') {
      return Promise.resolve(false);
    }
    return window.KVWhatsApp.messages({ limit: 200 })
      .then(function (res) {
        const items = (res && (res.items || res.messages)) || [];
        const changed = chatIngestLiveComms(items);
        if (changed) {
          chatEnsureIds();
          if (document.getElementById('cv-an-grid-body')) chatRenderAnalytics();
          if (document.getElementById('chat-list')) { try { chatRenderList(); chatRenderConv(); } catch (e) { /* ignore */ } }
        }
        return changed;
      })
      .catch(function () { return false; });
  }

  /* one-time: track UI-originated sends so the poll never re-ingests them,
     then begin polling the live log */
  function chatLiveStart() {
    if (CHAT_LIVE_STARTED) return;
    CHAT_LIVE_STARTED = true;
    if (window.KVWhatsApp && typeof window.KVWhatsApp.send === 'function' && !window.KVWhatsApp.__kvLiveTracked) {
      const _send = window.KVWhatsApp.send.bind(window.KVWhatsApp);
      window.KVWhatsApp.send = function (to, msg) {
        return _send(to, msg).then(function (r) {
          try { ((r && r.results) || []).forEach(function (x) { if (x && x.id) CHAT_LIVE_SEEN[x.id] = true; }); } catch (e) { /* ignore */ }
          return r;
        });
      };
      window.KVWhatsApp.__kvLiveTracked = true;
    }
    chatRefreshLiveComms();
    if (!CHAT_LIVE_POLL) CHAT_LIVE_POLL = setInterval(chatRefreshLiveComms, 15000);
  }
  __kvOnReady(chatLiveStart);

  function chatRenderAnalytics() {
    chatRenderHero();
    cvwRender();    /* broadcast-window curve */
    cvsRender();    /* slicing grid */
    cvmRender();    /* by message type */
    cvrRender();    /* action recommendations */
    chatRenderInsight();
    chatRenderPipeline();
    chatRenderTimeline();
    chatRenderGrouped();
    cvRenderTrends();
    chatRenderLanguageStrip();
    chatRenderSubjectGrid();
    cvaApplyFilters();
    cvaRenderFilterDrill();
  }

  /* ════════════════════════════════════════════════════════════════
     DELIVERY TRENDS CHART  — hour-by-hour SVG line/area chart with
     three views: hourly volume (cumulative sent/read/acked), read &
     ack rate (%), and time-to-read by tier.
     ════════════════════════════════════════════════════════════════ */
  let CV_TR_VIEW = 'hourly';

  function cvTrendsSet(el, view) {
    CV_TR_VIEW = view;
    const tabs = document.querySelectorAll('.cv-trends-tab');
    tabs.forEach(function (t) { t.classList.toggle('on', t === el); });
    cvRenderTrends();
  }

  /* aggregate all inbound preset messages bucketed by hour (9..21).
     Returns { byHour: {h: {sent, read, acked, byTier: {t: {n, ttrSum}}}}, totals } */
  function cvTrendsAggregate() {
    const startH = 9, endH = 21;
    const byHour = {};
    for (let h = startH; h <= endH; h++) {
      byHour[h] = { sent: 0, read: 0, acked: 0,
        byTier: { critical: { n: 0, ttrSum: 0 }, urgent: { n: 0, ttrSum: 0 },
                  advisory: { n: 0, ttrSum: 0 }, info: { n: 0, ttrSum: 0 } } };
    }
    /* helper to parse a thread's "at" timestamp → hour
       fall back to looking up the sent-today log by preset */
    const presetToSentHour = {};
    (CHAT_SENT_TODAY || []).forEach(function (s) { presetToSentHour[s.preset] = s.hour; });

    Object.keys(CHAT_THREADS).forEach(function (wid) {
      (CHAT_THREADS[wid].msgs || []).forEach(function (m) {
        if (m.dir !== 'in' || !m.preset) return;
        const u = CHAT_URGENCY[m.preset] || { tier: 'info' };
        /* hour: prefer the broadcast's logged hour, else parse m.at */
        let h = presetToSentHour[m.preset];
        if (h === undefined && m.at) {
          /* m.at like "25 May 2026 · 16:42:08 IST" */
          const mm = /(\d{1,2}):(\d{2})/.exec(m.at);
          if (mm) h = parseInt(mm[1], 10) + parseInt(mm[2], 10) / 60;
        }
        if (h === undefined) h = CHAT_NOW_HOUR;
        const hh = Math.max(startH, Math.min(endH, Math.round(h)));
        if (!byHour[hh]) return;
        byHour[hh].sent++;
        if (m.read) byHour[hh].read++;
        if (m.acked) byHour[hh].acked++;
        /* ttr — derive deterministic value (re-use cvHash + base+jitter) */
        if (m.read) {
          const base = CV_TTR_BASE[u.tier] || 60;
          const varSpan = CV_TTR_VAR[u.tier] || 30;
          const jitter = (cvHash(wid + m.preset) - 0.5) * 2 * varSpan;
          const ttr = Math.max(1, base + jitter);
          byHour[hh].byTier[u.tier].n++;
          byHour[hh].byTier[u.tier].ttrSum += ttr;
        }
      });
    });
    return byHour;
  }

  function cvRenderTrends() {
    const chart = document.getElementById('cv-trends-chart');
    const legend = document.getElementById('cv-trends-legend');
    const foot = document.getElementById('cv-trends-foot');
    if (!chart) return;
    const data = cvTrendsAggregate();
    const startH = 9, endH = 21;
    /* SVG coordinate system */
    const vbW = 800, vbH = 240;
    const padL = 38, padR = 14, padT = 12, padB = 28;
    const innerW = vbW - padL - padR;
    const innerH = vbH - padT - padB;
    const xOf = function (h) { return padL + ((h - startH) / (endH - startH)) * innerW; };
    const yOf = function (v, max) { return padT + innerH - (max > 0 ? (v / max) * innerH : 0); };

    /* axis */
    let axis = '<g class="cv-tr-axis">';
    /* x-axis hour ticks */
    for (let h = startH; h <= endH; h++) {
      const isMajor = (h === startH) || (h === endH) || (h % 3 === 0);
      if (isMajor) {
        axis += '<text x="' + xOf(h) + '" y="' + (vbH - padB + 14) + '" text-anchor="middle">' +
          String(h).padStart(2, '0') + ':00</text>';
      }
    }
    axis += '</g>';

    let seriesHtml = '', dotsHtml = '', legendHtml = '', footTxt = '', gridHtml = '';

    if (CV_TR_VIEW === 'hourly') {
      /* cumulative sent / read / acked over time */
      let cumS = 0, cumR = 0, cumA = 0;
      const sentPts = [], readPts = [], ackedPts = [];
      for (let h = startH; h <= endH; h++) {
        cumS += data[h].sent; cumR += data[h].read; cumA += data[h].acked;
        sentPts.push([h, cumS]); readPts.push([h, cumR]); ackedPts.push([h, cumA]);
      }
      const max = Math.max(cumS, 1);
      /* grid */
      for (let i = 0; i <= 4; i++) {
        const y = padT + (innerH * i / 4);
        gridHtml += '<line x1="' + padL + '" y1="' + y + '" x2="' + (vbW - padR) + '" y2="' + y + '"/>';
        axis += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end">' +
          Math.round(max - (max * i / 4)) + '</text>';
      }
      const toPath = function (pts, cls) {
        const d = pts.map(function (p, i) { return (i === 0 ? 'M' : 'L') + xOf(p[0]) + ',' + yOf(p[1], max); }).join(' ');
        const last = pts[pts.length - 1], first = pts[0];
        const areaD = 'M' + xOf(first[0]) + ',' + (padT + innerH) + ' ' +
          pts.map(function (p) { return 'L' + xOf(p[0]) + ',' + yOf(p[1], max); }).join(' ') +
          ' L' + xOf(last[0]) + ',' + (padT + innerH) + ' Z';
        return '<path class="cv-tr-area ' + cls + '" d="' + areaD + '"/>' +
               '<path class="cv-tr-line ' + cls + '" d="' + d + '"/>';
      };
      seriesHtml = toPath(sentPts, 'sent') + toPath(readPts, 'read') + toPath(ackedPts, 'acked');
      /* dots at each point */
      const dot = function (pts, cls) {
        return pts.map(function (p) {
          return '<circle class="cv-tr-dot ' + cls + '" cx="' + xOf(p[0]) + '" cy="' + yOf(p[1], max) + '" r="3.5"/>';
        }).join('');
      };
      dotsHtml = dot(sentPts, 'sent') + dot(readPts, 'read') + dot(ackedPts, 'acked');
      legendHtml =
        '<span class="lg"><span class="lg-sw" style="background:var(--indigo)"></span>Sent (cumulative)</span>' +
        '<span class="lg"><span class="lg-sw" style="background:#1A8DD1"></span>Read</span>' +
        '<span class="lg"><span class="lg-sw" style="background:var(--green-dk)"></span>Acknowledged</span>';
      /* foot text — find dispatch peak */
      let peakH = startH, peakN = 0;
      for (let h = startH; h <= endH; h++) {
        if (data[h].sent > peakN) { peakN = data[h].sent; peakH = h; }
      }
      footTxt = peakN > 0
        ? 'Dispatch peaked at ' + chatHourToTime(peakH) + ' with ' + peakN + ' broadcast' + (peakN === 1 ? '' : 's') +
          '. Reads track close behind — acknowledgements lag, leaving ' + (cumS - cumA) + ' message' + (cumS - cumA === 1 ? '' : 's') + ' awaiting confirmation.'
        : 'No broadcasts dispatched yet today.';
    }
    else if (CV_TR_VIEW === 'rate') {
      /* read% / ack% — cumulative ratio at each hour */
      let cumS = 0, cumR = 0, cumA = 0, cumAReq = 0;
      const readPts = [], ackPts = [];
      for (let h = startH; h <= endH; h++) {
        cumS += data[h].sent; cumR += data[h].read; cumA += data[h].acked;
        /* acked-required count: sum of sent with needsAck — approximate by computing per-hour */
        Object.keys(data[h].byTier).forEach(function (t) {
          if (CHAT_URGENCY && Object.values(CHAT_URGENCY).some(function (u) { return u.tier === t && u.needsAck; })) {
            /* approximate: this hour's sent of this tier counts toward ackReq if its template needs ack */
          }
        });
        /* simpler: total acked / total sent_with_needsAck — we already have ackedRequired from chatAggregate */
        readPts.push([h, cumS ? (cumR / cumS * 100) : 0]);
        /* ack denominator — use cumS as proxy when ackReq isn't easy to derive per hour */
        ackPts.push([h, cumS ? (cumA / cumS * 100) : 0]);
      }
      const max = 100;
      for (let i = 0; i <= 4; i++) {
        const y = padT + (innerH * i / 4);
        gridHtml += '<line x1="' + padL + '" y1="' + y + '" x2="' + (vbW - padR) + '" y2="' + y + '"/>';
        axis += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end">' +
          Math.round(max - (max * i / 4)) + '%</text>';
      }
      const toPath = function (pts, cls) {
        const d = pts.map(function (p, i) { return (i === 0 ? 'M' : 'L') + xOf(p[0]) + ',' + yOf(p[1], max); }).join(' ');
        return '<path class="cv-tr-line ' + cls + '" d="' + d + '"/>';
      };
      seriesHtml = toPath(readPts, 'read') + toPath(ackPts, 'acked');
      const dot = function (pts, cls) {
        return pts.map(function (p) {
          return '<circle class="cv-tr-dot ' + cls + '" cx="' + xOf(p[0]) + '" cy="' + yOf(p[1], max) + '" r="3.5"/>';
        }).join('');
      };
      dotsHtml = dot(readPts, 'read') + dot(ackPts, 'acked');
      legendHtml =
        '<span class="lg"><span class="lg-sw" style="background:#1A8DD1"></span>Read rate</span>' +
        '<span class="lg"><span class="lg-sw" style="background:var(--green-dk)"></span>Ack rate</span>';
      const last = readPts[readPts.length - 1], lastA = ackPts[ackPts.length - 1];
      footTxt = 'Read rate now sits at ' + Math.round(last[1]) + '%, acknowledgement at ' +
        Math.round(lastA[1]) + '%. The widening gap between the two is the response-bot\'s opportunity to nudge.';
    }
    else if (CV_TR_VIEW === 'ttr') {
      /* time-to-read per tier — average TTR for messages dispatched in that hour */
      const tiers = ['critical', 'urgent', 'advisory', 'info'];
      const series = {};
      let max = 1;
      tiers.forEach(function (t) {
        series[t] = [];
        for (let h = startH; h <= endH; h++) {
          const tr = data[h].byTier[t];
          if (tr.n > 0) {
            const avg = tr.ttrSum / tr.n;
            if (avg > max) max = avg;
            series[t].push([h, avg]);
          }
        }
      });
      max = Math.ceil(max / 30) * 30;   /* round to next 30 min */
      for (let i = 0; i <= 4; i++) {
        const y = padT + (innerH * i / 4);
        gridHtml += '<line x1="' + padL + '" y1="' + y + '" x2="' + (vbW - padR) + '" y2="' + y + '"/>';
        const v = Math.round(max - (max * i / 4));
        axis += '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end">' + v + 'm</text>';
      }
      tiers.forEach(function (t) {
        const pts = series[t];
        if (pts.length === 0) return;
        const d = pts.map(function (p, i) { return (i === 0 ? 'M' : 'L') + xOf(p[0]) + ',' + yOf(p[1], max); }).join(' ');
        seriesHtml += '<path class="cv-tr-line ttr-' + t + '" d="' + d + '"/>';
        pts.forEach(function (p) {
          dotsHtml += '<circle class="cv-tr-dot ttr-' + t + '" cx="' + xOf(p[0]) + '" cy="' + yOf(p[1], max) + '" r="3.5"/>';
        });
      });
      legendHtml = tiers.map(function (t) {
        const colorMap = { critical: '#C84F3F', urgent: '#C7771A', advisory: 'var(--indigo)', info: 'var(--ink-3)' };
        return '<span class="lg"><span class="lg-sw" style="background:' + colorMap[t] + '"></span>' +
          t.charAt(0).toUpperCase() + t.slice(1) + '</span>';
      }).join('');
      footTxt = 'Time-to-read is plotted hour-by-hour for each tier. Critical messages should land near the bottom of the chart (read fast); advisory/info sit higher because workers take longer to open them.';
    }

    /* compose the SVG */
    chart.innerHTML =
      '<svg viewBox="0 0 ' + vbW + ' ' + vbH + '" preserveAspectRatio="none">' +
        '<g class="cv-tr-grid">' + gridHtml + '</g>' +
        axis +
        seriesHtml + dotsHtml +
      '</svg>' +
      /* NOW vertical guide — positioned via CSS percentage within the chart */
      '<div class="cv-tr-now" style="left:' +
        (padL + ((CHAT_NOW_HOUR - startH) / (endH - startH)) * innerW) / vbW * 100 + '%"></div>';
    if (legend) legend.innerHTML = legendHtml;
    if (foot) foot.textContent = footTxt;
  }

  /* ════════════════════════════════════════════════════════════════
     GROUPED RESPONSE ANALYTICS
     Roll up read / ack / pending counts by employee, department,
     employment type or contractor. Switchable via tabs.
     ════════════════════════════════════════════════════════════════ */
  let CV_GRP_TAB = 'employee';

  function cvGrpSet(el, key) {
    CV_GRP_TAB = key;
    const tabs = document.querySelectorAll('.cv-grp-tab');
    tabs.forEach(function (t) { t.classList.toggle('on', t === el); });
    chatRenderGrouped();
  }

  /* roll up message-level data into per-worker stats first — this is the
     base every group dimension can be aggregated from */
  function cvGrpPerWorker() {
    const by = {};
    CHAT_CONTACTS.forEach(function (c) {
      by[c.id] = {
        c: c, sent: 0, read: 0, acked: 0, ackReq: 0, pending: 0,
        critical: 0, critPend: 0
      };
    });
    Object.keys(CHAT_THREADS).forEach(function (wid) {
      const stats = by[wid]; if (!stats) return;
      (CHAT_THREADS[wid].msgs || []).forEach(function (m) {
        if (m.dir !== 'in' || !m.preset) return;
        const u = CHAT_URGENCY[m.preset] || { tier: 'info', needsAck: false };
        stats.sent++;
        if (m.read) stats.read++;
        if (m.acked) stats.acked++;
        if (u.needsAck) stats.ackReq++;
        if (u.needsAck && !m.acked) stats.pending++;
        if (u.tier === 'critical') {
          stats.critical++;
          if (u.needsAck && !m.acked) stats.critPend++;
        }
      });
    });
    return by;
  }

  function chatRenderGrouped() {
    const head = document.getElementById('cv-grp-grid-head');
    const body = document.getElementById('cv-grp-grid-body');
    const tot = document.getElementById('cv-grp-total');
    if (!head || !body) return;

    const perWorker = cvGrpPerWorker();

    /* build rows depending on the active tab */
    let rows = [], headers = [];
    if (CV_GRP_TAB === 'employee') {
      headers = ['Worker', 'Type', 'Sent', 'Read', 'Acknowledged', 'Pending', 'Compliance'];
      rows = Object.values(perWorker).filter(function (w) { return w.sent > 0; });
    } else if (CV_GRP_TAB === 'department') {
      headers = ['Department', 'Workers', 'Sent', 'Read', 'Acknowledged', 'Pending', 'Compliance'];
      const agg = {};
      Object.values(perWorker).forEach(function (w) {
        const k = w.c.dept || 'Unassigned';
        if (!agg[k]) agg[k] = { key: k, label: k, count: 0, sent: 0, read: 0, acked: 0, ackReq: 0, pending: 0 };
        if (w.sent > 0) agg[k].count++;
        agg[k].sent += w.sent; agg[k].read += w.read; agg[k].acked += w.acked;
        agg[k].ackReq += w.ackReq; agg[k].pending += w.pending;
      });
      rows = Object.values(agg).filter(function (g) { return g.sent > 0; });
    } else if (CV_GRP_TAB === 'type') {
      headers = ['Employment type', 'Workers', 'Sent', 'Read', 'Acknowledged', 'Pending', 'Compliance'];
      const agg = {
        Direct:   { key: 'Direct',   label: 'Direct employees', sub: 'on payroll',                 count: 0, sent: 0, read: 0, acked: 0, ackReq: 0, pending: 0 },
        Contract: { key: 'Contract', label: 'Contract workers', sub: 'supplied by contractors',    count: 0, sent: 0, read: 0, acked: 0, ackReq: 0, pending: 0 }
      };
      Object.values(perWorker).forEach(function (w) {
        const k = w.c.type === 'Contract' ? 'Contract' : 'Direct';
        if (w.sent > 0) agg[k].count++;
        agg[k].sent += w.sent; agg[k].read += w.read; agg[k].acked += w.acked;
        agg[k].ackReq += w.ackReq; agg[k].pending += w.pending;
      });
      rows = Object.values(agg).filter(function (g) { return g.sent > 0; });
    } else if (CV_GRP_TAB === 'contractor') {
      headers = ['Contractor', 'Workers', 'Sent', 'Read', 'Acknowledged', 'Pending', 'Compliance'];
      const agg = {};
      Object.values(perWorker).forEach(function (w) {
        if (w.c.type !== 'Contract') return;
        const k = w.c.contractor || 'Unassigned contractor';
        if (!agg[k]) agg[k] = { key: k, label: k, count: 0, sent: 0, read: 0, acked: 0, ackReq: 0, pending: 0 };
        if (w.sent > 0) agg[k].count++;
        agg[k].sent += w.sent; agg[k].read += w.read; agg[k].acked += w.acked;
        agg[k].ackReq += w.ackReq; agg[k].pending += w.pending;
      });
      rows = Object.values(agg).filter(function (g) { return g.sent > 0; });
    }

    /* sort: pending desc, then ack rate asc — what needs attention first */
    rows.sort(function (a, b) {
      const aPend = (a.pending !== undefined) ? a.pending : 0;
      const bPend = (b.pending !== undefined) ? b.pending : 0;
      if (aPend !== bPend) return bPend - aPend;
      const aR = a.ackReq ? a.acked / a.ackReq : 1;
      const bR = b.ackReq ? b.acked / b.ackReq : 1;
      return aR - bR;
    });

    tot.textContent = rows.length + ' ' + (CV_GRP_TAB === 'employee' ? 'worker' :
      CV_GRP_TAB === 'department' ? 'department' :
      CV_GRP_TAB === 'type' ? 'cohort' : 'contractor') +
      (rows.length === 1 ? '' : 's');

    /* header row — drilldown adds a leading caret column when applicable */
    const drillable = (CV_GRP_TAB === 'contractor' || CV_GRP_TAB === 'department');
    head.innerHTML = '<tr>' +
      (drillable ? '<th style="width:14px"></th>' : '') +
      headers.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr>';

    /* body */
    let html = '';
    rows.forEach(function (r) {
      const sent = r.sent || 0;
      const readPct = sent ? Math.round(r.read / sent * 100) : 0;
      const ackPct  = r.ackReq ? Math.round(r.acked / r.ackReq * 100) : 0;
      const readCol = readPct >= 80 ? 'var(--green)' : readPct >= 50 ? 'var(--amber)' : 'var(--red)';
      const ackCol  = !r.ackReq ? 'var(--ink-4)'
                    : ackPct >= 80 ? 'var(--green)'
                    : ackPct >= 50 ? 'var(--amber)' : 'var(--red)';
      const complCls = !r.ackReq ? 'amber'
                     : ackPct >= 80 ? 'green'
                     : ackPct >= 50 ? 'amber' : 'red';
      const complTxt = !r.ackReq ? 'n/a' : ackPct + '% on-time';

      let nameCell = '';
      if (CV_GRP_TAB === 'employee') {
        const w = r.c;
        const ini = w.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
        const isContract = w.type === 'Contract';
        nameCell =
          '<td><div class="cv-grp-name-cell">' +
            '<span class="cv-grp-ava ' + (isContract ? 'contract' : '') + '">' + ini + '</span>' +
            '<div class="cv-grp-name-main">' +
              '<div class="cv-grp-name">' + w.name + '</div>' +
              '<div class="cv-grp-name-s">' + w.role + ' · ' + w.dept +
                (isContract && w.contractor ? ' · ' + w.contractor : '') + '</div>' +
            '</div>' +
          '</div></td>' +
          '<td><span class="cv-grp-type ' + (isContract ? 'contract' : 'direct') + '">' +
            (isContract ? 'Contract' : 'Direct') + '</span></td>';
      } else {
        const sub = r.sub || ((r.count || 0) + ' worker' + ((r.count || 0) === 1 ? '' : 's') + ' active');
        nameCell =
          '<td><div class="cv-grp-name-cell">' +
            '<div class="cv-grp-name-main">' +
              '<div class="cv-grp-name">' + r.label + '</div>' +
              '<div class="cv-grp-name-s">' + sub + '</div>' +
            '</div>' +
          '</div></td>' +
          '<td class="mono">' + (r.count || 0) + '</td>';
      }

      const pendingCell = r.ackReq
        ? (r.pending > 0
            ? '<span class="cv-grp-pill amber">' + r.pending + ' pending</span>'
            : '<span class="cv-grp-pill green">all clear</span>')
        : '<span class="t-mute">n/a</span>';

      /* drill-down ids — open state tracked per dimension+key */
      const dim = CV_GRP_TAB;
      const isOpen = drillable && CV_GRP_OPEN.dim === dim && CV_GRP_OPEN.key === r.key;
      const rowClick = drillable
        ? ' class="cv-grp-row" onclick="cvGrpDrill(\'' + dim + '\', \'' + r.key.replace(/'/g, "\\'") + '\')"'
        : '';
      const caretCell = drillable
        ? '<td><span class="cv-grp-caret">' + (isOpen ? '▾' : '▸') + '</span></td>'
        : '';

      html += '<tr' + rowClick + (isOpen ? ' class="cv-grp-row open"' : '') + '>' +
        caretCell +
        nameCell +
        '<td class="mono">' + sent + '</td>' +
        '<td><div class="cv-grp-bar">' +
          '<div class="cv-grp-bar-track"><div class="cv-grp-bar-fill" style="width:' + readPct +
          '%;background:' + readCol + '"></div></div>' +
          '<span class="cv-grp-bar-val">' + readPct + '%</span>' +
        '</div></td>' +
        '<td>' + (r.ackReq
          ? '<div class="cv-grp-bar">' +
            '<div class="cv-grp-bar-track"><div class="cv-grp-bar-fill" style="width:' + ackPct +
            '%;background:' + ackCol + '"></div></div>' +
            '<span class="cv-grp-bar-val">' + ackPct + '%</span>' +
          '</div>'
          : '<span class="t-mute">not required</span>') + '</td>' +
        '<td>' + pendingCell + '</td>' +
        '<td><span class="cv-grp-pill ' + complCls + '">' + complTxt + '</span></td>' +
      '</tr>';

      if (isOpen) {
        const colspan = headers.length + 1;   /* +1 for the caret column */
        html += '<tr class="cv-grp-detail"><td colspan="' + colspan + '">' +
          cvGrpRenderDrilldown(dim, r) +
        '</td></tr>';
      }
    });
    body.innerHTML = html;

    if (rows.length === 0) {
      body.innerHTML = '<tr><td colspan="' + headers.length +
        '" class="t-mute" style="padding:14px;text-align:center">No messages delivered in this view yet.</td></tr>';
    }
  }

  /* drill-down state — which cohort is currently expanded */
  const CV_GRP_OPEN = { dim: null, key: null };
  function cvGrpDrill(dim, key) {
    if (CV_GRP_OPEN.dim === dim && CV_GRP_OPEN.key === key) {
      CV_GRP_OPEN.dim = null; CV_GRP_OPEN.key = null;
    } else {
      CV_GRP_OPEN.dim = dim; CV_GRP_OPEN.key = key;
    }
    chatRenderGrouped();
  }

  /* given a cohort, return the list of worker ids that belong to it */
  function cvGrpWorkerIds(dim, key) {
    return CHAT_CONTACTS.filter(function (c) {
      if (dim === 'department') return (c.dept || 'Unassigned') === key;
      if (dim === 'contractor') return c.type === 'Contract' && (c.contractor || 'Unassigned contractor') === key;
      return false;
    }).map(function (c) { return c.id; });
  }

  /* subject-grouped analytics scoped to a cohort + the time-to-read trend chart */
  function cvGrpRenderDrilldown(dim, r) {
    const wids = cvGrpWorkerIds(dim, r.key);
    /* aggregate by subject across just these workers */
    const bySubj = {};
    wids.forEach(function (wid) {
      const t = CHAT_THREADS[wid]; if (!t) return;
      const c = CHAT_CONTACTS.find(function (x) { return x.id === wid; });
      (t.msgs || []).forEach(function (m) {
        if (m.dir !== 'in' || !m.preset) return;
        if (!bySubj[m.preset]) {
          bySubj[m.preset] = { preset: m.preset, subject: chatSubject(m.preset),
            urg: CHAT_URGENCY[m.preset] || { tier: 'info', needsAck: false },
            sent: 0, read: 0, acked: 0, pending: 0, ackReq: 0, langs: {} };
        }
        const b = bySubj[m.preset];
        b.sent++;
        if (m.read) b.read++;
        if (m.acked) b.acked++;
        if (b.urg.needsAck) b.ackReq++;
        if (b.urg.needsAck && !m.acked) b.pending++;
        if (c) b.langs[c.lang] = (b.langs[c.lang] || 0) + 1;
      });
    });
    const subs = Object.values(bySubj);
    const tierRank = { critical: 0, urgent: 1, advisory: 2, info: 3 };
    subs.sort(function (a, b) {
      const t = (tierRank[a.urg.tier] || 9) - (tierRank[b.urg.tier] || 9);
      return t !== 0 ? t : b.sent - a.sent;
    });

    /* === time-to-read by criticality, only for messages from this cohort === */
    const ttrByTier = cvGrpTtr(wids);

    const dimLabel = dim === 'department' ? 'department' : 'contractor';
    const heroBits = subs.length + ' subject' + (subs.length === 1 ? '' : 's') +
      ' across ' + wids.length + ' worker' + (wids.length === 1 ? '' : 's') +
      ' · click a subject row above for per-message detail';

    /* Render the subject mini-table */
    const subjRows = subs.map(function (s) {
      const readPct = s.sent ? Math.round(s.read / s.sent * 100) : 0;
      const ackPct = s.urg.needsAck && s.sent ? Math.round(s.acked / s.sent * 100) : 0;
      const readCol = readPct >= 80 ? 'var(--green)' : readPct >= 50 ? 'var(--amber)' : 'var(--red)';
      const ackCol  = !s.urg.needsAck ? 'var(--ink-4)'
                    : ackPct >= 80 ? 'var(--green)'
                    : ackPct >= 50 ? 'var(--amber)' : 'var(--red)';
      const langPills = Object.keys(s.langs).sort().map(function (lc) {
        return '<span class="cv-an-lang-chip">' + chatLang(lc).glyph + ' ' + lc + ' · ' + s.langs[lc] + '</span>';
      }).join('');
      const pendCell = s.urg.needsAck
        ? (s.pending > 0 ? '<span class="pill amber tiny">' + s.pending + ' pending</span>'
                         : '<span class="pill green tiny">clear</span>')
        : '<span class="t-mute">n/a</span>';
      return '<tr>' +
        '<td><span class="t-strong">' + s.subject + '</span></td>' +
        '<td><span class="cv-an-tier ' + s.urg.tier + '">' + s.urg.tier + '</span></td>' +
        '<td class="mono">' + s.sent + '</td>' +
        '<td><div class="cv-an-lang-row">' + langPills + '</div></td>' +
        '<td><div class="cv-an-bar">' +
          '<div class="cv-an-bar-track"><div class="cv-an-bar-fill" style="width:' + readPct +
          '%;background:' + readCol + '"></div></div>' +
          '<span class="cv-an-bar-val">' + readPct + '%</span>' +
        '</div></td>' +
        '<td>' + (s.urg.needsAck
          ? '<div class="cv-an-bar">' +
            '<div class="cv-an-bar-track"><div class="cv-an-bar-fill" style="width:' + ackPct +
            '%;background:' + ackCol + '"></div></div>' +
            '<span class="cv-an-bar-val">' + ackPct + '%</span>' +
          '</div>'
          : '<span class="t-mute">not required</span>') + '</td>' +
        '<td>' + pendCell + '</td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="7" class="t-mute" style="padding:12px;text-align:center">No subject deliveries for this ' + dimLabel + '.</td></tr>';

    return '<div class="cv-grp-detail-inner">' +
      '<div class="cv-grp-detail-h">' +
        '<div class="cv-grp-detail-eye">DRILL-DOWN · ' + r.label.toUpperCase() + '</div>' +
        '<div class="cv-grp-detail-t">' + r.label + ' · subject-level performance</div>' +
        '<div class="cv-grp-detail-s">' + heroBits + '</div>' +
      '</div>' +

      '<table class="t cv-grp-subj-tbl">' +
        '<thead><tr>' +
          '<th>Subject</th><th>Tier</th><th>Sent</th><th>Languages</th>' +
          '<th>Read</th><th>Acknowledged</th><th>Pending</th>' +
        '</tr></thead>' +
        '<tbody>' + subjRows + '</tbody>' +
      '</table>' +

      '<div class="cv-ttr-wrap">' +
        '<div class="cv-ttr-eye">Time to read · by criticality</div>' +
        '<div class="cv-ttr-sub">Average minutes between dispatch and first read, split by tier · lower is better</div>' +
        cvRenderTtrChart(ttrByTier) +
      '</div>' +
    '</div>';
  }

  /* === time-to-read aggregation per tier for a given set of workers ===
     The chat data doesn't carry a literal read-timestamp, so we model
     a credible TTR per message: faster for critical (workers act on them),
     slower for advisory, very slow for info. We derive deterministic
     values from the message preset + worker zone so the chart is stable
     across renders. */
  const CV_TTR_BASE = {
    critical: 4,   /* minutes, average */
    urgent:   18,
    advisory: 76,
    info:     220
  };
  const CV_TTR_VAR = {
    critical: 3,   /* spread */
    urgent:   9,
    advisory: 38,
    info:     100
  };
  /* deterministic pseudo-hash from a string → [0..1) — used to add a
     stable per-message jitter so different cohorts show distinct trends */
  function cvHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return (h % 1000) / 1000;
  }
  function cvGrpTtr(wids) {
    /* returns { critical: {n, sum, items:[m,..]}, urgent: ..., advisory: ..., info: ... } */
    const out = {
      critical: { n: 0, sum: 0, items: [] },
      urgent:   { n: 0, sum: 0, items: [] },
      advisory: { n: 0, sum: 0, items: [] },
      info:     { n: 0, sum: 0, items: [] }
    };
    wids.forEach(function (wid) {
      const t = CHAT_THREADS[wid]; if (!t) return;
      (t.msgs || []).forEach(function (m) {
        if (m.dir !== 'in' || !m.preset || !m.read) return;
        const u = CHAT_URGENCY[m.preset] || { tier: 'info' };
        const base = CV_TTR_BASE[u.tier];
        const varSpan = CV_TTR_VAR[u.tier];
        const jitter = (cvHash(wid + m.preset) - 0.5) * 2 * varSpan;
        const ttr = Math.max(1, Math.round(base + jitter));
        out[u.tier].n++;
        out[u.tier].sum += ttr;
        out[u.tier].items.push(ttr);
      });
    });
    return out;
  }

  /* horizontal-bar style chart of TTR per tier */
  function cvRenderTtrChart(ttr) {
    const tiers = [
      { key: 'critical', label: 'Critical', cls: 'critical' },
      { key: 'urgent',   label: 'Urgent',   cls: 'urgent' },
      { key: 'advisory', label: 'Advisory', cls: 'advisory' },
      { key: 'info',     label: 'Info',     cls: 'info' }
    ];
    /* compute global max across tiers for shared scale */
    let max = 0;
    tiers.forEach(function (t) {
      const data = ttr[t.key];
      if (data.n) {
        const avg = data.sum / data.n;
        if (avg > max) max = avg;
        data.items.forEach(function (v) { if (v > max) max = v; });
      }
    });
    if (max === 0) max = 1;

    return '<div class="cv-ttr-chart">' +
      tiers.map(function (t) {
        const d = ttr[t.key];
        if (!d.n) {
          return '<div class="cv-ttr-row empty">' +
            '<span class="cv-ttr-tier ' + t.cls + '">' + t.label + '</span>' +
            '<div class="cv-ttr-bar-wrap"><div class="cv-ttr-bar-empty">no deliveries in this tier</div></div>' +
            '<span class="cv-ttr-v">—</span>' +
          '</div>';
        }
        const avg = Math.round(d.sum / d.n);
        const pct = (avg / max) * 100;
        /* individual dots — distribution of the items along the same scale */
        const dots = d.items.map(function (v) {
          const p = (v / max) * 100;
          return '<span class="cv-ttr-dot" style="left:' + p + '%"></span>';
        }).join('');
        return '<div class="cv-ttr-row">' +
          '<span class="cv-ttr-tier ' + t.cls + '">' + t.label + '</span>' +
          '<div class="cv-ttr-bar-wrap">' +
            '<div class="cv-ttr-bar ' + t.cls + '" style="width:' + pct + '%"></div>' +
            dots +
          '</div>' +
          '<span class="cv-ttr-v">' + avg + ' min</span>' +
        '</div>';
      }).join('') +
      '<div class="cv-ttr-axis">' +
        '<span class="cv-ttr-axis-tick" style="left:0%">0</span>' +
        '<span class="cv-ttr-axis-tick" style="left:50%">' + Math.round(max / 2) + ' min</span>' +
        '<span class="cv-ttr-axis-tick" style="left:100%">' + Math.round(max) + ' min</span>' +
      '</div>' +
    '</div>';
  }

  /* ════════════════════════════════════════════════════════════════
     MODERN HERO  — animated big number + live stats
     ════════════════════════════════════════════════════════════════ */
  const CVA_FILTER = { tier: 'all', show: 'all' };
  let CVA_HERO_CLOCK_TIMER = null;

  /* animated counter — ticks a numeric value into a host element */
  function cvaAnimate(el, from, to, suffix, dur) {
    if (!el) return;
    suffix = suffix || '';
    dur = dur || 700;
    const t0 = performance.now();
    function step(now) {
      const p = Math.min(1, (now - t0) / dur);
      /* easeOut */
      const ease = 1 - Math.pow(1 - p, 3);
      const v = Math.round(from + (to - from) * ease);
      el.textContent = v + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function chatRenderHero() {
    const bigEl = document.getElementById('cva-hero-bignum');
    if (!bigEl) return;
    const win = cvwComputeWindow();
    /* lead number = T-to-90% read (the effective broadcast window) */
    const t90 = win.t90;
    const prev = parseInt(bigEl.textContent, 10);
    cvaAnimate(bigEl, isNaN(prev) ? 0 : prev, t90);
    /* unit label */
    const unitEl = document.getElementById('cva-hero-bigunit');
    if (unitEl) unitEl.textContent = 'min';
    /* mini stats */
    cvaAnimate(document.getElementById('cva-mini-t50'),  parseInt((document.getElementById('cva-mini-t50')||{}).textContent,10)||0, win.t50);
    cvaAnimate(document.getElementById('cva-mini-t90'),  parseInt((document.getElementById('cva-mini-t90')||{}).textContent,10)||0, win.t90);
    cvaAnimate(document.getElementById('cva-mini-tack'), parseInt((document.getElementById('cva-mini-tack')||{}).textContent,10)||0, win.tack80);
    cvaAnimate(document.getElementById('cva-mini-sent'), parseInt((document.getElementById('cva-mini-sent')||{}).textContent,10)||0, win.sent);

    const sub = document.getElementById('cva-hero-sub');
    if (sub) {
      const verdict = t90 < 30 ? 'Excellent — workers are reaching saturation fast.' :
                       t90 < 60 ? 'Reasonable — most workers are landing within an hour.' :
                       t90 < 120 ? 'Slow — your tail is dragging the broadcast window.' :
                                   'Critical — the broadcast window is too wide for safety alerts.';
      sub.textContent = verdict +
        ' Critical alerts close in ' + (win.tcrit90 || '—') + ' min · advisory tail extends to ' + (win.tadv90 || '—') + ' min.';
    }
    /* clock */
    if (!CVA_HERO_CLOCK_TIMER) {
      const tick = function () {
        const el = document.getElementById('cva-hero-clock');
        if (!el) return;
        const d = new Date();
        const pad = function (n) { return String(n).padStart(2, '0'); };
        el.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()) + ' IST';
      };
      tick(); CVA_HERO_CLOCK_TIMER = setInterval(tick, 1000);
    }
  }

  /* ════════════════════════════════════════════════════════════════
     BROADCAST-WINDOW ENGINE
     Compute time-to-X% for read & ack across the whole population, and
     by every slicing dimension. Foundation of objectives 1-4.
     ════════════════════════════════════════════════════════════════ */

  /* enrich CHAT_CONTACTS with deterministic demographic synthesis so
     we can slice cleanly. Run once — cache on first call. */
  let CV_DEMOG_CACHE = null;
  function cvDemog() {
    if (CV_DEMOG_CACHE) return CV_DEMOG_CACHE;
    const out = {};
    CHAT_CONTACTS.forEach(function (c) {
      const h = cvHash(c.id);
      /* shift derived from zone pattern + deterministic split */
      const shift = (h * 100) % 3 < 1 ? 'Morning' : (h * 100) % 3 < 2 ? 'Afternoon' : 'Evening';
      /* tenure in months — biased older for direct workers */
      const tenureBase = c.type === 'Direct' ? 24 + Math.floor(h * 40) : 4 + Math.floor(h * 22);
      const tenureBand = tenureBase < 6 ? '< 6 months' :
                         tenureBase < 24 ? '6 mo – 2 years' : '2+ years';
      /* age — biased by employment type and tenure */
      const ageBase = c.type === 'Direct' ? 28 + Math.floor(h * 22) : 22 + Math.floor(h * 18);
      const ageBand = ageBase < 25 ? '< 25' :
                      ageBase < 40 ? '25 – 40' : '40+';
      /* gender — biased by department (paint/quality have more women in this demo) */
      const womanProb = /Paint|Quality/.test(c.zone || '') ? 0.42 : 0.18;
      const gender = (h * 13) % 1 < womanProb ? 'Women' : 'Men';
      /* migrant flag — bias on contract type + zone */
      const migrant = (c.type === 'Contract' && (h * 7) % 1 < 0.35);
      out[c.id] = {
        shift: shift, tenureMo: tenureBase, tenureBand: tenureBand,
        age: ageBase, ageBand: ageBand, gender: gender, migrant: migrant
      };
    });
    CV_DEMOG_CACHE = out;
    return out;
  }

  /* compute the TTR (time to read, minutes) for every read inbound message.
     Re-uses the deterministic TTR base + jitter so values stay consistent. */
  function cvTtrSamples() {
    const samples = [];
    Object.keys(CHAT_THREADS).forEach(function (wid) {
      const c = CHAT_CONTACTS.find(function (x) { return x.id === wid; });
      if (!c) return;
      (CHAT_THREADS[wid].msgs || []).forEach(function (m) {
        if (m.dir !== 'in' || !m.preset) return;
        const u = CHAT_URGENCY[m.preset] || { tier: 'info', needsAck: false };
        const base = CV_TTR_BASE[u.tier] || 60;
        const varSpan = CV_TTR_VAR[u.tier] || 30;
        const jitter = (cvHash(wid + m.preset) - 0.5) * 2 * varSpan;
        const ttr = Math.max(1, base + jitter);
        /* synthesize an ack-time too — multiplier on TTR by tier */
        const ackMult = u.tier === 'critical' ? 1.4 : u.tier === 'urgent' ? 1.8 : 2.4;
        const ackTime = ttr * ackMult * (0.8 + cvHash('ack' + wid + m.preset) * 0.4);
        samples.push({
          wid: wid, c: c, m: m, u: u,
          ttr: ttr, ackTime: m.acked ? ackTime : null,
          read: !!m.read, acked: !!m.acked,
          needsAck: !!u.needsAck
        });
      });
    });
    return samples;
  }

  /* time-to-X-percentile helper. Given array of values, returns the value
     at which X% of the samples are below. */
  function cvPercentile(arr, p) {
    if (!arr.length) return 0;
    const sorted = arr.slice().sort(function (a, b) { return a - b; });
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * p));
    return Math.round(sorted[idx]);
  }

  /* compute the broadcast window stats across all messages — and by tier
     for the hero verdict line. */
  function cvwComputeWindow(slicePredicate) {
    const samples = cvTtrSamples();
    const matched = slicePredicate ? samples.filter(slicePredicate) : samples;
    const readTtrs = matched.filter(function (s) { return s.read; }).map(function (s) { return s.ttr; });
    const ackTimes = matched.filter(function (s) { return s.acked && s.needsAck; }).map(function (s) { return s.ackTime; });
    const t50 = cvPercentile(readTtrs, 0.5);
    const t80 = cvPercentile(readTtrs, 0.8);
    const t90 = cvPercentile(readTtrs, 0.9);
    const tack80 = cvPercentile(ackTimes, 0.8);
    /* by-tier ones for hero verdict */
    const crit = matched.filter(function (s) { return s.read && s.u.tier === 'critical'; }).map(function (s) { return s.ttr; });
    const adv  = matched.filter(function (s) { return s.read && s.u.tier === 'advisory'; }).map(function (s) { return s.ttr; });
    /* identify slowest cohort by department */
    const byDept = {};
    samples.forEach(function (s) {
      if (!s.read) return;
      const k = s.c.dept || '—';
      if (!byDept[k]) byDept[k] = [];
      byDept[k].push(s.ttr);
    });
    let slowestDept = null, slowestTtr = 0;
    Object.keys(byDept).forEach(function (k) {
      const t = cvPercentile(byDept[k], 0.5);
      if (t > slowestTtr) { slowestTtr = t; slowestDept = k; }
    });
    /* totals */
    const sent = matched.length;
    return {
      sent: sent,
      t50: t50, t80: t80, t90: t90, tack80: tack80,
      tcrit90: cvPercentile(crit, 0.9),
      tadv90:  cvPercentile(adv, 0.9),
      slowestDept: slowestDept, slowestTtr: slowestTtr,
      readTtrs: readTtrs, ackTimes: ackTimes
    };
  }

  /* render the four key-number stats + curve for the headline window card */
  function cvwRender() {
    const host = document.getElementById('cvw-chart');
    if (!host) return;
    const win = cvwComputeWindow();
    const t50El = document.getElementById('cvw-t50');
    const t90El = document.getElementById('cvw-t90');
    const tackEl = document.getElementById('cvw-tack');
    const dragEl = document.getElementById('cvw-drag');
    const dragSEl = document.getElementById('cvw-drag-s');
    if (t50El)  t50El.textContent  = win.t50 + ' min';
    if (t90El)  t90El.textContent  = win.t90 + ' min';
    if (tackEl) tackEl.textContent = win.tack80 + ' min';
    if (dragEl && win.slowestDept) {
      dragEl.textContent = win.slowestDept;
      if (dragSEl) dragSEl.textContent = 'median ' + win.slowestTtr + ' min · vs plant ' + win.t50 + ' min';
    }
    /* build cumulative-reach curve · sample at minute intervals up to t90+padding */
    const maxX = Math.max(win.t90, win.tack80 || 0) + 40;
    const vbW = 600, vbH = 220, padL = 36, padR = 14, padT = 14, padB = 28;
    const innerW = vbW - padL - padR, innerH = vbH - padT - padB;
    const xOf = function (t) { return padL + (t / maxX) * innerW; };
    const yOf = function (pct) { return padT + innerH - (pct / 100) * innerH; };
    /* compute cumulative function from readTtrs */
    const sorted = win.readTtrs.slice().sort(function (a, b) { return a - b; });
    const total = sorted.length || 1;
    /* sample 60 points along the x range */
    const readPts = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * maxX;
      let n = 0;
      for (let j = 0; j < sorted.length; j++) { if (sorted[j] <= t) n++; else break; }
      readPts.push([t, (n / total) * 100]);
    }
    /* ack cumulative */
    const sortedA = win.ackTimes.slice().sort(function (a, b) { return a - b; });
    const totalA = sortedA.length || 1;
    const ackPts = [];
    for (let i = 0; i <= 60; i++) {
      const t = (i / 60) * maxX;
      let n = 0;
      for (let j = 0; j < sortedA.length; j++) { if (sortedA[j] <= t) n++; else break; }
      ackPts.push([t, (n / totalA) * 100]);
    }
    /* grid + axis */
    let svg = '<svg viewBox="0 0 ' + vbW + ' ' + vbH + '" preserveAspectRatio="none">';
    for (let i = 0; i <= 4; i++) {
      const y = padT + (innerH * i / 4);
      svg += '<line x1="' + padL + '" y1="' + y + '" x2="' + (vbW - padR) + '" y2="' + y +
        '" stroke="rgba(0,0,0,0.06)" stroke-width="1"/>' +
        '<text x="' + (padL - 6) + '" y="' + (y + 3) + '" text-anchor="end" font-family="' + 'monospace' +
        '" font-size="9" fill="#7E869B">' + (100 - i * 25) + '%</text>';
    }
    /* x ticks every quarter of maxX */
    for (let i = 0; i <= 4; i++) {
      const t = (i / 4) * maxX;
      const x = xOf(t);
      svg += '<text x="' + x + '" y="' + (vbH - padB + 14) + '" text-anchor="middle" font-family="monospace" font-size="9" fill="#7E869B">' + Math.round(t) + 'm</text>';
    }
    /* path builders */
    const toPath = function (pts) {
      return pts.map(function (p, i) { return (i === 0 ? 'M' : 'L') + xOf(p[0]) + ',' + yOf(p[1]); }).join(' ');
    };
    /* area + line for read */
    const readD = toPath(readPts);
    const readArea = 'M' + xOf(0) + ',' + (padT + innerH) + ' ' +
      readPts.map(function (p) { return 'L' + xOf(p[0]) + ',' + yOf(p[1]); }).join(' ') +
      ' L' + xOf(maxX) + ',' + (padT + innerH) + ' Z';
    svg += '<path d="' + readArea + '" fill="#1F2B5C" opacity="0.10"/>';
    svg += '<path d="' + readD + '" fill="none" stroke="#1F2B5C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    /* ack line */
    const ackD = toPath(ackPts);
    svg += '<path d="' + ackD + '" fill="none" stroke="#2D6B3E" stroke-width="2.5" stroke-dasharray="4,4" stroke-linecap="round"/>';
    /* annotation markers at 50/80/90% on the read curve */
    const ann = function (t, p, label, color) {
      const x = xOf(t), y = yOf(p);
      return '<line x1="' + x + '" y1="' + y + '" x2="' + x + '" y2="' + (padT + innerH) + '" stroke="' + color + '" stroke-width="1.5" stroke-dasharray="2,3" opacity="0.6"/>' +
        '<circle cx="' + x + '" cy="' + y + '" r="5" fill="' + color + '" stroke="#FBFAF6" stroke-width="2"/>' +
        '<text x="' + x + '" y="' + (y - 9) + '" text-anchor="middle" font-family="' + 'sans-serif' +
        '" font-size="10" font-weight="700" fill="' + color + '">' + label + '</text>';
    };
    svg += ann(win.t50, 50, 't=' + win.t50 + 'm · 50%', '#8A5A12');
    svg += ann(win.t80, 80, 't=' + win.t80 + 'm · 80%', '#1F2B5C');
    svg += ann(win.t90, 90, 't=' + win.t90 + 'm · 90%', '#A52A1B');
    svg += '</svg>';
    host.innerHTML = svg;
    /* legend / foot */
    const foot = document.getElementById('cvw-chart-foot');
    if (foot) {
      foot.innerHTML =
        '<span style="display:inline-flex;align-items:center;gap:6px;margin-right:18px"><span style="width:14px;height:3px;background:var(--indigo)"></span> Cumulative read</span>' +
        '<span style="display:inline-flex;align-items:center;gap:6px"><span style="width:14px;height:0;border-top:2.5px dashed var(--green-dk)"></span> Cumulative acknowledged</span>' +
        '<div style="margin-top:6px">The flatter the tail, the longer your effective window. Shrink it by re-timing dispatch, escalating earlier, or pre-staging language voice notes.</div>';
    }
  }

  /* ════════════════════════════════════════════════════════════════
     SLICING ENGINE — TTR by department / contractor / language / shift / tenure / age
     ════════════════════════════════════════════════════════════════ */
  let CVS_DIM = 'department';
  function cvsSetDim(el, dim) {
    CVS_DIM = dim;
    document.querySelectorAll('.cvs-dim-tab').forEach(function (t) { t.classList.toggle('on', t === el); });
    cvsRender();
  }
  function cvsRender() {
    const host = document.getElementById('cvs-grid');
    const foot = document.getElementById('cvs-foot');
    if (!host) return;
    const samples = cvTtrSamples();
    const demog = cvDemog();
    const plant = cvPercentile(samples.filter(function (s) { return s.read; }).map(function (s) { return s.ttr; }), 0.5);

    /* group samples by the active dimension */
    const keyOf = function (s) {
      const d = demog[s.wid] || {};
      switch (CVS_DIM) {
        case 'department': return s.c.dept || '—';
        case 'contractor': return s.c.type === 'Contract' ? (s.c.contractor || 'Unassigned') : 'Direct (no contractor)';
        case 'type':       return s.c.type || '—';
        case 'language':   return chatLang(s.c.lang).name;
        case 'shift':      return d.shift || '—';
        case 'tenure':     return d.tenureBand || '—';
        case 'age':        return d.ageBand || '—';
      }
      return '—';
    };
    const groups = {};
    samples.forEach(function (s) {
      if (!s.read) return;
      const k = keyOf(s);
      if (!groups[k]) groups[k] = [];
      groups[k].push(s.ttr);
    });
    const rows = Object.keys(groups).map(function (k) {
      const ttrs = groups[k];
      const median = cvPercentile(ttrs, 0.5);
      const p90 = cvPercentile(ttrs, 0.9);
      const delta = median - plant;
      return { k: k, n: ttrs.length, median: median, p90: p90, delta: delta };
    });
    rows.sort(function (a, b) { return b.median - a.median; });

    /* global max for bar scaling */
    const max = rows.reduce(function (m, r) { return Math.max(m, r.p90); }, 1);
    host.innerHTML = rows.map(function (r) {
      const benchPct = (plant / max) * 100;
      const fillPct = (r.median / max) * 100;
      const speedCls = r.median <= plant * 0.85 ? 'fast' : r.median >= plant * 1.25 ? 'slow' : 'mid';
      const deltaCls = r.delta > plant * 0.15 ? 'up' : r.delta < -plant * 0.15 ? 'down' : 'neu';
      const deltaTxt = (r.delta > 0 ? '+' : '') + r.delta + ' min';
      return '<div class="cvs-row">' +
        '<div class="cvs-row-l"><span>' + r.k + '</span><span class="cvs-row-l-s">' + r.n + ' msg</span></div>' +
        '<div class="cvs-row-bar">' +
          '<div class="cvs-row-bar-fill ' + speedCls + '" style="width:' + fillPct + '%">' + r.median + ' min · median</div>' +
          '<div class="cvs-row-bench" style="left:' + benchPct + '%" title="plant median ' + plant + ' min"></div>' +
        '</div>' +
        '<div class="cvs-row-v">p90 ' + r.p90 + 'm</div>' +
        '<div class="cvs-row-delta ' + deltaCls + '">' + deltaTxt + '</div>' +
      '</div>';
    }).join('');

    /* narrative foot */
    if (foot && rows.length > 0) {
      const slowest = rows[0];
      const fastest = rows[rows.length - 1];
      const spread = slowest.median - fastest.median;
      const dimLabel = { department: 'department', contractor: 'contractor', type: 'employment type',
        language: 'language', shift: 'shift', tenure: 'tenure', age: 'age band' }[CVS_DIM] || CVS_DIM;
      foot.innerHTML =
        '<strong>Slowest ' + dimLabel + ':</strong> ' + slowest.k + ' at ' + slowest.median + ' min median. ' +
        '<strong>Fastest:</strong> ' + fastest.k + ' at ' + fastest.median + ' min — a <strong>' + spread + '-min spread</strong>. ' +
        'The dashed marker on each bar is the plant median (' + plant + ' min) — rows extending past it are dragging your broadcast window.';
    }
  }

  /* ════════════════════════════════════════════════════════════════
     BY MESSAGE TYPE — TTR per tier + sample counts
     ════════════════════════════════════════════════════════════════ */
  function cvmRender() {
    const host = document.getElementById('cvm-grid');
    if (!host) return;
    const samples = cvTtrSamples();
    const tiers = [
      { k: 'critical', label: 'Critical', cls: 'critical' },
      { k: 'urgent',   label: 'Urgent',   cls: 'urgent' },
      { k: 'advisory', label: 'Advisory', cls: 'advisory' },
      { k: 'info',     label: 'Info',     cls: 'info' },
    ];
    host.innerHTML = tiers.map(function (t) {
      const slice = samples.filter(function (s) { return s.read && s.u.tier === t.k; });
      const ttrs = slice.map(function (s) { return s.ttr; });
      const ackSlice = samples.filter(function (s) { return s.acked && s.u.tier === t.k && s.needsAck; });
      const ackTimes = ackSlice.map(function (s) { return s.ackTime; });
      const median = cvPercentile(ttrs, 0.5);
      const p90 = cvPercentile(ttrs, 0.9);
      const ackMed = cvPercentile(ackTimes, 0.5);
      const n = slice.length;
      return '<div class="cvm-tile ' + t.cls + '">' +
        '<div class="cvm-tile-eye">TIER · ' + t.label.toUpperCase() + '</div>' +
        '<div class="cvm-tile-tier">' + t.label + ' messages</div>' +
        '<div class="cvm-tile-v">' + median + ' <span style="font-size:0.9rem;font-style:normal">min</span></div>' +
        '<div class="cvm-tile-vsub">median time to read</div>' +
        '<div class="cvm-tile-stats">' +
          '<div class="cvm-tile-stat">' +
            '<div class="cvm-tile-stat-k">90th pctile</div>' +
            '<div class="cvm-tile-stat-v">' + (p90 || '—') + ' min</div>' +
          '</div>' +
          '<div class="cvm-tile-stat">' +
            '<div class="cvm-tile-stat-k">Median ack</div>' +
            '<div class="cvm-tile-stat-v">' + (ackMed || '—') + ' min</div>' +
          '</div>' +
          '<div class="cvm-tile-stat">' +
            '<div class="cvm-tile-stat-k">Sent</div>' +
            '<div class="cvm-tile-stat-v">' + n + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* ════════════════════════════════════════════════════════════════
     RECOMMENDATIONS — auto-generated from the slicing engine
     ════════════════════════════════════════════════════════════════ */
  function cvrRender() {
    const host = document.getElementById('cvr-list');
    if (!host) return;
    const samples = cvTtrSamples();
    const demog = cvDemog();
    const plant = cvPercentile(samples.filter(function (s) { return s.read; }).map(function (s) { return s.ttr; }), 0.5);

    const recs = [];

    /* recommendation 1: slowest department */
    const byDept = {};
    samples.forEach(function (s) {
      if (!s.read) return;
      if (!byDept[s.c.dept]) byDept[s.c.dept] = [];
      byDept[s.c.dept].push(s.ttr);
    });
    let slowDept = null, slowDeptTtr = 0;
    Object.keys(byDept).forEach(function (k) {
      const t = cvPercentile(byDept[k], 0.5);
      if (t > slowDeptTtr) { slowDeptTtr = t; slowDept = k; }
    });
    if (slowDept && slowDeptTtr > plant * 1.25) {
      recs.push({
        pri: 'high',
        ic: '!',
        eye: 'Department drag',
        t: 'Pre-stage broadcasts for ' + slowDept + ' 30 min earlier',
        s: slowDept + ' workers reach 50% read at ' + slowDeptTtr + ' min — that\'s ' +
          (slowDeptTtr - plant) + ' min slower than the plant. Schedule their dispatch earlier in the broadcast queue so the long tail still closes inside the window.',
        impact: 'Estimated window shrink · ' + Math.round((slowDeptTtr - plant) * 0.6) + ' min'
      });
    }

    /* recommendation 2: slowest contractor */
    const byCtr = {};
    samples.forEach(function (s) {
      if (!s.read || s.c.type !== 'Contract') return;
      const k = s.c.contractor || 'Unassigned';
      if (!byCtr[k]) byCtr[k] = [];
      byCtr[k].push(s.ttr);
    });
    let slowCtr = null, slowCtrTtr = 0;
    Object.keys(byCtr).forEach(function (k) {
      const t = cvPercentile(byCtr[k], 0.5);
      if (t > slowCtrTtr) { slowCtrTtr = t; slowCtr = k; }
    });
    if (slowCtr && slowCtrTtr > plant * 1.2) {
      recs.push({
        pri: 'med',
        ic: '⌬',
        eye: 'Contractor performance',
        t: 'Escalate compliance to ' + slowCtr + '\'s supervisor',
        s: slowCtr + ' workers respond at ' + slowCtrTtr + ' min vs ' + plant + ' min plant median. Push the contractor to enforce read-receipt SLAs on their floor leads; the current gap is the largest contractor variance.',
        impact: 'Lift response rate · estimated +18%'
      });
    }

    /* recommendation 3: critical tier tail too long */
    const crit = samples.filter(function (s) { return s.read && s.u.tier === 'critical'; }).map(function (s) { return s.ttr; });
    const critP90 = cvPercentile(crit, 0.9);
    if (critP90 > 10) {
      recs.push({
        pri: 'high',
        ic: '⚠',
        eye: 'Safety-critical tail',
        t: 'Auto-escalate critical alerts at 10 min unread',
        s: '90% of critical-tier reads close in ' + critP90 + ' min — too wide for safety alerts. Wire the response-bot to auto-call supervisors when a critical message goes unread past 10 minutes.',
        impact: 'Reduce critical-tier p90 by ' + Math.round((critP90 - 10) * 0.7) + ' min'
      });
    }

    /* recommendation 4: language gap */
    const byLang = {};
    samples.forEach(function (s) {
      if (!s.read) return;
      const k = chatLang(s.c.lang).name;
      if (!byLang[k]) byLang[k] = [];
      byLang[k].push(s.ttr);
    });
    let slowLang = null, slowLangTtr = 0;
    Object.keys(byLang).forEach(function (k) {
      const t = cvPercentile(byLang[k], 0.5);
      if (t > slowLangTtr) { slowLangTtr = t; slowLang = k; }
    });
    if (slowLang && slowLangTtr > plant * 1.15) {
      recs.push({
        pri: 'med',
        ic: '⌘',
        eye: 'Language tail',
        t: 'Add a ' + slowLang + ' voice-note alongside text',
        s: slowLang + '-speaking workers read at ' + slowLangTtr + ' min. Adding a Sarvam-generated voice note to the WhatsApp message lifts read rates on illiteracy-heavy cohorts — pilot data shows a 22% improvement.',
        impact: 'Estimated +12 min faster on ' + slowLang + ' cohort'
      });
    }

    /* recommendation 5: shift-of-day timing */
    recs.push({
      pri: 'low',
      ic: '⌚',
      eye: 'Dispatch timing',
      t: 'Move advisory broadcasts to 14:30 IST window',
      s: 'Advisory-tier reads peak in the 14:00-15:00 window when workers are between shifts and have their phones out. Re-target the dispatch scheduler to bias non-critical messages into this slot.',
      impact: 'Shift advisory p50 from ' + (plant + 10) + ' → ' + (plant - 5) + ' min'
    });

    /* render — show up to 4 highest-impact recommendations */
    const top = recs.slice(0, 4);
    if (top.length === 0) {
      host.innerHTML = '<div class="tiny muted" style="padding:14px;text-align:center;grid-column:1/-1">All cohorts are inside the target window — no actions needed today.</div>';
      return;
    }
    host.innerHTML = top.map(function (r) {
      return '<div class="cvr-tile ' + r.pri + '">' +
        '<div class="cvr-tile-eye">' +
          '<span class="pri ' + r.pri + '">' + (r.pri === 'high' ? 'High priority' : r.pri === 'med' ? 'Medium' : 'Low') + '</span>' +
          '<span>' + r.eye + '</span>' +
        '</div>' +
        '<div class="cvr-tile-t">' + r.t + '</div>' +
        '<div class="cvr-tile-s">' + r.s + '</div>' +
        '<div class="cvr-tile-impact">↘ ' + r.impact + '</div>' +
      '</div>';
    }).join('');
  }

  /* ── filter logic ── */
  function cvaSetFilter(el, key, val) {
    /* visual: deactivate siblings in this group, activate this chip */
    const parent = el && el.parentElement;
    if (parent) parent.querySelectorAll('.cva-chip').forEach(function (c) { c.classList.remove('on'); });
    if (el) el.classList.add('on');
    CVA_FILTER[key] = val;
    cvaApplyFilters();
    cvaRenderFilterDrill();
  }
  function cvaApplyFilters() {
    /* subject rows */
    document.querySelectorAll('#cv-an-grid-body tr.cv-an-row').forEach(function (tr) {
      const tier = tr.getAttribute('data-tier');
      const needsAck = tr.getAttribute('data-needsack') === '1';
      const pending = parseInt(tr.getAttribute('data-pending') || '0', 10);
      const tierOk = CVA_FILTER.tier === 'all' || tier === CVA_FILTER.tier;
      const showOk = CVA_FILTER.show === 'all'
        || (CVA_FILTER.show === 'pending'  && pending > 0)
        || (CVA_FILTER.show === 'response' && needsAck);
      const dim = !(tierOk && showOk);
      tr.classList.toggle('cva-dim', dim);
      /* also dim the immediately-following detail row if open */
      const nxt = tr.nextElementSibling;
      if (nxt && nxt.classList.contains('cv-an-detail')) nxt.classList.toggle('cva-dim', dim);
    });
    /* timeline pegs */
    document.querySelectorAll('.cv-tl-peg').forEach(function (peg) {
      const t = ['critical', 'urgent', 'advisory', 'info'].find(function (x) { return peg.classList.contains(x); });
      const dim = !(CVA_FILTER.tier === 'all' || t === CVA_FILTER.tier);
      peg.classList.toggle('cva-dim', dim);
    });
    /* queue + recent rows */
    document.querySelectorAll('.cv-pipe-item').forEach(function (it) {
      const t = ['critical', 'urgent', 'advisory', 'info'].find(function (x) { return it.classList.contains(x); });
      const dim = !(CVA_FILTER.tier === 'all' || t === CVA_FILTER.tier);
      it.classList.toggle('cva-dim', dim);
    });
  }

  /* ════════════════════════════════════════════════════════════════
     FILTER DRILL-DOWN — when a tier or show-state chip is active,
     render a focused panel below the filter bar listing every message
     matching that filter with its full origination / state / recipient.
     ════════════════════════════════════════════════════════════════ */
  function cvaRenderFilterDrill() {
    const host = document.getElementById('cva-filter-drill');
    if (!host) return;
    const tier = CVA_FILTER.tier;
    const show = CVA_FILTER.show;
    /* hide the drill-down panel when neither filter is narrowed */
    if (tier === 'all' && show === 'all') {
      host.style.display = 'none'; host.innerHTML = '';
      return;
    }

    /* collect every inbound preset message + worker context, applying
       the same filter logic used by cvaApplyFilters but at message level */
    const matches = [];
    Object.keys(CHAT_THREADS).forEach(function (wid) {
      const c = CHAT_CONTACTS.find(function (x) { return x.id === wid; });
      if (!c) return;
      (CHAT_THREADS[wid].msgs || []).forEach(function (m) {
        if (m.dir !== 'in' || !m.preset) return;
        const u = CHAT_URGENCY[m.preset] || { tier: 'info', needsAck: false };
        const tierOk = tier === 'all' || u.tier === tier;
        const showOk = show === 'all'
          || (show === 'pending'  && u.needsAck && !m.acked)
          || (show === 'response' && u.needsAck);
        if (tierOk && showOk) matches.push({ m: m, c: c, u: u });
      });
    });

    /* group matches by preset (subject) for readability */
    const bySubj = {};
    matches.forEach(function (r) {
      if (!bySubj[r.m.preset]) bySubj[r.m.preset] = { preset: r.m.preset, u: r.u, items: [] };
      bySubj[r.m.preset].items.push(r);
    });
    const subjects = Object.values(bySubj).sort(function (a, b) {
      const tr = { critical: 0, urgent: 1, advisory: 2, info: 3 };
      const t = (tr[a.u.tier] || 9) - (tr[b.u.tier] || 9);
      return t !== 0 ? t : b.items.length - a.items.length;
    });

    /* compute aggregate stats for the eyebrow line */
    const total = matches.length;
    let read = 0, acked = 0, pending = 0;
    matches.forEach(function (r) {
      if (r.m.read) read++;
      if (r.m.acked) acked++;
      if (r.u.needsAck && !r.m.acked) pending++;
    });

    /* eyebrow + headline copy based on filter */
    let eyebrow = '', subhead = '';
    if (tier !== 'all' && show === 'all') {
      eyebrow = tier.toUpperCase() + ' TIER · DRILL-DOWN';
      subhead = 'All messages classified as ' + tier + ' across today\'s broadcasts';
    } else if (tier === 'all' && show === 'pending') {
      eyebrow = 'PENDING ACKNOWLEDGEMENTS · DRILL-DOWN';
      subhead = 'Response-required messages still awaiting worker acknowledgement';
    } else if (tier === 'all' && show === 'response') {
      eyebrow = 'RESPONSE-REQUIRED · DRILL-DOWN';
      subhead = 'Every message that requires the worker to acknowledge it under the read-receipt rule';
    } else {
      eyebrow = (tier !== 'all' ? tier.toUpperCase() + ' · ' : '') +
        (show === 'pending' ? 'PENDING' : 'RESPONSE-REQUIRED') + ' DRILL-DOWN';
      subhead = 'Messages matching both filters';
    }

    /* render */
    let html =
      '<div class="cva-drill">' +
        '<div class="cva-drill-h">' +
          '<div class="cva-drill-h-l">' +
            '<div class="cva-drill-eye cva-drill-tier-' + tier + '">' + eyebrow + '</div>' +
            '<div class="cva-drill-t">' + total + ' message' + (total === 1 ? '' : 's') +
              ' across ' + subjects.length + ' subject' + (subjects.length === 1 ? '' : 's') + '</div>' +
            '<div class="cva-drill-s">' + subhead + '</div>' +
          '</div>' +
          '<div class="cva-drill-stats">' +
            '<div class="cva-drill-stat"><div class="cva-drill-stat-v">' + total + '</div><div class="cva-drill-stat-k">delivered</div></div>' +
            '<div class="cva-drill-stat"><div class="cva-drill-stat-v" style="color:var(--indigo)">' + read + '</div><div class="cva-drill-stat-k">read</div></div>' +
            '<div class="cva-drill-stat"><div class="cva-drill-stat-v" style="color:var(--green-dk)">' + acked + '</div><div class="cva-drill-stat-k">acknowledged</div></div>' +
            '<div class="cva-drill-stat"><div class="cva-drill-stat-v" style="color:var(--amber-dk)">' + pending + '</div><div class="cva-drill-stat-k">pending</div></div>' +
          '</div>' +
          '<button class="cva-drill-clear" onclick="cvaClearFilters()" title="Clear all filters">Clear filters ✕</button>' +
        '</div>';

    if (subjects.length === 0) {
      html += '<div class="cva-drill-empty">No messages match this filter — try a different combination.</div>';
    } else {
      html += subjects.map(function (s) {
        const origin = (typeof CHAT_ORIGIN !== 'undefined' && CHAT_ORIGIN[s.preset]) || {};
        const slaTxt = !s.u.needsAck ? 'no acknowledgement required'
                     : s.u.slaMin < 60 ? s.u.slaMin + ' min SLA'
                     : s.u.slaMin < 1440 ? Math.round(s.u.slaMin / 60) + ' hr SLA'
                     : Math.round(s.u.slaMin / 1440) + ' day SLA';
          /* per-message rows */
        const msgRows = s.items.map(function (r) {
          const ini = r.c.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
          const lng = chatLang(r.c.lang);
          const stateCls = r.m.acked ? 'done' : r.m.read ? 'pend' : 'miss';
          const stateLbl = r.m.acked
            ? '✓ Acknowledged · ' + (r.m.ackedAt || 'now')
            : r.m.read ? '⌛ Read · awaiting ack' : '✗ Delivered · unread';
          const reminders = r.m.reminders ? ' · ' + r.m.reminders + ' reminder' + (r.m.reminders === 1 ? '' : 's') : '';
          return '<div class="cva-drill-msg">' +
            '<div class="cv-an-detail-ava ' + (r.c.type === 'Contract' ? 'contract' : '') + '">' + ini + '</div>' +
            '<div class="cva-drill-who">' +
              '<div class="cva-drill-name">' + r.c.name +
                ' <span class="cva-drill-id">' + r.c.id + '</span></div>' +
              '<div class="cva-drill-meta">' + r.c.role + ' · ' + r.c.dept +
                ' · ' + r.c.type + (r.c.contractor ? ' · ' + r.c.contractor : '') +
                ' · ' + lng.glyph + ' ' + lng.name + '</div>' +
            '</div>' +
            '<div class="cva-drill-when">' +
              '<div class="cva-drill-sent">' + (r.m.at || r.m.time) + '</div>' +
              '<div class="cva-drill-state ' + stateCls + '">' + stateLbl + reminders + '</div>' +
            '</div>' +
          '</div>';
        }).join('');

        return '<div class="cva-drill-subj">' +
          '<div class="cva-drill-subj-h">' +
            '<span class="cv-an-tier ' + s.u.tier + '">' + s.u.tier + '</span>' +
            '<span class="cva-drill-subj-t">' + chatSubject(s.preset) + '</span>' +
            '<span class="cva-drill-subj-meta">' +
              (origin.mod ? origin.mod + ' · ' : '') +
              (origin.by ? 'by ' + origin.by + ' · ' : '') +
              slaTxt +
            '</span>' +
            '<span class="pill outline tiny">' + s.items.length + ' deliver' + (s.items.length === 1 ? 'y' : 'ies') + '</span>' +
          '</div>' +
          '<div class="cva-drill-msgs">' + msgRows + '</div>' +
        '</div>';
      }).join('');
    }

    html += '</div>';
    host.innerHTML = html;
    host.style.display = 'block';
  }

  /* clear button on the drill-down — reset both filter groups to "all" */
  function cvaClearFilters() {
    CVA_FILTER.tier = 'all'; CVA_FILTER.show = 'all';
    /* visually flip the chip on-states */
    document.querySelectorAll('.cva-filter .cva-chip').forEach(function (c) {
      const grpAttr = c.getAttribute('data-tier') || c.getAttribute('data-show');
      c.classList.toggle('on', grpAttr === 'all');
    });
    cvaApplyFilters();
    cvaRenderFilterDrill();
  }

  /* refresh-all hook for the "↻ Refresh" button */
  function cvaRefreshAll() {
    /* pull the live gateway log first, then re-render off the merged data */
    chatRefreshLiveComms().then(function () {
      chatRenderAnalytics();
      if (typeof toast === 'function') toast('Analytics refreshed from live comms log', 'green');
    });
  }

  /* smart-insight callout — surfaces the most pressing pending item, or
     a calm "all clear" state when nothing is overdue. */
  function chatRenderInsight() {
    const host = document.getElementById('cv-insight');
    if (!host) return;
    const subs = chatAggregate();
    /* find the subject with the largest pending count (needs ack & overdue) */
    const worst = subs.filter(function (s) { return s.urg.needsAck && s.pending > 0; })
                      .sort(function (a, b) {
                        const tr = { critical: 0, urgent: 1, advisory: 2, info: 3 };
                        const t = (tr[a.urg.tier] || 9) - (tr[b.urg.tier] || 9);
                        return t !== 0 ? t : b.pending - a.pending;
                      })[0];
    if (!worst) {
      host.className = 'cv-insight calm';
      host.innerHTML =
        '<span class="cv-insight-ico">✓</span>' +
        '<div class="cv-insight-main">' +
          '<div class="cv-insight-eye">All clear</div>' +
          '<div class="cv-insight-t">Every response-required broadcast has been acknowledged</div>' +
          '<div class="cv-insight-s">Read-receipt compliance is 100% across all subjects sent today. No follow-up reminders needed.</div>' +
        '</div>';
      return;
    }
    const cls = worst.urg.tier === 'critical' ? 'alert' : '';
    host.className = 'cv-insight ' + cls;
    host.innerHTML =
      '<span class="cv-insight-ico">!</span>' +
      '<div class="cv-insight-main">' +
        '<div class="cv-insight-eye">' +
          (worst.urg.tier === 'critical' ? 'Action needed · critical' : 'Watch — pending acknowledgements') +
        '</div>' +
        '<div class="cv-insight-t">' + worst.subject + ' · ' + worst.pending +
          ' worker' + (worst.pending === 1 ? '' : 's') + ' yet to acknowledge</div>' +
        '<div class="cv-insight-s">Sent to ' + worst.sent + ' workers across ' +
          Object.keys(worst.langs).length + ' language' + (Object.keys(worst.langs).length === 1 ? '' : 's') +
          '. The response-bot can fire a multilingual reminder from any unacknowledged thread — open the worker and tap <em>Send response-bot reminder</em>.</div>' +
      '</div>';
  }

  /* horizontal broadcast timeline plotting sent-today + queued */
  function chatRenderTimeline() {
    const track = document.getElementById('cv-tl-track');
    const axis = document.getElementById('cv-tl-axis');
    const nowEl = document.getElementById('cv-tl-now');
    const periodsEl = document.getElementById('cv-tl-periods');
    const bandsEl = document.getElementById('cv-tl-bands');
    if (!track || !axis || !nowEl) return;
    const startH = 9, endH = 21;
    const span = endH - startH;
    const pct = function (h) { return ((h - startH) / span) * 100; };
    const fmt12 = function (h) {
      const hh = Math.floor(h);
      const ampm = hh < 12 ? 'am' : 'pm';
      const disp = hh === 12 ? 12 : (hh % 12);
      return { hh: hh, disp: disp, ampm: ampm };
    };

    /* period bands above */
    if (periodsEl) {
      const periods = [
        { from: 9,  to: 12, label: 'Morning' },
        { from: 12, to: 17, label: 'Afternoon' },
        { from: 17, to: 21, label: 'Evening' }
      ];
      periodsEl.innerHTML = periods.map(function (p) {
        return '<div class="cv-tl-period" style="left:' + pct(p.from) +
          '%;right:' + (100 - pct(p.to)) + '%">' + p.label + '</div>';
      }).join('');
    }
    /* background tint bands inside the track */
    if (bandsEl) {
      const bands = [
        { from: 9,  to: 12, cls: 'morning' },
        { from: 12, to: 17, cls: 'afternoon' },
        { from: 17, to: 21, cls: 'evening' }
      ];
      bandsEl.innerHTML = bands.map(function (b) {
        return '<div class="cv-tl-band ' + b.cls + '" style="left:' + pct(b.from) +
          '%;right:' + (100 - pct(b.to)) + '%"></div>';
      }).join('') +
      /* elapsed band — from 09:00 up to NOW — to subtly mark "past" */
      '<div class="cv-tl-band elapsed" style="left:0;right:' +
        Math.max(0, 100 - pct(CHAT_NOW_HOUR)) + '%"></div>';
    }

    /* axis — hour ticks for every hour, major every 3 hours with AM/PM */
    let axisHtml = '';
    for (let h = startH; h <= endH; h++) {
      const f = fmt12(h);
      const isMajor = (h === startH) || (h === endH) || (h % 3 === 0);
      if (isMajor) {
        axisHtml += '<span class="cv-tl-tick major" style="left:' + pct(h) + '%">' +
          String(h).padStart(2, '0') + ':00' +
          '<span class="cv-tl-tick-sub">' + f.disp + ' ' + f.ampm + '</span></span>';
      } else {
        axisHtml += '<span class="cv-tl-tick" style="left:' + pct(h) + '%">' +
          String(h).padStart(2, '0') + '</span>';
      }
    }
    axis.innerHTML = axisHtml;

    /* grid lines + pegs */
    let trackHtml = '';
    for (let h = startH; h <= endH; h++) {
      const isMajor = (h === startH) || (h === endH) || (h % 3 === 0);
      trackHtml += '<div class="cv-tl-grid' + (isMajor ? ' major' : '') +
        '" style="left:' + pct(h) + '%"></div>';
    }
    /* plot sent-today (faded) and queued (full colour) pegs */
    CHAT_SENT_TODAY.forEach(function (s) {
      const u = CHAT_URGENCY[s.preset] || { tier: 'info' };
      const isOn = CV_TL_OPEN === s.preset + '@sent';
      trackHtml += '<div class="cv-tl-peg sent ' + u.tier + (isOn ? ' on' : '') + '" style="left:' + pct(s.hour) +
        '%" title="' + s.subject + ' · sent at ' + chatHourToTime(s.hour) +
        '" onclick="cvTlPick(\'' + s.preset + '@sent\')">✓</div>';
    });
    CHAT_QUEUE.forEach(function (q, i) {
      const u = CHAT_URGENCY[q.preset] || { tier: 'info' };
      const isOn = CV_TL_OPEN === q.preset + '@queue';
      trackHtml += '<div class="cv-tl-peg ' + u.tier + (isOn ? ' on' : '') + '" style="left:' + pct(q.hour) +
        '%" title="' + chatSubject(q.preset) + ' · ' + q.scheduledFor + ' · ' +
        q.audience + '" onclick="cvTlPick(\'' + q.preset + '@queue\')">' + (i + 1) + '</div>';
    });
    track.innerHTML = trackHtml;
    nowEl.style.left = pct(CHAT_NOW_HOUR) + '%';
    nowEl.setAttribute('data-time', chatHourToTime(CHAT_NOW_HOUR));
    cvTlRenderDetail();
  }

  /* timeline peg drill-down state + render */
  let CV_TL_OPEN = null;
  function cvTlPick(token) {
    CV_TL_OPEN = (CV_TL_OPEN === token) ? null : token;
    chatRenderTimeline();
  }
  function cvTlCloseDetail() { CV_TL_OPEN = null; chatRenderTimeline(); }

  function cvTlRenderDetail() {
    const host = document.getElementById('cv-tl-detail');
    if (!host) return;
    if (!CV_TL_OPEN) { host.style.display = 'none'; host.innerHTML = ''; return; }
    const parts = CV_TL_OPEN.split('@');
    const preset = parts[0], kind = parts[1];
    const u = CHAT_URGENCY[preset] || { tier: 'info', label: 'Info', needsAck: false };
    const o = CHAT_ORIGIN[preset] || {};

    let html = '';
    if (kind === 'queue') {
      const q = (CHAT_QUEUE || []).find(function (x) { return x.preset === preset; });
      if (!q) { host.style.display = 'none'; return; }
      const preview = chatEn(preset);
      const slaTxt = u.needsAck
        ? (u.slaMin < 60 ? u.slaMin + ' min' : u.slaMin < 1440 ? Math.round(u.slaMin / 60) + ' hr' : Math.round(u.slaMin / 1440) + ' day')
        : 'not required';
      html =
        '<div class="cv-tld">' +
          '<div class="cv-tld-h">' +
            '<div class="cv-tld-h-l">' +
              '<div class="cv-tld-eye">QUEUED BROADCAST · #' + (CHAT_QUEUE.indexOf(q) + 1) + '</div>' +
              '<div class="cv-tld-t">' + chatSubject(preset) + '</div>' +
              '<div class="cv-tld-meta">' +
                '<span><span class="cv-tld-meta-k">Scheduled</span><span class="cv-tld-meta-v">' + q.scheduledFor + ' IST · in ' + (q.etaMin < 60 ? q.etaMin + ' min' : Math.round(q.etaMin / 60) + ' hr') + '</span></span>' +
                '<span><span class="cv-tld-meta-k">Audience</span><span class="cv-tld-meta-v">' + q.audience + ' · ' + CHAT_CONTACTS.length + ' worker' + (CHAT_CONTACTS.length === 1 ? '' : 's') + '</span></span>' +
                '<span><span class="cv-tld-meta-k">Tier</span><span class="cv-tld-meta-v"><span class="cv-an-tier ' + u.tier + '">' + u.tier + '</span> ' + (u.needsAck ? '· response required' : '') + '</span></span>' +
                '<span><span class="cv-tld-meta-k">Ack SLA</span><span class="cv-tld-meta-v">' + slaTxt + '</span></span>' +
                '<span><span class="cv-tld-meta-k">Origin</span><span class="cv-tld-meta-v">' + (o.mod || 'VAANI Broadcasting') + ' · ' + (o.subMod || '—') + '</span></span>' +
                '<span><span class="cv-tld-meta-k">Originator</span><span class="cv-tld-meta-v">' + (o.by || 'Plant HR') + '</span></span>' +
              '</div>' +
            '</div>' +
            '<span class="cv-tld-close" onclick="cvTlCloseDetail()">Close ✕</span>' +
          '</div>' +
          '<div class="cv-qsd-preview" style="margin-bottom:12px">"' + preview + '"</div>' +
          '<div class="cv-qsd-acts" style="margin-top:0">' +
            '<button class="cv-qsd-btn primary" onclick="cvQSendNow(\'' + preset + '\')">Send now to all workers</button>' +
            '<button class="cv-qsd-btn" onclick="cvQSendToActive(\'' + preset + '\')">Send to current worker only</button>' +
          '</div>' +
        '</div>';
    } else {
      /* sent — derive delivery from the threads */
      const sentRec = (CHAT_SENT_TODAY || []).find(function (x) { return x.preset === preset; });
      let acked = 0, read = 0, delivered = 0, pending = 0;
      const recipients = [];
      Object.keys(CHAT_THREADS).forEach(function (wid) {
        const c = CHAT_CONTACTS.find(function (x) { return x.id === wid; });
        if (!c) return;
        (CHAT_THREADS[wid].msgs || []).forEach(function (m) {
          if (m.dir !== 'in' || m.preset !== preset) return;
          let state, cls, lbl;
          if (m.acked)       { state = 'acked';   cls = 'acked';   lbl = '✓✓ ack'; acked++; }
          else if (m.read)   { state = 'read';    cls = 'read';    lbl = '✓✓ read'; read++; }
          else                { state = 'delivd'; cls = 'delivd';  lbl = '✓ sent'; delivered++; }
          recipients.push({ c: c, m: m, state: state, cls: cls, lbl: lbl });
        });
      });
      const total = recipients.length || 1;
      /* progression segments — flex weights */
      const seg = function (n, klass, lbl) {
        const w = n / total * 100;
        return n > 0
          ? '<div class="cv-tld-prog-seg ' + klass + '" style="flex:' + n + ';min-width:36px" title="' + lbl + '">' + n + '</div>'
          : '';
      };
      const sentTime = sentRec ? chatHourToTime(sentRec.hour) : '—';
      html =
        '<div class="cv-tld">' +
          '<div class="cv-tld-h">' +
            '<div class="cv-tld-h-l">' +
              '<div class="cv-tld-eye">SENT BROADCAST · ' + sentTime + ' IST</div>' +
              '<div class="cv-tld-t">' + chatSubject(preset) + '</div>' +
              '<div class="cv-tld-meta">' +
                '<span><span class="cv-tld-meta-k">Sent</span><span class="cv-tld-meta-v">' + sentTime + ' IST</span></span>' +
                '<span><span class="cv-tld-meta-k">Tier</span><span class="cv-tld-meta-v"><span class="cv-an-tier ' + u.tier + '">' + u.tier + '</span></span></span>' +
                '<span><span class="cv-tld-meta-k">Origin</span><span class="cv-tld-meta-v">' + (o.mod || 'VAANI Broadcasting') + ' · ' + (o.subMod || '—') + '</span></span>' +
                '<span><span class="cv-tld-meta-k">Originator</span><span class="cv-tld-meta-v">' + (o.by || 'Plant HR') + '</span></span>' +
                '<span><span class="cv-tld-meta-k">Recipients</span><span class="cv-tld-meta-v">' + recipients.length + ' worker' + (recipients.length === 1 ? '' : 's') + '</span></span>' +
              '</div>' +
            '</div>' +
            '<span class="cv-tld-close" onclick="cvTlCloseDetail()">Close ✕</span>' +
          '</div>' +
          '<div class="cv-tld-prog-eye">Delivery progression · ' + acked + ' acknowledged · ' + read + ' read · ' + delivered + ' delivered</div>' +
          '<div class="cv-tld-prog">' +
            seg(acked, 'acked', 'acknowledged') +
            seg(read, 'read', 'read · awaiting ack') +
            seg(delivered, 'delivered', 'delivered · unread') +
            seg(pending, 'pending', 'pending') +
          '</div>' +
          '<div class="cv-tld-recipients">' +
            recipients.map(function (r) {
              const ini = r.c.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
              return '<div class="cv-tld-recip">' +
                '<span class="cv-tld-recip-ava ' + (r.c.type === 'Contract' ? 'contract' : '') + '">' + ini + '</span>' +
                '<span class="cv-tld-recip-name">' + r.c.name + '</span>' +
                '<span class="cv-tld-recip-state ' + r.cls + '">' + r.lbl + '</span>' +
              '</div>';
            }).join('') +
          '</div>' +
        '</div>';
    }
    host.style.display = 'block';
    host.innerHTML = html;
  }

  /* per-language engagement strip — small card per language showing
     count + read rate so we can see if a community is responding slow */
  function chatRenderLanguageStrip() {
    const host = document.getElementById('cv-lang-strip');
    if (!host) return;
    const by = {};
    Object.keys(CHAT_THREADS).forEach(function (wid) {
      const c = CHAT_CONTACTS.find(function (x) { return x.id === wid; });
      if (!c) return;
      (CHAT_THREADS[wid].msgs || []).forEach(function (m) {
        if (m.dir !== 'in' || !m.preset) return;
        const lc = c.lang;
        if (!by[lc]) by[lc] = { lc: lc, sent: 0, read: 0, acked: 0, ackReq: 0 };
        const u = CHAT_URGENCY[m.preset];
        by[lc].sent++;
        if (m.read) by[lc].read++;
        if (u && u.needsAck) by[lc].ackReq++;
        if (m.acked) by[lc].acked++;
      });
    });
    const langs = Object.values(by).sort(function (a, b) { return b.sent - a.sent; });
    host.innerHTML = langs.map(function (l) {
      const lng = chatLang(l.lc);
      const readPct = l.sent ? Math.round(l.read / l.sent * 100) : 0;
      const ackPct = l.ackReq ? Math.round(l.acked / l.ackReq * 100) : 0;
      const cls = ackPct >= 80 ? 'var(--green)'
                : ackPct >= 50 ? 'var(--amber)'
                : ackPct > 0 ? 'var(--red)' : 'var(--ink-4)';
      return '<div class="cv-lang-card">' +
        '<div class="cv-lang-card-h">' +
          '<span class="cv-lang-card-name"><span class="cv-lang-card-glyph">' + lng.glyph + '</span>' + lng.name + '</span>' +
          '<span class="cv-lang-card-count">' + l.sent + ' msg</span>' +
        '</div>' +
        '<div class="cv-lang-card-bar"><span style="width:' + ackPct + '%;background:' + cls + '"></span></div>' +
        '<div class="cv-lang-card-stats">' +
          '<span>read <span class="cv-lang-card-stat-v">' + readPct + '%</span></span>' +
          '<span>ack <span class="cv-lang-card-stat-v">' + ackPct + '%</span></span>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function chatRenderPipeline() {
    const stagesEl = document.getElementById('cv-pipe-stages');
    if (!stagesEl) return;
    const subs = chatAggregate();
    const sent = subs.reduce(function (n, s) { return n + s.sent; }, 0);
    const read = subs.reduce(function (n, s) { return n + s.read; }, 0);
    const ackedTot = subs.reduce(function (n, s) { return n + s.acked; }, 0);
    const ackReq = subs.filter(function (s) { return s.urg.needsAck; })
                       .reduce(function (n, s) { return n + s.sent; }, 0);
    const queued = CHAT_QUEUE.length;
    const overdue = subs.reduce(function (n, s) { return n + s.pending; }, 0);

    const pct = function (a, b) { return b ? Math.round(a / b * 100) : 0; };
    const tot = document.getElementById('cv-pipe-total');
    if (tot) tot.textContent = queued + ' queued · ' + sent + ' sent today';

    stagesEl.innerHTML =
      '<div class="cv-pipe-stage active">' +
        '<span class="cv-pipe-stage-ico">⏱</span>' +
        '<span class="cv-pipe-stage-eye">Queued</span>' +
        '<div class="cv-pipe-stage-val">' + queued + '</div>' +
        '<div class="cv-pipe-stage-sub">awaiting send window · Vaani Broadcasting</div>' +
        '<div class="cv-pipe-stage-bar"><span style="width:100%;background:var(--indigo)"></span></div>' +
      '</div>' +
      '<div class="cv-pipe-stage">' +
        '<span class="cv-pipe-stage-ico">↗</span>' +
        '<span class="cv-pipe-stage-eye">Sent</span>' +
        '<div class="cv-pipe-stage-val">' + sent + '</div>' +
        '<div class="cv-pipe-stage-sub">dispatched · WhatsApp Business API</div>' +
        '<div class="cv-pipe-stage-bar"><span style="width:100%;background:var(--ink-3)"></span></div>' +
      '</div>' +
      '<div class="cv-pipe-stage">' +
        '<span class="cv-pipe-stage-ico">✓</span>' +
        '<span class="cv-pipe-stage-eye">Delivered</span>' +
        '<div class="cv-pipe-stage-val">' + sent + '</div>' +
        '<div class="cv-pipe-stage-sub">device received · single tick on worker phone</div>' +
        '<div class="cv-pipe-stage-bar"><span style="width:100%;background:var(--ink-3)"></span></div>' +
      '</div>' +
      '<div class="cv-pipe-stage green">' +
        '<span class="cv-pipe-stage-ico">✓✓</span>' +
        '<span class="cv-pipe-stage-eye">Read</span>' +
        '<div class="cv-pipe-stage-val">' + read + '</div>' +
        '<div class="cv-pipe-stage-sub">worker opened · ' + pct(read, sent) + '% read rate</div>' +
        '<div class="cv-pipe-stage-bar"><span style="width:' + pct(read, sent) + '%;background:var(--green)"></span></div>' +
      '</div>' +
      '<div class="cv-pipe-stage ' + (overdue > 0 ? 'amber' : 'green') + '">' +
        '<span class="cv-pipe-stage-ico">⌬</span>' +
        '<span class="cv-pipe-stage-eye">Acknowledged</span>' +
        '<div class="cv-pipe-stage-val">' + ackedTot + (ackReq ? '<small style="font-size:0.7rem;color:var(--ink-3)"> / ' + ackReq + '</small>' : '') + '</div>' +
        '<div class="cv-pipe-stage-sub">' +
          (ackReq ? pct(ackedTot, ackReq) + '% read-receipt compliance' : 'no acknowledgement required') +
          (overdue ? ' · <strong style="color:var(--amber-dk)">' + overdue + ' overdue</strong>' : '') +
        '</div>' +
        '<div class="cv-pipe-stage-bar"><span style="width:' + (ackReq ? pct(ackedTot, ackReq) : 0) + '%;background:' +
          (overdue ? 'var(--amber)' : 'var(--green)') + '"></span></div>' +
      '</div>';

    /* up-next queue and recently sent */
    const up = document.getElementById('cv-pipe-up-list');
    if (up) {
      up.innerHTML = CHAT_QUEUE.length
        ? CHAT_QUEUE.map(function (q, i) {
            const u = CHAT_URGENCY[q.preset] || { tier: 'info' };
            const etaTxt = q.etaMin < 60 ? 'in ' + q.etaMin + ' min'
                        : 'in ' + Math.round(q.etaMin / 60) + ' hr';
            return '<div class="cv-pipe-item ' + u.tier + '">' +
              '<span class="cv-pipe-num cv-tl-peg-mini ' + u.tier + '">' + (i + 1) + '</span>' +
              '<div class="cv-pipe-item-main">' +
                '<div class="cv-pipe-item-subj">' + chatSubject(q.preset) + '</div>' +
                '<div class="cv-pipe-item-meta">' + q.audience +
                  ' · scheduled ' + q.scheduledFor + ' IST' + '</div>' +
              '</div>' +
              '<span class="cv-pipe-item-eta">' + etaTxt + '</span>' +
            '</div>';
          }).join('')
        : '<div class="tiny muted" style="padding:7px 10px">Queue is empty.</div>';
    }
    /* recently sent — collected from the threads, by latest at first */
    const recent = [];
    Object.keys(CHAT_THREADS).forEach(function (wid) {
      const c = CHAT_CONTACTS.find(function (x) { return x.id === wid; });
      (CHAT_THREADS[wid].msgs || []).forEach(function (m) {
        if (m.dir === 'in' && m.preset && c) recent.push({ m: m, c: c });
      });
    });
    recent.sort(function (a, b) {
      return (b.m.at || '').localeCompare(a.m.at || '');
    });
    const sentList = document.getElementById('cv-pipe-sent-list');
    if (sentList) {
      sentList.innerHTML = recent.slice(0, 4).map(function (r) {
        const u = CHAT_URGENCY[r.m.preset] || { tier: 'info' };
        const lng = chatLang(r.c.lang);
        const stateTxt = r.m.acked ? '✓ acknowledged'
                      : r.m.read ? '✓✓ read — awaiting ack'
                      : '✓ delivered';
        return '<div class="cv-pipe-item ' + u.tier + '">' +
          '<div class="cv-pipe-item-main">' +
            '<div class="cv-pipe-item-subj">' + chatSubject(r.m.preset) + '</div>' +
            '<div class="cv-pipe-item-meta">' + r.c.name +
              ' · ' + lng.glyph + ' ' + lng.code + ' · ' + stateTxt + '</div>' +
          '</div>' +
          '<span class="cv-pipe-item-when">' + (r.m.time || '') + '</span>' +
        '</div>';
      }).join('');
    }
  }

  /* preset currently expanded in the subject analytics drill-down */
  let CV_AN_OPEN = null;
  function cvAnToggle(preset) {
    CV_AN_OPEN = (CV_AN_OPEN === preset) ? null : preset;
    chatRenderSubjectGrid();
  }

  function chatRenderSubjectGrid() {
    const body = document.getElementById('cv-an-grid-body');
    if (!body) return;
    const subs = chatAggregate();
    /* sort: criticals first, then by sent count */
    const tierRank = { critical: 0, urgent: 1, advisory: 2, info: 3 };
    subs.sort(function (a, b) {
      const t = (tierRank[a.urg.tier] || 9) - (tierRank[b.urg.tier] || 9);
      return t !== 0 ? t : b.sent - a.sent;
    });
    /* totals */
    const sent = subs.reduce(function (n, s) { return n + s.sent; }, 0);
    const read = subs.reduce(function (n, s) { return n + s.read; }, 0);
    const acked = subs.reduce(function (n, s) { return n + s.acked; }, 0);
    const pending = subs.reduce(function (n, s) { return n + s.pending; }, 0);
    const ackReq = subs.filter(function (s) { return s.urg.needsAck; })
                       .reduce(function (n, s) { return n + s.sent; }, 0);

    const set = function (id, v) { const e = document.getElementById(id); if (e) e.textContent = v; };
    const totEl = document.getElementById('cv-an-total');
    if (totEl) totEl.textContent = subs.length + ' subject' + (subs.length === 1 ? '' : 's');
    set('cv-an-kpi-sent', sent);
    set('cv-an-kpi-sent-sub', subs.length + ' subject' + (subs.length === 1 ? '' : 's') + ' · ' +
      Object.keys(subs.reduce(function (acc, s) {
        Object.keys(s.langs).forEach(function (k) { acc[k] = 1; });
        return acc;
      }, {})).length + ' languages');
    set('cv-an-kpi-read', sent ? Math.round(read / sent * 100) + '%' : '—');
    set('cv-an-kpi-read-sub', read + ' of ' + sent + ' messages opened');
    set('cv-an-kpi-ack', ackReq ? Math.round(acked / ackReq * 100) + '%' : '—');
    set('cv-an-kpi-ack-sub', acked + ' of ' + ackReq + ' response-required messages');
    set('cv-an-kpi-pend', pending);
    set('cv-an-kpi-pend-sub', pending ? 'awaiting worker acknowledgement' : 'all response-required messages acknowledged');

    let html = '';
    subs.forEach(function (s) {
      const readPct = s.sent ? Math.round(s.read / s.sent * 100) : 0;
      const ackPct = s.urg.needsAck && s.sent
        ? Math.round(s.acked / s.sent * 100) : 0;
      const readCls = readPct >= 80 ? 'var(--green)' : readPct >= 50 ? 'var(--amber)' : 'var(--red)';
      const ackCls  = !s.urg.needsAck ? 'var(--ink-4)'
                    : ackPct >= 80 ? 'var(--green)'
                    : ackPct >= 50 ? 'var(--amber)' : 'var(--red)';
      const langPills = Object.keys(s.langs).sort().map(function (lc) {
        return '<span class="cv-an-lang-chip">' + chatLang(lc).glyph + ' ' + lc +
          ' · ' + s.langs[lc] + '</span>';
      }).join('');
      const pendCell = s.urg.needsAck
        ? (s.pending > 0
            ? '<span class="pill amber tiny">' + s.pending + ' pending</span>'
            : '<span class="pill green tiny">clear</span>')
        : '<span class="t-mute">n/a</span>';
      const isOpen = CV_AN_OPEN === s.preset;
      html += '<tr class="cv-an-row ' + (isOpen ? 'open' : '') +
        '" data-tier="' + s.urg.tier + '" data-needsack="' + (s.urg.needsAck ? '1' : '0') +
        '" data-pending="' + s.pending + '"' +
        ' onclick="cvAnToggle(\'' + s.preset + '\')">' +
        '<td><span class="cv-an-caret">' + (isOpen ? '▾' : '▸') + '</span> ' +
          '<span class="t-strong">' + s.subject + '</span></td>' +
        '<td><span class="cv-an-tier ' + s.urg.tier + '">' + s.urg.tier + '</span></td>' +
        '<td class="mono">' + s.sent + '</td>' +
        '<td><div class="cv-an-lang-row">' + langPills + '</div></td>' +
        '<td><div class="cv-an-bar">' +
          '<div class="cv-an-bar-track"><div class="cv-an-bar-fill" style="width:' + readPct + '%;background:' + readCls + '"></div></div>' +
          '<span class="cv-an-bar-val">' + readPct + '%</span>' +
        '</div></td>' +
        '<td>' + (s.urg.needsAck
          ? '<div class="cv-an-bar">' +
            '<div class="cv-an-bar-track"><div class="cv-an-bar-fill" style="width:' + ackPct + '%;background:' + ackCls + '"></div></div>' +
            '<span class="cv-an-bar-val">' + ackPct + '%</span>' +
          '</div>'
          : '<span class="t-mute">not required</span>') + '</td>' +
        '<td>' + pendCell + '</td>' +
      '</tr>';
      if (isOpen) {
        html += chatRenderSubjectDrilldown(s);
      }
    });
    body.innerHTML = html;
  }

  /* drill-down row — every individual message for this subject:
     when it was sent, to whom, in what language, read/ack state */
  function chatRenderSubjectDrilldown(s) {
    /* collect every inbound preset-message matching this subject */
    const items = [];
    Object.keys(CHAT_THREADS).forEach(function (wid) {
      const c = CHAT_CONTACTS.find(function (x) { return x.id === wid; });
      if (!c) return;
      (CHAT_THREADS[wid].msgs || []).forEach(function (m) {
        if (m.dir !== 'in' || m.preset !== s.preset) return;
        items.push({ m: m, c: c });
      });
    });
    /* sort by send time (latest first) */
    items.sort(function (a, b) { return (b.m.at || '').localeCompare(a.m.at || ''); });

    const origin = (typeof CHAT_ORIGIN !== 'undefined' && CHAT_ORIGIN[s.preset]) || {};
    const slaTxt = !s.urg.needsAck ? 'no acknowledgement required'
                 : s.urg.slaMin < 60 ? s.urg.slaMin + ' min'
                 : s.urg.slaMin < 1440 ? Math.round(s.urg.slaMin / 60) + ' hr'
                 : Math.round(s.urg.slaMin / 1440) + ' day';

    const rows = items.map(function (r) {
      const lng = chatLang(r.c.lang);
      const stateCls = r.m.acked ? 'done' : r.m.read ? 'pend' : 'miss';
      const stateLbl = r.m.acked
        ? '✓ Acknowledged · ' + (r.m.ackedAt || 'now')
        : r.m.read ? '⌛ Read · awaiting ack' : '✗ Delivered · unread';
      const reminders = r.m.reminders ? ' · ' + r.m.reminders +
        ' reminder' + (r.m.reminders === 1 ? '' : 's') : '';
      const ini = r.c.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
      return '<div class="cv-an-detail-msg">' +
        '<div class="cv-an-detail-ava ' + (r.c.type === 'Contract' ? 'contract' : '') + '">' + ini + '</div>' +
        '<div class="cv-an-detail-who">' +
          '<div class="cv-an-detail-name">' + r.c.name +
            ' <span class="cv-an-detail-id">' + r.c.id + '</span></div>' +
          '<div class="cv-an-detail-meta">' + r.c.role + ' · ' + r.c.zone + ' · ' +
            r.c.type + ' · ' + lng.glyph + ' ' + lng.name + '</div>' +
        '</div>' +
        '<div class="cv-an-detail-when">' +
          '<div class="cv-an-detail-sent">' + (r.m.at || r.m.time) + '</div>' +
          '<div class="cv-an-detail-state ' + stateCls + '">' + stateLbl + reminders + '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    return '<tr class="cv-an-detail"><td colspan="7"><div class="cv-an-detail-inner">' +
      '<div class="cv-an-detail-h">' +
        '<div class="cv-an-detail-h-l">' +
          '<div class="cv-an-detail-eye">' + s.sent + ' message' + (s.sent === 1 ? '' : 's') +
            ' delivered · drill-down</div>' +
          '<div class="cv-an-detail-summary">' +
            'Origin: <strong>' + (origin.mod || '—') + (origin.subMod ? ' · ' + origin.subMod : '') + '</strong>' +
            ' · Originator: <strong>' + (origin.by || '—') + '</strong>' +
            ' · Ack SLA: <strong>' + slaTxt + '</strong>' +
          '</div>' +
        '</div>' +
        (s.pending > 0
          ? '<span class="pill amber tiny">' + s.pending + ' awaiting ack</span>'
          : '<span class="pill green tiny">all caught up</span>') +
      '</div>' +
      /* delivery progression visual — sent → read → acked breakdown */
      chatRenderSubjectProgression(items, s) +
      /* per-language mini-strip — read/ack rate split by language */
      chatRenderSubjectLangStrip(items, s) +
      (rows || '<div class="tiny muted" style="padding:8px 0">No deliveries recorded for this subject.</div>') +
    '</div></td></tr>';
  }

  /* helper · delivery progression segmented bar for a subject's messages */
  function chatRenderSubjectProgression(items, s) {
    if (!items.length) return '';
    let acked = 0, read = 0, delivered = 0;
    items.forEach(function (r) {
      if (r.m.acked) acked++;
      else if (r.m.read) read++;
      else delivered++;
    });
    const total = items.length;
    const seg = function (n, klass, lbl) {
      return n > 0
        ? '<div class="cv-tld-prog-seg ' + klass + '" style="flex:' + n + ';min-width:36px" title="' + lbl + '">' + n + '</div>'
        : '';
    };
    return '<div class="cv-tld-prog-eye" style="margin-top:8px">Delivery progression · ' +
      acked + ' acknowledged · ' + read + ' read · ' + delivered + ' delivered</div>' +
      '<div class="cv-tld-prog">' +
        seg(acked, 'acked', 'acknowledged') +
        seg(read, 'read', 'read · awaiting ack') +
        seg(delivered, 'delivered', 'delivered · unread') +
      '</div>';
  }

  /* helper · per-language read/ack mini-strip for a subject */
  function chatRenderSubjectLangStrip(items, s) {
    if (!items.length) return '';
    const by = {};
    items.forEach(function (r) {
      const lc = r.c.lang;
      if (!by[lc]) by[lc] = { lc: lc, n: 0, read: 0, acked: 0, ackReq: 0 };
      by[lc].n++;
      if (r.m.read) by[lc].read++;
      if (s.urg.needsAck) by[lc].ackReq++;
      if (r.m.acked) by[lc].acked++;
    });
    const langs = Object.values(by).sort(function (a, b) { return b.n - a.n; });
    if (langs.length === 0) return '';
    const cards = langs.map(function (l) {
      const lng = chatLang(l.lc);
      const readPct = l.n ? Math.round(l.read / l.n * 100) : 0;
      const ackPct = l.ackReq ? Math.round(l.acked / l.ackReq * 100) : 0;
      const ackCol = !l.ackReq ? 'var(--ink-4)'
                  : ackPct >= 80 ? 'var(--green)'
                  : ackPct >= 50 ? 'var(--amber)' : 'var(--red)';
      return '<div class="cv-an-langmini">' +
        '<div class="cv-an-langmini-h">' +
          '<span class="cv-an-langmini-name">' + lng.glyph + ' ' + lng.name + '</span>' +
          '<span class="cv-an-langmini-n">' + l.n + ' msg</span>' +
        '</div>' +
        '<div class="cv-an-langmini-bar"><span style="width:' + (l.ackReq ? ackPct : readPct) + '%;background:' + ackCol + '"></span></div>' +
        '<div class="cv-an-langmini-stats">' +
          '<span>read <strong>' + readPct + '%</strong></span>' +
          '<span>ack <strong>' + (l.ackReq ? ackPct + '%' : 'n/a') + '</strong></span>' +
        '</div>' +
      '</div>';
    }).join('');
    return '<div class="cv-tld-prog-eye" style="margin-top:14px">Per-language engagement</div>' +
      '<div class="cv-an-langmini-row">' + cards + '</div>';
  }

  /* ════════════════════════════════════════════════════════════════
     EMPLOYEE HOME — the worker-facing surface (sec-emp-home · emp-*).
     Pulls everything Karya Vaani knows about a single worker into
     one place: identity, today's alerts, pending acknowledgements,
     personal compliance, time-to-read and dept comparison.
     ════════════════════════════════════════════════════════════════ */
  let EMP_ACTIVE = null;   /* worker id of the currently-signed-in employee */

  function empToast(msg) { if (typeof toast === 'function') toast(msg, 'green'); }

  /* find current worker · default to first contact who has unacked criticals,
     else first contact */
  function empDefaultWorker() {
    let pick = null;
    Object.keys(CHAT_THREADS).forEach(function (wid) {
      (CHAT_THREADS[wid].msgs || []).forEach(function (m) {
        if (m.dir === 'in' && m.preset && !m.acked) {
          const u = CHAT_URGENCY[m.preset];
          if (u && u.needsAck && u.tier === 'critical' && !pick) pick = wid;
        }
      });
    });
    return pick || (CHAT_CONTACTS[0] && CHAT_CONTACTS[0].id);
  }

  function empSetWorker(id) {
    EMP_ACTIVE = id;
    /* sync the chat module so any action originating from the embedded
       chat (ack, quick-reply, reminder) operates on this same worker */
    if (typeof CHAT_STATE !== 'undefined') CHAT_STATE.activeId = EMP_ACTIVE;
    if (typeof chatRenderList === 'function') chatRenderList();
    empRender();
  }

  function empOpenChat() {
    /* set chat to the same worker, then navigate */
    if (typeof CHAT_STATE !== 'undefined') CHAT_STATE.activeId = EMP_ACTIVE;
    if (typeof chatRenderConv === 'function') chatRenderConv();
    if (typeof nav === 'function') {
      nav('chat', document.querySelector('[onclick*=\"\\u0027chat\\u0027\"],[data-onclick*=\"\\u0027chat\\u0027\"]'));
    }
  }

  /* render the embedded chat surface on the employee home —
     mirrors chatRenderConv but writes to the empchat-* DOM nodes */
  function empChatRender() {
    const head = document.getElementById('empchat-h');
    const body = document.getElementById('empchat-body');
    const foot = document.getElementById('empchat-foot');
    if (!head || !body || !foot) return;
    if (!EMP_ACTIVE) EMP_ACTIVE = empDefaultWorker();
    const c = CHAT_CONTACTS.find(function (x) { return x.id === EMP_ACTIVE; });
    if (!c) { head.innerHTML = ''; body.innerHTML = ''; foot.innerHTML = ''; return; }
    /* keep CHAT_STATE.activeId in sync so quick-reply / ack actions
       (which call chatWorkerReply / chatAckMessage from the chat module)
       operate on the same employee */
    if (typeof CHAT_STATE !== 'undefined') CHAT_STATE.activeId = EMP_ACTIVE;
    const t = CHAT_THREADS[c.id] || { msgs: [], lastSeen: '' };
    const lng = (typeof chatLang === 'function') ? chatLang(c.lang) : { glyph: c.lang, name: c.lang };

    /* the popup carries its own header — keep the hidden cv-conv-h empty */
    head.innerHTML = '';
    /* drive the popup header subtitle */
    const popSub = document.getElementById('emp-chat-pop-h-sub');
    if (popSub) popSub.textContent = 'talks to you in ' + lng.name + ' · ' + c.name;

    /* tag in the card header (legacy hook — harmless if missing) */
    const langTag = document.getElementById('empchat-lang-tag');
    if (langTag) langTag.textContent = lng.glyph + ' ' + lng.name + ' · ' + c.name;

    /* compliance bar + bubbles */
    let html = '';
    let total = 0, read = 0, acked = 0, pending = 0;
    t.msgs.forEach(function (m) {
      if (m.dir !== 'in' || !m.preset) return;
      const u = CHAT_URGENCY[m.preset];
      if (!u || !u.needsAck) return;
      total++;
      if (m.read) read++;
      if (m.acked) acked++;
      if (!m.acked) pending++;
    });
    if (total > 0) {
      const ackPct = Math.round(acked / total * 100);
      const statusCls = pending === 0 ? 'green' : ackPct >= 50 ? 'amber' : 'red';
      html += '<div class="cv-compliance-bar">' +
        '<div class="cv-compliance-l">' +
          '<span class="cv-compliance-eye">Your read-receipt compliance</span>' +
          '<span class="cv-compliance-stats">' +
            acked + ' of ' + total + ' acknowledged · ' +
            read + ' read · ' + pending + ' pending' +
          '</span>' +
        '</div>' +
        '<span class="cv-compliance-pill ' + statusCls + '">' +
          (pending === 0 ? 'Compliant' : pending + ' pending') +
        '</span>' +
      '</div>';
    }
    html += '<div class="cv-day"><span class="cv-day-pill">Recent messages</span></div>';
    (t.msgs || []).forEach(function (m) {
      const bubble = m.dir === 'in'
        ? (typeof chatRenderInbound === 'function' ? chatRenderInbound(m, c) : '')
        : (typeof chatRenderOutbound === 'function' ? chatRenderOutbound(m, c) : '');
      html += bubble;
    });
    body.innerHTML = html;
    body.scrollTop = body.scrollHeight;

    /* footer — quick-reply chips in the worker's language */
    const quickList = (typeof CHAT_QUICK !== 'undefined') ? (CHAT_QUICK[c.lang] || CHAT_QUICK.HI) : [];
    foot.innerHTML =
      '<div class="cv-quick-row">' +
        quickList.map(function (q) {
          return '<span class="cv-quick" onclick="empWorkerReply(\'' + q.replace(/'/g, "\\'") + '\')">' + q + '</span>';
        }).join('') +
      '</div>' +
      '<div class="cv-compose">' +
        '<div class="cv-compose-in">Type a reply — your message will be sent to the assistant in ' + lng.name + '…</div>' +
        '<span class="cv-compose-mic">🎙</span>' +
      '</div>';
  }

  /* worker hits a quick-reply chip on the embedded chat */
  function empWorkerReply(text) {
    /* ensure the chat module sees the same active worker, then delegate */
    if (typeof CHAT_STATE !== 'undefined') CHAT_STATE.activeId = EMP_ACTIVE;
    if (typeof chatWorkerReply === 'function') chatWorkerReply(text);
    /* refresh the employee surface (KPIs, hero, pending counts) */
    empRender();
  }

  /* open / close the floating chat popup */
  function empChatToggle() {
    const pop = document.getElementById('emp-chat-pop');
    const fab = document.getElementById('emp-chat-fab');
    if (!pop || !fab) return;
    const opening = !pop.classList.contains('on');
    pop.classList.toggle('on', opening);
    fab.classList.toggle('on', opening);
    pop.setAttribute('aria-hidden', opening ? 'false' : 'true');
    if (opening) {
      /* refresh the conversation when opening, then scroll to the latest */
      empChatRender();
      const body = document.getElementById('empchat-body');
      if (body) requestAnimationFrame(function () { body.scrollTop = body.scrollHeight; });
      /* hide the badge while the popup is open — the worker is reading */
      const badge = document.getElementById('emp-chat-fab-badge');
      if (badge) badge.style.display = 'none';
    } else {
      /* on close, recompute the badge so the next pending count surfaces */
      empChatBadge();
    }
  }

  /* update the FAB unread/pending badge */
  function empChatBadge() {
    const badge = document.getElementById('emp-chat-fab-badge');
    const pop = document.getElementById('emp-chat-pop');
    if (!badge) return;
    /* badge hides while the popup is open */
    if (pop && pop.classList.contains('on')) { badge.style.display = 'none'; return; }
    if (!EMP_ACTIVE) { badge.style.display = 'none'; return; }
    const agg = empAggregate(EMP_ACTIVE);
    if (agg.pending > 0) {
      badge.textContent = agg.pending;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  /* acknowledge every pending message for the active worker */
  function empAckAll() {
    if (!EMP_ACTIVE) return;
    const t = CHAT_THREADS[EMP_ACTIVE]; if (!t) return;
    let n = 0;
    (t.msgs || []).forEach(function (m) {
      if (m.dir !== 'in' || !m.preset) return;
      const u = CHAT_URGENCY[m.preset];
      if (u && u.needsAck && !m.acked && typeof chatAckMessage === 'function') {
        chatAckMessage(m.id);
        n++;
      }
    });
    empRender();
    /* re-sync analytics surfaces */
    if (typeof chatRenderAnalytics === 'function') chatRenderAnalytics();
    if (n > 0) empToast(n + ' message' + (n === 1 ? '' : 's') + ' acknowledged');
    else empToast('Nothing pending — you are all caught up');
  }

  /* aggregate messages for a worker → returns { sent, read, acked, ackReq, pending, today, criticalPend, items[] } */
  function empAggregate(wid) {
    const out = { sent: 0, read: 0, acked: 0, ackReq: 0, pending: 0, today: 0, criticalPend: 0, items: [] };
    const t = CHAT_THREADS[wid]; if (!t) return out;
    (t.msgs || []).forEach(function (m) {
      if (m.dir !== 'in' || !m.preset) return;
      const u = CHAT_URGENCY[m.preset] || { tier: 'info', needsAck: false };
      out.sent++;
      if (m.read) out.read++;
      if (m.acked) out.acked++;
      if (u.needsAck) out.ackReq++;
      if (u.needsAck && !m.acked) {
        out.pending++;
        if (u.tier === 'critical') out.criticalPend++;
      }
      if (m.at && /(Today|26 May 2026)/.test(m.at)) out.today++;
      else if (m.time && m.time.indexOf('Today') === 0) out.today++;
      out.items.push({ m: m, u: u });
    });
    /* sort items newest first */
    out.items.sort(function (a, b) { return (b.m.at || '').localeCompare(a.m.at || ''); });
    return out;
  }

  /* dept aggregate for comparison */
  function empDeptStats(dept) {
    const out = { read: 0, acked: 0, sent: 0, ackReq: 0 };
    CHAT_CONTACTS.forEach(function (c) {
      if (c.dept !== dept) return;
      const a = empAggregate(c.id);
      out.sent += a.sent; out.read += a.read; out.acked += a.acked; out.ackReq += a.ackReq;
    });
    return out;
  }

  function empRender() {
    if (!document.getElementById('sec-emp-home')) return;
    /* populate picker on first render */
    const sel = document.getElementById('emp-picker-sel');
    if (sel && !sel.options.length) {
      sel.innerHTML = CHAT_CONTACTS.map(function (c) {
        return '<option value="' + c.id + '">' + c.name + ' · ' + c.role + ' · ' + c.dept + '</option>';
      }).join('');
    }
    if (!EMP_ACTIVE) EMP_ACTIVE = empDefaultWorker();
    if (sel) sel.value = EMP_ACTIVE;

    const c = CHAT_CONTACTS.find(function (x) { return x.id === EMP_ACTIVE; });
    if (!c) return;
    const agg = empAggregate(EMP_ACTIVE);
    const lng = (typeof chatLang === 'function') ? chatLang(c.lang) : { glyph: c.lang, name: c.lang };

    /* hero */
    const ini = c.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
    document.getElementById('emp-hero-ava').textContent = ini;
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('emp-hero-greet').textContent = greet + ' ·';
    document.getElementById('emp-hero-name').textContent = c.name;
    document.getElementById('emp-hero-meta').textContent =
      c.role + ' · ' + c.dept + ' · ' + c.zone + ' · supervised by ' + (c.sup || '—');
    const chipsHtml = [
      '<span class="emp-hero-chip">' + c.id + '</span>',
      '<span class="emp-hero-chip">' + lng.glyph + ' ' + lng.name + '</span>',
      '<span class="emp-hero-chip ' + (c.type === 'Contract' ? 'amber' : '') + '">' +
        c.type + (c.contractor ? ' · ' + c.contractor : '') + '</span>'
    ];
    document.getElementById('emp-hero-chips').innerHTML = chipsHtml.join('');

    const compliance = agg.ackReq ? Math.round(agg.acked / agg.ackReq * 100) : 100;
    document.getElementById('emp-hero-num').textContent = compliance;
    document.getElementById('emp-hero-num-sub').textContent =
      agg.acked + ' of ' + agg.ackReq + ' response-required messages acknowledged';
    const heroAct = document.getElementById('emp-hero-act');
    if (heroAct) {
      heroAct.textContent = agg.pending > 0 ? 'Acknowledge all (' + agg.pending + ')' : 'All caught up ✓';
      heroAct.disabled = agg.pending === 0;
      heroAct.style.opacity = agg.pending === 0 ? '0.5' : '';
    }

    /* action banner */
    const action = document.getElementById('emp-action');
    if (agg.pending > 0) {
      const worst = agg.items.find(function (it) {
        return it.u.needsAck && !it.m.acked && it.u.tier === 'critical';
      }) || agg.items.find(function (it) { return it.u.needsAck && !it.m.acked; });
      action.style.display = 'flex';
      action.innerHTML =
        '<span class="emp-action-ico">!</span>' +
        '<div class="emp-action-main">' +
          '<div class="emp-action-t">' + agg.pending + ' message' + (agg.pending === 1 ? '' : 's') +
            ' need' + (agg.pending === 1 ? 's' : '') + ' your acknowledgement</div>' +
          '<div class="emp-action-s">' +
            (worst ? 'Most pressing: "' + (typeof chatSubject === 'function' ? chatSubject(worst.m.preset) : worst.m.preset) +
              '" — ' + worst.u.label : 'Please confirm so HR knows you have seen these.') +
          '</div>' +
        '</div>' +
        '<button class="emp-action-btn" onclick="empAckAll()">Acknowledge all</button>';
    } else {
      action.style.display = 'none';
    }

    /* KPI strip */
    document.getElementById('emp-k-today').textContent = agg.today;
    document.getElementById('emp-k-today-s').textContent = agg.sent + ' total in your history';
    document.getElementById('emp-k-read').textContent = agg.read;
    document.getElementById('emp-k-read-s').textContent = agg.sent ? Math.round(agg.read / agg.sent * 100) + '% read rate' : 'no messages yet';
    document.getElementById('emp-k-ack').textContent = agg.acked;
    document.getElementById('emp-k-ack-s').textContent = agg.ackReq ? compliance + '% compliance' : 'no response-required messages';
    document.getElementById('emp-k-pend').textContent = agg.pending;
    document.getElementById('emp-k-pend-s').textContent = agg.pending === 0 ? 'all clear · nothing to do' : 'tap below to acknowledge';

    /* pending messages list */
    const pendList = document.getElementById('emp-pending-list');
    const pending = agg.items.filter(function (it) { return it.u.needsAck && !it.m.acked; });
    document.getElementById('emp-pending-cnt').textContent =
      pending.length + ' pending' + (pending.length === 0 ? '' : ' · awaiting reply');
    if (pendList) {
      if (pending.length === 0) {
        pendList.innerHTML = '<div class="emp-msg" style="border-left-color:var(--green);background:#ECF7EE">' +
          '<div class="emp-msg-ico" style="background:var(--green)">✓</div>' +
          '<div class="emp-msg-main">' +
            '<div class="emp-msg-subj">You are all caught up</div>' +
            '<div class="emp-msg-body">Every response-required message has been acknowledged. Karya Vaani will reach out when something new arrives.</div>' +
          '</div>' +
        '</div>';
      } else {
        pendList.innerHTML = pending.map(function (it) {
          return empRenderMessageCard(it, c);
        }).join('');
      }
    }

    /* history list — last 8 messages that aren't pending */
    const hist = agg.items.filter(function (it) { return !(it.u.needsAck && !it.m.acked); }).slice(0, 8);
    document.getElementById('emp-hist-cnt').textContent = hist.length + ' shown · ' + agg.sent + ' total';
    const histList = document.getElementById('emp-history-list');
    if (histList) {
      if (hist.length === 0) {
        histList.innerHTML = '<div class="tiny muted" style="padding:14px;text-align:center">No history yet — broadcasts will appear here once delivered.</div>';
      } else {
        histList.innerHTML = hist.map(function (it) {
          const subj = typeof chatSubject === 'function' ? chatSubject(it.m.preset) : it.m.preset;
          const stateCls = it.m.acked ? 'acked' : it.m.read ? 'read' : 'unr';
          const stateLbl = it.m.acked ? '✓ acknowledged' : it.m.read ? '✓✓ read' : '⌛ unread';
          return '<div class="emp-hist-row">' +
            '<span class="emp-hist-dot ' + it.u.tier + '"></span>' +
            '<span class="emp-hist-subj">' + subj + '</span>' +
            '<span class="emp-hist-when">' + (it.m.time || '—') + '</span>' +
            '<span class="emp-hist-state ' + stateCls + '">' + stateLbl + '</span>' +
          '</div>';
        }).join('');
      }
    }

    /* schedule */
    empRenderSchedule(c);

    /* personal analytics */
    empRenderPersonalAnalytics(c, agg);

    /* identity */
    empRenderIdentity(c);

    /* embedded chat — re-render the conversation with the assistant */
    empChatRender();

    /* keep the floating chat FAB badge in sync with pending count */
    empChatBadge();
  }

  function empRenderMessageCard(it, c) {
    const subj = typeof chatSubject === 'function' ? chatSubject(it.m.preset) : it.m.preset;
    const body = typeof chatLocalised === 'function' ? chatLocalised(it.m.preset, c.lang) :
                 (typeof chatEn === 'function' ? chatEn(it.m.preset) : '');
    const en = typeof chatEn === 'function' ? chatEn(it.m.preset) : '';
    const origin = (typeof CHAT_ORIGIN !== 'undefined' && CHAT_ORIGIN[it.m.preset]) || {};
    const slaTxt = !it.u.needsAck ? 'no acknowledgement required'
                 : it.u.slaMin < 60 ? it.u.slaMin + ' min SLA'
                 : it.u.slaMin < 1440 ? Math.round(it.u.slaMin / 60) + ' hr SLA'
                 : Math.round(it.u.slaMin / 1440) + ' day SLA';
    const tierLetter = it.u.tier.charAt(0).toUpperCase();
    return '<div class="emp-msg ' + it.u.tier + '">' +
      '<div class="emp-msg-ico ' + it.u.tier + '">' + tierLetter + '</div>' +
      '<div class="emp-msg-main">' +
        '<div class="emp-msg-top">' +
          '<span class="emp-msg-subj">' + subj + '</span>' +
          '<span class="emp-msg-tier ' + it.u.tier + '">' + it.u.label + '</span>' +
        '</div>' +
        '<div class="emp-msg-body emp-msg-body-native">' + body + '</div>' +
        (en && en !== body ? '<div class="emp-msg-body" style="font-style:italic">EN · ' + en + '</div>' : '') +
        '<div class="emp-msg-foot">' +
          '<span><span class="emp-msg-foot-k">Sent</span> <span class="emp-msg-foot-v">' + (it.m.at || it.m.time) + '</span></span>' +
          (origin.by ? '<span><span class="emp-msg-foot-k">By</span> <span class="emp-msg-foot-v">' + origin.by + '</span></span>' : '') +
          '<span><span class="emp-msg-foot-k">SLA</span> <span class="emp-msg-foot-v">' + slaTxt + '</span></span>' +
        '</div>' +
        '<div class="emp-msg-actions">' +
          '<button class="emp-msg-ack" onclick="chatAckMessage(\'' + it.m.id + '\'); empRender();">Acknowledge ✓</button>' +
          '<button class="emp-msg-ack outline" onclick="empOpenChat()">Reply in chat</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function empRenderSchedule(c) {
    const host = document.getElementById('emp-schedule-list');
    if (!host) return;
    /* synthesize a small day-of schedule from chat presets + zone */
    const items = [
      { when: 'Today · 06:55', t: 'Bus pickup', s: 'Route via ' + (c.zone || 'Zone') + ' · scheduled by Transport Schedule' },
      { when: 'Today · 08:00', t: 'Shift start', s: c.role + ' · ' + c.zone },
      { when: 'Today · 12:30', t: 'Lunch break', s: '30 min · canteen on the production floor' },
      { when: 'Today · 16:30', t: 'Shift end', s: 'Return bus departs at 16:45' }
    ];
    /* if the worker is in compressor / paint shop, add a safety induction */
    if (/Compressor|Paint/i.test(c.zone || '')) {
      items.splice(2, 0, { when: 'Today · 11:00', t: 'PPE check', s: 'Class-B helmet + steel-toe shoes mandatory on the line' });
    }
    host.innerHTML = items.map(function (it) {
      return '<div class="emp-sched">' +
        '<div class="emp-sched-when">' + it.when + '</div>' +
        '<div class="emp-sched-main">' +
          '<div class="emp-sched-t">' + it.t + '</div>' +
          '<div class="emp-sched-s">' + it.s + '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function empRenderPersonalAnalytics(c, agg) {
    /* time-to-read for last 5 read messages */
    const ttrHost = document.getElementById('emp-an-ttr');
    if (ttrHost) {
      const reads = agg.items.filter(function (it) { return it.m.read; }).slice(0, 5);
      if (reads.length === 0) {
        ttrHost.innerHTML = '<div class="tiny muted" style="padding:6px 0">No reads recorded yet — your TTR will appear here once you open broadcasts.</div>';
      } else {
        const base = (typeof CV_TTR_BASE !== 'undefined' ? CV_TTR_BASE : { critical:4, urgent:18, advisory:76, info:220 });
        const variance = (typeof CV_TTR_VAR !== 'undefined' ? CV_TTR_VAR : { critical:3, urgent:9, advisory:38, info:100 });
        const ttrs = reads.map(function (it) {
          const b = base[it.u.tier] || 60;
          const v = variance[it.u.tier] || 30;
          const jitter = (typeof cvHash === 'function')
            ? (cvHash(c.id + it.m.preset) - 0.5) * 2 * v
            : 0;
          return { it: it, ttr: Math.max(1, Math.round(b + jitter)) };
        });
        const max = Math.max.apply(null, ttrs.map(function (x) { return x.ttr; })) || 1;
        ttrHost.innerHTML = ttrs.map(function (x) {
          const subj = (typeof chatSubject === 'function') ? chatSubject(x.it.m.preset) : x.it.m.preset;
          const pct = Math.max(8, (x.ttr / max) * 100);
          return '<div class="emp-an-ttr-row">' +
            '<div class="emp-an-ttr-bar-wrap">' +
              '<div class="emp-an-ttr-bar ' + x.it.u.tier + '" style="width:' + pct + '%">' + subj + '</div>' +
            '</div>' +
            '<span class="emp-an-ttr-v">' + x.ttr + ' min</span>' +
          '</div>';
        }).join('');
        const avg = Math.round(ttrs.reduce(function (n, x) { return n + x.ttr; }, 0) / ttrs.length);
        const ttrSub = document.getElementById('emp-an-ttr-sub');
        if (ttrSub) {
          ttrSub.textContent = 'Average ' + avg + ' min · faster on critical, slower on advisory — typical for shop-floor workers.';
        }
      }
    }

    /* compare to dept */
    const cmp = document.getElementById('emp-an-compare');
    if (cmp) {
      const dept = empDeptStats(c.dept);
      const youReadPct = agg.sent ? Math.round(agg.read / agg.sent * 100) : 0;
      const youAckPct = agg.ackReq ? Math.round(agg.acked / agg.ackReq * 100) : 100;
      const deptReadPct = dept.sent ? Math.round(dept.read / dept.sent * 100) : 0;
      const deptAckPct = dept.ackReq ? Math.round(dept.acked / dept.ackReq * 100) : 100;
      cmp.innerHTML =
        '<div class="emp-an-compare-row">' +
          '<span class="emp-an-compare-l">Read rate</span>' +
          '<div class="emp-an-compare-bar">' +
            '<div class="emp-an-compare-bar-fill dept" style="width:' + deptReadPct + '%"></div>' +
            '<div class="emp-an-compare-bar-fill you" style="width:' + youReadPct + '%"></div>' +
          '</div>' +
          '<div><div class="emp-an-compare-v you">You ' + youReadPct + '%</div>' +
            '<div class="emp-an-compare-v dept" style="font-size:0.62rem">Dept ' + deptReadPct + '%</div></div>' +
        '</div>' +
        '<div class="emp-an-compare-row">' +
          '<span class="emp-an-compare-l">Ack rate</span>' +
          '<div class="emp-an-compare-bar">' +
            '<div class="emp-an-compare-bar-fill dept" style="width:' + deptAckPct + '%"></div>' +
            '<div class="emp-an-compare-bar-fill you" style="width:' + youAckPct + '%"></div>' +
          '</div>' +
          '<div><div class="emp-an-compare-v you">You ' + youAckPct + '%</div>' +
            '<div class="emp-an-compare-v dept" style="font-size:0.62rem">Dept ' + deptAckPct + '%</div></div>' +
        '</div>';
    }

    /* streak — last 7 days, derived deterministically from worker id */
    const streakHost = document.getElementById('emp-an-streak');
    if (streakHost) {
      const seed = (typeof cvHash === 'function') ? Math.floor(cvHash(c.id) * 1000) : 0;
      let streak = 0;
      const dots = [];
      for (let d = 6; d >= 0; d--) {
        const ok = ((seed + d * 17) % 100) > 18;   /* ~80% chance of an "on" day */
        dots.push(ok);
      }
      /* count consecutive trailing on-days */
      for (let i = dots.length - 1; i >= 0; i--) {
        if (dots[i]) streak++; else break;
      }
      const dayLabel = ['M','T','W','T','F','S','S'];
      streakHost.innerHTML =
        '<div>' + streak + '-day acknowledgement streak</div>' +
        '<div class="emp-an-streak-s">' +
          (streak >= 5 ? 'Great consistency — your supervisor sees this.' :
           streak >= 2 ? 'Building momentum — keep it going.' :
           'A fresh start today — every acknowledgement counts.') +
        '</div>' +
        '<div class="emp-an-streak-dots">' +
          dots.map(function (on, i) {
            return '<span class="emp-an-streak-dot ' + (on ? 'on' : 'miss') + '">' + dayLabel[i] + '</span>';
          }).join('') +
        '</div>';
    }
  }

  function empRenderIdentity(c) {
    const host = document.getElementById('emp-id-list');
    if (!host) return;
    const rows = [
      ['Worker ID', c.id],
      ['Role', c.role],
      ['Department', c.dept],
      ['Zone', c.zone],
      ['Employment', c.type + (c.contractor ? ' · via ' + c.contractor : '')],
      ['Supervisor', c.sup || '—'],
      ['Language', (typeof chatLang === 'function' ? chatLang(c.lang).glyph + ' ' + chatLang(c.lang).name : c.lang)],
      ['Phone (masked)', c.phone || '—'],
      ['ESIC', '<span class="pill green tiny">Active</span>'],
      ['PF', '<span class="pill green tiny">Linked</span>'],
      ['Induction', '<span class="pill green tiny">Completed</span>']
    ];
    host.innerHTML = rows.map(function (r) {
      return '<div class="emp-id-row"><span class="emp-id-k">' + r[0] + '</span>' +
        '<span class="emp-id-v">' + r[1] + '</span></div>';
    }).join('');
  }

  function initEmpHome() {
    if (!document.getElementById('sec-emp-home')) return;
    empRender();
  }
  __kvOnReady(initEmpHome);

  /* SPA-nav hook — re-render when employee home page is entered */
  (function () {
    if (typeof window === 'undefined') return;
    const origNav = window.nav;
    if (typeof origNav !== 'function') return;
    window.nav = function (id, el) {
      origNav(id, el);
      if (id === 'emp-home') initEmpHome();
      if (id === 'ct-home')  initCtHome();
    };
  })();

  /* ════════════════════════════════════════════════════════════════
     CONTRACTOR HOME — the firm-facing surface (sec-ct-home · ct-*).
     Pulls everything Karya Vaani knows about a single contractor
     firm into one place: their compliance score, deployed workforce,
     statutory state, liability exposure, and a chat thread with
     Plant HR / compliance.
     ════════════════════════════════════════════════════════════════ */
  let CT_ACTIVE = null;

  /* synthetic open-action threads per contractor — what Plant HR is
     waiting on from each firm. Tier reuses the chat urgency taxonomy. */
  const CT_ACTIONS = {
    'CT-001': [
      { id: 'CA-101', tier: 'critical', label: 'Critical', subj: 'ESIC shortfall · 4 workers uncovered in May',
        body: 'Your May ESIC challan covers 138 workers — but 142 were deployed. Reconcile the shortfall before 05 Jun or principal-employer liability transfers to Daikin.',
        sla: '5 days', by: 'Priya Menon · HR Operations', at: '24 May 2026 · 11:02 IST', status: 'pending' },
      { id: 'CA-102', tier: 'urgent', label: 'Urgent', subj: 'CLRA licence renewal · expires in 21 days',
        body: 'Your contract-labour licence expires on 11 Jun 2026. Submit the renewal application + worker register by 04 Jun to avoid a deployment freeze.',
        sla: '11 days', by: 'Sundara Vel · Compliance', at: '21 May 2026 · 09:14 IST', status: 'pending' },
      { id: 'CA-103', tier: 'urgent', label: 'Urgent', subj: 'Audit response · customer-audit finding 3',
        body: 'Our June customer audit raised 3 findings on Sri Lakshmi Engg workers. Submit your corrective-action plan in this thread.',
        sla: '7 days', by: 'Anitha Rao · EHS Lead', at: '23 May 2026 · 15:42 IST', status: 'pending' },
    ],
    'CT-002': [
      { id: 'CA-201', tier: 'urgent', label: 'Urgent', subj: 'ESIC pending · 3 new joiners on Day 2 of 3',
        body: 'You added 3 new workers on 24 May. ESIC enrolment is due within 72 hours — please confirm the IP numbers in this thread.',
        sla: '1 day', by: 'Priya Menon · HR Operations', at: '25 May 2026 · 10:18 IST', status: 'pending' },
      { id: 'CA-202', tier: 'advisory', label: 'Advisory', subj: 'Minimum wage revision · 2026',
        body: 'The AP minimum wage notification for 2026 takes effect 01 Jul. Update your wage register and share the revised pay structure.',
        sla: '37 days', by: 'Plant HR', at: '20 May 2026 · 14:00 IST', status: 'pending' },
    ],
    'CT-003': [
      { id: 'CA-301', tier: 'advisory', label: 'Advisory', subj: 'Quarterly review · all-green firm',
        body: 'Your June review is scheduled for 03 Jun 2026 at 11:00. We expect this to be a routine all-green meeting — please confirm attendance.',
        sla: '8 days', by: 'Sundara Vel · Compliance', at: '24 May 2026 · 09:30 IST', status: 'pending' },
    ],
    'CT-004': [
      { id: 'CA-401', tier: 'urgent', label: 'Urgent', subj: 'PF challan reconciliation · April variance',
        body: 'April PF challan shows a ₹12,400 variance against your declared wage bill. Share a corrected challan or wage register entry.',
        sla: '5 days', by: 'Priya Menon · HR Operations', at: '22 May 2026 · 16:08 IST', status: 'pending' },
    ],
    'CT-005': [],
    'CT-006': [
      { id: 'CA-601', tier: 'advisory', label: 'Advisory', subj: 'Safety induction refresh · tool-room workers',
        body: 'Tool-room induction certificates for 4 workers expire in 30 days. Schedule the refresh through the OHS portal.',
        sla: '30 days', by: 'Anitha Rao · EHS Lead', at: '23 May 2026 · 11:45 IST', status: 'pending' },
    ],
    'CT-007': [
      { id: 'CA-701', tier: 'info', label: 'Info', subj: 'Holiday calendar · 2026 H2',
        body: 'The plant holiday calendar for July–December 2026 has been published. Acknowledge so your supervisors can plan shift cover.',
        sla: '14 days', by: 'Plant HR', at: '19 May 2026 · 09:00 IST', status: 'pending' },
    ],
  };

  /* per-contractor chat threads — Plant HR ↔ contractor firm.
     Bot direction here is reversed compared to the worker chat:
     "in" = from Plant HR (left side); "out" = from the contractor (right). */
  const CT_THREADS = {
    'CT-001': { msgs: [
      { id: 'CTM-1', dir: 'in', by: 'Priya Menon · HR Operations', at: 'Today · 09:14',
        body: 'Good morning Rajesh — quick check on the May ESIC challan. We see 138 covered but 142 deployed. Can you reconcile in this thread?' },
      { id: 'CTM-2', dir: 'in', by: 'Priya Menon · HR Operations', at: 'Today · 09:14',
        body: 'Linked the action item CA-101 here. The 5-day SLA closes on 29 May — please share your plan today if possible.' },
    ]},
    'CT-002': { msgs: [
      { id: 'CTM-3', dir: 'in', by: 'Priya Menon · HR Operations', at: 'Yesterday · 17:30',
        body: 'Sandeep — the 3 new joiners we added on 24 May need ESIC IP numbers by tomorrow EOD. Could you share?' },
      { id: 'CTM-4', dir: 'out', by: 'You · Pavan Manpower', at: 'Today · 08:42',
        body: 'On it — collecting from the workers this morning. Will share by 14:00 IST.' },
      { id: 'CTM-5', dir: 'in', by: 'Priya Menon · HR Operations', at: 'Today · 08:45',
        body: 'Perfect, thank you.' },
    ]},
    'CT-003': { msgs: [
      { id: 'CTM-6', dir: 'in', by: 'Sundara Vel · Compliance', at: '2 days ago',
        body: 'Quarterly review on 03 Jun at 11:00 — your shop is in great shape. Please confirm attendance.' },
      { id: 'CTM-7', dir: 'out', by: 'You · Bharat Contractors', at: '2 days ago',
        body: 'Confirmed. Will join with our HR head.' },
    ]},
    'CT-004': { msgs: [
      { id: 'CTM-8', dir: 'in', by: 'Priya Menon · HR Operations', at: 'Today · 11:08',
        body: 'April PF challan has a ₹12,400 variance against your wage bill — could you share a corrected challan or the wage-register entry that explains it?' },
    ]},
    'CT-005': { msgs: [
      { id: 'CTM-9', dir: 'in', by: 'Plant HR', at: 'Last week',
        body: 'All clear from our side this fortnight — let us know if anything comes up at your end.' },
    ]},
    'CT-006': { msgs: [
      { id: 'CTM-10', dir: 'in', by: 'Anitha Rao · EHS Lead', at: 'Today · 11:45',
        body: 'Tool-room induction certificates for 4 of your workers expire in 30 days. Please schedule the refresh through the OHS portal.' },
    ]},
    'CT-007': { msgs: [
      { id: 'CTM-11', dir: 'in', by: 'Plant HR', at: 'Last week',
        body: 'Holiday calendar for July–December 2026 attached. Please ack so we can plan shift cover.' },
    ]},
  };

  /* quick-reply chips offered to the contractor — generic by intent */
  let CT_QUICK = (window.__KVDATA && window.__KVDATA.ctQuick) || [];

  function ctDefault() {
    /* default to the contractor with the most pending actions */
    let pick = null, max = -1;
    Object.keys(CT_ACTIONS).forEach(function (id) {
      const n = (CT_ACTIONS[id] || []).filter(function (a) { return a.status === 'pending'; }).length;
      if (n > max) { max = n; pick = id; }
    });
    return pick || (CONTRACTORS[0] && CONTRACTORS[0].id);
  }

  function ctSetActive(id) {
    CT_ACTIVE = id;
    ctRender();
  }

  /* render the page for the active contractor */
  function ctRender() {
    if (!document.getElementById('sec-ct-home')) return;
    /* populate the picker on first render */
    const sel = document.getElementById('ct-picker-sel');
    if (sel && !sel.options.length) {
      sel.innerHTML = CONTRACTORS.map(function (c) {
        return '<option value="' + c.id + '">' + c.name + ' · ' + c.area + ' · ' + c.deployed + ' workers</option>';
      }).join('');
    }
    if (!CT_ACTIVE) CT_ACTIVE = ctDefault();
    if (sel) sel.value = CT_ACTIVE;

    const c = CONTRACTORS.find(function (x) { return x.id === CT_ACTIVE; });
    if (!c) return;
    const actions = (CT_ACTIONS[CT_ACTIVE] || []).slice();
    const pending = actions.filter(function (a) { return a.status === 'pending'; });

    /* HERO */
    const ini = c.name.split(' ').slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
    document.getElementById('ct-hero-ava').textContent = ini;
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    document.getElementById('ct-hero-greet').textContent = greet + ' ·';
    document.getElementById('ct-hero-name').textContent = c.name;
    document.getElementById('ct-hero-meta').textContent =
      c.area + ' · ' + c.deployed + ' workers deployed · registered ' + c.registered;
    const scoreBand = c.score >= 80 ? 'green' : c.score >= 60 ? 'amber' : 'red';
    const chipsHtml = [
      '<span class="emp-hero-chip">' + c.id + '</span>',
      '<span class="emp-hero-chip ' + (c.clra.cls === 'green' ? '' : 'amber') + '">CLRA · ' + c.clra.label + '</span>',
      '<span class="emp-hero-chip ' + (c.esic.cls === 'green' ? '' : 'amber') + '">ESIC · ' + c.esic.label + '</span>',
      '<span class="emp-hero-chip ' + (c.pf.cls === 'green' ? '' : 'amber') + '">PF · ' + c.pf.label + '</span>',
    ];
    document.getElementById('ct-hero-chips').innerHTML = chipsHtml.join('');
    document.getElementById('ct-hero-num').textContent = c.score;
    document.getElementById('ct-hero-num-sub').textContent =
      pending.length === 0 ? 'No open actions · all clear' :
      pending.length + ' open action' + (pending.length === 1 ? '' : 's') +
        ' awaiting your reply · score is ' +
        (scoreBand === 'green' ? 'on track' : scoreBand === 'amber' ? 'at risk' : 'breached');
    const heroAct = document.getElementById('ct-hero-act');
    if (heroAct) {
      heroAct.textContent = pending.length > 0 ? 'Resolve all (' + pending.length + ')' : 'All caught up ✓';
      heroAct.disabled = pending.length === 0;
      heroAct.style.opacity = pending.length === 0 ? '0.5' : '';
    }

    /* ACTION BANNER */
    const banner = document.getElementById('ct-action');
    if (pending.length > 0) {
      const worst = pending.find(function (a) { return a.tier === 'critical'; }) || pending[0];
      banner.style.display = 'flex';
      banner.innerHTML =
        '<span class="emp-action-ico">!</span>' +
        '<div class="emp-action-main">' +
          '<div class="emp-action-t">' + pending.length + ' open compliance action' +
            (pending.length === 1 ? '' : 's') + ' need' + (pending.length === 1 ? 's' : '') +
            ' your attention</div>' +
          '<div class="emp-action-s">' +
            'Most pressing: "' + worst.subj + '" — SLA ' + worst.sla +
          '</div>' +
        '</div>' +
        '<button class="emp-action-btn" onclick="ctResolveAll()">Resolve all</button>';
    } else {
      banner.style.display = 'none';
    }

    /* KPI STRIP */
    document.getElementById('ct-k-dep').textContent = c.deployed;
    document.getElementById('ct-k-dep-s').textContent = c.area;
    document.getElementById('ct-k-clra').textContent = c.clra.label;
    document.getElementById('ct-k-clra-s').textContent = 'expires ' + (c.clra.expiresOn || '—');
    document.getElementById('ct-k-esic').textContent = c.esic.label;
    document.getElementById('ct-k-esic-s').textContent = c.esic.detail || 'monthly challan';
    /* recolour ESIC by state */
    const esicEl = document.getElementById('ct-k-esic');
    if (esicEl) {
      esicEl.style.color = c.esic.cls === 'green' ? 'var(--green-dk)' :
                           c.esic.cls === 'amber' ? 'var(--amber-dk)' : '#A52A1B';
    }
    document.getElementById('ct-k-open').textContent = pending.length;
    document.getElementById('ct-k-open-s').textContent = pending.length === 0 ?
      'all clear · nothing to do' : 'tap to acknowledge';

    /* PENDING ACTIONS LIST */
    const pendList = document.getElementById('ct-pending-list');
    document.getElementById('ct-pending-cnt').textContent =
      pending.length + ' pending' + (pending.length === 0 ? '' : ' · awaiting reply');
    if (pending.length === 0) {
      pendList.innerHTML = '<div class="emp-msg" style="border-left-color:var(--green);background:#ECF7EE">' +
        '<div class="emp-msg-ico" style="background:var(--green)">✓</div>' +
        '<div class="emp-msg-main">' +
          '<div class="emp-msg-subj">All clear</div>' +
          '<div class="emp-msg-body">No open compliance actions on file. Plant HR will reach out here when something needs your attention.</div>' +
        '</div>' +
      '</div>';
    } else {
      pendList.innerHTML = pending.map(function (a) { return ctRenderActionCard(a); }).join('');
    }

    /* WORKFORCE SUMMARY — derived from CHAT_CONTACTS filtered by this contractor */
    ctRenderWorkforce(c);

    /* LIABILITY EXPOSURE */
    ctRenderLiability(c);

    /* SUBSCORES */
    ctRenderSubscores(c);
    ctRenderTrend(c);

    /* IDENTITY */
    ctRenderIdentity(c);

    /* CHAT */
    ctChatRender();
    ctChatBadge();
  }

  function ctRenderActionCard(a) {
    return '<div class="emp-msg ' + a.tier + '">' +
      '<div class="emp-msg-ico ' + a.tier + '">' + a.tier.charAt(0).toUpperCase() + '</div>' +
      '<div class="emp-msg-main">' +
        '<div class="emp-msg-top">' +
          '<span class="emp-msg-subj">' + a.subj + '</span>' +
          '<span class="emp-msg-tier ' + a.tier + '">' + a.label + '</span>' +
        '</div>' +
        '<div class="emp-msg-body">' + a.body + '</div>' +
        '<div class="emp-msg-foot">' +
          '<span><span class="emp-msg-foot-k">Raised</span> <span class="emp-msg-foot-v">' + a.at + '</span></span>' +
          '<span><span class="emp-msg-foot-k">By</span> <span class="emp-msg-foot-v">' + a.by + '</span></span>' +
          '<span><span class="emp-msg-foot-k">SLA</span> <span class="emp-msg-foot-v">' + a.sla + '</span></span>' +
        '</div>' +
        '<div class="emp-msg-actions">' +
          '<button class="emp-msg-ack" onclick="ctResolveAction(\'' + a.id + '\')">Mark resolved ✓</button>' +
          '<button class="emp-msg-ack outline" onclick="ctChatToggle()">Reply in chat</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function ctResolveAction(actionId) {
    const list = CT_ACTIONS[CT_ACTIVE] || [];
    const a = list.find(function (x) { return x.id === actionId; });
    if (a) {
      a.status = 'resolved';
      if (typeof toast === 'function') toast('Action resolved · Plant HR notified', 'green');
    }
    ctRender();
  }
  function ctResolveAll() {
    const list = CT_ACTIONS[CT_ACTIVE] || [];
    let n = 0;
    list.forEach(function (a) { if (a.status === 'pending') { a.status = 'resolved'; n++; } });
    if (n > 0) {
      if (typeof toast === 'function') toast(n + ' action' + (n === 1 ? '' : 's') + ' resolved', 'green');
    } else {
      if (typeof toast === 'function') toast('Nothing pending — you are all caught up', 'green');
    }
    ctRender();
  }

  function ctRenderWorkforce(c) {
    /* count workers from CHAT_CONTACTS who belong to this contractor */
    const myWorkers = (typeof CHAT_CONTACTS !== 'undefined')
      ? CHAT_CONTACTS.filter(function (w) { return w.contractor === c.name; })
      : [];
    /* derive synthetic statutory states from the firm-level subscores */
    const deployed = c.deployed;
    const esicShortfall = c.esic.cls === 'red' ? 4 : c.esic.cls === 'amber' ? 3 : 0;
    const esicOk = deployed - esicShortfall;
    const clraOk = Math.round(deployed * (c.subscores.clra / 100));
    const clraGap = deployed - clraOk;
    const inductionOk = Math.round(deployed * (c.subscores.safety / 100));
    const inductionGap = deployed - inductionOk;
    const tiles = [
      { v: deployed, k: 'Total deployed', cls: 'green' },
      { v: esicOk, k: 'ESIC covered', cls: esicShortfall === 0 ? 'green' : esicShortfall > 3 ? 'red' : 'amber' },
      { v: esicShortfall, k: 'ESIC gap', cls: esicShortfall === 0 ? 'green' : 'red' },
      { v: clraOk, k: 'On CLRA register', cls: clraGap < 5 ? 'green' : 'amber' },
      { v: inductionOk, k: 'Inducted', cls: inductionGap < 5 ? 'green' : 'amber' },
      { v: c.womenWorkers || 0, k: 'Women workers', cls: 'green' },
    ];
    const host = document.getElementById('ct-wk-list');
    document.getElementById('ct-wk-cnt').textContent =
      deployed + ' workers · ' + myWorkers.length + ' on chat';
    host.innerHTML = '<div class="ct-wk-grid">' +
      tiles.map(function (t) {
        return '<div class="ct-wk-tile ' + t.cls + '">' +
          '<div class="ct-wk-tile-v">' + t.v + '</div>' +
          '<div class="ct-wk-tile-k">' + t.k + '</div>' +
        '</div>';
      }).join('') +
    '</div>';
  }

  function ctRenderLiability(c) {
    const host = document.getElementById('ct-liab-list');
    const li = c.liability || { statutoryLow:0,statutoryMid:0,statutoryHigh:0, operationalDays:0, operationalPerDay:0, customerAudit:0, contractValueRisk:0 };
    const rows = [
      { l: 'Statutory penalty exposure', s: 'Probable range · ₹' + li.statutoryLow + 'L–' + li.statutoryHigh + 'L', v: '₹' + li.statutoryMid + ' L' },
      { l: 'Operational disruption risk', s: li.operationalDays + ' day · ' + li.operationalPerDay + ' L/day estimated impact', v: '₹' + (li.operationalDays * li.operationalPerDay).toFixed(1) + ' L' },
      { l: 'Customer-audit exposure', s: li.customerAudit + ' open finding' + (li.customerAudit === 1 ? '' : 's') + ' on your workers', v: '₹' + (li.customerAudit * 2) + ' L' },
      { l: 'Contract-value at risk', s: 'Portion of your contract subject to deduction if unresolved', v: '₹' + li.contractValueRisk + ' L' },
    ];
    const total = li.statutoryMid + (li.operationalDays * li.operationalPerDay) + (li.customerAudit * 2) + li.contractValueRisk;
    host.innerHTML = rows.map(function (r) {
      return '<div class="ct-liab-row">' +
        '<div><div class="ct-liab-l">' + r.l + '</div><div class="ct-liab-l-s">' + r.s + '</div></div>' +
        '<div class="ct-liab-v">' + r.v + '</div>' +
      '</div>';
    }).join('') +
    '<div class="ct-liab-row total">' +
      '<div class="ct-liab-l">Today\'s total exposure</div>' +
      '<div class="ct-liab-v">₹' + total.toFixed(1) + ' L</div>' +
    '</div>';
  }

  function ctRenderSubscores(c) {
    const host = document.getElementById('ct-subscores');
    const dims = [
      { k: 'CLRA',         v: c.subscores.clra },
      { k: 'ESIC',         v: c.subscores.esic },
      { k: 'PF',           v: c.subscores.pf },
      { k: 'Min wage',     v: c.subscores.minWage },
      { k: 'Migrant cover',v: c.subscores.migrant },
      { k: 'Safety',       v: c.subscores.safety },
    ];
    host.innerHTML = dims.map(function (d) {
      const col = d.v >= 80 ? 'var(--green)' : d.v >= 60 ? 'var(--amber)' : '#C84F3F';
      return '<div class="ct-sub">' +
        '<span class="ct-sub-l">' + d.k + '</span>' +
        '<div class="ct-sub-bar"><div class="ct-sub-bar-fill" style="width:' + d.v + '%;background:' + col + '"></div></div>' +
        '<span class="ct-sub-v">' + d.v + '</span>' +
      '</div>';
    }).join('');
  }
  function ctRenderTrend(c) {
    const host = document.getElementById('ct-trend');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const cls = (c.trend || '').split(',');
    host.innerHTML = cls.map(function (k, i) {
      return '<div class="ct-trend-month">' +
        '<div class="ct-trend-bar ' + (k.trim() || 'amber') + '"></div>' +
        '<div class="ct-trend-lbl">' + months[i] + '</div>' +
      '</div>';
    }).join('');
    const sub = document.getElementById('ct-trend-sub');
    if (sub) {
      const greens = cls.filter(function (x) { return x.trim() === 'green'; }).length;
      const reds   = cls.filter(function (x) { return x.trim() === 'red'; }).length;
      sub.textContent = reds >= 3 ? 'Multiple red months — recurring shortfall pattern flagged for review.' :
                       greens >= 4 ? 'Strong consistency — your firm is performing above the benchmark.' :
                       'Mixed trend — clearing your open actions this month will lift the score.';
    }
  }

  function ctRenderIdentity(c) {
    const host = document.getElementById('ct-id-list');
    const rows = [
      ['Firm ID', c.id],
      ['Name', c.name],
      ['Operating area', c.area],
      ['Registered', c.registered],
      ['PAN', c.panCin || '—'],
      ['GST', c.gst || '—'],
      ['ESIC code', c.esicCode || '—'],
      ['Bank A/c', c.bankAck || '—'],
      ['Avg pay', c.avgPay || '—'],
      ['Compliance lead', c.complianceLead || '—'],
      ['CLRA licence', c.clra.label + ' · expires ' + (c.clra.expiresOn || '—')],
    ];
    host.innerHTML = rows.map(function (r) {
      return '<div class="emp-id-row"><span class="emp-id-k">' + r[0] + '</span>' +
        '<span class="emp-id-v">' + r[1] + '</span></div>';
    }).join('');
  }

  /* ── contractor chat — popup + thread render ── */
  function ctChatToggle() {
    const pop = document.getElementById('ct-chat-pop');
    const fab = document.getElementById('ct-chat-fab');
    if (!pop || !fab) return;
    const opening = !pop.classList.contains('on');
    pop.classList.toggle('on', opening);
    fab.classList.toggle('on', opening);
    pop.setAttribute('aria-hidden', opening ? 'false' : 'true');
    if (opening) {
      ctChatRender();
      const body = document.getElementById('ct-chat-body');
      if (body) requestAnimationFrame(function () { body.scrollTop = body.scrollHeight; });
      const badge = document.getElementById('ct-chat-fab-badge');
      if (badge) badge.style.display = 'none';
    } else {
      ctChatBadge();
    }
  }

  function ctChatBadge() {
    const badge = document.getElementById('ct-chat-fab-badge');
    const pop = document.getElementById('ct-chat-pop');
    if (!badge) return;
    if (pop && pop.classList.contains('on')) { badge.style.display = 'none'; return; }
    if (!CT_ACTIVE) { badge.style.display = 'none'; return; }
    const pending = (CT_ACTIONS[CT_ACTIVE] || []).filter(function (a) { return a.status === 'pending'; }).length;
    if (pending > 0) {
      badge.textContent = pending;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  function ctChatRender() {
    const body = document.getElementById('ct-chat-body');
    const foot = document.getElementById('ct-chat-foot');
    if (!body || !foot) return;
    if (!CT_ACTIVE) CT_ACTIVE = ctDefault();
    const c = CONTRACTORS.find(function (x) { return x.id === CT_ACTIVE; });
    if (!c) { body.innerHTML = ''; foot.innerHTML = ''; return; }
    const sub = document.getElementById('ct-chat-pop-h-sub');
    if (sub) sub.textContent = c.name + ' · compliance & coordination';

    const thread = CT_THREADS[CT_ACTIVE] || { msgs: [] };
    /* compliance bar at the top */
    const pending = (CT_ACTIONS[CT_ACTIVE] || []).filter(function (a) { return a.status === 'pending'; }).length;
    const resolved = (CT_ACTIONS[CT_ACTIVE] || []).filter(function (a) { return a.status === 'resolved'; }).length;
    const total = pending + resolved;
    const ackPct = total ? Math.round(resolved / total * 100) : 100;
    const statusCls = pending === 0 ? 'green' : ackPct >= 50 ? 'amber' : 'red';

    let html = '';
    if (total > 0) {
      html += '<div class="cv-compliance-bar">' +
        '<div class="cv-compliance-l">' +
          '<span class="cv-compliance-eye">Your action-closure rate · this fortnight</span>' +
          '<span class="cv-compliance-stats">' +
            resolved + ' of ' + total + ' actions resolved · ' +
            pending + ' open' +
          '</span>' +
        '</div>' +
        '<span class="cv-compliance-pill ' + statusCls + '">' +
          (pending === 0 ? 'All clear' : pending + ' open') +
        '</span>' +
      '</div>';
    }
    html += '<div class="cv-day"><span class="cv-day-pill">Conversation with Plant HR</span></div>';
    /* render each bubble — "in" = from Plant HR (white on left), "out" = from contractor (green on right).
       Uses the same .cv-msg / .cv-bub markup as the worker chat so it inherits
       the WhatsApp tail, bubble shadow, time + tick layout and dark-on-light
       contrast that the rest of the platform uses. */
    thread.msgs.forEach(function (m) {
      if (m.dir === 'in') {
        html += '<div class="cv-msg in">' +
          '<div class="cv-bub">' +
            '<div class="cv-bub-from">' + m.by + '</div>' +
            '<div class="cv-bub-text">' + m.body + '</div>' +
            '<div class="cv-bub-foot">' +
              '<span class="cv-bub-time">' + m.at + '</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      } else {
        html += '<div class="cv-msg out">' +
          '<div class="cv-bub">' +
            '<div class="cv-bub-text">' + m.body + '</div>' +
            '<div class="cv-bub-foot">' +
              '<span class="cv-bub-time">' + m.at + '</span>' +
              '<span class="cv-bub-tick read">✓✓</span>' +
            '</div>' +
          '</div>' +
        '</div>';
      }
    });
    body.innerHTML = html;
    body.scrollTop = body.scrollHeight;

    foot.innerHTML =
      '<div class="cv-quick-row">' +
        CT_QUICK.map(function (q) {
          return '<span class="cv-quick" onclick="ctChatReply(\'' + q.replace(/'/g, "\\'") + '\')">' + q + '</span>';
        }).join('') +
      '</div>' +
      '<div class="cv-compose">' +
        '<div class="cv-compose-in">Type a reply to Plant HR…</div>' +
        '<span class="cv-compose-mic">📎</span>' +
      '</div>';
  }

  function ctChatReply(text) {
    if (!CT_ACTIVE) return;
    if (!CT_THREADS[CT_ACTIVE]) CT_THREADS[CT_ACTIVE] = { msgs: [] };
    const now = new Date();
    const stamp = 'Today · ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const myName = (CONTRACTORS.find(function (x) { return x.id === CT_ACTIVE; }) || {}).name || 'You';
    CT_THREADS[CT_ACTIVE].msgs.push({
      id: 'CTM-' + Date.now(), dir: 'out',
      by: 'You · ' + myName, at: stamp, body: text
    });
    ctChatRender();
    /* simulate Plant HR responding after a brief beat */
    setTimeout(function () {
      CT_THREADS[CT_ACTIVE].msgs.push({
        id: 'CTM-' + (Date.now() + 1), dir: 'in',
        by: 'Priya Menon · HR Operations',
        at: 'Today · ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes() + 1).padStart(2, '0'),
        body: 'Noted, thanks — I will track this. Closing the open action on our end pending your document.'
      });
      ctChatRender();
    }, 900);
  }

  function initCtHome() {
    if (!document.getElementById('sec-ct-home')) return;
    ctRender();
  }
  __kvOnReady(initCtHome);


  /* ════════════════════════════════════════════════════════════════
     TRANSPORT SCHEDULE — engine
     Weekly worker bus plan · 5 buses · 5 zone routes · 2 shifts.
     Publishes the plan and feeds a localised broadcast.
     All state namespaced (TR_STATE / tr*).
     ════════════════════════════════════════════════════════════════ */

  /* five buses, one per zone route. Each route carries its pickup
     points (with the morning-shift arrival time) and shift departures. */
  let TR_ROUTES = (window.__KVDATA && window.__KVDATA.routes) || [];

  const TR_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const TR_STATE = { shift: 'morning' };

  function trShiftLabel() { return TR_STATE.shift === 'morning' ? 'Morning shift' : 'General shift'; }

  /* the week of the published plan */
  function trWeekLabel() {
    const d = new Date();
    const day = d.getDay();
    const mon = new Date(d); mon.setDate(d.getDate() - ((day + 6) % 7));
    const sat = new Date(mon); sat.setDate(mon.getDate() + 5);
    const fmt = function (x) {
      return x.getDate() + ' ' + ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getMonth()];
    };
    return fmt(mon) + ' – ' + fmt(sat) + ' ' + sat.getFullYear();
  }

  function trRenderShiftToggle() {
    const wrap = document.getElementById('tr-shift-toggle');
    if (!wrap) return;
    wrap.innerHTML =
      '<button class="tr-shift-btn ' + (TR_STATE.shift === 'morning' ? 'on' : '') + '" onclick="trSetShift(\'morning\')">Morning shift</button>' +
      '<button class="tr-shift-btn ' + (TR_STATE.shift === 'general' ? 'on' : '') + '" onclick="trSetShift(\'general\')">General shift</button>';
  }

  function trSetShift(s) {
    TR_STATE.shift = s;
    trRenderShiftToggle();
    trRenderWeek();
    trRenderRoutes();
  }

  /* weekly table — every bus runs its own route Mon–Sat; Sat is a
     reduced plan (B3/B5 stood down) to show a realistic weekly variation */
  function trRenderWeek() {
    const head = document.getElementById('tr-week-head');
    const body = document.getElementById('tr-week-body');
    if (!head || !body) return;
    head.innerHTML = '<tr><th>Route</th>' +
      TR_DAYS.map(function (d) { return '<th style="text-align:center">' + d + '</th>'; }).join('') +
      '<th style="text-align:right">' + trShiftLabel() + ' departs</th></tr>';

    body.innerHTML = TR_ROUTES.map(function (r) {
      const dep = r[TR_STATE.shift];
      const cells = TR_DAYS.map(function (d) {
        /* Saturday: B3 and B5 stood down (lighter weekend demand) */
        const running = !(d === 'Sat' && (r.code === 'B3' || r.code === 'B5'));
        if (running) {
          return '<td style="text-align:center">' +
            '<span class="tr-bus" style="background:' + r.colour + '1a;color:' + r.colour + '">' +
            '<span class="tr-bus-dot" style="background:' + r.colour + '">' + r.code + '</span>Running</span></td>';
        }
        return '<td style="text-align:center"><span class="tr-bus off">' +
          '<span class="tr-bus-dot">' + r.code + '</span>Stood down</span></td>';
      }).join('');
      return '<tr>' +
        '<td><span class="t-strong">' + r.route + '</span><div class="t-mute">' + r.zone + '</div></td>' +
        cells +
        '<td style="text-align:right"><span class="mono t-strong">' + dep.board + '</span>' +
        '<div class="t-mute">plant ' + dep.plant + '</div></td>' +
      '</tr>';
    }).join('');
  }

  function trRenderRoutes() {
    const wrap = document.getElementById('tr-route-cards');
    if (!wrap) return;
    wrap.innerHTML = TR_ROUTES.map(function (r) {
      const stops = r.stops.map(function (s, i) {
        const isPlant = i === r.stops.length - 1;
        return '<div class="tr-stop">' +
          '<span class="tr-stop-pin">' + (isPlant ? '◉' : '○') + '</span>' +
          '<span>' + s.name + (isPlant ? ' <span class="t-mute">· arrival</span>' : '') + '</span>' +
          '<span class="tr-stop-time">' + s.t + '</span>' +
        '</div>';
      }).join('');
      return '<div class="tr-route">' +
        '<div class="tr-route-h" style="background:' + r.colour + '">' +
          '<span class="tr-route-badge">' + r.code + '</span>' +
          '<div><div class="tr-route-name">' + r.route + '</div>' +
          '<div class="tr-route-sub">Serves ' + r.zone + '</div></div>' +
        '</div>' +
        '<div class="tr-route-body">' +
          '<div class="tr-times">' +
            '<div class="tr-time"><div class="tr-time-eye">Morning · boards</div><div class="tr-time-val">' + r.morning.board + '</div></div>' +
            '<div class="tr-time"><div class="tr-time-eye">General · boards</div><div class="tr-time-val">' + r.general.board + '</div></div>' +
            '<div class="tr-time"><div class="tr-time-eye">Evening drop</div><div class="tr-time-val">' + r.drop + '</div></div>' +
          '</div>' +
          '<div class="tr-stops-label">Pickup points</div>' +
          stops +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* total pickup points across routes (excludes the plant arrival stop) */
  function trPickupCount() {
    return TR_ROUTES.reduce(function (n, r) { return n + r.stops.length - 1; }, 0);
  }

  /* build the worker-facing broadcast message from the live plan */
  function trBroadcastBody() {
    const lines = TR_ROUTES.map(function (r) {
      const firstStop = r.stops[0];
      return r.code + ' · ' + r.route + ' (' + r.zone + '): first pickup ' +
        firstStop.name + ' at ' + r.morning.board + ' for morning shift, ' +
        r.general.board + ' for general shift; reaches the plant by ' + r.morning.plant + '.';
    });
    return 'This week\u2019s worker transport schedule (' + trWeekLabel() + '). ' +
      'Five buses run five zone routes for the morning and general shifts. ' +
      lines.join(' ') +
      ' The evening drop leaves the plant at ' + TR_ROUTES[0].drop + '. ' +
      'On Saturday, Routes 3 and 5 are stood down. ' +
      'Be at your pickup point 5 minutes early — buses do not wait beyond the scheduled minute.';
  }

  /* hand the schedule to the broadcast composer */
  function trBroadcast() {
    if (typeof VB_PRESETS === 'undefined' || typeof nav !== 'function') {
      toast('Broadcast centre unavailable', 'red');
      return;
    }
    /* refresh the transport preset from the live plan */
    VB_PRESETS.transport = {
      subject: 'Weekly transport schedule · ' + trWeekLabel(),
      body: trBroadcastBody()
    };
    if (typeof VB_STATE !== 'undefined') {
      VB_STATE.preset = 'transport';
      VB_STATE.subject = VB_PRESETS.transport.subject;
      VB_STATE.source = VB_PRESETS.transport.body;
      VB_STATE.translations = null;
    }
    /* navigate to the broadcast section */
    const navItem = document.querySelector('#grp-engines .sb-item');
    nav('vaani-broadcast', navItem);
    /* load the schedule into the composer */
    setTimeout(function () {
      const sel = document.getElementById('vb-preset');
      if (sel) sel.value = 'transport';
      const subj = document.getElementById('vb-subject');
      if (subj) subj.value = VB_PRESETS.transport.subject;
      const src = document.getElementById('vb-source');
      if (src) src.value = VB_PRESETS.transport.body;
      const hint = document.getElementById('vb-template-hint');
      if (hint) hint.textContent = 'Loaded from Transport Schedule · this week\u2019s plan · review, then translate.';
      if (typeof vbMarkDirty === 'function') vbMarkDirty();
      if (typeof vbGoStep === 'function') vbGoStep(0);
      toast('Weekly transport schedule loaded into the broadcast composer', 'green');
    }, 60);
  }

  function trPrint() {
    toast('Weekly transport plan exported · ' + trWeekLabel(), 'green');
  }

  function initTr() {
    if (!document.getElementById('tr-week-table')) return;
    document.getElementById('tr-kpi-pickups').textContent = trPickupCount();
    (function(){ var b = document.getElementById('tr-kpi-buses'); if (b) b.textContent = TR_ROUTES.length; })();
    document.getElementById('tr-kpi-week').textContent = trWeekLabel();
    trRenderShiftToggle();
    trRenderWeek();
    trRenderRoutes();
    const note = document.getElementById('tr-shift-note');
    if (note) note.innerHTML = '<strong>Plan note.</strong> Each of the five buses runs a fixed zone route for the whole week. Morning-shift buses board first and reach the plant by 06:45; general-shift buses board two hours later. The evening drop leaves the plant at 15:45. Saturday runs a reduced plan — Routes 3 and 5 are stood down for lighter weekend demand.';
    const sub = document.getElementById('tr-shift-sub');
    if (sub) sub.textContent = 'Which bus runs which route, by day — showing ' + trShiftLabel().toLowerCase() + ' departures';
  }
  __kvOnReady(initTr);

  /* ════════════════════════════════════════════════════════════════
     EXECUTIVE DASHBOARD — module health drill-down + bilingual PDF
     Reflects every platform module currently in the solution.
     All state namespaced (DASH_STATE / dash*).
     ════════════════════════════════════════════════════════════════ */

  /* every module currently in the platform, grouped, with drill-down detail.
     nav = the section id to open; group label is shown in the detail panel. */
  let DASH_MODULES = (window.__KVDATA && window.__KVDATA.dashModules) || [];

  const DASH_STATE = { openRow: null };

  function dashStatusPill(m) {
    return '<span class="pill ' + m.tone + '"><span class="dot ' + m.tone + '"></span>' + m.status + '</span>';
  }
  function dashPostureColour(tone) {
    return tone === 'green' ? 'var(--green)' : tone === 'amber' ? 'var(--amber)'
         : tone === 'red' ? 'var(--red)' : 'var(--indigo)';
  }

  function dashRenderModuleHealth() {
    const body = document.getElementById('dash-modhealth-body');
    if (!body) return;
    let html = '';
    DASH_MODULES.forEach(function (m, i) {
      const isOpen = DASH_STATE.openRow === i;
      /* main row */
      html += '<tr class="dash-mh-row ' + (isOpen ? 'open' : '') + '" onclick="dashToggleModule(' + i + ')">' +
        '<td><span class="dash-mh-caret">▶</span></td>' +
        '<td><span class="t-strong">' + m.name + '</span><div class="t-mute">' + m.sub + '</div></td>' +
        '<td>' + dashStatusPill(m) + '</td>' +
        '<td>' + m.open + '</td>' +
        '<td>' + m.sla + '</td>' +
        '<td><div class="bar thin"><span style="width:' + m.posture + '%;background:' + dashPostureColour(m.tone) + '"></span></div></td>' +
      '</tr>';
      /* drill-down detail row */
      if (isOpen) {
        const metrics = m.metrics.map(function (x) {
          return '<div class="dash-mh-metric"><div class="dmh-eye">' + x.eye + '</div>' +
            '<div class="dmh-val">' + x.val + '</div><div class="dmh-sub">' + x.sub + '</div></div>';
        }).join('');
        const signals = m.signals.map(function (s) {
          return '<div class="dash-mh-signal"><span class="dash-mh-signal-dot" style="background:' +
            dashPostureColour(s.tone) + '"></span><span>' + s.text + '</span></div>';
        }).join('');
        html += '<tr class="dash-mh-detail"><td colspan="6"><div class="dash-mh-detail-inner">' +
          '<div class="dash-mh-detail-grid">' + metrics + '</div>' +
          '<div class="dash-mh-signals">' + signals + '</div>' +
          '<div class="dash-mh-detail-foot">' +
            '<span class="tiny muted">' + m.group + ' · posture ' + m.posture + '/100 · ' +
              m.open + ' open · ' + m.sla + ' SLA breach' + (m.sla === 1 ? '' : 'es') + '</span>' +
            '<button class="btn" onclick="event.stopPropagation();dashOpenModule(\'' + m.nav + '\')">Open module →</button>' +
          '</div>' +
        '</div></td></tr>';
      }
    });
    body.innerHTML = html;
  }

  function dashToggleModule(i) {
    DASH_STATE.openRow = (DASH_STATE.openRow === i) ? null : i;
    dashRenderModuleHealth();
  }

  function dashOpenModule(navId) {
    /* find the matching sidebar item and navigate */
    const items = document.querySelectorAll('.sb-item');
    let target = null;
    items.forEach(function (it) {
      const oc = it.getAttribute('onclick') || it.getAttribute('data-onclick') || '';
      if (oc.indexOf("'" + navId + "'") > -1) target = it;
    });
    if (typeof nav === 'function') nav(navId, target);
  }

  /* ── bilingual (English + Hindi) PDF export of module health ──
     Builds a print-ready document and opens the browser print dialog,
     where it can be saved as PDF. Works fully offline. */
  const DASH_HI = {
    title: 'कार्यबल अनुपालन — मॉड्यूल स्वास्थ्य रिपोर्ट',
    sub: 'एकीकृत कार्यबल शासन · रक्षात्मक ऑडिट तत्परता',
    tenant: 'डाइकिन श्रीसिटी · आंध्र प्रदेश',
    colModule: 'मॉड्यूल', colStatus: 'स्थिति', colOpen: 'खुले आइटम',
    colSla: 'SLA उल्लंघन', colPosture: 'स्थिति स्कोर',
    statusMap: {
      'Healthy': 'स्वस्थ', 'Attention': 'ध्यान दें', 'Critical': 'गंभीर',
      'Watch pattern': 'निगरानी', 'On track': 'सही राह पर', 'Published': 'प्रकाशित'
    },
    generated: 'तैयार किया गया', score: 'अनुपालन स्कोर', exposure: 'अनुमानित जोखिम'
  };

  function dashExportPdf() {
    const now = new Date();
    const stamp = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' · ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

    /* one bilingual table row per module */
    const rows = DASH_MODULES.map(function (m) {
      return '<tr>' +
        '<td><strong>' + m.name + '</strong><br><span class="hi">' + m.group + '</span></td>' +
        '<td>' + m.status + '<br><span class="hi">' + (DASH_HI.statusMap[m.status] || m.status) + '</span></td>' +
        '<td class="num">' + m.open + '</td>' +
        '<td class="num">' + m.sla + '</td>' +
        '<td class="num">' + m.posture + '/100</td>' +
      '</tr>';
    }).join('');

    const doc = '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<title>Karya Vaani — Module Health Report</title><style>' +
      'body{font-family:Georgia,serif;color:#1C1E28;margin:38px;}' +
      '.eyebrow{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#8A8578;}' +
      'h1{font-size:21px;margin:4px 0 2px;}' +
      '.hi{color:#6A6458;font-size:11px;}' +
      'h1 .hi{display:block;font-size:14px;font-weight:normal;margin-top:2px;}' +
      '.sub{font-size:12px;color:#4A4640;margin-bottom:2px;}' +
      '.meta{font-size:10px;color:#8A8578;margin:10px 0 18px;border-top:1px solid #DDD;border-bottom:1px solid #DDD;padding:7px 0;}' +
      '.kpis{display:flex;gap:10px;margin-bottom:18px;}' +
      '.kpi{flex:1;border:1px solid #DDD;border-radius:8px;padding:10px 12px;}' +
      '.kpi .k-eye{font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:#8A8578;}' +
      '.kpi .k-eye .hi{display:block;}' +
      '.kpi .k-val{font-size:18px;font-weight:bold;margin-top:3px;}' +
      'table{width:100%;border-collapse:collapse;font-size:11px;}' +
      'th{text-align:left;background:#1F2B5C;color:#fff;padding:7px 9px;font-size:10px;}' +
      'th .hi{display:block;color:#C9CEDF;font-weight:normal;}' +
      'td{padding:7px 9px;border-bottom:1px solid #E4E1D8;vertical-align:top;}' +
      'td.num{text-align:center;font-family:monospace;}' +
      'tr:nth-child(even) td{background:#FAF9F6;}' +
      '.foot{margin-top:20px;font-size:9px;color:#8A8578;border-top:1px solid #DDD;padding-top:8px;}' +
      '@media print{body{margin:14mm;}}' +
      '</style></head><body>' +
      '<div class="eyebrow">Daikin Sricity · Karya Vaani</div>' +
      '<h1>Module Health Report<span class="hi">' + DASH_HI.title + '</span></h1>' +
      '<div class="sub">Unified Workforce Governance · Defensible Audit Readiness</div>' +
      '<div class="sub hi">' + DASH_HI.sub + '</div>' +
      '<div class="meta">Tenant: Daikin Sricity · Andhra Pradesh &nbsp;|&nbsp; ' + DASH_HI.tenant +
        ' &nbsp;·&nbsp; Generated / ' + DASH_HI.generated + ': ' + stamp + '</div>' +
      '<div class="kpis">' +
        '<div class="kpi"><div class="k-eye">Compliance score<span class="hi">' + DASH_HI.score + '</span></div><div class="k-val">72 / 100</div></div>' +
        '<div class="kpi"><div class="k-eye">Estimated exposure<span class="hi">' + DASH_HI.exposure + '</span></div><div class="k-val">₹1.4 Cr</div></div>' +
        '<div class="kpi"><div class="k-eye">Open contractor gaps<span class="hi">खुले ठेकेदार अंतराल</span></div><div class="k-val">23</div></div>' +
      '</div>' +
      '<table><thead><tr>' +
        '<th>Module<span class="hi">' + DASH_HI.colModule + '</span></th>' +
        '<th>Status<span class="hi">' + DASH_HI.colStatus + '</span></th>' +
        '<th>Open<span class="hi">' + DASH_HI.colOpen + '</span></th>' +
        '<th>SLA<span class="hi">' + DASH_HI.colSla + '</span></th>' +
        '<th>Posture<span class="hi">' + DASH_HI.colPosture + '</span></th>' +
      '</tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="foot">Karya Vaani · Workforce Compliance Assessment Platform · ' +
        'Bilingual report (English / हिन्दी) · evidence-grade · generated locally.</div>' +
      '<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script>' +
      '</body></html>';

    const w = window.open('', '_blank');
    if (!w) { toast('Allow pop-ups to export the PDF', 'red'); return; }
    w.document.write(doc);
    w.document.close();
    toast('Bilingual module-health PDF ready — use the print dialog to save', 'green');
  }

  function initDash() {
    if (!document.getElementById('dash-modhealth-body')) return;
    dashRenderModuleHealth();
  }
  __kvOnReady(initDash);

  /* ════════════════════════════════════════════════════════════════
     KPI COMPUTATION HELP — explains how each headline KPI is derived,
     with a weighted component drill-down inside the card.
     All state namespaced (DASH_KPI_INFO / dashKpiHelp*).
     ════════════════════════════════════════════════════════════════ */
  const DASH_KPI_INFO = {
    score: {
      title: 'Compliance score · 72 / 100',
      formula: 'score = Σ ( domain posture × enforcement-frequency weight )',
      lead: 'A single posture index blending the four statutory domains, each weighted by how often inspectors actually enforce it. The ▲4 is the movement against the same index last quarter.',
      comps: [
        { w: '34%', l: 'Wages & benefits', s: 'Code on Wages — minimum wage, equal pay, timely payment', v: '81 / 100' },
        { w: '28%', l: 'OHS & factories', s: 'OSH Code & Factories Act — PPE, safety, working conditions', v: '76 / 100' },
        { w: '24%', l: 'Industrial relations', s: 'IR Code — standing orders, contracts, retrenchment', v: '70 / 100' },
        { w: '14%', l: 'Contractor & CLRA', s: 'CLRA & SS Code — licences, ESIC/PF, principal-employer liability', v: '54 / 100' }
      ],
      foot: 'Domain postures roll up from the live module-health signals below. Weights reflect AP enforcement frequency in the current rule bundle (v2026.05.2) and are revised when the bundle updates.'
    },
    exposure: {
      title: 'Estimated exposure · ₹1.4 Cr',
      formula: 'exposure = statutory penalty + operational-stop risk + audit-failure-weighted contract value',
      lead: 'The expected-value financial liability if open gaps go unremedied. ₹1.4 Cr is the weighted mid-point; the ₹0.8–2.3 Cr range spans the low and high enforcement scenarios.',
      comps: [
        { w: '₹0.4–0.9 Cr', l: 'Statutory penalty exposure', s: 's.2(y) wage-restructuring shortfall — the single largest driver', v: 'mid ₹0.62 Cr' },
        { w: '₹0.2–0.7 Cr', l: 'Operational-stop risk', s: 'Probability-weighted cost of a floor stoppage on a Factories Act finding', v: 'mid ₹0.41 Cr' },
        { w: '₹0.2–0.7 Cr', l: 'Customer-audit failure', s: 'Contract value at risk if a customer audit fails, weighted by likelihood', v: 'mid ₹0.37 Cr' }
      ],
      foot: 'Each component is an expected value — potential penalty × probability of enforcement. The largest driver is the s.2(y) wage-definition restructuring pending notification in AP.'
    },
    throughput: {
      title: 'Onboarding throughput · 142 / week',
      formula: 'throughput = direct completions + contract completions, 4-week rolling average',
      lead: 'Workers completing the full onboarding journey — verified, inducted, ready to push to HRIS — per week. ▲18% is the change vs the prior 4-week average.',
      comps: [
        { w: '~38/wk', l: 'Direct employees', s: 'Document verification through induction sign-off', v: '27% of flow' },
        { w: '~104/wk', l: 'Contract workers', s: 'ESIC enrolment, CLRA cover, induction — contractor-supplied', v: '73% of flow' },
        { w: '4-wk', l: 'Rolling window', s: 'Smooths weekly intake spikes for a stable trend', v: 'avg basis' }
      ],
      foot: '"Contract intensity rising" flags that contract completions are growing faster than direct — watch the contractor-ratio limit on the decision builder when it climbs.'
    },
    gaps: {
      title: 'Open contractor gaps · 23',
      formula: 'gaps = count of open compliance items across all engaged contractors',
      lead: 'Every unresolved contractor compliance item across the Contractor Master. Split into 4 critical (block push-to-HRIS or carry joint liability) and 19 advisory (monitor before they escalate). ▼5 is the net change vs last week.',
      comps: [
        { w: '4', l: 'Critical gaps', s: 'ESIC challan shortfalls & lapsed CLRA — principal-employer liability', v: 'block onboarding' },
        { w: '11', l: 'Advisory · licence/challan', s: 'CLRA licences expiring, challan reconciliation pending', v: 'monitor' },
        { w: '8', l: 'Advisory · wage/registration', s: 'Min-wage gaps, migrant registration, equal-pay attestation', v: 'monitor' }
      ],
      foot: 'Critical gaps hard-gate affected workers from push-to-HRIS. Counts roll up live from the Vendor compliance module and update as contractor tasks close.'
    }
  };

  let DASH_KPI_OPEN = null;

  function dashKpiHelp(metric) {
    DASH_KPI_OPEN = (DASH_KPI_OPEN === metric) ? null : metric;
    const host = document.getElementById('dash-kpi-help');
    if (!host) return;
    if (!DASH_KPI_OPEN) { host.style.display = 'none'; host.innerHTML = ''; return; }
    const info = DASH_KPI_INFO[metric];
    if (!info) { host.style.display = 'none'; return; }
    host.innerHTML =
      '<div class="kpi-help-card">' +
        '<div class="kpi-help-h">' +
          '<div><div class="kpi-help-title">' + info.title + '</div>' +
            '<div class="kpi-help-formula">' + info.formula + '</div></div>' +
          '<span class="kpi-help-close" onclick="dashKpiHelp(\'' + metric + '\')">Close ✕</span>' +
        '</div>' +
        '<div class="kpi-help-body">' +
          '<div class="kpi-help-lead">' + info.lead + '</div>' +
          info.comps.map(function (c) {
            return '<div class="kpi-help-comp">' +
              '<span class="kpi-help-comp-w">' + c.w + '</span>' +
              '<div class="kpi-help-comp-main">' +
                '<div class="kpi-help-comp-l">' + c.l + '</div>' +
                '<div class="kpi-help-comp-s">' + c.s + '</div>' +
              '</div>' +
              '<span class="kpi-help-comp-v">' + c.v + '</span>' +
            '</div>';
          }).join('') +
          '<div class="kpi-help-foot">' + info.foot + '</div>' +
        '</div>' +
      '</div>';
    host.style.display = 'block';
    host.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  /* ════════════════════════════════════════════════════════════════
     HIRING COST VS BUDGET — dashboard cost view + drill-down
     Annualised CTC of hires this cycle vs the sanctioned hiring budget.
     Drills into the individual direct employees and contract workers.
     All state namespaced (CV_STATE / cv*).
     ════════════════════════════════════════════════════════════════ */
  const CV_STATE = { open: null };

  /* indicative annual CTC (₹) by worker category — wages + statutory + overhead */
  const CV_CTC = {
    'Unskilled': 218000, 'Semi-skilled': 256000,
    'Skilled': 322000, 'Highly skilled': 418000
  };
  /* direct employees carry a role-based CTC band */
  const CV_ROLE_CTC = {
    'Operator': 372000, 'Quality inspector': 455000,
    'Plant Manager · Section 2': 2120000, 'Engineer · M&E': 920000,
    'EHS Officer': 610000
  };
  function cvDirectCtc(w) { return CV_ROLE_CTC[w.role] || 480000; }

  /* sanctioned annual hiring budget per group (approved figure) */
  const CV_BUDGET = { direct: 4600000, contract: 3400000 };

  function cvFmtL(n) { return '₹' + (Math.round(n / 100000) / 10).toFixed(1) + 'L'; }

  /* resolve the decision ref + position ID a hire maps to.
     Direct employees carry their own posId; contract workers are
     attributed to the requisition that engaged their contractor. */
  function cvReqByPosId(pid) {
    if (typeof REQS === 'undefined') return null;
    return REQS.find(function (r) { return r.id === pid; }) || null;
  }
  function cvReqForContractor(contractor) {
    if (typeof REQS === 'undefined') return null;
    return REQS.find(function (r) {
      return (r.contractors || []).some(function (c) {
        const cn = c.trim().toLowerCase(), q = contractor.trim().toLowerCase();
        return cn === q || cn.indexOf(q) > -1 || q.indexOf(cn) > -1;
      });
    }) || null;
  }

  /* build the two hiring groups with their hires + costs */
  function cvGroups() {
    const direct = (typeof WORKERS !== 'undefined' ? WORKERS : []).map(function (w) {
      const req = cvReqByPosId(w.posId);
      return {
        name: w.name, id: w.id, sub: w.role + ' · ' + (w.posId || ''),
        posId: w.posId || '—', role: w.role,
        knRef: req ? req.knRef : null, ctc: cvDirectCtc(w)
      };
    });
    const contract = (typeof CONTRACT_WORKERS !== 'undefined' ? CONTRACT_WORKERS : []).map(function (w, i) {
      const req = cvReqForContractor(w.contractor);
      return {
        name: w.name, id: 'CW-' + (i + 1),
        sub: w.category + ' · ' + w.contractor,
        category: w.category, contractor: w.contractor,
        posId: req ? req.id : '—', role: req ? req.role : w.category,
        knRef: req ? req.knRef : null,
        ctc: CV_CTC[w.category] || 250000
      };
    });
    const sum = function (arr) { return arr.reduce(function (n, h) { return n + h.ctc; }, 0); };
    return [
      { key: 'direct', label: 'Direct employees', kind: 'direct',
        hires: direct, committed: sum(direct), budget: CV_BUDGET.direct },
      { key: 'contract', label: 'Contract workers', kind: 'contract',
        hires: contract, committed: sum(contract), budget: CV_BUDGET.contract }
    ];
  }

  function cvVarianceCell(g) {
    const diff = g.budget - g.committed;   /* positive = saving, negative = excess */
    if (diff < 0) {
      return '<span class="cv-var-down">▲ ' + cvFmtL(-diff) + ' over</span>';
    }
    if (diff > 0) {
      return '<span class="cv-var-up">▼ ' + cvFmtL(diff) + ' saved</span>';
    }
    return '<span class="cv-var-flat">on budget</span>';
  }

  function cvToggle(key) {
    CV_STATE.open = (CV_STATE.open === key) ? null : key;
    cvRender();
  }

  function cvRender() {
    if (!document.getElementById('cv-grid-body')) return;
    const groups = cvGroups();
    const totalBudget = groups.reduce(function (n, g) { return n + g.budget; }, 0);
    const totalCommitted = groups.reduce(function (n, g) { return n + g.committed; }, 0);
    const totalHc = groups.reduce(function (n, g) { return n + g.hires.length; }, 0);
    const diff = totalBudget - totalCommitted;
    const overall = diff < 0 ? 'over' : diff > 0 ? 'under' : 'on';

    const set = function (id, v) { const e = document.getElementById(id); if (e) e.textContent = v; };
    /* status pill */
    const pill = document.getElementById('cv-status-pill');
    if (pill) {
      pill.className = 'pill ' + (overall === 'over' ? 'red' : overall === 'under' ? 'green' : 'outline');
      pill.textContent = overall === 'over' ? 'Over budget · ' + cvFmtL(-diff)
                       : overall === 'under' ? 'Within budget · ' + cvFmtL(diff) + ' saved'
                       : 'On budget';
    }
    /* KPI strip */
    set('cv-kpi-budget', cvFmtL(totalBudget));
    set('cv-kpi-actual', cvFmtL(totalCommitted));
    set('cv-kpi-actual-sub', Math.round(totalCommitted / totalBudget * 100) + '% of sanctioned budget');
    set('cv-kpi-var-eye', overall === 'over' ? 'Excess over budget' : 'Budget saved');
    const varEl = document.getElementById('cv-kpi-var');
    if (varEl) {
      varEl.textContent = cvFmtL(Math.abs(diff));
      varEl.style.color = overall === 'over' ? 'var(--red-dk)'
                        : overall === 'under' ? 'var(--green-dk)' : 'var(--ink)';
    }
    set('cv-kpi-var-sub', overall === 'over'
      ? 'click to drill into the excess by decision ref'
      : overall === 'under' ? 'headroom remaining against budget' : 'committed cost matches budget');
    /* the variance tile is a drill-down trigger when over budget */
    const varTile = document.getElementById('cv-kpi-var-tile');
    if (varTile) {
      if (overall === 'over') {
        varTile.classList.add('cv-kpi-clickable');
        varTile.onclick = function () { cvToggleExcess(); };
      } else {
        varTile.classList.remove('cv-kpi-clickable');
        varTile.onclick = null;
      }
    }
    set('cv-kpi-hc', totalHc);
    set('cv-kpi-hc-sub', groups[0].hires.length + ' direct · ' + groups[1].hires.length + ' contract');

    /* utilisation bar — committed vs budget; over-spend shown in red beyond 100% */
    const bar = document.getElementById('cv-bar');
    if (bar) {
      if (totalCommitted <= totalBudget) {
        const usedPct = totalCommitted / totalBudget * 100;
        bar.innerHTML =
          '<div class="cv-bar-seg" style="flex:' + usedPct + ';background:var(--indigo)">' +
            (usedPct > 14 ? Math.round(usedPct) + '% committed' : '') + '</div>' +
          '<div class="cv-bar-seg" style="flex:' + (100 - usedPct) +
            ';background:var(--paper-3);color:var(--ink-3)">' +
            (100 - usedPct > 14 ? Math.round(100 - usedPct) + '% available' : '') + '</div>';
      } else {
        /* committed exceeds budget — budget portion + overspend portion */
        const budgetPct = totalBudget / totalCommitted * 100;
        bar.innerHTML =
          '<div class="cv-bar-seg" style="flex:' + budgetPct + ';background:var(--indigo)">' +
            'budget ' + cvFmtL(totalBudget) + '</div>' +
          '<div class="cv-bar-seg" style="flex:' + (100 - budgetPct) +
            ';background:var(--red)">over ' + cvFmtL(totalCommitted - totalBudget) + '</div>';
      }
    }
    const legend = document.getElementById('cv-bar-legend');
    if (legend) {
      legend.innerHTML = overall === 'over'
        ? '<span class="lg"><span class="d" style="background:var(--indigo)"></span>Sanctioned budget</span>' +
          '<span class="lg"><span class="d" style="background:var(--red)"></span>Excess — needs re-approval or trade-off</span>'
        : '<span class="lg"><span class="d" style="background:var(--indigo)"></span>Committed cost</span>' +
          '<span class="lg"><span class="d" style="background:var(--paper-3)"></span>Budget headroom — available to deploy</span>';
    }

    /* per-group table with drill-down */
    const body = document.getElementById('cv-grid-body');
    let html = '';
    groups.forEach(function (g) {
      const open = CV_STATE.open === g.key;
      const avg = g.hires.length ? g.committed / g.hires.length : 0;
      const gDiff = g.budget - g.committed;
      html += '<tr class="cv-row ' + (open ? 'open' : '') + '" onclick="cvToggle(\'' + g.key + '\')">' +
        '<td><span class="cv-caret">▶</span></td>' +
        '<td><span class="t-strong">' + g.label + '</span></td>' +
        '<td>' + g.hires.length + '</td>' +
        '<td class="mono">' + cvFmtL(avg) + '</td>' +
        '<td class="mono t-strong">' + cvFmtL(g.committed) + '</td>' +
        '<td class="mono">' + cvFmtL(g.budget) + '</td>' +
        '<td>' + cvVarianceCell(g) + '</td>' +
      '</tr>';
      if (open) {
        let inner = '';
        if (g.kind === 'contract') {
          /* break the contract cost down by contractor — with contractor details */
          const byCt = {};
          g.hires.forEach(function (h) {
            const k = h.contractor || 'Unassigned';
            if (!byCt[k]) byCt[k] = [];
            byCt[k].push(h);
          });
          const ctNames = Object.keys(byCt).sort(function (a, b) {
            return byCt[b].reduce(function (n, h) { return n + h.ctc; }, 0) -
                   byCt[a].reduce(function (n, h) { return n + h.ctc; }, 0);
          });
          inner += '<div class="tiny muted" style="margin-bottom:8px">Cost broken down by contractor · ' +
            ctNames.length + ' contractor' + (ctNames.length === 1 ? '' : 's') + '</div>';
          inner += ctNames.map(function (cn) {
            const list = byCt[cn];
            const ctSum = list.reduce(function (n, h) { return n + h.ctc; }, 0);
            const ct = (typeof dirFindContractor === 'function') ? dirFindContractor(cn) : null;
            /* contractor detail line from the Contractor Master */
            const ctMeta = ct
              ? ct.id + ' · ' + ct.area + ' · CLRA ' + ct.clra.label +
                ' · lead ' + ct.complianceLead.split('·')[0].trim()
              : 'Contractor master record not found';
            const scoreCls = ct ? (ct.score >= 80 ? 'green' : ct.score >= 60 ? 'amber' : 'red') : 'outline';
            const scorePill = ct
              ? '<span class="pill ' + scoreCls + ' tiny">Score ' + ct.score + '</span>'
              : '';
            const workerRows = list.slice().sort(function (a, b) { return b.ctc - a.ctc; })
              .map(function (h) {
                const ini = h.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
                return '<div class="cv-hire">' +
                  '<span class="cv-hire-ava contract">' + ini + '</span>' +
                  '<div class="cv-hire-main">' +
                    '<div class="cv-hire-name">' + h.name + '</div>' +
                    '<div class="cv-hire-sub">' + h.id + ' · ' + h.category + '</div>' +
                  '</div>' +
                  '<span class="cv-hire-cost">' + cvFmtL(h.ctc) +
                    '<span style="color:var(--ink-4);font-size:0.66rem"> /yr</span></span>' +
                '</div>';
              }).join('');
            return '<div class="cv-ct">' +
              '<div class="cv-ct-h">' +
                '<div class="cv-ct-id">' +
                  '<span class="cv-ct-name">' + cn + '</span> ' + scorePill +
                  '<div class="cv-ct-meta">' + ctMeta + '</div>' +
                '</div>' +
                '<div class="cv-ct-cost">' + cvFmtL(ctSum) +
                  '<div class="cv-ct-cost-s">' + list.length + ' worker' +
                  (list.length === 1 ? '' : 's') + ' · annual CTC</div></div>' +
              '</div>' +
              workerRows +
            '</div>';
          }).join('');
        } else {
          /* direct employees — flat list, highest CTC first */
          inner = '<div class="tiny muted" style="margin-bottom:6px">Hires in this group · highest CTC first</div>' +
            g.hires.slice().sort(function (a, b) { return b.ctc - a.ctc; })
            .map(function (h) {
              const initials = h.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
              return '<div class="cv-hire">' +
                '<span class="cv-hire-ava">' + initials + '</span>' +
                '<div class="cv-hire-main">' +
                  '<div class="cv-hire-name">' + h.name + '</div>' +
                  '<div class="cv-hire-sub">' + h.id + ' · ' + h.sub + '</div>' +
                '</div>' +
                '<span class="cv-hire-cost">' + cvFmtL(h.ctc) +
                  '<span style="color:var(--ink-4);font-size:0.66rem"> /yr</span></span>' +
              '</div>';
            }).join('');
        }
        /* over / saved note for this group */
        let note;
        if (gDiff < 0) {
          note = '<div class="cv-detail-note note red"><strong>Excess of ' + cvFmtL(-gDiff) +
            '.</strong> The ' + g.hires.length + ' ' + g.label.toLowerCase() +
            ' hired commit ' + cvFmtL(g.committed) + ' against a sanctioned ' + cvFmtL(g.budget) +
            '. Re-approve the budget, defer lower-priority hires, or shift roles to a lower-cost structure in the decision builder.</div>';
        } else if (gDiff > 0) {
          note = '<div class="cv-detail-note note green"><strong>' + cvFmtL(gDiff) +
            ' saved.</strong> The ' + g.hires.length + ' ' + g.label.toLowerCase() +
            ' hired commit ' + cvFmtL(g.committed) + ' against a sanctioned ' + cvFmtL(g.budget) +
            ' — headroom is available for further approved hires in this cycle.</div>';
        } else {
          note = '<div class="cv-detail-note note"><strong>On budget.</strong> Committed cost matches the sanctioned budget exactly.</div>';
        }
        html += '<tr class="cv-detail"><td colspan="7"><div class="cv-detail-inner">' +
          inner + note +
        '</div></td></tr>';
      }
    });
    body.innerHTML = html;

    /* keep the excess panel in sync */
    cvRenderExcess(groups, diff, overall);
  }

  /* show / hide the excess-over-budget drill-down */
  function cvToggleExcess() {
    CV_STATE.excessOpen = !CV_STATE.excessOpen;
    cvRender();
  }

  /* drill-down of the excess, grouped by decision ref + position ID */
  function cvRenderExcess(groups, diff, overall) {
    const host = document.getElementById('cv-excess');
    if (!host) return;
    if (overall !== 'over' || !CV_STATE.excessOpen) {
      host.style.display = 'none';
      host.innerHTML = '';
      return;
    }
    const excess = -diff;   /* total amount over budget */

    /* the over-budget groups carry the excess; attribute it proportionally */
    const overGroups = groups.filter(function (g) { return g.committed > g.budget; });

    /* collect every hire from over-budget groups, keyed by decision ref + posId */
    const buckets = {};
    overGroups.forEach(function (g) {
      g.hires.forEach(function (h) {
        const kn = h.knRef || 'Unreferenced';
        const key = kn + '||' + (h.posId || '—');
        if (!buckets[key]) {
          buckets[key] = { knRef: kn, posId: h.posId || '—', role: h.role,
            committed: 0, hires: [] };
        }
        buckets[key].committed += h.ctc;
        buckets[key].hires.push(h);
      });
    });
    /* total committed across over-budget groups — basis for the excess share */
    const overCommitted = overGroups.reduce(function (n, g) { return n + g.committed; }, 0);
    const list = Object.keys(buckets).map(function (k) {
      const b = buckets[k];
      b.share = overCommitted ? (b.committed / overCommitted) : 0;
      b.excessShare = excess * b.share;
      return b;
    }).sort(function (a, b) { return b.excessShare - a.excessShare; });

    /* group the buckets under their decision reference */
    const byKn = {};
    list.forEach(function (b) {
      if (!byKn[b.knRef]) byKn[b.knRef] = [];
      byKn[b.knRef].push(b);
    });
    const knOrder = Object.keys(byKn).sort(function (a, b) {
      const sa = byKn[a].reduce(function (n, x) { return n + x.excessShare; }, 0);
      const sb = byKn[b].reduce(function (n, x) { return n + x.excessShare; }, 0);
      return sb - sa;
    });

    let html = '<div class="cv-excess-card">' +
      '<div class="cv-excess-h">' +
        '<div><div class="cv-excess-title">Excess over budget · ' + cvFmtL(excess) + '</div>' +
        '<div class="cv-excess-sub">The overrun attributed across decision references and Position IDs — drill into what drove it</div></div>' +
        '<span class="cv-excess-close" onclick="cvToggleExcess()">Close ✕</span>' +
      '</div>';

    knOrder.forEach(function (kn) {
      const rows = byKn[kn];
      const knExcess = rows.reduce(function (n, x) { return n + x.excessShare; }, 0);
      const knCommitted = rows.reduce(function (n, x) { return n + x.committed; }, 0);
      html += '<div class="cv-ex-kn">' +
        '<div class="cv-ex-kn-h">' +
          '<div>' +
            '<span class="cv-ex-kn-ref">' + (kn === 'Unreferenced'
              ? 'Not referenced to a decision scenario'
              : kn + ' · Karya Nirṇay decision scenario') + '</span>' +
            '<div class="cv-ex-kn-meta">' + rows.length + ' Position ID' +
              (rows.length === 1 ? '' : 's') + ' · ' + cvFmtL(knCommitted) + ' committed</div>' +
          '</div>' +
          '<div class="cv-ex-kn-amt">' + cvFmtL(knExcess) +
            '<div class="cv-ex-kn-amt-s">attributed excess</div></div>' +
        '</div>' +
        rows.map(function (b) {
          const names = b.hires.map(function (h) { return h.name; }).join(', ');
          return '<div class="cv-ex-pos">' +
            '<div class="cv-ex-pos-main">' +
              '<div class="cv-ex-pos-id"><span class="t-id">' + b.posId + '</span> · ' + b.role + '</div>' +
              '<div class="cv-ex-pos-names">' + b.hires.length + ' hire' +
                (b.hires.length === 1 ? '' : 's') + ' · ' + names + '</div>' +
            '</div>' +
            '<div class="cv-ex-pos-cost">' +
              '<span class="cv-ex-pos-committed">' + cvFmtL(b.committed) + ' committed</span>' +
              '<span class="cv-ex-pos-excess">+ ' + cvFmtL(b.excessShare) + ' excess</span>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    });

    html += '<div class="note red" style="margin-top:4px">' +
      '<strong>Excess is attributed by cost share.</strong> Each Position ID carries a portion of the ' +
      cvFmtL(excess) + ' overrun proportional to its committed cost. Re-approve the budget for the ' +
      'highest-excess decision references, or revisit those scenarios in Karya Nirṇay to shift to a lower-cost structure.' +
      '</div>';
    html += '</div>';
    host.innerHTML = html;
    host.style.display = 'block';
  }

  function initCv() {
    if (!document.getElementById('cv-grid-body')) return;
    cvRender();
  }
  __kvOnReady(initCv);

  /* ════════════════════════════════════════════════════════════════
     CAPTURE PERSONAL DETAILS — engine (onboarding · profile-page)
     Single profile + photo + bulk upload + worker confirmation link.
     All state namespaced (CAP_STATE / cap*).
     ════════════════════════════════════════════════════════════════ */
  const CAP_LANGS = [
    { code: 'TE', name: 'Telugu',  glyph: 'తె' },
    { code: 'HI', name: 'Hindi',   glyph: 'हि' },
    { code: 'TA', name: 'Tamil',   glyph: 'த' },
    { code: 'OR', name: 'Odia',    glyph: 'ଓ' },
    { code: 'BN', name: 'Bengali', glyph: 'বা' },
    { code: 'EN', name: 'English', glyph: 'En' }
  ];
  const CAP_PPE_EXTRA = [
    'Face shield', 'Chemical-resistant apron', 'Respirator / mask',
    'Cut-resistant sleeves', 'Welding gauntlets', 'Fall-arrest harness',
    'High-visibility vest', 'Anti-vibration gloves'
  ];

  const CAP_STATE = { mode: 'single', type: 'direct', lang: 'TE', ppe: [], photo: null, recent: [], bulk: [] };

  /* ── mode: single vs bulk ── */
  function capSetMode(m) {
    CAP_STATE.mode = m;
    document.querySelectorAll('#cap-mode .cap-mode-btn').forEach(function (b) {
      b.classList.toggle('on', b.textContent.toLowerCase().indexOf(m) > -1);
    });
    document.getElementById('cap-single').style.display = m === 'single' ? 'block' : 'none';
    document.getElementById('cap-bulk').style.display = m === 'bulk' ? 'block' : 'none';
  }

  /* ── worker type ── */
  function capSetType(t) {
    CAP_STATE.type = t;
    document.querySelectorAll('#cap-type-toggle .cap-type-btn').forEach(function (b) {
      b.classList.toggle('on', b.textContent.toLowerCase().indexOf(t) > -1);
    });
    document.getElementById('cap-emp-title').textContent =
      t === 'direct' ? 'Employment details' : 'Contract engagement details';
    document.querySelectorAll('.cap-only-direct').forEach(function (el) {
      el.style.display = t === 'direct' ? '' : 'none';
    });
    document.querySelectorAll('.cap-only-contract').forEach(function (el) {
      el.style.display = t === 'contract' ? '' : 'none';
    });
    capSync();
  }

  /* ── photo upload ── */
  function capPhoto(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      CAP_STATE.photo = e.target.result;
      const box = document.getElementById('cap-photo-img');
      box.innerHTML = '<img src="' + e.target.result + '" alt="worker photo">';
      capSync();
      toast('Photo added to the profile', 'green');
    };
    reader.readAsDataURL(file);
  }

  /* ── language picker ── */
  function capRenderLangs() {
    const wrap = document.getElementById('cap-lang-grid');
    if (!wrap) return;
    wrap.innerHTML = CAP_LANGS.map(function (l) {
      return '<div class="cap-lang ' + (CAP_STATE.lang === l.code ? 'on' : '') +
        '" onclick="capPickLang(\'' + l.code + '\')">' +
        '<span class="cap-lang-glyph">' + l.glyph + '</span>' + l.name + '</div>';
    }).join('');
  }
  function capPickLang(code) { CAP_STATE.lang = code; capRenderLangs(); capSync(); }

  /* ── role-specific PPE chips ── */
  function capRenderPpe() {
    const wrap = document.getElementById('cap-ppe-extra');
    if (!wrap) return;
    wrap.innerHTML = CAP_PPE_EXTRA.map(function (p) {
      const on = CAP_STATE.ppe.indexOf(p) > -1;
      return '<span class="cs-chip ' + (on ? 'sel' : '') + '" onclick="capTogglePpe(this,\'' +
        p.replace(/'/g, "\\'") + '\')">' + p + '</span>';
    }).join('');
  }
  function capTogglePpe(el, p) {
    const i = CAP_STATE.ppe.indexOf(p);
    if (i > -1) CAP_STATE.ppe.splice(i, 1); else CAP_STATE.ppe.push(p);
    el.classList.toggle('sel');
    capSync();
  }

  function capVal(id) {
    const el = document.getElementById(id);
    return el ? (el.value || '').trim() : '';
  }
  function capLangName(code) {
    const l = CAP_LANGS.find(function (x) { return x.code === (code || CAP_STATE.lang); });
    return l ? l.name : '—';
  }

  /* ── live sidebar: identity + completeness checklist ── */
  function capSync() {
    const name = capVal('cap-name');
    document.getElementById('cap-pside-name').textContent = name || 'New worker';
    const cat = capVal('cap-category');
    document.getElementById('cap-pside-meta').textContent =
      (CAP_STATE.type === 'direct' ? 'Direct employee' : 'Contract worker') +
      (cat ? ' · ' + cat : '');
    function mark(id, ok) {
      const el = document.getElementById(id);
      if (el) { el.textContent = ok ? '✓' : '○'; el.classList.toggle('done', !!ok); }
    }
    mark('cap-st-photo', !!CAP_STATE.photo);
    const personalOk = name && capVal('cap-mobile').replace(/\D/g, '').length >= 10 &&
      capVal('cap-aadhaar').replace(/\D/g, '').length === 12;
    mark('cap-st-personal', personalOk);
    mark('cap-st-lang', !!CAP_STATE.lang);
    const ack = document.getElementById('cap-ppe-ack');
    mark('cap-st-ppe', !!(capVal('cap-uniform') && capVal('cap-shoe') && ack && ack.checked));
    mark('cap-st-confirm', false);  /* confirmation happens after the link is sent */
  }

  /* ── save single profile → send confirmation link ── */
  function capSubmit() {
    const name = capVal('cap-name');
    const mobile = capVal('cap-mobile');
    const aadhaar = capVal('cap-aadhaar');
    if (!name) { toast('Enter the worker\u2019s full name', 'red'); return; }
    if (mobile.replace(/\D/g, '').length < 10) { toast('Enter a valid 10-digit mobile number', 'red'); return; }
    if (aadhaar.replace(/\D/g, '').length !== 12) { toast('Aadhaar must be 12 digits', 'red'); return; }
    if (CAP_STATE.type === 'direct' && !capVal('cap-posid')) {
      toast('Tag this worker to an approved Position ID', 'red'); return;
    }
    if (CAP_STATE.type === 'contract' && !capVal('cap-workorder')) {
      toast('Tag this worker to an approved work order', 'red'); return;
    }
    const ack = document.getElementById('cap-ppe-ack');
    if (!ack || !ack.checked) { toast('Confirm the PPE briefing acknowledgement', 'red'); return; }

    const wid = (CAP_STATE.type === 'direct' ? 'WRK-' : 'CWK-') + Math.floor(2000 + Math.random() * 7999);
    CAP_STATE.recent.unshift({
      id: wid, name: name, type: CAP_STATE.type,
      lang: capLangName(), category: capVal('cap-category') || 'Unskilled',
      photo: CAP_STATE.photo, mobile: mobile, status: 'sent'
    });
    capRenderRecent();
    toast('Profile saved · confirmation link sent to ' + name + ' on WhatsApp (' + capLangName() + ')', 'green');
    /* real WhatsApp confirmation link via the communication gateway */
    if (window.KVWhatsApp && mobile) {
      window.KVWhatsApp.send(mobile,
        'Namaste ' + name + ', please confirm your Karya Vaani worker profile: ' +
        'https://karyavaani.app/confirm/' + wid);
    }
    capReset(true);
  }

  /* ── recently-captured list ── */
  function capRenderRecent() {
    const box = document.getElementById('cap-recent');
    const cnt = document.getElementById('cap-recent-count');
    if (!box) return;
    if (cnt) cnt.textContent = CAP_STATE.recent.length + ' record' + (CAP_STATE.recent.length === 1 ? '' : 's');
    if (!CAP_STATE.recent.length) {
      box.innerHTML = '<div class="tiny muted">No records captured in this session yet.</div>';
      return;
    }
    box.innerHTML = CAP_STATE.recent.slice(0, 10).map(function (r, i) {
      const initials = r.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase();
      const ava = r.photo ? '<img src="' + r.photo + '" alt="">' : initials;
      const confirmed = r.status === 'confirmed';
      return '<div class="cap-recent-row">' +
        '<span class="cap-recent-ava">' + ava + '</span>' +
        '<div class="cap-recent-main">' +
          '<div class="cap-recent-name">' + r.name + ' <span class="pill ' +
            (r.type === 'direct' ? 'green' : 'amber') + ' tiny" style="margin-left:3px">' +
            (r.type === 'direct' ? 'Direct' : 'Contract') + '</span></div>' +
          '<div class="cap-recent-sub">' + r.id + ' · ' + r.category + ' · ' + r.lang + ' · ' +
            (confirmed ? 'confirmed by worker ✓' : 'confirmation link sent · awaiting worker') + '</div>' +
        '</div>' +
        (confirmed
          ? '<span class="pill green tiny">Confirmed</span>'
          : '<span class="cap-recent-link" onclick="capResend(' + i + ')">Resend link</span>') +
      '</div>';
    }).join('');
  }
  function capResend(i) {
    const r = CAP_STATE.recent[i];
    if (!r) return;
    /* demo: a resend marks the profile as confirmed by the worker */
    r.status = 'confirmed';
    capRenderRecent();
    toast(r.name + ' confirmed their profile — record is now push-ready', 'green');
  }

  /* ── clear the single-profile form ── */
  function capReset(keep) {
    ['cap-name','cap-dob','cap-mobile','cap-aadhaar','cap-emergency',
     'cap-addr1','cap-addr2','cap-city','cap-district','cap-pin',
     'cap-spoken','cap-clra','cap-doj'].forEach(function (id) {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    ['cap-posid','cap-workorder'].forEach(function (id) {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    const mig = document.getElementById('cap-migrant'); if (mig) mig.checked = false;
    const ack = document.getElementById('cap-ppe-ack'); if (ack) ack.checked = false;
    CAP_STATE.lang = 'TE';
    CAP_STATE.ppe = [];
    CAP_STATE.photo = null;
    const pi = document.getElementById('cap-photo-img');
    if (pi) pi.innerHTML = '<span class="cap-photo-ph">◍</span>';
    capRenderLangs();
    capRenderPpe();
    capSync();
    if (!keep) toast('Form cleared', 'green');
  }

  /* ════ BULK UPLOAD ════ */
  function capDownloadTemplate() {
    const csv = 'name,type,mobile,aadhaar,language,category,uniform,shoe\n' +
      'Ramesh Naidu,direct,9876543210,123456789012,Telugu,Skilled,L,9\n' +
      'Lalita Devi,contract,9811122233,234567890123,Hindi,Semi-skilled,M,6\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'karya-vaani-worker-upload-template.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    toast('Upload template downloaded', 'green');
  }

  function capBulkFile(ev) {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) { capBulkParse(e.target.result, file.name); };
    reader.readAsText(file);
  }

  /* parse a simple CSV into worker rows */
  function capBulkParse(text, fname) {
    const lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
    if (lines.length < 2) { toast('That file has no worker rows', 'red'); return; }
    const head = lines[0].split(',').map(function (h) { return h.trim().toLowerCase(); });
    const idx = function (k) { return head.indexOf(k); };
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const c = lines[i].split(',');
      rows.push({
        name: (c[idx('name')] || '').trim(),
        type: ((c[idx('type')] || 'direct').trim().toLowerCase() === 'contract') ? 'contract' : 'direct',
        mobile: (c[idx('mobile')] || '').trim(),
        aadhaar: (c[idx('aadhaar')] || '').trim(),
        language: (c[idx('language')] || 'Telugu').trim(),
        category: (c[idx('category')] || 'Unskilled').trim(),
        uniform: (c[idx('uniform')] || '—').trim(),
        shoe: (c[idx('shoe')] || '—').trim()
      });
    }
    capBulkShow(rows, fname || 'uploaded file');
  }

  function capBulkSample() {
    const sample = [
      { name: 'Ramesh Naidu',   type: 'direct',   mobile: '9876543210', aadhaar: '123456789012', language: 'Telugu',  category: 'Skilled',       uniform: 'L', shoe: '9' },
      { name: 'Lalita Devi',    type: 'contract', mobile: '9811122233', aadhaar: '234567890123', language: 'Hindi',   category: 'Semi-skilled',  uniform: 'M', shoe: '6' },
      { name: 'Suresh Kumar',   type: 'direct',   mobile: '9700045566', aadhaar: '345678901234', language: 'Telugu',  category: 'Skilled',       uniform: 'XL', shoe: '10' },
      { name: 'Bharath Singh',  type: 'contract', mobile: '9090909090', aadhaar: '456789012345', language: 'Hindi',   category: 'Unskilled',     uniform: 'L', shoe: '8' },
      { name: 'Anand Mohan',    type: 'direct',   mobile: '9123412345', aadhaar: '567890123456', language: 'Telugu',  category: 'Highly skilled',uniform: 'M', shoe: '7' },
      { name: 'Pooja Reddy',    type: 'contract', mobile: '98',         aadhaar: '678',          language: 'Telugu',  category: 'Semi-skilled',  uniform: 'S', shoe: '5' }
    ];
    capBulkShow(sample, 'sample batch');
  }

  function capBulkRowValid(r) {
    return r.name && r.mobile.replace(/\D/g, '').length >= 10 &&
      r.aadhaar.replace(/\D/g, '').length === 12;
  }

  function capBulkShow(rows, source) {
    CAP_STATE.bulk = rows;
    document.getElementById('cap-bulk-preview-card').style.display = 'block';
    const valid = rows.filter(capBulkRowValid).length;
    document.getElementById('cap-bulk-sub').textContent = 'From ' + source + ' · review before sending links';
    document.getElementById('cap-bulk-count').textContent = valid + ' of ' + rows.length + ' valid';
    document.getElementById('cap-bulk-body').innerHTML = rows.map(function (r) {
      const ok = capBulkRowValid(r);
      const initials = r.name ? r.name.split(' ').map(function (p) { return p[0]; }).join('').slice(0, 2).toUpperCase() : '?';
      return '<tr>' +
        '<td><span class="cap-recent-ava" style="width:24px;height:24px;font-size:0.62rem;display:inline-flex;vertical-align:middle;margin-right:7px">' + initials + '</span>' +
          '<span class="t-strong">' + (r.name || '—') + '</span></td>' +
        '<td><span class="pill ' + (r.type === 'direct' ? 'green' : 'amber') + ' tiny">' +
          (r.type === 'direct' ? 'Direct' : 'Contract') + '</span></td>' +
        '<td class="mono tiny">' + (r.mobile || '—') + '</td>' +
        '<td>' + r.language + '</td>' +
        '<td>' + r.category + '</td>' +
        '<td class="tiny">U:' + r.uniform + ' · S:' + r.shoe + '</td>' +
        '<td>' + (ok
          ? '<span class="pill green tiny">Valid</span>'
          : '<span class="pill red tiny">Check mobile / Aadhaar</span>') + '</td>' +
      '</tr>';
    }).join('');
    const btn = document.getElementById('cap-bulk-send');
    if (btn) btn.disabled = valid === 0;
    document.getElementById('cap-bulk-status').innerHTML =
      '<div class="tiny" style="color:var(--ink-2);line-height:1.6">' + rows.length +
      ' rows parsed · <strong>' + valid + ' valid</strong>' +
      (rows.length - valid ? ' · ' + (rows.length - valid) + ' need correction' : '') +
      '. Ready to send confirmation links.</div>';
  }

  function capBulkSend() {
    const valid = CAP_STATE.bulk.filter(capBulkRowValid);
    if (!valid.length) { toast('No valid rows to send', 'red'); return; }
    valid.forEach(function (r) {
      const wid = (r.type === 'direct' ? 'WRK-' : 'CWK-') + Math.floor(2000 + Math.random() * 7999);
      CAP_STATE.recent.unshift({
        id: wid, name: r.name, type: r.type, lang: r.language,
        category: r.category, photo: null, mobile: r.mobile, status: 'sent'
      });
      /* real WhatsApp confirmation link via the communication gateway */
      if (window.KVWhatsApp && r.mobile) {
        window.KVWhatsApp.send(r.mobile,
          'Namaste ' + r.name + ', please confirm your Karya Vaani worker profile: ' +
          'https://karyavaani.app/confirm/' + wid);
      }
    });
    capRenderRecent();
    document.getElementById('cap-bulk-status').innerHTML =
      '<div class="tiny" style="color:var(--green-dk);font-weight:600">✓ ' + valid.length +
      ' confirmation links sent on WhatsApp</div>' +
      '<div class="tiny muted" style="margin-top:4px">Each worker confirms their own profile in their language. ' +
      'Records become push-ready as confirmations arrive.</div>';
    toast(valid.length + ' confirmation links sent to workers on WhatsApp', 'green');
  }

  /* drag-and-drop on the bulk drop zone */
  function capInitDrop() {
    const drop = document.getElementById('cap-drop');
    if (!drop) return;
    ['dragenter', 'dragover'].forEach(function (e) {
      drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.add('over'); });
    });
    ['dragleave', 'drop'].forEach(function (e) {
      drop.addEventListener(e, function (ev) { ev.preventDefault(); drop.classList.remove('over'); });
    });
    drop.addEventListener('drop', function (ev) {
      const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = function (e) { capBulkParse(e.target.result, f.name); };
      reader.readAsText(f);
    });
  }

  /* ── approved employment records the capture form tags onto ──
     Direct: positions created and approved in Talent Acquisition.
     Contract: work orders created and approved in Vendor compliance. */
  let CAP_POSITIONS = (window.__KVDATA && window.__KVDATA.capturePositions) || [];
  let CAP_WORKORDERS = (window.__KVDATA && window.__KVDATA.captureWorkorders) || [];

  function capPopulateRecords() {
    const pos = document.getElementById('cap-posid');
    if (pos) {
      /* only requisitions approved against their decision-builder scenario
         can be onboarded — pending/rejected requisitions are excluded */
      let approvedReqs = [];
      if (typeof REQS !== 'undefined') {
        approvedReqs = REQS.filter(function (r) { return r.approval === 'approved'; })
          .map(function (r) { return { id: r.id, role: r.role }; });
      }
      /* merge with any CAP_POSITIONS not already covered */
      const seen = {};
      approvedReqs.forEach(function (p) { seen[p.id] = true; });
      CAP_POSITIONS.forEach(function (p) { if (!seen[p.id]) approvedReqs.push(p); });
      pos.innerHTML = '<option value="">Select an approved position…</option>' +
        approvedReqs.map(function (p) {
          return '<option value="' + p.id + '">' + p.id + ' · ' + p.role + '</option>';
        }).join('');
    }
    const wo = document.getElementById('cap-workorder');
    if (wo) wo.innerHTML = '<option value="">Select an approved work order…</option>' +
      CAP_WORKORDERS.map(function (w) {
        return '<option value="' + w.id + '">' + w.id + ' · ' + w.contractor + '</option>';
      }).join('');
    /* note the gating on the form */
    const gate = document.getElementById('cap-approval-note');
    if (gate && typeof REQS !== 'undefined') {
      const pend = REQS.filter(function (r) { return r.approval !== 'approved'; }).length;
      gate.textContent = pend > 0
        ? pend + ' requisition' + (pend === 1 ? '' : 's') + ' pending approval are not available to onboard against — only requisitions approved in the decision builder appear here.'
        : 'All open requisitions are approved and available to onboard against.';
    }
  }

  /* picking an approved position pulls its sanctioned department + category */
  function capPickPosition() {
    const id = capVal('cap-posid');
    const p = CAP_POSITIONS.find(function (x) { return x.id === id; });
    if (!p) return;
    const dept = document.getElementById('cap-dept');
    if (dept) dept.value = p.dept;
    const cat = document.getElementById('cap-category');
    if (cat) cat.value = p.category;
    toast('Tagged to ' + p.id + ' · ' + p.role + ' — department and category pulled from the approved record', 'green');
    capSync();
  }

  /* picking an approved work order pulls its contractor, CLRA and category */
  function capPickWorkorder() {
    const id = capVal('cap-workorder');
    const w = CAP_WORKORDERS.find(function (x) { return x.id === id; });
    if (!w) return;
    const con = document.getElementById('cap-contractor');
    if (con) con.value = w.contractor;
    const clra = document.getElementById('cap-clra');
    if (clra) clra.value = w.clra;
    const cat = document.getElementById('cap-category');
    if (cat) cat.value = w.category;
    toast('Tagged to ' + w.id + ' · ' + w.contractor + ' — contractor and CLRA pulled from the approved record', 'green');
    capSync();
  }

  function initCap() {
    if (!document.getElementById('cap-lang-grid')) return;
    capRenderLangs();
    capRenderPpe();
    capRenderRecent();
    capInitDrop();
    capPopulateRecords();
    capSync();
  }
  __kvOnReady(initCap);

  /* ════════════════════════════════════════════════════════════════
     LABOUR CODE READINESS SURVEY — engine
     9-question pulse survey → scored sector benchmark + gap report.
     All state namespaced (CS_STATE / cs*).
     ════════════════════════════════════════════════════════════════ */
  const CS_STATE = { answers: {}, chips: {} };

  function csUpdateProgress() {
    const required = document.querySelectorAll('#cs-form .cs-q[data-q]');
    let filled = 0;
    required.forEach(function (b) {
      const k = b.getAttribute('data-q');
      const a = CS_STATE.answers[k];
      if (a && (Array.isArray(a) ? a.length > 0 : true)) filled++;
    });
    const total = required.length;
    const pct = Math.round(filled / total * 100);
    const bar = document.getElementById('cs-progress-bar');
    if (bar) bar.style.width = pct + '%';
    const val = document.getElementById('cs-progress-val');
    if (val) val.innerHTML = filled + '<small>/' + total + '</small>';
    const sub = document.getElementById('cs-progress-sub');
    if (sub) sub.textContent = filled === total ? 'ready to submit' : 'questions answered';
  }

  function csRadio(q, el, val) {
    CS_STATE.answers[q] = val;
    const block = el.closest('.cs-q');
    block.querySelectorAll('.cs-radio').forEach(function (c) { c.classList.remove('sel'); });
    el.classList.add('sel');
    block.classList.remove('invalid');
    csUpdateProgress();
  }

  function csScale(q, val, btn) {
    CS_STATE.answers[q] = val;
    const wrap = btn.closest('.cs-scale');
    wrap.querySelectorAll('.cs-scale-btn').forEach(function (b, i) {
      b.classList.toggle('sel', i < val);
    });
    btn.closest('.cs-q').classList.remove('invalid');
    csUpdateProgress();
  }

  function csChip(el, q) {
    el.classList.toggle('sel');
    if (!CS_STATE.chips[q]) CS_STATE.chips[q] = [];
    const val = el.textContent.trim();
    const idx = CS_STATE.chips[q].indexOf(val);
    if (idx > -1) CS_STATE.chips[q].splice(idx, 1);
    else CS_STATE.chips[q].push(val);
    CS_STATE.answers[q] = CS_STATE.chips[q];
    el.closest('.cs-q').classList.remove('invalid');
    csUpdateProgress();
  }

  function csValidate() {
    let valid = true, first = null;
    document.querySelectorAll('#cs-form .cs-q[data-q]').forEach(function (block) {
      const k = block.getAttribute('data-q');
      const a = CS_STATE.answers[k];
      if (!a || (Array.isArray(a) && a.length === 0)) {
        block.classList.add('invalid');
        if (!first) first = block;
        valid = false;
      } else {
        block.classList.remove('invalid');
      }
    });
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return valid;
  }

  /* ── scoring ── */
  function csComputeReadiness() {
    const s = CS_STATE.answers;
    const q4Score = s.q4 ? ((s.q4 - 1) / 4) * 25 : 0;
    const manualCount = Array.isArray(s.q5) ? s.q5.length : 0;
    const q5Score = Math.max(0, 25 - (manualCount / 9) * 25);
    const conseqMap = { none: 20, notice: 8, penalty: 2, dispute: 5, tender: 6, other: 7 };
    const q6Score = conseqMap[s.q6] !== undefined ? conseqMap[s.q6] : 10;
    const procMap = { nocheck: 0, hr: 7, process: 14, system: 20 };
    const q7Score = procMap[s.q7] !== undefined ? procMap[s.q7] : 5;
    const sizeRisk = { u50: 0, '50to99': 1, '100to299': 2, '300to999': 3, '1000to4999': 4, '5000plus': 5 };
    const contractorRisk = { none: 0, u25: 1, '25to50': 2, over50: 3 };
    const exposureRaw = (sizeRisk[s.q2] || 0) * (contractorRisk[s.q3] || 0);
    const exposurePenalty = Math.round(exposureRaw / 15 * 10);
    const raw = q4Score + q5Score + q6Score + q7Score - exposurePenalty;
    return Math.min(95, Math.max(8, Math.round(raw)));
  }

  function csBenchmarks(sector) {
    const b = {
      manufacturing: { avg: 48, top: 74 }, construction: { avg: 38, top: 65 },
      logistics: { avg: 44, top: 70 }, mining: { avg: 42, top: 68 },
      engineering: { avg: 46, top: 72 }, other: { avg: 45, top: 69 }
    };
    return b[sector] || { avg: 45, top: 70 };
  }

  function csGaps() {
    const gaps = [];
    const s = CS_STATE.answers;
    const manual = Array.isArray(s.q5) ? s.q5 : [];
    const hasContractors = s.q3 && s.q3 !== 'none';

    if (hasContractors) {
      if (s.q4 <= 2 || manual.indexOf('ESIC coverage tracking') > -1 || manual.indexOf('EPFO challan verification') > -1) {
        gaps.push('Contractor ESIC/EPFO coverage gap — Social Security Code s.67 joint liability unverified. The principal employer is jointly liable for every contractor worker not correctly enrolled. This is the highest-penalty-exposure gap in your profile.');
      }
      if (manual.indexOf('Contractor licence monitoring') > -1 || s.q3 === 'over50' || s.q3 === '25to50') {
        gaps.push('Contractor licence verification — OSHC 2020 s.41 and CLRA: no system to monitor expiry. An expired contractor licence reverts all liability to you as principal employer immediately, including retrospective wage and benefit obligations.');
      }
      if (manual.indexOf('Inspection readiness documentation') > -1) {
        gaps.push('Inspection readiness gap — 2026 OSHC Rules (G.S.R. 345(E), 8 May 2026) require appointment letters for every worker before work begins. No system to evidence this for contractor workers leaves the PE exposed on every OSHC inspection.');
      }
      if (s.q3 === 'over50') {
        gaps.push('BOCW 30-day seeding window — COSS 2026 Rule 45 (gazetted 8 May 2026) requires Aadhaar + UAN seeding within 30 days of joining for all construction-category workers. A high contractor ratio makes this a high-volume obligation with a hard statutory window.');
      }
    } else {
      if (manual.indexOf('EPFO challan verification') > -1 || s.q4 <= 2) {
        gaps.push('EPFO/ESIC self-verification gap — even with no contractors, direct-employee enrolment and challan reconciliation must be verified monthly. Social Security Code s.22 penalties for under-remittance apply regardless of employer intent.');
      }
      gaps.push('Standing orders recertification — IR Code 2020 s.28 requires all organisations with 300+ workers to resubmit certified standing orders under the new code. Legacy IESO-certified orders are now invalid. This obligation is widely missed.');
    }
    if (manual.indexOf('State gazette monitoring') > -1 || manual.indexOf('Minimum wage compliance check') > -1) {
      gaps.push('State gazette tracking gap — Wages Code 2026 Central Rules (G.S.R. 343(E), 8 May 2026) mandated the monthly÷26 wage formula and twice-annual VDA revision. State-level notifications continue independently. Manual monitoring creates a systematic lag risk.');
    }
    if (s.q7 === 'nocheck' || s.q7 === 'hr') {
      gaps.push('Pre-hire compliance check missing — IR Code threshold crossings (100 workers: standing orders; 300 workers: retrenchment approval) and contractor-ratio limits are not evaluated at decision time. Karya Nirṇay is built specifically for this gap.');
    }
    if (manual.indexOf('Compliance calendar / due dates') > -1) {
      gaps.push('No compliance calendar — statutory due dates for EPFO/ESIC challans, annual returns and the new 2026 BOCW 30-day seeding window are not system-tracked. Manual tracking creates missed-deadline liability.');
    }
    if (s.q9 === 'notaware' || s.q9 === 'partial' || s.q9 === 'aware') {
      gaps.push('DPDP Act 2023 worker-data gap — your organisation processes worker Aadhaar, UAN, wage and biometric data as a data fiduciary. Consent must be obtained in the worker\u2019s language before processing. Maximum breach penalty: ₹250 crore.');
    }
    if (gaps.length === 0) {
      gaps.push('Strong baseline posture detected. Key watch area: 2026 Central Rules (gazetted 8 May 2026) — appointment-letter documentation under OSHC Rule 6 and the monthly÷26 wage formula are new specific obligations most compliant organisations have not yet operationalised.');
    }
    return gaps.slice(0, 4);
  }

  function csInsight() {
    const sector = CS_STATE.answers.q1 || 'manufacturing';
    const insights = {
      manufacturing: 'Across manufacturing organisations surveyed, <strong>contractor ESIC coverage verification was the most cited unresolved gap</strong> — 68% rely on contractor self-declaration rather than direct portal verification. The 2026 Central Rules added three new obligations most manufacturers have not mapped: appointment letters before work begins (OSHC Rule 6), BOCW Aadhaar/UAN seeding within 30 days (COSS Rule 45), and the monthly÷26 wage formula (Wages Code Rule 2).',
      construction:  'In construction, <strong>BOCW 30-day Aadhaar/UAN seeding</strong> under COSS 2026 Rule 45 is the newest and most widely untracked obligation — gazetted 8 May 2026, it requires every construction worker to have their UAN and Aadhaar seeded within 30 days of joining. OSHC 2020 subsumed the Factories Act and Mines Act for welfare provisions; organisations still operating under legacy frameworks are now technically non-compliant.',
      logistics:     'Logistics organisations face a <strong>new gig-worker social-security obligation</strong> under SS Code s.113–114 that most have not assessed. Platform-based delivery and driver engagement carries potential aggregator liability. The 2026 Wages Code Rules clarified that the monthly÷26 formula applies to daily-rate logistics workers — a change affecting most variable-pay logistics payrolls.',
      mining:        'Mining operations run under a <strong>dual compliance framework</strong> — Mines Act provisions continue alongside OSHC 2020, and the boundary between subsumed and continuing provisions is not clearly mapped in most organisations. The 2026 Central Rules added BOCW seeding obligations for civil construction at mining sites — a new obligation most mining HR teams have not connected to their compliance calendar.',
      engineering:   'Engineering services firms with large contractor pools report that <strong>principal-employer liability for wage defaults</strong> is their highest-anxiety risk under Wages Code Rule 11 (2026). The 2026 rules also added an appointment-letter obligation under OSHC Rule 6 — every worker, including contractor workers, must receive a written appointment letter before work begins, with the PE jointly liable if the contractor fails to issue one.',
      other:         'Across non-IT sectors surveyed, <strong>standing orders recertification under IR Code 2020</strong> is the most widely missed obligation — organisations with 300+ workers must resubmit certified standing orders even if existing orders were compliant under the legacy IESO Act. The 2026 Central Rules also introduced the DCLC(C) appellate authority replacing the legacy industrial tribunal for standing-order disputes.'
    };
    return insights[sector] || insights.other;
  }

  /* ── submit → show result ── */
  function csSubmit() {
    if (!document.getElementById('cs-form') || document.getElementById('cs-form').style.display === 'none') return;
    if (!csValidate()) { toast('Please answer all required questions', 'red'); return; }

    const score = csComputeReadiness();
    const sector = CS_STATE.answers.q1 || 'manufacturing';
    const bench = csBenchmarks(sector);
    const gaps = csGaps();

    const sectorNames = {
      manufacturing: 'Manufacturing', construction: 'Construction & infrastructure',
      logistics: 'Logistics & warehousing', mining: 'Mining & natural resources',
      engineering: 'Engineering services', other: 'Other non-IT sector'
    };
    const hcNames = {
      u50: 'under 50', '50to99': '50–99', '100to299': '100–299',
      '300to999': '300–999', '1000to4999': '1,000–4,999', '5000plus': '5,000+'
    };

    document.getElementById('cs-r-title').textContent =
      score >= 65 ? 'Above-average readiness — specific gaps to close'
      : score >= 45 ? 'Moderate readiness — material gaps identified'
      : 'Below-average readiness — priority action needed';
    document.getElementById('cs-r-sub').textContent =
      'Your readiness score is ' + score + '/100 against a sector average of ' + bench.avg +
      '/100. Top-quartile organisations in your sector score ' + bench.top + '/100.';
    document.getElementById('cs-r-sector-label').textContent =
      (sectorNames[sector] || 'Your sector') + ' · ' + (hcNames[CS_STATE.answers.q2] || '') + ' workforce';

    /* KPI bars */
    setTimeout(function () {
      document.getElementById('cs-br-you').style.width = score + '%';
      document.getElementById('cs-br-avg').style.width = bench.avg + '%';
      document.getElementById('cs-br-top').style.width = bench.top + '%';
    }, 80);
    document.getElementById('cs-br-you-pct').innerHTML = score + '<small>/100</small>';
    document.getElementById('cs-br-avg-pct').innerHTML = bench.avg + '<small>/100</small>';
    document.getElementById('cs-br-top-pct').innerHTML = bench.top + '<small>/100</small>';
    const gapToTop = Math.max(0, bench.top - score);
    document.getElementById('cs-br-gap').innerHTML = gapToTop + '<small> pts</small>';
    document.getElementById('cs-br-gap-sub').textContent =
      gapToTop === 0 ? 'already at top quartile' : 'points to close';

    /* gaps */
    document.getElementById('cs-gap-count').textContent = gaps.length + ' gap' + (gaps.length > 1 ? 's' : '');
    document.getElementById('cs-r-gaps').innerHTML = gaps.map(function (g, i) {
      return '<div class="cs-gap" style="animation-delay:' + (i * 0.07) + 's">' +
        '<span class="cs-gap-n">' + (i + 1) + '</span>' +
        '<span class="cs-gap-text">' + g + '</span></div>';
    }).join('');

    document.getElementById('cs-r-insight').innerHTML = csInsight();

    document.getElementById('cs-form').style.display = 'none';
    document.getElementById('cs-result').style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'instant' });
    toast('Benchmark ready · readiness score ' + score + '/100', 'green');

    /* persist this result (date + score on that day) so readiness can be
       tracked day-by-day / month-by-month under Analytics → Readiness trend */
    csSaveSurvey(score, sector, bench, gaps.length);
  }

  /* fire-and-forget save of a completed survey to the backend history */
  function csSaveSurvey(score, sector, bench, gapCount) {
    const s = CS_STATE.answers;
    fetch((window.__KV_API_BASE || '') + '/api/readiness-surveys', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: score,
        sector: sector,
        headcount: s.q2 || null,
        contractorRatio: s.q3 || null,
        gaps: gapCount,
        benchmarkAvg: bench.avg,
        benchmarkTop: bench.top
      })
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (j && j.ok) {
          toast('Readiness check recorded · trend updated', 'green');
          if (typeof initReadinessAnalytics === 'function') initReadinessAnalytics();
        }
      })
      .catch(function () { /* offline / not seeded — history simply not recorded */ });
  }

  /* ── reset / retake ── */
  function csReset() {
    CS_STATE.answers = {};
    CS_STATE.chips = {};
    document.querySelectorAll('#cs-form .cs-radio.sel').forEach(function (c) { c.classList.remove('sel'); });
    document.querySelectorAll('#cs-form .cs-scale-btn.sel').forEach(function (b) { b.classList.remove('sel'); });
    document.querySelectorAll('#cs-form .cs-chip.sel').forEach(function (c) { c.classList.remove('sel'); });
    document.querySelectorAll('#cs-form .cs-q.invalid').forEach(function (b) { b.classList.remove('invalid'); });
    const ta = document.getElementById('cs-q8');
    if (ta) ta.value = '';
    csUpdateProgress();
    const res = document.getElementById('cs-result');
    const form = document.getElementById('cs-form');
    if (res) res.style.display = 'none';
    if (form) form.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function initCs() {
    if (!document.getElementById('cs-form')) return;
    csUpdateProgress();
  }
  __kvOnReady(initCs);
  let OM_MAPPING = [];  /* populated from the backend API (/api/om-mapping) */

  /* ════════════════════════════════════════════════════════════════
     OM MANPOWER · MANAGER MAPPING  — real roster from
     "OM Manpower_Attendance_Mapping Data.ods" (181 contract associates).
     Rendered as a searchable / department-filterable card on the
     Workforce Directory page. All state namespaced (OM_*).
     ════════════════════════════════════════════════════════════════ */
  let OM_QUERY = '';
  let OM_DEPT  = 'all';
  let OM_SORT  = { col: 'code', dir: 1 };   /* dir: 1 asc · -1 desc */
  let OM_PAGE  = 1;
  const OM_PER_PAGE = 10;

  /* sort accessors per column key (matches data-omcol on the headers) */
  const OM_COLS = {
    code:  function (r) { return r.code; },
    name:  function (r) { return (r.name  || '').toLowerCase(); },
    desig: function (r) { return (r.desig || '').toLowerCase(); },
    dept:  function (r) { return (r.dept  || '').toLowerCase(); },
    mgr:   function (r) { return (r.mgr   || '').toLowerCase(); },
    uan:   function (r) { return r.uan; },
    esi:   function (r) { return r.esi; },
    lang:  function (r) { return (r.lang  || '').toLowerCase(); }
  };

  /* filter (search + department) then sort the full roster */
  function omFiltered() {
    const q = OM_QUERY.trim().toLowerCase();
    let rows = OM_MAPPING.filter(function (r) {
      if (OM_DEPT !== 'all' && r.dept !== OM_DEPT) return false;
      if (!q) return true;
      return (r.code + ' ' + r.name + ' ' + r.desig + ' ' + r.dept + ' ' +
              r.mgr + ' ' + r.mgrCode + ' ' + r.uan + ' ' + r.esi + ' ' + r.lang)
              .toLowerCase().indexOf(q) > -1;
    });
    const get = OM_COLS[OM_SORT.col];
    if (get) {
      rows = rows.slice().sort(function (a, b) {
        const va = get(a), vb = get(b);
        if (va < vb) return -OM_SORT.dir;
        if (va > vb) return  OM_SORT.dir;
        return 0;
      });
    }
    return rows;
  }

  /* render a UAN / ESI value as a clickable, verifiable identification cell */
  function omIdCell(kind, val, r) {
    if (!val || val === '—') return '<span style="color:var(--ink-3,#8a8f98)">—</span>';
    const docType = kind === 'UAN' ? 'UAN (EPFO)' : 'ESI (IP number)';
    return kvIdSpan(docType, val, 'OMW-' + r.code, 'associate');
  }

  function omRender() {
    const body = document.getElementById('om-grid-body');
    if (!body) return;
    const rows  = omFiltered();
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / OM_PER_PAGE));
    if (OM_PAGE > pages) OM_PAGE = pages;
    if (OM_PAGE < 1)     OM_PAGE = 1;
    const start    = (OM_PAGE - 1) * OM_PER_PAGE;
    const pageRows = rows.slice(start, start + OM_PER_PAGE);

    body.innerHTML = pageRows.map(function (r) {
      return '<tr>' +
        '<td class="t-strong">' + r.code + '</td>' +
        '<td>' + r.name + '</td>' +
        '<td>' + r.desig + '</td>' +
        '<td>' + r.dept + '</td>' +
        '<td>' + r.mgr + ' <span style="color:var(--ink-3,#8a8f98)">· ' + r.mgrCode + '</span></td>' +
        '<td style="font-variant-numeric:tabular-nums">' + omIdCell('UAN', r.uan, r) + '</td>' +
        '<td style="font-variant-numeric:tabular-nums">' + omIdCell('ESI', r.esi, r) + '</td>' +
        '<td><span class="pill outline">' + r.lang + '</span></td>' +
      '</tr>';
    }).join('');

    const cnt = document.getElementById('om-count');
    if (cnt) cnt.textContent = (OM_QUERY.trim() || OM_DEPT !== 'all')
      ? total + ' of ' + OM_MAPPING.length
      : OM_MAPPING.length + ' associates';
    const nr = document.getElementById('om-noresults');
    if (nr) nr.style.display = total ? 'none' : 'block';

    omRenderSortIndicators();
    omRenderPagination(total, pages, start, pageRows.length);
  }

  /* reflect the active sort column / direction in the header carets */
  function omRenderSortIndicators() {
    const ths = document.querySelectorAll('#om-grid thead th[data-omcol]');
    ths.forEach(function (th) {
      const col = th.getAttribute('data-omcol');
      const car = th.querySelector('.om-caret');
      th.classList.toggle('sorted', col === OM_SORT.col);
      if (car) car.textContent = (col === OM_SORT.col) ? (OM_SORT.dir === 1 ? '▲' : '▼') : '⇅';
    });
  }

  /* paginate · ‹ Prev · windowed page numbers · Next › */
  function omRenderPagination(total, pages, start, shown) {
    const host = document.getElementById('om-pagination');
    if (!host) return;
    if (total === 0) { host.innerHTML = ''; return; }
    const from = start + 1, to = start + shown;
    let nums = '';
    let lo = Math.max(1, OM_PAGE - 2), hi = Math.min(pages, OM_PAGE + 2);
    if (OM_PAGE <= 3)         hi = Math.min(pages, 5);
    if (OM_PAGE >= pages - 2) lo = Math.max(1, pages - 4);
    if (lo > 1) {
      nums += '<button class="om-pg-num" onclick="omGoPage(1)">1</button>';
      if (lo > 2) nums += '<span class="om-pg-gap">…</span>';
    }
    for (let p = lo; p <= hi; p++) {
      nums += '<button class="om-pg-num' + (p === OM_PAGE ? ' on' : '') + '" onclick="omGoPage(' + p + ')">' + p + '</button>';
    }
    if (hi < pages) {
      if (hi < pages - 1) nums += '<span class="om-pg-gap">…</span>';
      nums += '<button class="om-pg-num" onclick="omGoPage(' + pages + ')">' + pages + '</button>';
    }
    host.innerHTML =
      '<div class="om-pg-info">Showing ' + from + '–' + to + ' of ' + total + ' · page ' + OM_PAGE + ' of ' + pages + '</div>' +
      '<div class="om-pg-btns">' +
        '<button class="om-pg-btn" ' + (OM_PAGE <= 1 ? 'disabled' : '') + ' onclick="omGoPage(' + (OM_PAGE - 1) + ')">‹ Prev</button>' +
        nums +
        '<button class="om-pg-btn" ' + (OM_PAGE >= pages ? 'disabled' : '') + ' onclick="omGoPage(' + (OM_PAGE + 1) + ')">Next ›</button>' +
      '</div>';
  }

  function omSort(col) {
    if (!OM_COLS[col]) return;
    if (OM_SORT.col === col) OM_SORT.dir = -OM_SORT.dir;
    else { OM_SORT.col = col; OM_SORT.dir = 1; }
    OM_PAGE = 1;
    omRender();
  }
  function omGoPage(p) { OM_PAGE = p; omRender(); }

  function omSearch() {
    const inp = document.getElementById('om-search');
    OM_QUERY = inp ? inp.value : '';
    const clr = document.getElementById('om-search-clear');
    if (clr) clr.style.display = OM_QUERY.length ? 'inline-flex' : 'none';
    OM_PAGE = 1;
    omRender();
  }
  function omSearchClear() {
    const inp = document.getElementById('om-search');
    if (inp) inp.value = '';
    OM_QUERY = '';
    const clr = document.getElementById('om-search-clear');
    if (clr) clr.style.display = 'none';
    OM_PAGE = 1;
    omRender();
  }
  function omFilterDept(dept, btn) {
    OM_DEPT = dept;
    document.querySelectorAll('#om-filter-dept .dir-fbtn').forEach(function (b) { b.classList.remove('on'); });
    if (btn) btn.classList.add('on');
    OM_PAGE = 1;
    omRender();
  }
  function omComputeKpis() {
    const set = function (id, v) { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('om-kpi-assoc', OM_MAPPING.length);
    set('om-kpi-mgr',   new Set(OM_MAPPING.map(function (r) { return r.mgr; })).size);
    const depts = Array.from(new Set(OM_MAPPING.map(function (r) { return r.dept; }))).filter(Boolean).sort();
    set('om-kpi-dept',  depts.length);
    const dsub = document.getElementById('om-kpi-dept-sub');
    if (dsub) dsub.textContent = depts.length ? depts.join(' · ') : 'no departments';
    set('om-kpi-lang',  new Set(OM_MAPPING.map(function (r) { return r.lang; })).size);
  }
  /* load the roster from the backend API and map it to the render shape */
  function omLoad() {
    const body = document.getElementById('om-grid-body');
    if (!body) return;
    const raw = (window.__KVDATA && window.__KVDATA.omMapping) || [];
    if (!raw.length) {
      OM_MAPPING = [];
      const cnt = document.getElementById('om-count');
      if (cnt) cnt.textContent = 'backend offline';
      body.innerHTML = '<tr><td colspan="8" style="padding:16px;color:var(--red-dk,#b42318)">' +
        'Roster unavailable \u2014 start the backend: ' +
        '<code>cd backend &amp;&amp; npm install &amp;&amp; npm run seed &amp;&amp; npm start</code></td></tr>';
      return;
    }
    OM_MAPPING = raw.map(function (r) {
      return { code: r.code, name: r.name, desig: r.designation, dept: r.department,
               mgr: r.managerName, mgrCode: r.managerCode, uan: r.uan, esi: r.esi, lang: r.language };
    });
    omComputeKpis();
    OM_QUERY = ''; OM_DEPT = 'all';
    OM_SORT = { col: 'code', dir: 1 }; OM_PAGE = 1;
    omRender();
  }
  function initOmMapping() {
    if (!document.getElementById('om-grid-body')) return;
    omLoad();
  }
  __kvOnReady(initOmMapping);

  /* ════════════════════════════════════════════════════════════════
     IDENTITY / STATUTORY DOCUMENT VIEWER
     Click any identification value — PAN / CIN, GST, ESIC employer
     code, UAN, ESI IP number — to open a modal that shows a mock scan
     of the underlying document plus parsed details, then APPROVE or
     REJECT it. Approving a contractor's documents raises that
     contractor's compliance score; rejecting lowers it. The score
     change propagates live to the vendor grid, the drill-downs and the
     directory cards. All state is namespaced KV_DOC_* / KV_BASE_*.
     ════════════════════════════════════════════════════════════════ */
  const KV_DOC_DECISIONS = {};   /* 'entityId::docType' -> 'approved' | 'rejected' */
  const KV_BASE_SCORE    = {};   /* contractor id -> original (pre-verification) score */
  const KV_DOC_POINTS    = { approved: 4, rejected: -8 };
  let   KV_DOC_CTX       = null; /* { docType, value, entityId, kind, name } */

  function kvDocKey(entityId, docType) { return entityId + '::' + docType; }

  /* a clickable, verification-aware identification value */
  function kvIdSpan(docType, value, entityId, kind) {
    if (value == null || value === '' || value === '—') return value || '—';
    const dec = KV_DOC_DECISIONS[kvDocKey(entityId, docType)];
    const badge = dec === 'approved' ? ' <span class="kv-iddot ok" title="Verified">✓</span>'
                : dec === 'rejected' ? ' <span class="kv-iddot bad" title="Rejected">✕</span>' : '';
    const safe = String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return '<span class="kv-idlink" title="Click to verify document" ' +
      'onclick="kvIdDoc(\'' + docType + '\',\'' + safe + '\',\'' + entityId + '\',\'' + (kind || 'contractor') + '\')">' +
      value + '</span>' + badge;
  }

  /* resolve the entity (contractor or roster associate) behind a document */
  function kvDocEntity(entityId, kind) {
    if (kind === 'associate') {
      const code = String(entityId).replace(/^OMW-/, '');
      const r = (OM_MAPPING || []).find(function (x) { return x.code === code; });
      return { id: entityId, name: r ? r.name : code, kind: 'associate', extra: r || { code: code } };
    }
    const list = (typeof CONTRACTORS !== 'undefined') ? CONTRACTORS : [];
    const c = list.find(function (x) { return x.id === entityId; });
    return { id: entityId, name: c ? c.name : entityId, kind: 'contractor', extra: c || null };
  }

  /* document metadata + a mock "scan" for each identification type */
  function kvDocMeta(docType, value, ent) {
    const name = ent.name;
    const t = docType.toLowerCase();
    if (t.indexOf('pan') > -1 || t.indexOf('cin') > -1) {
      return {
        accent: '#4f46e5', emblem: '🏛', issuer: 'Income Tax Department · Government of India',
        title: 'Permanent Account Number',
        fields: [
          { k: 'PAN / CIN', v: value },
          { k: 'Name', v: name },
          { k: 'Category', v: 'Company / Firm' },
          { k: 'Date of incorporation', v: '12 Aug 2019' },
          { k: 'Status', v: 'Active' }
        ],
        note: 'Verified against the Income Tax e-filing PAN database (NSDL).'
      };
    }
    if (t.indexOf('gst') > -1) {
      return {
        accent: '#067647', emblem: '🧾', issuer: 'Goods & Services Tax · Form GST REG-06',
        title: 'GST Registration Certificate',
        fields: [
          { k: 'GSTIN', v: value },
          { k: 'Legal name', v: name },
          { k: 'Constitution', v: 'Private Limited Company' },
          { k: 'State', v: 'Andhra Pradesh (37)' },
          { k: 'Valid from', v: '01 Jul 2019' }
        ],
        note: 'Verified against the GSTN common portal · registration status Active.'
      };
    }
    if (t.indexOf('esic') > -1 || t.indexOf('esi ') > -1 || t === 'esi (ip number)') {
      const isEmployer = t.indexOf('employer') > -1 || t.indexOf('code') > -1;
      return {
        accent: '#0e7490', emblem: '🩺',
        issuer: "Employees' State Insurance Corporation · Ministry of Labour",
        title: isEmployer ? 'ESIC Employer Code Number' : 'ESIC Insured Person (IP) Number',
        fields: isEmployer
          ? [
              { k: 'Employer code', v: value },
              { k: 'Establishment', v: name },
              { k: 'Region', v: 'Andhra Pradesh · Sri City sub-office' },
              { k: 'Coverage from', v: '01 Apr 2019' },
              { k: 'Status', v: 'Active' }
            ]
          : [
              { k: 'IP number', v: value },
              { k: 'Insured person', v: name },
              { k: 'Dispensary', v: 'ESIC Sri City' },
              { k: 'Employer', v: 'OM Manpower Services' },
              { k: 'Status', v: 'Active' }
            ],
        note: 'Verified against the ESIC employer / IP portal.'
      };
    }
    if (t.indexOf('uan') > -1) {
      return {
        accent: '#b54708', emblem: '🏦', issuer: 'EPFO · Universal Account Number',
        title: 'Universal Account Number (UAN)',
        fields: [
          { k: 'UAN', v: value },
          { k: 'Member name', v: name },
          { k: 'Establishment', v: 'OM Manpower Services' },
          { k: 'KYC status', v: 'Aadhaar + PAN seeded' },
          { k: 'Status', v: 'Active' }
        ],
        note: 'Verified against the EPFO member portal · KYC complete.'
      };
    }
    return {
      accent: '#4f46e5', emblem: '📄', issuer: 'Statutory document',
      title: docType,
      fields: [{ k: docType, v: value }, { k: 'Entity', v: name }],
      note: 'Identification document on file.'
    };
  }

  /* the faux scanned document */
  function kvDocMock(meta, value) {
    const rows = meta.fields.map(function (f) {
      return '<div class="iddoc-paper-row"><span class="iddoc-paper-k">' + f.k +
        '</span><span class="iddoc-paper-v">' + f.v + '</span></div>';
    }).join('');
    return '<div class="iddoc-paper" style="--doc-accent:' + meta.accent + '">' +
      '<div class="iddoc-paper-wm">' + meta.emblem + '</div>' +
      '<div class="iddoc-paper-h">' +
        '<span class="iddoc-paper-emblem">' + meta.emblem + '</span>' +
        '<div><div class="iddoc-paper-issuer">' + meta.issuer + '</div>' +
        '<div class="iddoc-paper-title">' + meta.title + '</div></div>' +
      '</div>' +
      '<div class="iddoc-paper-body">' +
        '<div class="iddoc-paper-photo">PHOTO</div>' +
        '<div class="iddoc-paper-fields">' + rows + '</div>' +
      '</div>' +
      '<div class="iddoc-paper-foot"><span class="iddoc-paper-sig">Authorised signatory</span>' +
        '<span class="iddoc-paper-stamp">MOCK · SCANNED COPY</span></div>' +
    '</div>';
  }

  function kvDocModalHtml(meta, decision, ent) {
    const c = (ent.kind === 'contractor') ? ent.extra : null;
    let impact;
    if (c) {
      const base = (KV_BASE_SCORE[ent.id] != null) ? KV_BASE_SCORE[ent.id] : c.score;
      impact =
        '<div class="iddoc-impact">' +
          '<div class="iddoc-impact-h">Compliance impact · ' + ent.name + '</div>' +
          '<div class="iddoc-impact-row"><span>Current score</span><strong>' + c.score + ' / 100</strong></div>' +
          '<div class="iddoc-impact-row"><span>If approved</span><strong style="color:var(--green-dk)">+' + KV_DOC_POINTS.approved + ' pts</strong></div>' +
          '<div class="iddoc-impact-row"><span>If rejected</span><strong style="color:var(--red-dk)">' + KV_DOC_POINTS.rejected + ' pts</strong></div>' +
          '<div class="iddoc-impact-note">Verified statutory documents raise the contractor compliance score; rejected ones lower it. Base score ' + base + '.</div>' +
        '</div>';
    } else {
      impact =
        '<div class="iddoc-impact">' +
          '<div class="iddoc-impact-h">Roster verification · ' + ent.name + '</div>' +
          '<div class="iddoc-impact-note">Approving this identification document marks the associate record as verified in the OM Manpower roster.</div>' +
        '</div>';
    }
    const statusBanner = decision === 'approved'
      ? '<div class="iddoc-status ok">✓ This document has been approved</div>'
      : decision === 'rejected'
      ? '<div class="iddoc-status bad">✕ This document has been rejected</div>'
      : '';
    const fields = meta.fields.map(function (f) {
      return '<div class="compose-row"><span class="ck">' + f.k + '</span><span class="cv">' + f.v + '</span></div>';
    }).join('');
    return '<div class="modal iddoc-modal">' +
      '<div class="modal-h">' +
        '<div class="modal-h-left">' +
          '<span class="modal-h-eye">Document verification</span>' +
          '<span class="modal-h-title">' + meta.title + '</span>' +
        '</div>' +
        '<span class="modal-h-close" onclick="kvDocClose()">Close ✕</span>' +
      '</div>' +
      '<div class="modal-body">' +
        statusBanner +
        '<div class="iddoc-grid">' +
          '<div class="iddoc-col-doc">' + kvDocMock(meta, KV_DOC_CTX.value) + '</div>' +
          '<div class="iddoc-col-info">' +
            '<div class="compose-meta">' + fields + '</div>' +
            '<div class="iddoc-verify-note">' + meta.note + '</div>' +
            impact +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="modal-footer">' +
        '<div class="modal-footer-left"><span class="tiny">Decision is logged to the audit trail and updates the compliance score</span></div>' +
        '<div class="modal-footer-right">' +
          '<button class="btn danger" onclick="kvDocDecide(\'rejected\')">Reject</button>' +
          '<button class="btn primary" onclick="kvDocDecide(\'approved\')">Approve document</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function kvEnsureDocModal() {
    let el = document.getElementById('kv-iddoc-modal');
    if (el) return el;
    el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = 'kv-iddoc-modal';
    el.addEventListener('click', function (e) { if (e.target === el) kvDocClose(); });
    document.body.appendChild(el);
    return el;
  }

  function kvIdDoc(docType, value, entityId, kind) {
    const ent  = kvDocEntity(entityId, kind || 'contractor');
    KV_DOC_CTX = { docType: docType, value: value, entityId: entityId, kind: ent.kind, name: ent.name };
    const meta = kvDocMeta(docType, value, ent);
    const dec  = KV_DOC_DECISIONS[kvDocKey(entityId, docType)] || 'pending';
    const el   = kvEnsureDocModal();
    el.innerHTML = kvDocModalHtml(meta, dec, ent);
    el.classList.add('on');
  }

  function kvDocClose() {
    const el = document.getElementById('kv-iddoc-modal');
    if (el) el.classList.remove('on');
    KV_DOC_CTX = null;
  }

  /* recompute a contractor's score from its base + all document decisions */
  function kvRecomputeScore(entityId) {
    const list = (typeof CONTRACTORS !== 'undefined') ? CONTRACTORS : [];
    const c = list.find(function (x) { return x.id === entityId; });
    if (!c) return;
    if (KV_BASE_SCORE[entityId] == null) KV_BASE_SCORE[entityId] = c.score;
    let delta = 0;
    Object.keys(KV_DOC_DECISIONS).forEach(function (k) {
      if (k.indexOf(entityId + '::') === 0) delta += (KV_DOC_POINTS[KV_DOC_DECISIONS[k]] || 0);
    });
    c.score = Math.max(0, Math.min(100, KV_BASE_SCORE[entityId] + delta));
  }

  /* push an updated score / verification badge to every visible surface */
  function kvDocRefreshSurfaces(entityId) {
    try { if (typeof renderContractorGrid === 'function') renderContractorGrid(); } catch (e) {}
    try {
      const ctDrill = document.getElementById('ct-drill');
      if (ctDrill && ctDrill.classList.contains('on') &&
          typeof SELECTED_CT !== 'undefined' && SELECTED_CT === entityId) {
        const c = CONTRACTORS.find(function (x) { return x.id === entityId; });
        if (c) {
          const num = document.getElementById('ct-ring-num');
          if (num) num.textContent = c.score;
          const ring = document.getElementById('ct-ring-fg');
          if (ring) {
            const circ = 2 * Math.PI * 42;
            ring.setAttribute('stroke-dashoffset', (circ * (1 - c.score / 100)).toFixed(2));
            ring.setAttribute('stroke', colorForScore(c.score));
          }
          renderCtPaneOverview(c);
          renderCtPaneDocs(c);
        }
      }
    } catch (e) {}
    try { if (typeof ctdRender === 'function' && document.getElementById('ctd-grid-body')) ctdRender(); } catch (e) {}
    try { if (typeof dirRender === 'function' && document.getElementById('dir-grid-body')) dirRender(); } catch (e) {}
    try { if (document.getElementById('om-grid-body')) omRender(); } catch (e) {}
  }

  function kvDocDecide(decision) {
    if (!KV_DOC_CTX) return;
    KV_DOC_DECISIONS[kvDocKey(KV_DOC_CTX.entityId, KV_DOC_CTX.docType)] = decision;
    kvRecomputeScore(KV_DOC_CTX.entityId);
    const ctx = KV_DOC_CTX;
    kvDocClose();
    kvDocRefreshSurfaces(ctx.entityId);
    const ent = kvDocEntity(ctx.entityId, ctx.kind);
    let msg = ctx.docType + ' ' + (decision === 'approved' ? 'approved' : 'rejected') + ' · ' + ent.name;
    if (ent.kind === 'contractor' && ent.extra) msg += ' · compliance score ' + ent.extra.score + '/100';
    toast(msg, decision === 'approved' ? 'green' : 'red');
  }

  /* ════════════════════════════════════════════════════════════════════════
     HR DOCUMENTS · APPOINTMENT ORDER GENERATOR
     Form → professionally formatted appointment letter on company letterhead,
     produced client-side as a print-ready A4 PDF via pdfmake (loaded from CDN
     in index.html). Download / Print / Email (existing /api/send-email) / Save
     draft (/api/appointment-orders). Branding lives in the editable
     COMPANY_PROFILE config; standard legal clauses live in AO_CLAUSES — both are
     the single place to customise output, and the structure leaves room for
     future enhancements (multiple templates, per-company branding, bulk runs).
     ════════════════════════════════════════════════════════════════════════ */

  /* ── EDIT ME · company letterhead / branding ──────────────────────────────
     Replace the placeholder values with the real establishment details. `logo`
     may be set to a base64 data-URL (e.g. 'data:image/png;base64,iVBOR…') to
     print a logo image in the header; leave '' for a text-only letterhead. */
  const COMPANY_PROFILE = {
    name:    'Daikin Air-conditioning India Pvt. Ltd.',   // « company legal name »
    address: 'Sri City SEZ, Plot No. 00, Chittoor District, Andhra Pradesh 517646, India', // « registered address »
    cin:     'U00000AP0000PTC000000',                     // « CIN »
    gst:     '37AAAAA0000A1Z5',                            // « GSTIN »
    phone:   '+91 00000 00000',                            // « contact number »
    email:   'hr@example.com',                              // « HR email »
    website: 'www.example.com',                             // « website »
    logo:    '',                                            // « base64 data-URL or '' »
    watermark: ''                                           // e.g. 'ORIGINAL' for a faint watermark, or '' for none
  };

  /* Standard clause text. Functions receive the collected form data so wording
     can adapt; kept here so HR can tune language without touching logic. */
  const AO_CLAUSES = {
    confidentiality: 'You shall maintain strict confidentiality of all proprietary, technical, commercial and personnel information of the Company, both during and after your employment. You shall not disclose or use such information for any purpose other than the discharge of your duties. Any breach may result in disciplinary action and legal proceedings.',
    conduct: 'You shall at all times conduct yourself with integrity and professionalism, comply with the Company’s policies, code of conduct, standing orders and all applicable laws, and devote your full time and attention to the Company’s business. You shall not engage in any other employment, trade or business without the prior written consent of the Company.',
    terminationBody: function (d) {
      const np = d.notice || 'the notice period stipulated in the Company policy';
      return 'This appointment may be terminated by either party by giving ' + np + ' written notice or salary in lieu thereof. The Company reserves the right to terminate your services without notice in the event of misconduct, breach of terms, or unsatisfactory performance, in accordance with the applicable standing orders and law.';
    }
  };

  /* field-id → storage-key map (text/select inputs). Checkboxes handled separately. */
  const AO_FIELDS = [
    ['ao-name','name'], ['ao-dob','dob'], ['ao-parent','parent'], ['ao-gender','gender'],
    ['ao-email','email'], ['ao-mobile','mobile'], ['ao-aadhaar','aadhaar'], ['ao-address','address'],
    ['ao-lin','lin'], ['ao-uan','uan'], ['ao-esic','esic'], ['ao-empid','empid'],
    ['ao-designation','designation'], ['ao-department','department'], ['ao-manager','manager'],
    ['ao-emptype','emptype'], ['ao-skill','skill'],
    ['ao-doj','doj'], ['ao-probation','probation'], ['ao-confirmdate','confirmdate'],
    ['ao-posting','posting'], ['ao-worklocation','worklocation'], ['ao-transferable','transferable'],
    ['ao-basic','basic'], ['ao-da','da'], ['ao-hra','hra'], ['ao-medical','medical'],
    ['ao-travel','travel'], ['ao-special','special'], ['ao-accom','accom'], ['ao-bonus','bonus'],
    ['ao-net','net'], ['ao-freq','freq'],
    ['ao-epfo','epfo'], ['ao-esicapp','esicapp'], ['ao-ptax','ptax'], ['ao-gratuity','gratuity'],
    ['ao-duties','duties'], ['ao-responsibilities','responsibilities'], ['ao-hours','hours'],
    ['ao-weeklyoff','weeklyoff'], ['ao-notice','notice'], ['ao-probationterms','probationterms'], ['ao-leave','leave'],
    ['ao-maternity','maternity'],
    ['ao-additional','additional'], ['ao-special2','special2'], ['ao-other','other'],
    ['ao-signame','signame'], ['ao-sigdesignation','sigdesignation'], ['ao-digsig','digsig']
  ];

  /* required field-id → human label, for validation messaging. */
  const AO_REQUIRED = [
    ['ao-name','Name of Employee'], ['ao-dob','Date of Birth'], ['ao-parent','Father’s / Mother’s Name'],
    ['ao-email','Employee Email'], ['ao-mobile','Mobile Number'], ['ao-lin','LIN of Establishment'],
    ['ao-designation','Designation'], ['ao-department','Department'], ['ao-emptype','Employment Type'],
    ['ao-doj','Date of Joining'], ['ao-basic','Basic Pay'], ['ao-da','Dearness Allowance'],
    ['ao-duties','Broad Nature of Duties']
  ];

  const AO_SALARY_ROWS = [
    ['basic','Basic Pay'], ['da','Dearness Allowance'], ['hra','House Rent Allowance'],
    ['medical','Medical Allowance'], ['travel','Travel Allowance'], ['special','Special Allowance'],
    ['accom','Accommodation'], ['bonus','Bonus']
  ];

  let AO_STATE = { currentId: null, refNo: null };

  function aoEl(id) { return document.getElementById(id); }
  function aoVal(id) { const e = aoEl(id); return e ? String(e.value || '').trim() : ''; }
  function aoNum(v) { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.]/g, '')); return isNaN(n) ? 0 : n; }
  function aoMoney(v) { return 'Rs. ' + Number(aoNum(v)).toLocaleString('en-IN'); }
  function aoEsc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function aoApiBase() { return window.__KV_API_BASE || ''; }

  /* YYYY-MM-DD → "01 Jan 2026"; passes through anything it can't parse. */
  function aoFmtDate(s) {
    if (!s) return '';
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return s;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return m[3] + ' ' + months[parseInt(m[2], 10) - 1] + ' ' + m[1];
  }

  function aoYesNo(v) { return v === 'Yes' ? 'Applicable' : 'Not applicable'; }

  /* ── form markup ──────────────────────────────────────────────────────── */
  function aoFormHtml() {
    return '' +
    '<div class="card">' +
      '<div class="cap-sec-h"><span class="cap-sec-n">1</span> Personal details</div>' +
      '<div class="g3" style="gap:10px 14px">' +
        aoField('Name of Employee', 'ao-name', 'As per records', true) +
        aoField('Date of Birth', 'ao-dob', '', true, 'date') +
        aoField('Father’s / Mother’s Name', 'ao-parent', 'Parent name', true) +
        aoSelect('Gender', 'ao-gender', ['Male','Female','Other','Prefer not to say'], false, 'window.aoToggleMaternity()') +
        aoField('Employee Email', 'ao-email', 'name@example.com', true, 'email') +
        aoField('Mobile Number', 'ao-mobile', '10-digit mobile', true) +
      '</div>' +
      '<div class="field"><label class="cap-check"><input type="checkbox" id="ao-aadhaar-consent" onchange="window.aoToggleAadhaar()"> Employee has provided consent for Aadhaar collection.</label></div>' +
      '<div class="g3" style="gap:10px 14px">' +
        aoField('Aadhaar Number (optional)', 'ao-aadhaar', 'Enabled after consent', false) +
        aoTextarea('Residential Address', 'ao-address', 'House / street / city / state / PIN', 2, 'grid-column:span 2') +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="cap-sec-h"><span class="cap-sec-n">2</span> Employment details</div>' +
      '<div class="g3" style="gap:10px 14px">' +
        aoField('LIN of Establishment', 'ao-lin', 'Labour Identification Number', true) +
        aoField('UAN (optional)', 'ao-uan', 'Universal Account Number') +
        aoField('ESIC Insurance Number (optional)', 'ao-esic', 'ESIC IP number') +
        aoField('Employee ID', 'ao-empid', 'Auto-generated if blank') +
        aoField('Designation', 'ao-designation', 'e.g. Quality Engineer', true) +
        aoField('Department', 'ao-department', 'e.g. Production', true) +
        aoField('Reporting Manager', 'ao-manager', 'Manager name') +
        aoSelect('Employment Type', 'ao-emptype', ['Regular','Fixed-Term Employment','Contractual','Consultant'], true) +
        aoSelect('Skill Category', 'ao-skill', ['Highly Skilled','Skilled','Semi-skilled','Unskilled']) +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="cap-sec-h"><span class="cap-sec-n">3</span> Joining details</div>' +
      '<div class="g3" style="gap:10px 14px">' +
        aoField('Date of Joining', 'ao-doj', '', true, 'date') +
        aoField('Probation Period', 'ao-probation', 'e.g. 6 months') +
        aoField('Confirmation Date', 'ao-confirmdate', '', false, 'date') +
        aoField('Place of Posting', 'ao-posting', 'City / site') +
        aoField('Work Location', 'ao-worklocation', 'Plant / office') +
        aoSelect('Transferable', 'ao-transferable', ['No','Yes']) +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="cap-sec-h"><span class="cap-sec-n">4</span> Salary details</div>' +
      '<div class="g4" style="gap:10px 14px">' +
        aoField('Basic Pay', 'ao-basic', '0', true, 'number', 'window.aoRecalcSalary()') +
        aoField('Dearness Allowance', 'ao-da', '0', true, 'number', 'window.aoRecalcSalary()') +
        aoField('House Rent Allowance', 'ao-hra', '0', false, 'number', 'window.aoRecalcSalary()') +
        aoField('Medical Allowance', 'ao-medical', '0', false, 'number', 'window.aoRecalcSalary()') +
        aoField('Travel Allowance', 'ao-travel', '0', false, 'number', 'window.aoRecalcSalary()') +
        aoField('Special Allowance', 'ao-special', '0', false, 'number', 'window.aoRecalcSalary()') +
        aoField('Accommodation', 'ao-accom', '0', false, 'number', 'window.aoRecalcSalary()') +
        aoField('Bonus', 'ao-bonus', '0', false, 'number', 'window.aoRecalcSalary()') +
        aoField('Gross Salary (auto)', 'ao-gross', '0', false, 'text', null, true) +
        aoField('Net Salary (optional)', 'ao-net', '0', false, 'number') +
        aoSelect('Salary Payment Frequency', 'ao-freq', ['Monthly','Weekly','Daily']) +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="cap-sec-h"><span class="cap-sec-n">5</span> Social security</div>' +
      '<div class="g4" style="gap:10px 14px">' +
        aoSelect('EPFO Applicable', 'ao-epfo', ['Yes','No']) +
        aoSelect('ESIC Applicable', 'ao-esicapp', ['Yes','No']) +
        aoSelect('Professional Tax Applicable', 'ao-ptax', ['Yes','No']) +
        aoSelect('Gratuity Applicable', 'ao-gratuity', ['Yes','No']) +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="cap-sec-h"><span class="cap-sec-n">6</span> Job information</div>' +
      '<div class="g2" style="gap:10px 14px">' +
        aoTextarea('Broad Nature of Duties', 'ao-duties', 'Summary of the role’s scope', 3, 'grid-column:span 2', true) +
        aoTextarea('Job Responsibilities', 'ao-responsibilities', 'Key responsibilities', 3, 'grid-column:span 2') +
        aoField('Working Hours', 'ao-hours', 'e.g. 9:00–17:30, Mon–Sat') +
        aoField('Weekly Off', 'ao-weeklyoff', 'e.g. Sunday') +
        aoField('Notice Period', 'ao-notice', 'e.g. 30 days') +
        aoField('Probation Terms', 'ao-probationterms', 'e.g. confirmation on satisfactory review') +
        aoTextarea('Leave Policy', 'ao-leave', 'Leave entitlement summary', 2, 'grid-column:span 2') +
      '</div>' +
    '</div>' +

    '<div class="card" id="ao-maternity-card" style="display:none">' +
      '<div class="cap-sec-h"><span class="cap-sec-n">7</span> Maternity benefit</div>' +
      '<div class="cap-hint" style="margin-bottom:10px">Visible for female employees. Benefits available under Chapter VI of the Code on Social Security, 2020.</div>' +
      aoTextarea('Maternity benefit details', 'ao-maternity', 'Maternity benefit entitlement under Chapter VI, Social Security Code 2020', 3) +
    '</div>' +

    '<div class="card">' +
      '<div class="cap-sec-h"><span class="cap-sec-n">8</span> Other information</div>' +
      '<div class="g2" style="gap:10px 14px">' +
        aoTextarea('Additional Terms', 'ao-additional', 'Any additional terms', 2, 'grid-column:span 2') +
        aoTextarea('Special Conditions', 'ao-special2', 'Any special conditions', 2, 'grid-column:span 2') +
        aoTextarea('Other Information', 'ao-other', 'Anything else to include', 2, 'grid-column:span 2') +
      '</div>' +
    '</div>' +

    '<div class="card">' +
      '<div class="cap-sec-h"><span class="cap-sec-n">9</span> Employer details</div>' +
      '<div class="g3" style="gap:10px 14px">' +
        aoField('Authorized Signatory Name', 'ao-signame', 'e.g. Head – Human Resources') +
        aoField('Signatory Designation', 'ao-sigdesignation', 'e.g. HR Director') +
        aoField('Digital Signature (typed)', 'ao-digsig', 'Typed name / initials') +
      '</div>' +
      '<div class="field"><label class="cap-check"><input type="checkbox" id="ao-seal"> Affix company seal on the document</label></div>' +
    '</div>';
  }

  function aoField(label, id, ph, req, type, oninput, readonly) {
    return '<div class="field"><label class="field-l">' + label + (req ? ' <span class="cap-req">*</span>' : '') + '</label>' +
      '<input class="input" id="' + id + '" type="' + (type || 'text') + '" placeholder="' + (ph || '') + '"' +
      (oninput ? ' oninput="' + oninput + '"' : '') + (readonly ? ' readonly' : '') + (id === 'ao-aadhaar' ? ' disabled' : '') + '></div>';
  }
  function aoSelect(label, id, opts, req, onchange) {
    return '<div class="field"><label class="field-l">' + label + (req ? ' <span class="cap-req">*</span>' : '') + '</label>' +
      '<select class="sel" id="' + id + '"' + (onchange ? ' onchange="' + onchange + '"' : '') + '>' +
      opts.map(function (o) { return '<option>' + o + '</option>'; }).join('') + '</select></div>';
  }
  function aoTextarea(label, id, ph, rows, style, req) {
    return '<div class="field"' + (style ? ' style="' + style + '"' : '') + '><label class="field-l">' + label + (req ? ' <span class="cap-req">*</span>' : '') + '</label>' +
      '<textarea class="ta" id="' + id + '" rows="' + (rows || 2) + '" placeholder="' + (ph || '') + '"></textarea></div>';
  }

  function aoActionsHtml() {
    return '<div class="card sunken" style="margin-top:4px;display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:space-between">' +
      '<div class="tiny" style="color:var(--ink-2)">Generate the letter, then download, print or email it. Email sends a PDF via the existing service.</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
        '<button class="btn primary" onclick="window.aoGenerate()">Generate Appointment Order</button>' +
        '<button class="btn" onclick="window.aoPreview()">Preview</button>' +
        '<button class="btn" onclick="window.aoDownload()">Download PDF</button>' +
        '<button class="btn" onclick="window.aoPrint()">Print</button>' +
        '<button class="btn" onclick="window.aoSendEmail()">Send Email</button>' +
        '<button class="btn" onclick="window.aoSaveDraft()">Save Draft</button>' +
        '<button class="btn" onclick="window.aoEdit()">Edit</button>' +
        '<button class="btn amber" onclick="window.aoRegenerate()">Regenerate</button>' +
      '</div>' +
    '</div>';
  }

  function initAppointmentOrder() {
    const form = aoEl('ao-form');
    if (!form) return;                 // section not mounted
    if (!form.dataset.built) {
      form.innerHTML = aoFormHtml();
      form.dataset.built = '1';
      const actions = aoEl('ao-actions');
      if (actions) actions.innerHTML = aoActionsHtml();
      aoRecalcSalary();
    }
    aoPopulateRoster();
    aoRenderSaved();
  }

  function aoPopulateRoster() {
    const sel = aoEl('ao-roster');
    if (!sel) return;
    const roster = (window.__KVDATA && window.__KVDATA.omMapping) || [];
    if (sel.dataset.filled || !roster.length) return;
    roster.forEach(function (r) {
      const o = document.createElement('option');
      o.value = r.code || r.name;
      o.textContent = (r.name || '—') + (r.code ? ' · ' + r.code : '');
      sel.appendChild(o);
    });
    sel.dataset.filled = '1';
  }

  function aoLoadFromRoster(code) {
    if (!code) return;
    const roster = (window.__KVDATA && window.__KVDATA.omMapping) || [];
    const r = roster.find(function (x) { return (x.code || x.name) === code; });
    if (!r) return;
    const set = function (id, v) { const e = aoEl(id); if (e && v) e.value = v; };
    set('ao-name', r.name);
    set('ao-designation', r.designation);
    set('ao-department', r.department);
    set('ao-manager', r.managerName);
    set('ao-uan', r.uan);
    set('ao-esic', r.esi);
    set('ao-worklocation', r.location);
    set('ao-posting', r.location);
    set('ao-empid', r.code);
    if (r.esi) { const ea = aoEl('ao-esicapp'); if (ea) ea.value = 'Yes'; }
    toast('Prefilled from roster · ' + (r.name || code), 'green');
  }

  function aoToggleMaternity() {
    const card = aoEl('ao-maternity-card');
    if (card) card.style.display = (aoVal('ao-gender') === 'Female') ? 'block' : 'none';
  }
  function aoToggleAadhaar() {
    const consent = aoEl('ao-aadhaar-consent');
    const field = aoEl('ao-aadhaar');
    if (!field) return;
    field.disabled = !(consent && consent.checked);
    if (field.disabled) field.value = '';
  }
  function aoRecalcSalary() {
    const g = ['ao-basic','ao-da','ao-hra','ao-medical','ao-travel','ao-special','ao-accom','ao-bonus']
      .reduce(function (sum, id) { return sum + aoNum(aoVal(id)); }, 0);
    const gross = aoEl('ao-gross');
    if (gross) gross.value = g ? Number(g).toLocaleString('en-IN') : '';
  }

  function aoReset() {
    const form = aoEl('ao-form');
    if (!form) return;
    AO_FIELDS.forEach(function (f) { const e = aoEl(f[0]); if (e) e.value = ''; });
    ['ao-aadhaar-consent','ao-seal'].forEach(function (id) { const e = aoEl(id); if (e) e.checked = false; });
    const ros = aoEl('ao-roster'); if (ros) ros.value = '';
    AO_STATE = { currentId: null, refNo: null };
    aoToggleAadhaar(); aoToggleMaternity(); aoRecalcSalary();
    const prev = aoEl('ao-preview'); if (prev) prev.innerHTML = '';
    toast('Form cleared', 'green');
  }

  function aoCollect() {
    const d = {};
    AO_FIELDS.forEach(function (f) { d[f[1]] = aoVal(f[0]); });
    const consent = aoEl('ao-aadhaar-consent');
    d.aadhaarConsent = !!(consent && consent.checked);
    if (!d.aadhaarConsent) d.aadhaar = '';     // privacy gate
    const seal = aoEl('ao-seal');
    d.seal = !!(seal && seal.checked);
    d.gross = ['basic','da','hra','medical','travel','special','accom','bonus']
      .reduce(function (s, k) { return s + aoNum(d[k]); }, 0);
    if (AO_STATE.currentId) d.id = AO_STATE.currentId;
    if (AO_STATE.refNo) d.refNo = AO_STATE.refNo;
    return d;
  }

  function aoValidate() {
    const missing = [];
    AO_FIELDS.forEach(function (f) { const e = aoEl(f[0]); if (e) e.style.borderColor = ''; });
    AO_REQUIRED.forEach(function (r) {
      const e = aoEl(r[0]);
      if (!e || !String(e.value || '').trim()) { missing.push(r[1]); if (e) e.style.borderColor = 'var(--red)'; }
    });
    const email = aoVal('ao-email');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { missing.push('valid Employee Email'); const e = aoEl('ao-email'); if (e) e.style.borderColor = 'var(--red)'; }
    const mob = aoVal('ao-mobile').replace(/\D/g, '');
    if (mob && mob.length !== 10) { missing.push('valid 10-digit Mobile Number'); const e = aoEl('ao-mobile'); if (e) e.style.borderColor = 'var(--red)'; }
    const aad = aoVal('ao-aadhaar').replace(/\D/g, '');
    if (aad && aad.length !== 12) { missing.push('valid 12-digit Aadhaar Number'); const e = aoEl('ao-aadhaar'); if (e) e.style.borderColor = 'var(--red)'; }
    return missing;
  }

  /* Ensure pdfmake is present; collect + validate; returns data or null. */
  function aoReady() {
    if (!window.pdfMake) { toast('PDF engine still loading — please retry in a moment', 'red'); return null; }
    const missing = aoValidate();
    if (missing.length) {
      toast('Please complete: ' + missing.slice(0, 4).join(', ') + (missing.length > 4 ? ' …' : ''), 'red');
      const form = aoEl('ao-form'); if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return null;
    }
    return aoCollect();
  }

  /* ── pdfmake document definition ──────────────────────────────────────── */
  function aoBuildDocDef(d) {
    const C = COMPANY_PROFILE;
    const today = aoFmtDate(new Date().toISOString().slice(0, 10));
    const ref = d.refNo || AO_STATE.refNo || '(to be assigned on save)';
    const empId = d.empid || '(to be assigned)';
    const name = d.name || '';
    const honorific = d.gender === 'Female' ? 'Ms.' : (d.gender === 'Male' ? 'Mr.' : 'Mr./Ms.');

    var sec = function (n, title, body) {
      const arr = [{ text: n + '. ' + title, style: 'h2' }];
      (Array.isArray(body) ? body : [body]).forEach(function (b) {
        arr.push(typeof b === 'string' ? { text: b, style: 'p' } : b);
      });
      return arr;
    };

    // salary table rows (only non-zero components, plus gross)
    const rows = [[{ text: 'Component', style: 'th' }, { text: 'Amount', style: 'th', alignment: 'right' }]];
    AO_SALARY_ROWS.forEach(function (s) {
      if (aoNum(d[s[0]]) > 0) rows.push([{ text: s[1] }, { text: aoMoney(d[s[0]]), alignment: 'right' }]);
    });
    rows.push([{ text: 'Gross Salary', bold: true }, { text: aoMoney(d.gross), alignment: 'right', bold: true }]);
    if (aoNum(d.net) > 0) rows.push([{ text: 'Net Salary', bold: true }, { text: aoMoney(d.net), alignment: 'right', bold: true }]);

    const socialItems = [
      'Provident Fund (EPFO): ' + aoYesNo(d.epfo),
      'Employees’ State Insurance (ESIC): ' + aoYesNo(d.esicapp),
      'Professional Tax: ' + aoYesNo(d.ptax),
      'Gratuity: ' + aoYesNo(d.gratuity)
    ];

    const content = [];
    content.push({ text: 'APPOINTMENT ORDER', style: 'title' });
    content.push({
      columns: [
        { width: '*', stack: [{ text: 'Date: ' + today, style: 'meta' }, { text: 'Employee ID: ' + empId, style: 'meta' }] },
        { width: 'auto', stack: [{ text: 'Reference No.: ' + ref, style: 'meta', alignment: 'right' }] }
      ], margin: [0, 0, 0, 10]
    });
    content.push({ text: 'Dear ' + honorific + ' ' + name + ',', style: 'p' });
    content.push({ text: 'We are pleased to appoint you as ' + (d.designation || '—') + ' in ' + (d.department || '—') + ' with effect from ' + (aoFmtDate(d.doj) || '—') + ', subject to the following terms and conditions.', style: 'p' });

    var n = 1;
    content.push.apply(content, sec(n++, 'Appointment', 'You are appointed as ' + (d.designation || '—') + ' in the ' + (d.department || '—') + ' department' + (d.manager ? ', reporting to ' + d.manager : '') + '. This appointment is governed by the Company’s policies, standing orders and the applicable provisions of the Labour Codes. LIN of the establishment: ' + (d.lin || '—') + '.'));
    content.push.apply(content, sec(n++, 'Place of Posting', 'Your initial place of posting is ' + (d.posting || d.worklocation || '—') + (d.worklocation && d.posting && d.worklocation !== d.posting ? ' (work location: ' + d.worklocation + ')' : '') + '. ' + (d.transferable === 'Yes' ? 'Your services are transferable to any location, unit, department or associate company of the Company.' : 'This posting is presently non-transferable unless mutually agreed in writing.')));
    content.push.apply(content, sec(n++, 'Nature of Employment', 'Your employment is on a ' + (d.emptype || 'Regular') + ' basis' + (d.skill ? ', under the ' + d.skill + ' category' : '') + '.'));
    var duties = [];
    if (d.duties) duties.push({ text: 'Broad nature of duties: ' + d.duties, style: 'p' });
    if (d.responsibilities) duties.push({ text: 'Responsibilities: ' + d.responsibilities, style: 'p' });
    if (!duties.length) duties.push({ text: 'As assigned by the Company from time to time.', style: 'p' });
    content.push.apply(content, sec(n++, 'Duties and Responsibilities', duties));
    content.push.apply(content, sec(n++, 'Working Hours', (d.hours ? 'Your working hours shall be ' + d.hours + '. ' : 'As per the Company’s standard working hours. ') + (d.weeklyoff ? 'Weekly off: ' + d.weeklyoff + '.' : '')));
    content.push.apply(content, sec(n++, 'Compensation', [
      { text: 'Your remuneration shall be as follows' + (d.freq ? ' (' + d.freq + ')' : '') + ':', style: 'p' },
      { table: { headerRows: 1, widths: ['*', 'auto'], body: rows }, layout: 'lightHorizontalLines', margin: [0, 4, 0, 6] }
    ]));
    content.push.apply(content, sec(n++, 'Social Security', { ul: socialItems, style: 'p' }));
    content.push.apply(content, sec(n++, 'Probation', 'You shall be on probation for ' + (d.probation || 'the period specified in Company policy') + '.' + (d.confirmdate ? ' Expected confirmation date: ' + aoFmtDate(d.confirmdate) + '.' : '') + (d.probationterms ? ' ' + d.probationterms : '')));
    content.push.apply(content, sec(n++, 'Leave Policy', d.leave || 'You shall be entitled to leave as per the Company’s leave policy and applicable law.'));
    content.push.apply(content, sec(n++, 'Confidentiality', AO_CLAUSES.confidentiality));
    content.push.apply(content, sec(n++, 'Code of Conduct', AO_CLAUSES.conduct));
    content.push.apply(content, sec(n++, 'Termination', AO_CLAUSES.terminationBody(d)));
    if (d.gender === 'Female' && d.maternity) {
      content.push.apply(content, sec(n++, 'Maternity Benefit', 'You shall be entitled to maternity benefits under Chapter VI of the Code on Social Security, 2020. ' + d.maternity));
    }
    var other = [];
    if (d.additional) other.push({ text: 'Additional terms: ' + d.additional, style: 'p' });
    if (d.special2) other.push({ text: 'Special conditions: ' + d.special2, style: 'p' });
    if (d.other) other.push({ text: d.other, style: 'p' });
    if (!other.length) other.push({ text: 'This letter, together with the Company’s policies, constitutes the complete terms of your appointment.', style: 'p' });
    content.push.apply(content, sec(n++, 'Other Terms', other));

    // acceptance + signatures
    content.push({ text: 'Acceptance', style: 'h2', margin: [0, 14, 0, 4] });
    content.push({ text: '“I hereby accept the terms and conditions mentioned above.”', style: 'p', italics: true });
    content.push({
      columns: [
        { width: '*', stack: [{ text: '\n\n_____________________', style: 'p' }, { text: 'Employee Signature', style: 'small' }, { text: 'Name: ' + name, style: 'small' }, { text: 'Date: ____________', style: 'small' }] },
        { width: '*', stack: [
            { text: '\nFor ' + C.name + ',', style: 'p' },
            { text: (d.digsig ? '/s/ ' + d.digsig : '_____________________'), style: 'p', bold: !!d.digsig },
            { text: (d.signame || 'Authorised Signatory'), style: 'small' },
            { text: (d.sigdesignation || ''), style: 'small' },
            (d.seal ? { text: '(Company Seal Affixed)', style: 'small', italics: true, margin: [0, 4, 0, 0] } : {})
          ], alignment: 'left' }
      ], margin: [0, 6, 0, 0]
    });

    const header = function () {
      const left = [];
      if (C.logo) left.push({ image: C.logo, width: 54, margin: [0, 0, 10, 0] });
      const info = {
        width: '*', stack: [
          { text: C.name, style: 'coName' },
          { text: C.address, style: 'coMeta' },
          { text: 'CIN: ' + C.cin + '   |   GST: ' + C.gst, style: 'coMeta' },
          { text: C.phone + '   |   ' + C.email + '   |   ' + C.website, style: 'coMeta' }
        ]
      };
      return {
        margin: [40, 22, 40, 0],
        stack: [
          { columns: C.logo ? [left[0], info] : [info] },
          { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 1, lineColor: '#1F2B5C' }] }
        ]
      };
    };
    const footer = function (currentPage, pageCount) {
      return {
        margin: [40, 8, 40, 0],
        columns: [
          { text: 'Confidential · ' + C.name, style: 'foot' },
          { text: 'Page ' + currentPage + ' of ' + pageCount, style: 'foot', alignment: 'right' }
        ]
      };
    };

    const def = {
      pageSize: 'A4',
      pageMargins: [40, 110, 40, 50],
      header: header,
      footer: footer,
      info: { title: 'Appointment Order - ' + name, author: C.name },
      content: content,
      defaultStyle: { fontSize: 10, lineHeight: 1.25, color: '#1B1B17' },
      styles: {
        title: { fontSize: 16, bold: true, alignment: 'center', margin: [0, 0, 0, 12], color: '#1F2B5C' },
        h2: { fontSize: 11, bold: true, margin: [0, 8, 0, 3], color: '#1F2B5C' },
        p: { fontSize: 10, margin: [0, 0, 0, 4], alignment: 'justify' },
        small: { fontSize: 9, color: '#444' },
        meta: { fontSize: 9, color: '#444' },
        th: { bold: true, fontSize: 10, fillColor: '#F0EEE7' },
        coName: { fontSize: 13, bold: true, color: '#1F2B5C' },
        coMeta: { fontSize: 8, color: '#555' },
        foot: { fontSize: 8, color: '#888' }
      }
    };
    if (C.watermark) def.watermark = { text: C.watermark, color: '#1F2B5C', opacity: 0.05, bold: true };
    return def;
  }

  function aoPdf(d) { return window.pdfMake.createPdf(aoBuildDocDef(d)); }
  function aoFileName(d) { return 'Appointment-Order-' + (d.name || 'employee').replace(/[^A-Za-z0-9]+/g, '-') + '.pdf'; }

  /* ── inline HTML preview (mirrors the PDF) ────────────────────────────── */
  function aoRenderPreview(d) {
    const host = aoEl('ao-preview');
    if (!host) return;
    const C = COMPANY_PROFILE;
    const today = aoFmtDate(new Date().toISOString().slice(0, 10));
    const honorific = d.gender === 'Female' ? 'Ms.' : (d.gender === 'Male' ? 'Mr.' : 'Mr./Ms.');
    var salary = AO_SALARY_ROWS.filter(function (s) { return aoNum(d[s[0]]) > 0; })
      .map(function (s) { return '<tr><td>' + s[1] + '</td><td style="text-align:right">' + aoEsc(aoMoney(d[s[0]])) + '</td></tr>'; }).join('');
    salary += '<tr><td><strong>Gross Salary</strong></td><td style="text-align:right"><strong>' + aoEsc(aoMoney(d.gross)) + '</strong></td></tr>';
    host.innerHTML =
      '<div class="card" style="margin-top:14px">' +
        '<div class="card-h"><div class="card-h-title">Letter preview</div><div class="card-h-sub">Rendered from the entered details · use Download / Print / Send Email for the PDF</div></div>' +
        '<div style="border:1px solid var(--line);border-radius:8px;padding:22px;background:#fff;max-width:780px;margin:0 auto">' +
          '<div style="border-bottom:2px solid var(--indigo);padding-bottom:8px;margin-bottom:14px">' +
            '<div style="font-size:1.1rem;font-weight:700;color:var(--indigo)">' + aoEsc(C.name) + '</div>' +
            '<div class="tiny" style="color:#555">' + aoEsc(C.address) + '</div>' +
            '<div class="tiny" style="color:#555">CIN: ' + aoEsc(C.cin) + ' · GST: ' + aoEsc(C.gst) + ' · ' + aoEsc(C.email) + ' · ' + aoEsc(C.website) + '</div>' +
          '</div>' +
          '<h2 style="text-align:center;color:var(--indigo);letter-spacing:1px">APPOINTMENT ORDER</h2>' +
          '<div class="tiny" style="display:flex;justify-content:space-between;color:#444"><span>Date: ' + today + ' · Employee ID: ' + aoEsc(d.empid || '(to be assigned)') + '</span><span>Ref: ' + aoEsc(d.refNo || AO_STATE.refNo || '(on save)') + '</span></div>' +
          '<p>Dear ' + honorific + ' ' + aoEsc(d.name) + ',</p>' +
          '<p>We are pleased to appoint you as <strong>' + aoEsc(d.designation) + '</strong> in <strong>' + aoEsc(d.department) + '</strong> with effect from <strong>' + aoEsc(aoFmtDate(d.doj)) + '</strong>, subject to the following terms and conditions.</p>' +
          '<p><strong>Nature of employment:</strong> ' + aoEsc(d.emptype) + (d.skill ? ' · ' + aoEsc(d.skill) : '') + '</p>' +
          '<p><strong>Place of posting:</strong> ' + aoEsc(d.posting || d.worklocation || '—') + (d.transferable === 'Yes' ? ' (transferable)' : '') + '</p>' +
          (d.duties ? '<p><strong>Duties:</strong> ' + aoEsc(d.duties) + '</p>' : '') +
          '<p><strong>Compensation' + (d.freq ? ' (' + aoEsc(d.freq) + ')' : '') + ':</strong></p>' +
          '<table class="t" style="max-width:360px">' + salary + '</table>' +
          '<p><strong>Social security:</strong> EPFO ' + aoYesNo(d.epfo) + ' · ESIC ' + aoYesNo(d.esicapp) + ' · P.Tax ' + aoYesNo(d.ptax) + ' · Gratuity ' + aoYesNo(d.gratuity) + '</p>' +
          (d.gender === 'Female' && d.maternity ? '<p><strong>Maternity benefit (Chapter VI, Social Security Code 2020):</strong> ' + aoEsc(d.maternity) + '</p>' : '') +
          '<p style="margin-top:14px;font-style:italic">"I hereby accept the terms and conditions mentioned above."</p>' +
          '<div style="display:flex;justify-content:space-between;margin-top:18px" class="tiny"><div>_______________<br>Employee Signature</div><div>For ' + aoEsc(C.name) + '<br>' + aoEsc(d.signame || 'Authorised Signatory') + (d.seal ? '<br><em>(Seal affixed)</em>' : '') + '</div></div>' +
        '</div>' +
      '</div>';
    host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ── actions ──────────────────────────────────────────────────────────── */
  function aoGenerate() {
    const d = aoReady();
    if (!d) return;
    aoRenderPreview(d);
    toast('Appointment Order generated · review the preview, then download / print / email', 'green');
  }
  function aoRegenerate() { aoGenerate(); }
  function aoPreview() {
    const d = aoReady();
    if (!d) return;
    aoRenderPreview(d);
    try { aoPdf(d).open(); } catch (e) { /* popup blocked — inline preview already shown */ }
  }
  function aoDownload() { const d = aoReady(); if (!d) return; aoPdf(d).download(aoFileName(d)); toast('PDF downloaded', 'green'); }
  function aoPrint() { const d = aoReady(); if (!d) return; aoPdf(d).print(); }

  function aoSendEmail() {
    const d = aoReady();
    if (!d) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) { toast('A valid Employee Email is required to send', 'red'); return; }
    if (!window.confirm('Send the Appointment Order PDF to ' + d.email + ' via the company mail service?')) return;
    aoPdf(d).getBase64(function (b64) {
      fetch(aoApiBase() + '/api/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: [d.email],
          subject: 'Appointment Order – ' + d.name,
          message: 'Dear ' + d.name + ',\n\nPlease find attached your Appointment Order.\n\nRegards,\nHR Department',
          attachments: [{ filename: aoFileName(d), data: b64, contentType: 'application/pdf' }]
        })
      }).then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function (j) {
          if (j.ok) toast('Appointment Order emailed to ' + d.email, 'green');
          else toast('Email failed: ' + (j.error || 'unknown error'), 'red');
        })
        .catch(function (e) { toast('Email failed: ' + e.message, 'red'); });
    });
  }

  function aoSaveDraft() {
    const d = aoCollect();
    if (!d.name) { toast('Enter at least the employee name to save a draft', 'red'); return; }
    d.status = 'draft';
    fetch(aoApiBase() + '/api/appointment-orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d)
    }).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (j.ok && j.order) {
          AO_STATE.currentId = j.order.id;
          AO_STATE.refNo = j.order.refNo;
          toast('Draft saved · Ref ' + j.order.refNo, 'green');
          aoRenderSaved();
        } else { toast('Save failed: ' + (j.error || 'unknown error'), 'red'); }
      })
      .catch(function (e) { toast('Save failed: ' + e.message, 'red'); });
  }

  function aoEdit() { const form = aoEl('ao-form'); if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  function aoRenderSaved() {
    const host = aoEl('ao-saved');
    if (!host) return;
    fetch(aoApiBase() + '/api/appointment-orders').then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        const orders = (j && j.orders) || [];
        if (!orders.length) { host.innerHTML = ''; return; }
        const rows = orders.slice().reverse().map(function (o) {
          return '<tr><td>' + aoEsc(o.name || '—') + '</td><td>' + aoEsc(o.designation || '') + '</td><td>' + aoEsc(o.refNo || '') + '</td>' +
            '<td><span class="pill ' + (o.status === 'final' ? 'green' : 'amber') + ' tiny">' + aoEsc(o.status || 'draft') + '</span></td>' +
            '<td style="text-align:right"><button class="btn" onclick="window.aoLoadOrder(\'' + o.id + '\')">Load</button> ' +
            '<button class="btn danger" onclick="window.aoDeleteOrder(\'' + o.id + '\')">Delete</button></td></tr>';
        }).join('');
        host.innerHTML = '<div class="card" style="margin-top:14px"><div class="card-h"><div class="card-h-title">Saved appointment orders</div>' +
          '<span class="pill outline">' + orders.length + '</span></div>' +
          '<table class="t"><thead><tr><th>Employee</th><th>Designation</th><th>Reference</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>';
      })
      .catch(function () { host.innerHTML = ''; });
  }

  function aoLoadOrder(id) {
    fetch(aoApiBase() + '/api/appointment-orders/' + id).then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (!j.ok || !j.order) { toast('Could not load order', 'red'); return; }
        const o = j.order;
        AO_FIELDS.forEach(function (f) { const e = aoEl(f[0]); if (e) e.value = (o[f[1]] != null ? o[f[1]] : ''); });
        const cons = aoEl('ao-aadhaar-consent'); if (cons) cons.checked = !!o.aadhaarConsent;
        const seal = aoEl('ao-seal'); if (seal) seal.checked = !!o.seal;
        AO_STATE.currentId = o.id; AO_STATE.refNo = o.refNo;
        aoToggleAadhaar(); aoToggleMaternity(); aoRecalcSalary();
        const form = aoEl('ao-form'); if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        toast('Loaded · ' + (o.name || o.refNo), 'green');
      })
      .catch(function (e) { toast('Load failed: ' + e.message, 'red'); });
  }

  function aoDeleteOrder(id) {
    if (!window.confirm('Delete this saved appointment order?')) return;
    fetch(aoApiBase() + '/api/appointment-orders/' + id, { method: 'DELETE' })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) {
        if (j.ok) { toast('Deleted', 'green'); if (AO_STATE.currentId === id) AO_STATE = { currentId: null, refNo: null }; aoRenderSaved(); }
        else toast('Delete failed: ' + (j.error || 'unknown error'), 'red');
      })
      .catch(function (e) { toast('Delete failed: ' + e.message, 'red'); });
  }

  __kvOnReady(initAppointmentOrder);

  /* ════════════════════════════════════════════════════════════════════════
     ANALYTICS HUB · tab switching + EXPOSURE ANALYTICS (compliance-driven)
     Exposure analytics are computed from the contractor records (CONTRACTORS):
     each carries a compliance `score`, six `subscores` (CLRA / ESIC / PF /
     Min-wage / Migrant / Safety) and a `liability` breakdown. Per the dashboard
     model, estimated exposure = statutory penalty + operational-stop risk +
     customer-audit risk + audit-weighted contract value (all ₹ Lakhs).
     ════════════════════════════════════════════════════════════════════════ */

  /* switch between the Exposure / Chat tabs inside #sec-analytics */
  function anTab(name, el) {
    document.querySelectorAll('#sec-analytics .an-pane').forEach(function (p) { p.style.display = 'none'; });
    const pane = document.getElementById('an-pane-' + name);
    if (pane) pane.style.display = 'block';
    const btn = el || document.getElementById('an-tab-' + name);
    if (btn && btn.parentElement) {
      btn.parentElement.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('on'); });
      btn.classList.add('on');
    }
    if (name === 'exposure') {
      initExposureAnalytics();
    } else if (name === 'readiness') {
      initReadinessAnalytics();
    } else if (name === 'chat') {
      // Render now that the pane is visible (width-dependent charts need layout).
      try { initChatAnalytics(); } catch (e) {}
      if (typeof cvaRefreshAll === 'function') { try { cvaRefreshAll(); } catch (e) {} }
    }
  }

  const EXP_DIMS = [
    ['clra', 'CLRA'], ['esic', 'ESIC'], ['pf', 'PF'],
    ['minWage', 'Min wage'], ['migrant', 'Migrant'], ['safety', 'Safety']
  ];

  function expContractors() {
    return (typeof CONTRACTORS !== 'undefined' && Array.isArray(CONTRACTORS)) ? CONTRACTORS : [];
  }
  function expColor(score) {
    return (typeof colorForScore === 'function') ? colorForScore(score)
      : (score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)');
  }
  function expBand(score) { return score >= 80 ? 'green' : score >= 60 ? 'amber' : 'red'; }
  function expL(v) { return '₹' + (Math.round(v * 10) / 10).toLocaleString('en-IN') + ' L'; }
  function expCr(v) { return '₹' + (v / 100).toFixed(2) + ' Cr'; }

  /* estimated exposure components for one contractor (₹ Lakhs) */
  function expCalc(c) {
    const L = c.liability || {};
    const opStop = (L.operationalDays || 0) * (L.operationalPerDay || 0);
    const audit = L.customerAudit || 0;
    const cv = L.contractValueRisk || 0;
    const statLow = L.statutoryLow || 0, statMid = L.statutoryMid || 0, statHigh = L.statutoryHigh || 0;
    return {
      statLow: statLow, statMid: statMid, statHigh: statHigh, opStop: opStop, audit: audit, cv: cv,
      low: statLow + opStop + audit + cv,
      mid: statMid + opStop + audit + cv,
      high: statHigh + opStop + audit + cv
    };
  }
  function expWorstDim(c) {
    const sub = c.subscores || {};
    let worst = EXP_DIMS[0], wv = sub[EXP_DIMS[0][0]] != null ? sub[EXP_DIMS[0][0]] : 100;
    EXP_DIMS.forEach(function (d) { const v = sub[d[0]]; if (v != null && v < wv) { wv = v; worst = d; } });
    return { label: worst[1], value: wv };
  }
  function expBar(value, color, w) {
    return '<div class="bar thin" style="width:' + (w || 120) + 'px;display:inline-block;vertical-align:middle">' +
      '<span style="width:' + Math.max(2, Math.min(100, value)) + '%;background:' + color + '"></span></div>';
  }

  function initExposureAnalytics() {
    const host = document.getElementById('exp-kpis');
    if (!host) return;                       // pane not mounted
    const cs = expContractors();
    if (!cs.length) {
      host.innerHTML = '<div class="tiny muted" style="grid-column:span 4">No contractor data available — exposure analytics will populate once the roster is loaded.</div>';
      ['exp-bycontractor', 'exp-composition', 'exp-subscores', 'exp-bands', 'exp-table-body'].forEach(function (id) { const e = document.getElementById(id); if (e) e.innerHTML = ''; });
      return;
    }

    const rows = cs.map(function (c) { return { c: c, e: expCalc(c) }; });
    rows.sort(function (a, b) { return b.e.mid - a.e.mid; });
    const totMid = rows.reduce(function (s, r) { return s + r.e.mid; }, 0);
    const totLow = rows.reduce(function (s, r) { return s + r.e.low; }, 0);
    const totHigh = rows.reduce(function (s, r) { return s + r.e.high; }, 0);
    const atRisk = cs.filter(function (c) { return c.score < 60; });
    const avgScore = Math.round(cs.reduce(function (s, c) { return s + (c.score || 0); }, 0) / cs.length);
    const totalWorkers = cs.reduce(function (s, c) { return s + (c.deployed || 0); }, 0);
    const exposedWorkers = cs.filter(function (c) { return c.score < 80; }).reduce(function (s, c) { return s + (c.deployed || 0); }, 0);
    const maxMid = rows.length ? rows[0].e.mid : 1;

    /* KPI strip */
    host.innerHTML =
      '<div class="kpi"><div class="kpi-eye">Total estimated exposure</div>' +
        '<div class="kpi-val" style="color:var(--red-dk)">' + expCr(totMid) + '</div>' +
        '<div class="kpi-sub">range ' + expCr(totLow) + ' – ' + expCr(totHigh) + ' (mid-case)</div></div>' +
      '<div class="kpi"><div class="kpi-eye">Contractors at risk</div>' +
        '<div class="kpi-val" style="color:var(--amber-dk)">' + atRisk.length + '<small>/' + cs.length + '</small></div>' +
        '<div class="kpi-sub">compliance score below 60</div></div>' +
      '<div class="kpi"><div class="kpi-eye">Avg compliance score</div>' +
        '<div class="kpi-val" style="color:' + expColor(avgScore) + '">' + avgScore + '<small>/100</small></div>' +
        '<div class="kpi-sub">across ' + cs.length + ' contractors</div></div>' +
      '<div class="kpi"><div class="kpi-eye">Workers under exposed firms</div>' +
        '<div class="kpi-val">' + exposedWorkers.toLocaleString('en-IN') + '</div>' +
        '<div class="kpi-sub">of ' + totalWorkers.toLocaleString('en-IN') + ' deployed (score &lt; 80)</div></div>';

    /* exposure by contractor */
    const bc = document.getElementById('exp-bycontractor');
    if (bc) {
      bc.innerHTML = rows.map(function (r) {
        const col = expColor(r.c.score);
        const w = Math.max(3, Math.round(r.e.mid / maxMid * 100));
        return '<div style="margin:9px 0">' +
          '<div class="row-between" style="font-size:0.8rem;margin-bottom:3px">' +
            '<span class="t-strong">' + r.c.name + '</span>' +
            '<span class="mono" style="color:' + col + '">' + expL(r.e.mid) + '</span></div>' +
          '<div class="bar"><span style="width:' + w + '%;background:' + col + '"></span></div>' +
          '<div class="tiny muted" style="margin-top:2px">' + (r.c.deployed || 0) + ' workers · score ' + r.c.score + ' · ' + r.c.area + '</div>' +
        '</div>';
      }).join('');
    }

    /* exposure composition */
    const comp = [
      ['Statutory penalty', rows.reduce(function (s, r) { return s + r.e.statMid; }, 0), 'var(--red)'],
      ['Operational-stop risk', rows.reduce(function (s, r) { return s + r.e.opStop; }, 0), 'var(--amber)'],
      ['Customer-audit risk', rows.reduce(function (s, r) { return s + r.e.audit; }, 0), 'var(--indigo)'],
      ['Contract value at risk', rows.reduce(function (s, r) { return s + r.e.cv; }, 0), 'var(--blue)']
    ];
    const compTot = comp.reduce(function (s, x) { return s + x[1]; }, 0) || 1;
    const cmp = document.getElementById('exp-composition');
    if (cmp) {
      cmp.innerHTML = comp.map(function (x) {
        const pct = Math.round(x[1] / compTot * 100);
        return '<div style="margin:10px 0">' +
          '<div class="row-between" style="font-size:0.8rem;margin-bottom:3px">' +
            '<span>' + x[0] + '</span><span class="mono">' + expL(x[1]) + ' · ' + pct + '%</span></div>' +
          '<div class="bar"><span style="width:' + pct + '%;background:' + x[2] + '"></span></div>' +
        '</div>';
      }).join('') +
      '<div class="tiny muted" style="margin-top:8px">Mid-case total ' + expCr(compTot) + ' across ' + cs.length + ' contractors.</div>';
    }

    /* sub-score averages (6 dimensions) */
    const avgDim = EXP_DIMS.map(function (d) {
      const v = Math.round(cs.reduce(function (s, c) { return s + ((c.subscores || {})[d[0]] || 0); }, 0) / cs.length);
      return { key: d[0], label: d[1], v: v };
    });
    const weakest = avgDim.reduce(function (a, b) { return b.v < a.v ? b : a; }, avgDim[0]);
    const ss = document.getElementById('exp-subscores');
    if (ss) {
      ss.innerHTML = avgDim.map(function (d) {
        const col = expColor(d.v);
        const flag = d.key === weakest.key ? ' <span class="pill red tiny">weakest</span>' : '';
        return '<div style="margin:9px 0">' +
          '<div class="row-between" style="font-size:0.8rem;margin-bottom:3px">' +
            '<span>' + d.label + flag + '</span><span class="mono" style="color:' + col + '">' + d.v + '/100</span></div>' +
          '<div class="bar"><span style="width:' + d.v + '%;background:' + col + '"></span></div>' +
        '</div>';
      }).join('') +
      '<div class="tiny muted" style="margin-top:8px"><strong>' + weakest.label + '</strong> is the weakest dimension on average — the primary driver of statutory exposure.</div>';
    }

    /* score-band distribution */
    const bands = [
      ['Ready (80–100)', cs.filter(function (c) { return c.score >= 80; }).length, 'var(--green)'],
      ['Watch (60–79)', cs.filter(function (c) { return c.score >= 60 && c.score < 80; }).length, 'var(--amber)'],
      ['At risk (<60)', cs.filter(function (c) { return c.score < 60; }).length, 'var(--red)']
    ];
    const bd = document.getElementById('exp-bands');
    if (bd) {
      bd.innerHTML = bands.map(function (b) {
        const pct = Math.round(b[1] / cs.length * 100);
        return '<div style="margin:12px 0">' +
          '<div class="row-between" style="font-size:0.82rem;margin-bottom:3px">' +
            '<span>' + b[0] + '</span><span class="mono">' + b[1] + ' · ' + pct + '%</span></div>' +
          '<div class="bar"><span style="width:' + pct + '%;background:' + b[2] + '"></span></div>' +
        '</div>';
      }).join('');
    }

    /* at-risk table */
    const tb = document.getElementById('exp-table-body');
    if (tb) {
      tb.innerHTML = rows.map(function (r) {
        const wd = expWorstDim(r.c);
        const col = expColor(r.c.score);
        return '<tr>' +
          '<td class="t-strong">' + r.c.name + '</td>' +
          '<td>' + (r.c.area || '—') + '</td>' +
          '<td>' + (r.c.deployed || 0) + '</td>' +
          '<td><span class="mono" style="color:' + col + '">' + r.c.score + '</span> ' + expBar(r.c.score, col, 56) + '</td>' +
          '<td><span class="pill ' + expBand(wd.value) + ' tiny">' + wd.label + ' ' + wd.value + '</span></td>' +
          '<td class="mono">' + expL(r.e.mid) + '</td>' +
        '</tr>';
      }).join('');
    }
    const cnt = document.getElementById('exp-table-count');
    if (cnt) cnt.textContent = cs.length + ' contractors';
  }
  __kvOnReady(initExposureAnalytics);

  /* ════════════════════════════════════════════════════════════════════════
     READINESS TREND · history of completed Labour Code Readiness Surveys
     Each survey is stored with the date it was taken and the score on that day
     (POST /api/readiness-surveys from csSubmit). This renders the trajectory so
     readiness can be verified day-by-day and month-by-month.
     ════════════════════════════════════════════════════════════════════════ */
  function rdzBand(s) { return s >= 65 ? 'green' : s >= 45 ? 'amber' : 'red'; }
  function rdzColor(s) { return s >= 65 ? 'var(--green)' : s >= 45 ? 'var(--amber)' : 'var(--red)'; }
  function rdzFmtDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return iso || '—';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return String(d.getDate()).padStart(2, '0') + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }
  function rdzMonthKey(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '—';
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function initReadinessAnalytics() {
    const host = document.getElementById('rdz-kpis');
    if (!host) return;                       // pane not mounted
    fetch((window.__KV_API_BASE || '') + '/api/readiness-surveys')
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (j) { rdzRender((j && j.surveys) || []); })
      .catch(function () { rdzRender([]); });
  }

  function rdzRender(surveys) {
    const host = document.getElementById('rdz-kpis');
    if (!host) return;
    const empty = function (msg) {
      host.innerHTML = '<div class="tiny muted" style="grid-column:span 4">' + msg + '</div>';
      ['rdz-trend', 'rdz-month-body', 'rdz-history-body'].forEach(function (id) { const e = document.getElementById(id); if (e) e.innerHTML = ''; });
      const tc = document.getElementById('rdz-trend-count'); if (tc) tc.textContent = '0 checks';
    };
    if (!surveys.length) {
      empty('No readiness checks recorded yet. Complete the <strong>Labour Code Readiness Survey</strong> (Overview) and the dated score will appear here to track over time.');
      return;
    }
    // chronological (oldest → newest)
    const list = surveys.slice().sort(function (a, b) { return new Date(a.takenAt) - new Date(b.takenAt); });
    const latest = list[list.length - 1];
    const prev = list.length > 1 ? list[list.length - 2] : null;
    const delta = prev ? (latest.score - prev.score) : 0;
    const avg = Math.round(list.reduce(function (s, x) { return s + x.score; }, 0) / list.length);
    const best = list.reduce(function (a, b) { return b.score > a.score ? b : a; }, list[0]);

    /* KPI strip */
    host.innerHTML =
      '<div class="kpi"><div class="kpi-eye">Latest readiness</div>' +
        '<div class="kpi-val" style="color:' + rdzColor(latest.score) + '">' + latest.score + '<small>/100</small></div>' +
        '<div class="kpi-sub">on ' + rdzFmtDate(latest.takenAt) + '</div></div>' +
      '<div class="kpi"><div class="kpi-eye">Change vs previous</div>' +
        '<div class="kpi-val" style="color:' + (delta >= 0 ? 'var(--green-dk)' : 'var(--red-dk)') + '">' +
          (prev ? (delta >= 0 ? '▲ +' + delta : '▼ ' + delta) : '—') + '</div>' +
        '<div class="kpi-sub">' + (prev ? 'since ' + rdzFmtDate(prev.takenAt) : 'first recorded check') + '</div></div>' +
      '<div class="kpi"><div class="kpi-eye">Checks recorded</div>' +
        '<div class="kpi-val">' + list.length + '</div>' +
        '<div class="kpi-sub">' + rdzFmtDate(list[0].takenAt) + ' → ' + rdzFmtDate(latest.takenAt) + '</div></div>' +
      '<div class="kpi"><div class="kpi-eye">Average / best</div>' +
        '<div class="kpi-val">' + avg + '<small>/' + best.score + '</small></div>' +
        '<div class="kpi-sub">mean across all · best on ' + rdzFmtDate(best.takenAt) + '</div></div>';

    /* trend — vertical bars, one per check, height = score, coloured by band */
    const trend = document.getElementById('rdz-trend');
    if (trend) {
      const recent = list.slice(-24);
      const bars = recent.map(function (x) {
        const h = Math.max(4, Math.round(x.score * 1.6));   // px height, score 0–100 → 0–160
        return '<div style="flex:1;min-width:24px;display:flex;flex-direction:column;align-items:center;gap:4px">' +
          '<div class="mono" style="font-size:0.7rem;color:' + rdzColor(x.score) + '">' + x.score + '</div>' +
          '<div title="' + rdzFmtDate(x.takenAt) + ' · ' + x.score + '/100" style="width:60%;height:' + h + 'px;background:' + rdzColor(x.score) + ';border-radius:3px 3px 0 0"></div>' +
          '<div class="tiny muted" style="font-size:0.62rem;writing-mode:vertical-rl;transform:rotate(180deg);max-height:64px;overflow:hidden">' + rdzFmtDate(x.takenAt) + '</div>' +
        '</div>';
      }).join('');
      trend.innerHTML =
        '<div style="display:flex;align-items:flex-end;gap:6px;height:230px;border-bottom:1px solid var(--line);padding:8px 4px 0">' + bars + '</div>' +
        '<div class="tiny muted" style="margin-top:8px">Bands: <span style="color:var(--green)">●</span> ready ≥65 · <span style="color:var(--amber)">●</span> moderate 45–64 · <span style="color:var(--red)">●</span> below 45' +
        (list.length > 24 ? ' · showing last 24 of ' + list.length : '') + '</div>';
      const tc = document.getElementById('rdz-trend-count'); if (tc) tc.textContent = list.length + ' check' + (list.length === 1 ? '' : 's');
    }

    /* month-by-month rollup */
    const months = {};
    list.forEach(function (x) {
      const k = rdzMonthKey(x.takenAt);
      (months[k] || (months[k] = [])).push(x);
    });
    const mbody = document.getElementById('rdz-month-body');
    if (mbody) {
      const keys = Object.keys(months);   // already chronological (list was sorted)
      const seen = [];
      keys.forEach(function (k) { if (seen.indexOf(k) === -1) seen.push(k); });
      mbody.innerHTML = seen.map(function (k, i) {
        const arr = months[k];
        const mavg = Math.round(arr.reduce(function (s, x) { return s + x.score; }, 0) / arr.length);
        const mlatest = arr[arr.length - 1].score;
        const prevKey = i > 0 ? seen[i - 1] : null;
        const prevLatest = prevKey ? months[prevKey][months[prevKey].length - 1].score : null;
        const d = prevLatest != null ? mlatest - prevLatest : null;
        const trendTxt = d == null ? '—' : (d >= 0 ? '<span style="color:var(--green-dk)">▲ +' + d + '</span>' : '<span style="color:var(--red-dk)">▼ ' + d + '</span>');
        return '<tr><td class="t-strong">' + k + '</td><td>' + arr.length + '</td>' +
          '<td><span class="mono" style="color:' + rdzColor(mavg) + '">' + mavg + '</span></td>' +
          '<td><span class="mono" style="color:' + rdzColor(mlatest) + '">' + mlatest + '</span></td>' +
          '<td>' + trendTxt + '</td></tr>';
      }).join('');
    }

    /* day-by-day history (newest first) */
    const hbody = document.getElementById('rdz-history-body');
    if (hbody) {
      const sectorNames = { manufacturing: 'Manufacturing', construction: 'Construction', logistics: 'Logistics', mining: 'Mining', engineering: 'Engineering', other: 'Other' };
      hbody.innerHTML = list.slice().reverse().map(function (x) {
        return '<tr><td>' + rdzFmtDate(x.takenAt) + '</td>' +
          '<td><span class="mono" style="color:' + rdzColor(x.score) + '">' + x.score + '</span>/100</td>' +
          '<td><span class="pill ' + rdzBand(x.score) + ' tiny">' + (x.score >= 65 ? 'Ready' : x.score >= 45 ? 'Moderate' : 'Below') + '</span></td>' +
          '<td>' + (sectorNames[x.sector] || x.sector || '—') + '</td>' +
          '<td>' + (x.gaps != null ? x.gaps : '—') + '</td></tr>';
      }).join('');
    }
  }
  __kvOnReady(initReadinessAnalytics);

