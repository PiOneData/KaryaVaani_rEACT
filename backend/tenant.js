/* tenant.js — server-side mirror of src/config/tenant.js.

   Karya Vaani ships single-tenant, so the customer's identity appears in
   generated records (CLRA licence authorities, direct-employment labels) as
   well as in the UI. Both sides read their identity from one place; the
   frontend from VITE_TENANT_* at build time, the backend from TENANT_* at
   runtime. Keep the two default sets in step — a fresh checkout names no
   client at all. */

const pick = (v, fallback) => (v == null || v === '' ? fallback : String(v));

const TENANT = {
  /* Short customer name, used inline in generated copy and record labels. */
  name: pick(process.env.TENANT_NAME, 'Customer'),
  /* Plant / site this deployment covers. */
  site: pick(process.env.TENANT_SITE, 'Plant'),
  /* Short region code shown next to the site ("AP", "TN"). Blank ⇒ omitted. */
  region: pick(process.env.TENANT_REGION, ''),
  /* Full state name, used in statutory authority strings. */
  regionFull: pick(process.env.TENANT_REGION_FULL, ''),
  /* Location code used by the manpower-mapping datasets. */
  locationCode: pick(process.env.TENANT_LOCATION_CODE, 'PLANT-FG'),
};

/** "Customer Plant" — name + site. */
TENANT.siteLabel = [TENANT.name, TENANT.site].filter(Boolean).join(' ');

/** "Customer Plant · AP" — full tenant label (region dropped if unset). */
TENANT.label = [TENANT.siteLabel, TENANT.region].filter(Boolean).join(' · ');

/** "Customer (direct)" — how a directly-employed worker's employer is shown. */
TENANT.directEmployer = `${TENANT.name} (direct)`;

/** The issuing authority printed on a CLRA licence record. */
TENANT.licensingAuthority = ['Licensing Officer', [TENANT.site, TENANT.regionFull].filter(Boolean).join(', ')]
  .filter(Boolean).join(' · ');

module.exports = { TENANT };
