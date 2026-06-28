/**
 * Simple database/lookup for Indian Districts to GPS coordinates.
 * Used for calling the Open-Meteo weather API.
 */
const DISTRICT_COORDINATES = {
  // Uttar Pradesh
  'varanasi': { lat: 25.3176, lon: 82.9739 },
  'lucknow': { lat: 26.8467, lon: 80.9462 },
  'kanpur': { lat: 26.4499, lon: 80.3319 },
  'prayagraj': { lat: 25.4358, lon: 81.8463 },
  'allahabad': { lat: 25.4358, lon: 81.8463 },
  'gorakhpur': { lat: 26.7606, lon: 83.3731 },

  // Maharashtra
  'nashik': { lat: 19.9975, lon: 73.7898 },
  'pune': { lat: 18.5204, lon: 73.8567 },
  'nagpur': { lat: 21.1458, lon: 79.0882 },
  'mumbai': { lat: 19.0760, lon: 72.8777 },
  'aurangabad': { lat: 19.8762, lon: 75.3433 },

  // Punjab
  'ludhiana': { lat: 30.9010, lon: 75.8573 },
  'amritsar': { lat: 31.6340, lon: 74.8723 },
  'jalandhar': { lat: 31.3260, lon: 75.5762 },

  // Bihar
  'patna': { lat: 25.5941, lon: 85.1376 },
  'gaya': { lat: 24.7914, lon: 84.9993 },

  // Andhra Pradesh / Telangana
  'hyderabad': { lat: 17.3850, lon: 78.4867 },
  'guntur': { lat: 16.3067, lon: 80.4365 },
  'vijayawada': { lat: 16.5062, lon: 80.6480 },

  // Gujarat
  'ahmedabad': { lat: 23.0225, lon: 72.5714 },
  'surat': { lat: 21.1702, lon: 72.8311 },
  'rajkot': { lat: 22.3039, lon: 70.8022 }
};

/**
 * Resolve GPS coordinates for a given district name.
 * Falls back to Varanasi coordinates if not found.
 * 
 * @param {string} district - Name of the district
 * @returns {object} - { lat: number, lon: number }
 */
function getCoordinatesForDistrict(district) {
  if (!district || typeof district !== 'string') {
    return DISTRICT_COORDINATES['varanasi']; // Default Varanasi
  }

  const cleanName = district.trim().toLowerCase();
  const coords = DISTRICT_COORDINATES[cleanName];

  if (coords) {
    return coords;
  }

  console.log(`[GPS Utility] Coordinates not found for district "${district}". Using default Varanasi coordinates.`);
  return DISTRICT_COORDINATES['varanasi'];
}

module.exports = {
  getCoordinatesForDistrict
};
