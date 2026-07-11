/* config.js -- central configuration, sourced entirely from environment variables.
   Nothing app-specific lives here, so the server can be reused as-is by any
   application that needs a WhatsApp (or, later, multi-channel) gateway. */

function bool(v, def = false) {
  if (v === undefined || v === null || v === '') return def;
  return String(v).toLowerCase() === 'true' || v === '1';
}

const config = {
  port: parseInt(process.env.PORT || '4100', 10),

  /* Comma-separated list of allowed CORS origins, or "*" for any. */
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').trim(),

  /* API key that callers must present (x-api-key header) on send endpoints.
     If unset, auth is disabled -- only do that on a trusted private network. */
  apiKey: process.env.COMMS_API_KEY || '',

  /* Which provider drives WhatsApp: "aoc" (BOT API portal), "meta" or "mock".
     If a live provider is selected but credentials are missing, the server
     automatically falls back to "mock" so callers never hard-fail. */
  provider: (process.env.WHATSAPP_PROVIDER || 'aoc').toLowerCase(),

  aoc: {
    /* AOC portal ("BOT API") gateway — docs: https://developers.aoc-portal.com */
    baseUrl: (process.env.AOC_BASE_URL || 'https://apis.aoc-portal.com').replace(/\/$/, ''),
    /* Account API key (portal login → API key); sent as the `apikey` header. */
    apiKey: process.env.AOC_API_KEY || '',
    /* Sender WhatsApp number ("From Id" in the portal), digits only,
       e.g. 918220099940 for the KaryaVani number. */
    fromId: process.env.AOC_FROM_ID || '',
    /* Shared secret expected on inbound webhook calls. Add the same
       header/value pair in the portal webhook's "Add Headers" dialog.
       Leave the token empty to accept unauthenticated calls (dev only). */
    webhookTokenHeader: process.env.AOC_WEBHOOK_TOKEN_HEADER || 'x-webhook-token',
    webhookToken: process.env.AOC_WEBHOOK_TOKEN || ''
  },

  meta: {
    apiVersion: process.env.META_API_VERSION || 'v21.0',
    phoneNumberId: process.env.META_PHONE_NUMBER_ID || '',
    accessToken: process.env.META_ACCESS_TOKEN || '',
    /* Token you choose; must match what you enter in the Meta webhook setup. */
    verifyToken: process.env.META_VERIFY_TOKEN || 'karya-vaani-verify',
    /* App secret, used to validate the X-Hub-Signature-256 on inbound calls.
       Optional but recommended in production. */
    appSecret: process.env.META_APP_SECRET || '',
    graphBase: process.env.META_GRAPH_BASE || 'https://graph.facebook.com'
  },

  /* Optional: every inbound message / status is POSTed to this URL so other
     applications can subscribe without polling. Leave empty to disable. */
  forwardUrl: process.env.COMMS_FORWARD_URL || '',

  /* How many messages to keep in the in-memory log (per process). */
  storeLimit: parseInt(process.env.COMMS_STORE_LIMIT || '500', 10),

  /* TEST SAFETY VALVE: when set, every outbound message is redirected to this
     single number regardless of the requested recipient. Use during testing
     so nothing reaches real workers. Leave empty in production. */
  testRecipient: process.env.WHATSAPP_TEST_RECIPIENT || '',

  verifySignature: bool(process.env.COMMS_VERIFY_SIGNATURE, false)
};

/* Decide the effective provider: fall back to mock when the selected live
   provider is missing its credentials, so callers never hard-fail. */
config.effectiveProvider = (() => {
  if (config.provider === 'aoc') {
    return config.aoc.apiKey && config.aoc.fromId ? 'aoc' : 'mock';
  }
  if (config.provider === 'meta') {
    return config.meta.phoneNumberId && config.meta.accessToken ? 'meta' : 'mock';
  }
  return config.provider;
})();

module.exports = config;
