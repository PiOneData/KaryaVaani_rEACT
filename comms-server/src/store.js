/* store.js — in-memory message log + subscriber fan-out.

   Keeps a rolling window of the most recent inbound/outbound messages and
   delivery status updates so any client (e.g. a chat UI) can poll for them.
   Also forwards events to an optional external webhook (config.forwardUrl)
   so other applications can subscribe push-style. Swap this for Redis/DB
   if you need durability across restarts or multiple instances. */
const config = require('./config');
const logger = require('./logger');

const messages = []; // newest last
let seq = 0;

/* Lifetime counters — survive the rolling-window trim so the /metrics
   endpoint reflects everything seen since boot, not just what's in the log. */
const stats = {
  since: new Date().toISOString(),
  inbound: 0,
  outbound: 0,
  events: 0,
  statuses: { sent: 0, delivered: 0, read: 0, failed: 0, other: 0 },
  lastEventAt: null
};

function count(evt) {
  if (evt.direction === 'in') stats.inbound++;
  else if (evt.direction === 'out') stats.outbound++;
  else if (evt.direction === 'status') {
    const s = String(evt.status || '').toLowerCase();
    if (s in stats.statuses) stats.statuses[s]++;
    else stats.statuses.other++;
  } else stats.events++;
  stats.lastEventAt = new Date().toISOString();
}

function add(evt) {
  const record = { seq: ++seq, at: new Date().toISOString(), ...evt };
  messages.push(record);
  while (messages.length > config.storeLimit) messages.shift();
  count(record);
  forward(record);
  return record;
}

function list({ since = 0, direction, channel, to, from, limit = 100 } = {}) {
  let out = messages.filter((m) => m.seq > Number(since || 0));
  if (direction) out = out.filter((m) => m.direction === direction);
  if (channel) out = out.filter((m) => m.channel === channel);
  if (to) out = out.filter((m) => m.to === to);
  if (from) out = out.filter((m) => m.from === from);
  if (limit) out = out.slice(-Number(limit));
  return out;
}

function forward(record) {
  if (!config.forwardUrl) return;
  /* fire-and-forget; never let a slow subscriber block message handling */
  Promise.resolve()
    .then(() =>
      fetch(config.forwardUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      })
    )
    .catch((err) => logger.warn('forward webhook failed:', err.message));
}

function metrics() {
  return { ...stats, statuses: { ...stats.statuses }, logSize: messages.length };
}

module.exports = { add, list, metrics };
