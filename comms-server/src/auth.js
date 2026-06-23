/* auth.js — simple API-key gate for outbound/send endpoints. */
const config = require('./config');

function requireApiKey(req, res, next) {
  if (!config.apiKey) return next(); // auth disabled
  const provided = req.get('x-api-key') || req.query.api_key;
  if (provided && provided === config.apiKey) return next();
  return res.status(401).json({ ok: false, error: 'invalid or missing api key' });
}

module.exports = { requireApiKey };
