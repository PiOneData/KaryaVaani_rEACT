/* logger.js — tiny structured logger so the server has no external deps. */
function ts() { return new Date().toISOString(); }

module.exports = {
  info: (...a) => console.log(ts(), '[info]', ...a),
  warn: (...a) => console.warn(ts(), '[warn]', ...a),
  error: (...a) => console.error(ts(), '[error]', ...a)
};
