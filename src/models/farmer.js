const db = require('../db');

/**
 * Fetch a farmer's profile by ID.
 * @param {string} farmerId 
 * @returns {object|null}
 */
function getFarmerProfile(farmerId) {
  return db.farmers.get(farmerId);
}

/**
 * Update a farmer's profile.
 * @param {object} profile - Farmer profile data
 * @returns {object} - Updated profile
 */
function updateFarmerProfile(profile) {
  return db.farmers.save(profile);
}

/**
 * Register a new farmer.
 * @param {object} farmer 
 * @returns {object} - Registered farmer
 */
function createFarmer(farmer) {
  return db.farmers.save(farmer);
}

module.exports = {
  getFarmerProfile,
  updateFarmerProfile,
  createFarmer
};
