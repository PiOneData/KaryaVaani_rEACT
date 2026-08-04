# Karya Vaani — React

1:1 React replica of `karya-vaani_v3.html` (Workforce Compliance Assessment Platform · Daikin Sricity). Identical UI, navigation, fonts and behaviour — verified by a node-by-node DOM diff (9,371 nodes) against the original.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
```

## Structure

```
index.html                  fonts + SheetJS CDN (same as original <head>)
src/styles/app.css          original <style> block, verbatim
src/App.jsx                 composition: TopBar · NavBar · 23 sections · EmailModal · Toast
src/components/             TopBar, NavBar, EmailModal, Toast
src/sections/               one component per view (SecDashboard, SecKaryaNirnay, …)
src/legacy/useLegacyApp.js  loads the application logic after mount
public/legacy/app.js        original application logic (~12.7k lines), verbatim
```

## How the hybrid works

- Markup was converted mechanically to JSX (`class`→`className`, inline styles→objects, `onclick="fn(this)"`→`onClick` calling the same global function). Each converted element keeps its original handler string in `data-onclick`, because parts of the legacy code introspect that attribute.
- `public/legacy/app.js` is the untouched original script, loaded as a classic script after React mounts so its functions stay on `window`. Its `DOMContentLoaded` hooks were rewritten to a run-now helper (`__kvOnReady`) since the DOM is already rendered when it loads.
- `React.StrictMode` is intentionally not used — the legacy script must initialise exactly once.

## Refactoring further

To migrate a view to idiomatic React, port the relevant functions from `public/legacy/app.js` into the matching `src/sections/*.jsx` component as state/hooks, then delete them from the legacy file.

## Compliance change requests (CR-3 / CR-6 / CR-7 / CR-8 / CR-9)

One rule runs through all of these: **an agency submits or requests, the principal
employer's HR verifies or decides.** Every HR-only action is gated in the UI and
again on the server (`requireHR` in `backend/server.js`), and anything an agency
raises lands in the HR inbox on the Onboarding page plus the top-bar bell.

| CR | What it does | Where |
|----|--------------|-------|
| **CR-6** | Agency submits EPF/ESIC amounts paid, the challan and the headcount it covers. The platform reconciles the challan headcount against the **actual deployed** headcount; HR records Full Paid / Partially Paid / Not Paid. Changing a submitted amount clears the earlier verification. | Contractor drill-down → *EPF / ESIC payments* · Contractor home · Statutory posture rollup |
| **CR-8** | The CLRA licensed headcount is a **hard block** on onboarding (single capture, bulk import and API). Daikin's commercial contracted headcount is a separate field that only raises an advisory alert. | Contractor master grid · drill-down *Deployment ceilings* · onboarding form · Statutory posture |
| **CR-3** | Every transport route carries a unique, persistent `routeNo`. Worker re-assignments are **appended** with a timestamp, never overwritten, so past boarding and OSHC R.83 consent records stay traceable. | Transport page → *Route identity & assignment log* · worker record |
| **CR-7** | Monthly register of overtime (rate computed at **125% of the ordinary rate**, never typed), Loss of Pay and variable allowances. Flags workers whose overtime pushes monthly wages over the **₹21,000 ESIC ceiling**. | *Overtime & wage register* (Operational Pillars) |
| **CR-9** | Exit produces two records: an **access-revocation** record (worker login actually disabled — revoked accounts cannot sign in) and a **statutory data-disposition** record naming, per data category, retain / delete / anonymise with the statutory basis and the end date. | Worker record → *Status & access* → exit workflow · Statutory posture exit register |

**Worker employment status** (Active · Inactive · On notice · Suspended · Exited)
is shown as a badge on the worker directory, onboarded-workers grid, All Employee
Track and the contractor's deployed-workers pane, each with a status filter. Only
HR can change it; an agency raises a request that notifies HR and changes nothing
until HR approves. Inactive and exited workers release their CLRA licence slot.

New backend collections: `statutoryPayments`, `workerStatusEvents`, `exitRecords`,
`routeAssignments`, `payrollMonths`, `hrNotifications`. `ensureComplianceDefaults()`
backfills the licence ceiling and route numbers onto stores seeded before these
fields existed, so no re-seed is needed.
