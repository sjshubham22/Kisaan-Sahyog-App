const { generateJson } = require('../services/gemini');
const { fetchIcarVarieties, fetchMspPrice } = require('../services/dataGovIn');
const { fetchWeatherData } = require('../services/openMeteo');

const CROP_ADVISORY_SYSTEM_INSTRUCTION = `You are "Kisaan Sahyog", an expert agricultural advisor specializing in Indian smallholder farming.
Your goal is to synthesize real agricultural data (varieties, mandi/MSP prices, weather, soil moisture, evapotranspiration) to provide a clear, actionable crop advisory.

Rules:
1. Language: You must respond ONLY in English.
2. Tone: Helpful, simple, and direct. Avoid academic jargon.
3. Units: Always use standard Indian farming units:
   - "bigha" (not hectare) for land area.
   - "quintal" (not kg) for yields/weights.
   - "bags" (not kg) for fertilizer quantities (e.g., "1 bag Urea per bigha").
4. Length: Keep the chat response under 200 words.
5. Structure:
   - Keep the main text conversational, concluding with exactly ONE clear, practical action the farmer can take TODAY or THIS WEEK.
   - Do NOT use markdown headers, bold headers, or bullet points in the conversational text.
   - Separate the conversational text from the structured data card fields.
6. Schema: You must return a JSON object matching the provided response schema. If data for a specific field is missing, provide a reasonable agricultural estimation based on the region and crop, noting it is a guidance.`;

const cropAdvisoryResponseSchema = {
  type: 'OBJECT',
  properties: {
    message: { 
      type: 'STRING', 
      description: 'The conversational response text to display in the chat bubble. Must be under 200 words, simple English, and end with one clear action for this week.' 
    },
    structured_data: {
      type: 'OBJECT',
      properties: {
        variety: { type: 'STRING', description: 'Recommended variety name (e.g., HD-3086)' },
        sowing_window: { type: 'STRING', description: 'Best sowing window (e.g., 10-25 November)' },
        fertiliser: { type: 'STRING', description: 'Fertilizer schedule in bags per bigha' },
        msp_price: { type: 'STRING', description: 'MSP price details (e.g., Rs. 2275 per quintal)' },
        yield_estimate: { type: 'STRING', description: 'Expected yield estimate in quintals per bigha' },
        irrigation_advice: { type: 'STRING', description: 'Irrigation frequency recommendations' }
      },
      required: ['variety', 'sowing_window', 'fertiliser', 'msp_price', 'yield_estimate', 'irrigation_advice']
    }
  },
  required: ['message', 'structured_data']
};

/**
 * Runs the Crop Advisory Agent: collects data and calls Gemini for synthesis.
 * @param {string} userQuery - The farmer's question
 * @param {object} profile - The farmer's profile (district, state, primary_crop, gps_lat, gps_lon, irrigation)
 * @returns {Promise<object>} - Structured response containing message and card details
 */
async function runCropAdvisoryAgent(userQuery, profile) {
  try {
    const crop = profile.primary_crop || 'Wheat';
    const state = profile.state || 'Uttar Pradesh';
    const district = profile.district || 'Varanasi';
    const lat = profile.gps_lat || 25.3176;
    const lon = profile.gps_lon || 82.9739;
    const irrigationType = profile.irrigation || 'borewell';

    console.log(`[Crop Advisory Agent] Gathering data for ${profile.name} (${crop} in ${district}, ${state})`);

    // Fetch API data in parallel
    const [icarVarieties, mspRecord, weatherData] = await Promise.all([
      fetchIcarVarieties(crop, state).catch(err => {
        console.error('Failed to fetch ICAR varieties:', err.message);
        return [];
      }),
      fetchMspPrice(crop).catch(err => {
        console.error('Failed to fetch MSP price:', err.message);
        return null;
      }),
      fetchWeatherData(lat, lon).catch(err => {
        console.error('Failed to fetch weather data:', err.message);
        return null;
      })
    ]);

    // Extract relevant soil and weather metrics if available
    let soilMoisture = 'N/A';
    let et0 = 'N/A';
    let rainfall7Day = 0;

    if (weatherData) {
      if (weatherData.hourly && weatherData.hourly.soil_moisture_0_to_1cm) {
        // Average soil moisture of the current day (first 24 entries)
        const moistureToday = weatherData.hourly.soil_moisture_0_to_1cm.slice(0, 24);
        const sum = moistureToday.reduce((a, b) => a + b, 0);
        soilMoisture = (sum / moistureToday.length).toFixed(2) + ' m³/m³';
      }

      if (weatherData.daily) {
        if (weatherData.daily.et0_fao_evapotranspiration) {
          et0 = weatherData.daily.et0_fao_evapotranspiration[0] + ' mm/day';
        }
        if (weatherData.daily.precipitation_sum) {
          rainfall7Day = weatherData.daily.precipitation_sum.reduce((a, b) => a + b, 0).toFixed(1);
        }
      }
    }

    // Format MSP details
    const mspPrice = mspRecord ? `Rs. ${mspRecord.msp_per_quintal} per quintal (Season: ${mspRecord.season})` : 'Rs. 2275 per quintal (estimated)';

    // Build the prompt for Gemini
    const userPrompt = `
Farmer Profile:
- Name: ${profile.name}
- Location: ${district}, ${state}
- Crop: ${crop}
- Land size: ${profile.land_bigha || 'N/A'} bigha
- Irrigation source: ${irrigationType}

Data Fetched from APIs:
- ICAR Variety Recommendations: ${JSON.stringify(icarVarieties)}
- Government MSP: ${mspPrice}
- Current Soil Moisture (top 1cm average): ${soilMoisture}
- Current Evapotranspiration (ET0): ${et0}
- 7-Day Total Precipitation Forecast: ${rainfall7Day} mm

Farmer's Question: "${userQuery}"

Task:
Please synthesize this information. Estimate yields based on the variety and input details (usually 15-20 quintals per bigha for wheat under irrigated conditions). Calculate and provide advice in simple terms. Specify sowing windows, fertilizer schedules, and irrigation plans.
Remember to end the message with ONE clear advice for this week.
`;

    // Generate response using Gemini
    const result = await generateJson(userPrompt, CROP_ADVISORY_SYSTEM_INSTRUCTION, cropAdvisoryResponseSchema);
    
    // Set type flag in structured_data
    result.structured_data.type = 'crop_advisory';
    result.structured_data.data_sources = ['ICAR Varieties', 'MSP 2024-25', 'Open-Meteo'];

    return result;
  } catch (error) {
    console.error('[Crop Advisory Agent] Error:', error);
    return {
      message: "Sorry, I encountered an issue pulling the latest crop database records. General advice for wheat: sow between Nov 10-25 using HD-3086 variety, apply 2 bags of DAP per bigha. Please check your soil moisture before watering.",
      structured_data: {
        type: 'crop_advisory',
        variety: "HD-3086",
        sowing_window: "Nov 10 - Nov 25",
        fertiliser: "2 bags DAP per bigha",
        msp_price: "Rs. 2275 per quintal",
        yield_estimate: "15-18 quintals per bigha",
        irrigation_advice: "Irrigate every 20-25 days",
        data_sources: ['Fallback Static Database']
      }
    };
  }
}

module.exports = {
  runCropAdvisoryAgent
};
