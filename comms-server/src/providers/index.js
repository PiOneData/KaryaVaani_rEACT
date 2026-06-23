/* providers/index.js — selects the active provider from config. */
const config = require('./../config');

let provider;
if (config.effectiveProvider === 'meta') {
  provider = require('./meta');
} else {
  provider = require('./mock');
}

module.exports = provider;
