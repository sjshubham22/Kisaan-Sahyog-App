const dotenv = require('dotenv');
dotenv.config();

/**
 * Service for NDMA Sachet API integration.
 * Requires organization registration at: https://sachet.ndma.gov.in
 * 
 * Required Token:
 * - NDMA_SACHET_TOKEN: Set in .env file as a Bearer token.
 */

const NDMA_SACHET_TOKEN = process.env.NDMA_SACHET_TOKEN;

/**
 * Fetch active disaster alerts for the given state.
 * Falls back to mock data if NDMA_SACHET_TOKEN is not configured or fails.
 * 
 * @param {string} state - The state name (e.g. "Uttar Pradesh", "Maharashtra")
 * @param {string} [district] - Optional district for filtering
 * @returns {Promise<Array>} - Active warnings
 */
async function fetchActiveAlerts(state, district = '') {
  if (!NDMA_SACHET_TOKEN || NDMA_SACHET_TOKEN.trim() === '' || NDMA_SACHET_TOKEN === 'your_ndma_bearer_token') {
    console.log(`[NDMA Sachet] NDMA_SACHET_TOKEN not configured. Using mock alerts for state=${state}, district=${district}.`);
    return getMockAlerts(state, district);
  }

  try {
    const url = `https://sachet.ndma.gov.in/cap/warningapi/api/warning?state=${encodeURIComponent(state)}&type=all&active=true`;
    console.log(`[NDMA Sachet] Calling live NDMA Sachet API: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${NDMA_SACHET_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`NDMA Sachet API status ${response.status}`);
    }

    const data = await response.json();
    let alerts = data.alerts || [];

    // Filter by district if provided
    if (district && alerts.length > 0) {
      alerts = alerts.filter(alert => {
        if (!alert.districts) return true;
        return alert.districts.some(d => d.toLowerCase() === district.toLowerCase());
      });
    }

    return alerts;
  } catch (error) {
    console.error('[NDMA Sachet] Error calling NDMA Sachet API, falling back to mock:', error.message);
    return getMockAlerts(state, district);
  }
}

// ==========================================
// Robust Mock Implementations
// ==========================================

function getMockAlerts(state, district) {
  // Return alerts mock based on state/district or return a default simulation.
  // During testing, if the state is "Uttar Pradesh" and district is "Varanasi",
  // we can simulate an alert, or return a list of typical alerts.
  // For demonstration, let's trigger a Heatwave/Rain warning depending on current date,
  // or return a mock alert that can be triggered dynamically.
  
  const currentMonth = new Date().getMonth(); // 0 = Jan, 5 = June, etc.
  
  if (currentMonth >= 4 && currentMonth <= 6) {
    // May - July: Heatwave alerts
    return [
      {
        id: 'NDMA-MOCK-HW-001',
        type: 'Heatwave',
        severity: 'Extreme',
        districts: [district || 'Varanasi', 'Lucknow', 'Allahabad'],
        state: state,
        issued_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days valid
        message: 'Severe heatwave conditions expected. Temperatures exceeding 45°C. Avoid direct sunlight between 12:00 PM and 4:00 PM. Keep livestock shaded and hydrated.'
      }
    ];
  } else if (currentMonth >= 7 && currentMonth <= 9) {
    // August - October: Monsoon heavy rainfall alerts
    return [
      {
        id: 'NDMA-MOCK-RF-002',
        type: 'HeavyRainfall',
        severity: 'High',
        districts: [district || 'Varanasi', 'Mirzapur'],
        state: state,
        issued_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours valid
        message: 'Heavy to very heavy rainfall forecast (exceeding 70mm). Low-lying fields might experience waterlogging. Clear drainage channels immediately.'
      }
    ];
  }

  // Fallback: No active warnings
  return [];
}

module.exports = {
  fetchActiveAlerts
};
