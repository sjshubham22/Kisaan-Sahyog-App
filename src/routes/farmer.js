const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { validateProfileRequest } = require('../middleware/validate');
const { getFarmerProfile, updateFarmerProfile } = require('../models/farmer');
const { getCoordinatesForDistrict } = require('../utils/gps');
const { runWeatherThresholdCheck } = require('../agents/weatherAlertAgent');
const db = require('../db');

// Apply auth middleware to all farmer routes
router.use(authMiddleware);

/**
 * GET /api/farmer/profile
 * Retrieve current farmer's profile.
 */
router.get('/profile', (req, res) => {
  try {
    const profile = getFarmerProfile(req.farmer_id);
    if (!profile) {
      return res.status(404).json({ error: 'Farmer profile not found.' });
    }
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error fetching profile.' });
  }
});

/**
 * POST /api/farmer/profile
 * Update current farmer's profile.
 */
router.post('/profile', validateProfileRequest, (req, res) => {
  try {
    const profile = getFarmerProfile(req.farmer_id);
    if (!profile) {
      return res.status(404).json({ error: 'Farmer profile not found.' });
    }

    const { name, phone, district, state, primary_crop, land_bigha, irrigation } = req.body;

    // Resolve coordinates if district or state changed
    let gps_lat = profile.gps_lat;
    let gps_lon = profile.gps_lon;
    if (district !== profile.district || state !== profile.state) {
      const coords = getCoordinatesForDistrict(district);
      gps_lat = coords.lat;
      gps_lon = coords.lon;
    }

    const updatedProfile = {
      farmer_id: req.farmer_id,
      name,
      phone,
      district,
      state,
      gps_lat,
      gps_lon,
      primary_crop,
      land_bigha: parseFloat(land_bigha) || 0,
      irrigation
    };

    updateFarmerProfile(updatedProfile);
    res.json(updatedProfile);
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error updating profile.' });
  }
});

/**
 * GET /api/farmer/alerts
 * Trigger on-demand weather threshold check and return active alerts.
 */
router.get('/alerts', async (req, res) => {
  try {
    const profile = getFarmerProfile(req.farmer_id);
    if (!profile) {
      return res.status(404).json({ error: 'Farmer profile not found.' });
    }

    // 1. Fetch active unseen alerts already in database
    let activeAlerts = db.alerts.getActiveForFarmer(req.farmer_id);

    // 2. If no alerts in DB, check weather API on-demand for any new thresholds crossed
    if (activeAlerts.length === 0) {
      const newAlert = await runWeatherThresholdCheck(profile);
      if (newAlert) {
        // Save the new alert in the DB
        const saved = db.alerts.save({
          farmer_id: req.farmer_id,
          alert_type: newAlert.alert_type,
          severity: newAlert.severity,
          message: newAlert.message,
          valid_until: newAlert.valid_until
        });
        activeAlerts = [saved];
      }
    }

    res.json(activeAlerts);
  } catch (error) {
    console.error('Error checking active alerts:', error);
    res.status(500).json({ error: 'Internal server error checking alerts.' });
  }
});

/**
 * POST /api/farmer/alerts/dismiss
 * Dismiss (mark as seen) active weather alerts.
 */
router.post('/alerts/dismiss', (req, res) => {
  try {
    db.alerts.markAsSeen(req.farmer_id);
    res.json({ success: true, message: 'Alerts marked as seen.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error dismissing alerts.' });
  }
});

module.exports = router;
