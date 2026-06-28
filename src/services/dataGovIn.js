const dotenv = require('dotenv');
dotenv.config();

/**
 * Service for data.gov.in API integration.
 * Requires developer registration at: https://data.gov.in
 * 
 * Required API key:
 * - DATA_GOV_API_KEY: Set in .env file
 * 
 * Resource IDs:
 * - ICAR varieties: 9ef84268-d588-465a-a308-a864a43d0070
 * - MSP prices: 35985678-0d79-46b4-9ed6-6f13308a1d24
 */

const DATA_GOV_API_KEY = process.env.DATA_GOV_API_KEY;
const ICAR_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const MSP_RESOURCE_ID = '35985678-0d79-46b4-9ed6-6f13308a1d24';

/**
 * Fetch crop variety recommendations from ICAR database.
 * Falls back to mock data if DATA_GOV_API_KEY is not configured or fails.
 * 
 * @param {string} crop - e.g., "Wheat", "Mustard"
 * @param {string} state - e.g., "Uttar Pradesh"
 * @returns {Promise<Array>} - List of crop variety records
 */
async function fetchIcarVarieties(crop, state) {
  // If API key is not provided, use the robust mock fallback
  if (!DATA_GOV_API_KEY || DATA_GOV_API_KEY.trim() === '' || DATA_GOV_API_KEY === 'your_data_gov_key') {
    console.log(`[data.gov.in] DATA_GOV_API_KEY not configured. Using mock ICAR varieties for crop=${crop}, state=${state}.`);
    return getMockIcarVarieties(crop, state);
  }

  try {
    // Construct filters object
    const filters = JSON.stringify({ crop: crop, state: state });
    const url = `https://data.gov.in/api/datastore/resource/${ICAR_RESOURCE_ID}?api-key=${DATA_GOV_API_KEY}&filters=${encodeURIComponent(filters)}&limit=3`;

    console.log(`[data.gov.in] Calling live ICAR Variety API: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`data.gov.in ICAR status ${response.status}`);
    }

    const data = await response.json();
    if (data.records && data.records.length > 0) {
      return data.records;
    }
    
    // Fall back to mock if no records found
    return getMockIcarVarieties(crop, state);
  } catch (error) {
    console.error('[data.gov.in] Error calling live ICAR Variety API, falling back to mock:', error.message);
    return getMockIcarVarieties(crop, state);
  }
}

/**
 * Fetch MSP (Minimum Support Price) for the given crop.
 * Falls back to mock data if DATA_GOV_API_KEY is not configured or fails.
 * 
 * @param {string} crop - e.g., "Wheat", "Mustard"
 * @returns {Promise<object|null>} - MSP record or null
 */
async function fetchMspPrice(crop) {
  if (!DATA_GOV_API_KEY || DATA_GOV_API_KEY.trim() === '' || DATA_GOV_API_KEY === 'your_data_gov_key') {
    console.log(`[data.gov.in] DATA_GOV_API_KEY not configured. Using mock MSP price for crop=${crop}.`);
    return getMockMspPrice(crop);
  }

  try {
    // Note: year is filtered for latest, commodity refers to crop
    const filters = JSON.stringify({ commodity: crop, year: '2024-25' });
    const url = `https://data.gov.in/api/datastore/resource/${MSP_RESOURCE_ID}?api-key=${DATA_GOV_API_KEY}&filters=${encodeURIComponent(filters)}`;

    console.log(`[data.gov.in] Calling live MSP API: ${url}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`data.gov.in MSP status ${response.status}`);
    }

    const data = await response.json();
    if (data.records && data.records.length > 0) {
      return data.records[0];
    }
    
    // Fall back to mock if no records found
    return getMockMspPrice(crop);
  } catch (error) {
    console.error('[data.gov.in] Error calling live MSP API, falling back to mock:', error.message);
    return getMockMspPrice(crop);
  }
}

// ==========================================
// Robust Mock Implementations
// ==========================================

function getMockIcarVarieties(crop, state) {
  const cropLower = crop.toLowerCase();
  
  if (cropLower.includes('wheat')) {
    return [
      {
        variety_name: 'HD-3086 (Pusa Gautami)',
        crop: 'Wheat',
        state: state || 'Uttar Pradesh',
        year_released: '2016',
        yield_qtl_ha: '55.1',
        maturity_days: '143',
        special_traits: 'Heat tolerant, high rust resistance, excellent chapati making quality',
        recommended_zone: 'Northeastern Plains Zone / Central Zone'
      },
      {
        variety_name: 'DBW-187 (Karan Vandana)',
        crop: 'Wheat',
        state: state || 'Uttar Pradesh',
        year_released: '2019',
        yield_qtl_ha: '61.3',
        maturity_days: '120',
        special_traits: 'High yield, lodging resistant, highly resistant to leaf rust and blast',
        recommended_zone: 'Eastern Plains Zone'
      }
    ];
  } else if (cropLower.includes('mustard')) {
    return [
      {
        variety_name: 'RH-749',
        crop: 'Mustard',
        state: state || 'Uttar Pradesh',
        year_released: '2013',
        yield_qtl_ha: '26.5',
        maturity_days: '142',
        special_traits: 'Bold seeded variety, high oil content (40%), drought tolerant',
        recommended_zone: 'Haryana, Punjab, Delhi, Rajasthan, UP'
      }
    ];
  } else if (cropLower.includes('rice') || cropLower.includes('paddy')) {
    return [
      {
        variety_name: 'Pusa Basmati 1121',
        crop: 'Rice',
        state: state || 'Uttar Pradesh',
        year_released: '2003',
        yield_qtl_ha: '45.0',
        maturity_days: '135',
        special_traits: 'Extra-long slender grain, premium aroma, high elongation ratio',
        recommended_zone: 'Northwestern India'
      }
    ];
  }
  
  // Generic crop fallback
  return [
    {
      variety_name: `Co-${crop} Gold`,
      crop: crop,
      state: state || 'Uttar Pradesh',
      year_released: '2022',
      yield_qtl_ha: '40.0',
      maturity_days: '110',
      special_traits: 'Locally adapted, pest resistant, medium maturity duration',
      recommended_zone: 'All India'
    }
  ];
}

function getMockMspPrice(crop) {
  const cropLower = crop.toLowerCase();
  
  const mspDatabase = {
    'wheat': { commodity: 'Wheat', msp_per_quintal: '2275', year: '2024-25', season: 'Rabi', announcement_date: '2024-10-16' },
    'mustard': { commodity: 'Mustard', msp_per_quintal: '5650', year: '2024-25', season: 'Rabi', announcement_date: '2024-10-16' },
    'barley': { commodity: 'Barley', msp_per_quintal: '1850', year: '2024-25', season: 'Rabi', announcement_date: '2024-10-16' },
    'gram': { commodity: 'Gram', msp_per_quintal: '5440', year: '2024-25', season: 'Rabi', announcement_date: '2024-10-16' },
    'safflower': { commodity: 'Safflower', msp_per_quintal: '5800', year: '2024-25', season: 'Rabi', announcement_date: '2024-10-16' },
    'rice': { commodity: 'Paddy (Common)', msp_per_quintal: '2300', year: '2024-25', season: 'Kharif', announcement_date: '2024-06-19' },
    'paddy': { commodity: 'Paddy (Common)', msp_per_quintal: '2300', year: '2024-25', season: 'Kharif', announcement_date: '2024-06-19' },
    'maize': { commodity: 'Maize', msp_per_quintal: '2090', year: '2024-25', season: 'Kharif', announcement_date: '2024-06-19' },
    'cotton': { commodity: 'Cotton (Medium Staple)', msp_per_quintal: '7120', year: '2024-25', season: 'Kharif', announcement_date: '2024-06-19' }
  };

  // Find matches
  for (const [key, value] of Object.entries(mspDatabase)) {
    if (cropLower.includes(key)) {
      return value;
    }
  }

  // Generic fallback if not matched
  return {
    commodity: crop,
    msp_per_quintal: '2100',
    year: '2024-25',
    season: 'Kharif/Rabi',
    announcement_date: '2024-06-19'
  };
}

module.exports = {
  fetchIcarVarieties,
  fetchMspPrice
};
