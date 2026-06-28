const db = require('../db');

/**
 * Get item from cache. Returns null if expired or not found.
 * @param {string} key 
 * @returns {object|null}
 */
function get(key) {
  return db.cache.get(key);
}

/**
 * Set item in cache with a TTL in seconds.
 * @param {string} key 
 * @param {object} valueObj 
 * @param {number} ttlSeconds 
 */
function set(key, valueObj, ttlSeconds) {
  db.cache.set(key, valueObj, ttlSeconds);
}

module.exports = {
  get,
  set
};
