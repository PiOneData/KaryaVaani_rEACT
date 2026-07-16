/* server.js -- standalone communication server entry point.

   A small, reusable HTTP gateway for messaging channels. Today it exposes the
   WhatsApp channel (AOC portal "BOT API" gateway by default, legacy Meta
   Cloud API optional, with a credential-free mock fallback).
   It holds the provider credentials server-side so that any number of client
   applications can send/receive WhatsApp messages through one shared service
   without ever embedding tokens in a browser or another codebase.

   Mounts:
     GET  /health
     /v1/whatsapp/*   (see src/channels/whatsapp.js)
*/
const express = require('express');
const cors = require('cors');

const config = require('./src/config');
const logger = require('./src/logger');
const provider = require('./src/providers');
const whatsapp = require('./src/channels/whatsapp');

const app = express();

app.use(
  cors({
    origin: config.allowedOrigins === '*' ? true : config.allowedOrigins.split(',').map((s) => s.trim())
  })
);

/* Capture the raw body (needed for Meta signature verification) while still
   parsing JSON for handlers. */
app.use(
  express.json({
    limit: '5mb',
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    }
  })
);

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'comms-server',
    channel: 'whatsapp',
    provider: provider.name,
    configuredProvider: config.provider,
    authEnabled: !!config.apiKey,
    forwarding: !!config.forwardUrl,
    testMode: !!(config.testRecipients && config.testRecipients.length),
    testRecipient: config.testRecipient || null,
    testRecipients: (config.testRecipients || []).map((r) => (r.lang ? r.number + ':' + r.lang : r.number))
  });
});

app.use('/v1/whatsapp', whatsapp);

app.use((req, res) => res.status(404).json({ ok: false, error: 'not found' }));

app.listen(config.port, () => {
  logger.info(`comms-server listening on http://localhost:${config.port}`);
  logger.info(`active WhatsApp provider: ${provider.name}`);
  if (config.testRecipients && config.testRecipients.length) {
    logger.warn(`TEST MODE: all outbound messages sent to ${config.testRecipients.map((r) => (r.lang ? r.number + ':' + r.lang : r.number)).join(', ')}`);
  }
  if (provider.name === 'mock' && config.provider === 'aoc') {
    logger.warn('AOC requested but credentials missing -- running in MOCK mode. Set AOC_API_KEY and AOC_FROM_ID to send real messages.');
  }
  if (provider.name === 'mock' && config.provider === 'meta') {
    logger.warn('META requested but credentials missing -- running in MOCK mode. Set META_PHONE_NUMBER_ID and META_ACCESS_TOKEN to send real messages.');
  }
});
