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
