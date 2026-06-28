const dns = require('dns');

/**
 * Fetch weather forecast and soil/ET0 data from Open-Meteo API for given coordinates.
 * Open-Meteo does not require an API key.
 * 
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<object>} - Soil and weather data
 */
async function fetchWeatherData(lat, lon) {
  try {
    // Standard forecast URL with combined daily and hourly fields:
    // - Daily: ET0, precipitation, max/min temperature, max windspeed, weather code
    // - Hourly: Soil moisture (0-1cm), soil temperature, temperature, precipitation, windspeed, weather code
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=et0_fao_evapotranspiration,precipitation_sum,temperature_2m_max,temperature_2m_min,windspeed_10m_max,weathercode&hourly=soil_moisture_0_to_1cm,soil_temperature_0cm,temperature_2m,precipitation,windspeed_10m,weathercode&timezone=Asia%2FKolkata&forecast_days=7`;

    console.log(`Fetching Open-Meteo weather data: ${url}`);
    
    // Set a timeout of 5 seconds
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);

    if (!response.ok) {
      throw new Error(`Open-Meteo API error: status ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error in openMeteo.fetchWeatherData:', error.message);
    throw error;
  }
}

module.exports = {
  fetchWeatherData
};
