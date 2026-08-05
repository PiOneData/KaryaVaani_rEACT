/**
 * licence-policy.js — CLRA licensed-headcount ceilings that Daikin has fixed by
 * policy, rather than leaving to the generic backfill.
 *
 * Where a contractor has no clraLicence on record, both the seed script and the
 * server boot backfill invent a ceiling by spreading a factor over the deployed
 * headcount. That is fine for demo agencies nobody is transacting against, but
 * it produces a number with no basis in the agency's actual licence — and once
 * written it is never revised, so two deployments seeded at different times can
 * disagree about the same agency's ceiling.
 *
 * An agency listed here is pinned to its real licensed headcount instead, so
 * every surface (agency portal, HR vendor grid, onboarding gate) reads the same
 * number. The pin is applied on every boot and is idempotent.
 *
 * It deliberately yields to HR: an HR edit through the licence editor stamps
 * clraLicence.updatedBy, and a licence carrying that stamp is never re-pinned.
 * The policy sets the starting number; a person with the licence in front of
 * them always outranks it.
 */

/* Keyed by contractor name, matched case- and whitespace-insensitively so a
   trailing space or a casing difference in the roster cannot silently drop the
   pin back to the invented ceiling. */
const LICENCE_CEILING_POLICY = {
  'ark hr solutions & services': 145
};

function licenceCeilingFor(name) {
  const key = String(name || '').trim().replace(/\s+/g, ' ').toLowerCase();
  if (!key) return null;
  const v = LICENCE_CEILING_POLICY[key];
  return typeof v === 'number' && isFinite(v) && v >= 0 ? v : null;
}

/* True once HR has saved the licence by hand — the pin must not overwrite it. */
function licenceSetByHR(lic) {
  return !!(lic && lic.updatedBy);
}

module.exports = { LICENCE_CEILING_POLICY, licenceCeilingFor, licenceSetByHR };
