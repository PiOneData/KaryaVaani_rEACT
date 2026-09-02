/* tenant.js — the ONE place the customer's identity lives.

   Karya Vaani ships single-tenant: every deployment is branded for the client
   whose plant it runs at. Everything client-specific the UI renders reads from
   here, so standing the product up for a new client is a single-file change (or
   a set of build-time env vars) rather than a hunt through the sections.

   Defaults are deliberately generic — a fresh checkout names no client at all.
   Override per deployment with VITE_TENANT_* in .env (see .env.example).

   The legacy bundle (public/legacy/app.js) is a classic script and cannot
   import this module, so we also publish the resolved values on
   window.__KV_TENANT; app.js reads that with its own matching fallbacks.
   The backend has a parallel copy at backend/tenant.js (TENANT_* env vars). */

const pick = (v, fallback) => (v == null || v === '' ? fallback : String(v));

export const TENANT = {
  /* Short customer name, used inline in copy: "<name> HR", "<name> EHS". */
  name: pick(import.meta.env.VITE_TENANT_NAME, 'Customer'),
  /* Registered entity, for statutory letterheads (ESIC/CLRA forms). */
  legalName: pick(import.meta.env.VITE_TENANT_LEGAL_NAME, 'Customer Industries Pvt. Ltd.'),
  /* Plant / site this deployment covers. */
  site: pick(import.meta.env.VITE_TENANT_SITE, 'Plant'),
  /* Short region code shown next to the site ("AP", "TN"). Blank ⇒ omitted. */
  region: pick(import.meta.env.VITE_TENANT_REGION, ''),
  /* Full state name, for statutory addresses and regime tables. */
  regionFull: pick(import.meta.env.VITE_TENANT_REGION_FULL, ''),
  /* Industrial park / zone the plant sits in. */
  zone: pick(import.meta.env.VITE_TENANT_ZONE, 'Plant SEZ'),
  /* Registered address printed on generated statutory documents. */
  address: pick(import.meta.env.VITE_TENANT_ADDRESS, 'Plant SEZ, Plot No. 00, India'),
  /* Location code used by the manpower-mapping datasets. */
  locationCode: pick(import.meta.env.VITE_TENANT_LOCATION_CODE, 'PLANT-FG'),
  /* Parent / group HQ that reviews localised artefacts. */
  hq: pick(import.meta.env.VITE_TENANT_HQ, 'Customer HQ'),
  /* Internal compliance mailbox CC'd on statutory escalations. */
  complianceEmail: pick(import.meta.env.VITE_TENANT_COMPLIANCE_EMAIL, 'compliance@customer.example'),
  /* Compliance helpdesk number quoted in escalation emails. */
  helpdeskPhone: pick(import.meta.env.VITE_TENANT_HELPDESK_PHONE, '+91-000-0000000'),
};

/** "Customer Plant" — name + site. Page eyebrows, card headers, email sign-offs. */
export const TENANT_SITE = [TENANT.name, TENANT.site].filter(Boolean).join(' ');

/** "Customer Plant · AP" — the full tenant chip label (region dropped if unset). */
export const TENANT_LABEL = [TENANT_SITE, TENANT.region].filter(Boolean).join(' · ');

/* Hand the resolved identity to the legacy classic script, which runs later. */
if (typeof window !== 'undefined') {
  window.__KV_TENANT = Object.assign({}, TENANT, { siteLabel: TENANT_SITE, label: TENANT_LABEL });
}
