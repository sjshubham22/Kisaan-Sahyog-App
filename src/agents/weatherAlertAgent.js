const { generateJson } = require('../services/gemini');
const { fetchWeatherData } = require('../services/openMeteo');
const { fetchActiveAlerts } = require('../services/ndmaSachet');
const { evaluateThresholds } = require('../thresholds/weatherRules');

const WEATHER_SUMMARY_SYSTEM_INSTRUCTION = `You are "Kisaan Sahyog", an expert agricultural weather advisor for Indian farmers.
Your task is to synthesize a 7-day weather forecast and active official disaster alerts into a friendly, plain English weekly advisory.

Rules:
1. Language: English only.
2. Word limit: Under 150 words.
3. Guidelines:
   - Provide an overall outlook for the week.
   - Explicitly list the best days of the week for field work (like spraying, harvesting, or weeding) and days to avoid (due to rain or extreme heat).
   - Give one irrigation recommendation based on the rainfall forecast.
   - Mention specific days of the week (e.g., "Tuesday", "Friday") rather than "day 3" or "in 4 days".
4. Schema: Return a JSON object matching the requested schema. Do not use formatting, headers, or bullet points in the "message" field.`;

const weatherSummarySchema = {
  type: 'OBJECT',
  properties: {
    message: { 
      type: 'STRING', 
      description: 'Friendly 7-day weather summary text. Under 150 words, conversational English, no headers, no bullet points. Must mention specific days of the week and give an irrigation tip.' 
    },
    structured_data: {
      type: 'OBJECT',
      properties: {
        forecast_days: { type: 'INTEGER' },
        key_risk: { type: 'STRING', description: 'Brief description of the main weather risk this week (e.g., High heat on Mon-Tue)' },
        recommended_action: { type: 'STRING', description: 'Immediate protective action recommendation' }
      },
      required: ['forecast_days', 'key_risk', 'recommended_action']
    }
  },
  required: ['message', 'structured_data']
};

const WEATHER_ALERT_SYSTEM_INSTRUCTION = `You are "Kisaan Sahyog", an emergency agricultural advisor.
Your job is to generate a short, urgent weather warning for a farmer based on active official alerts and crossed meteorological thresholds.

Rules:
1. Language: English only.
2. Length: Under 3 sentences maximum.
3. Content:
   - State exactly what weather is coming and on which specific day of the week (e.g. "Tuesday" instead of "in 48 hours").
   - Give ONE protective action specific to their crop (e.g., Wheat) at their current cultivation stage.
   - State urgency clearly (TODAY, within 24 hours, this week).
4. Formatting: Output plain conversational text only. No bullet points, no headers, no emojis.
5. Schema: Return a JSON object matching the requested schema.`;

const weatherAlertSchema = {
  type: 'OBJECT',
  properties: {
    message: { 
      type: 'STRING', 
      description: 'The urgent warning text (maximum 3 sentences, English, conversational, no bullet points or emojis).' 
    },
    severity: { type: 'STRING', enum: ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'] },
    alert_type: { type: 'STRING', description: 'Type of alert (e.g. Heavy Rain, Heatwave, Severe Storm)' }
  },
  required: ['message', 'severity', 'alert_type']
};

/**
 * Runs the Weather Agent on-demand: fetches forecast and provides a weekly summary.
 * @param {string} userQuery - The farmer's question
 * @param {object} profile - The farmer's profile
 * @returns {Promise<object>} - Structured response with message and weather card
 */
async function runWeatherOnDemand(userQuery, profile) {
  try {
    const lat = profile.gps_lat || 25.3176;
    const lon = profile.gps_lon || 82.9739;
    const state = profile.state || 'Uttar Pradesh';
    const district = profile.district || 'Varanasi';

    console.log(`[Weather Agent] Fetching weather forecast for coordinates: ${lat}, ${lon}`);
    const [weatherData, ndmaAlerts] = await Promise.all([
      fetchWeatherData(lat, lon),
      fetchActiveAlerts(state, district)
    ]);

    // Map daily weather codes to readable days
    const dailyForecast = [];
    if (weatherData && weatherData.daily) {
      const times = weatherData.daily.time || [];
      for (let i = 0; i < times.length; i++) {
        dailyForecast.push({
          date: times[i],
          temp_max: weatherData.daily.temperature_2m_max[i],
          temp_min: weatherData.daily.temperature_2m_min[i],
          rain: weatherData.daily.precipitation_sum[i],
          wind_max: weatherData.daily.windspeed_10m_max[i]
        });
      }
    }

    const userPrompt = `
Farmer Location: ${district}, ${state}
Crop: ${profile.primary_crop || 'Wheat'}

7-Day Forecast Data:
${JSON.stringify(dailyForecast)}

Active NDMA Disaster Alerts:
${JSON.stringify(ndmaAlerts)}

Farmer's Question: "${userQuery}"
`;

    const result = await generateJson(userPrompt, WEATHER_SUMMARY_SYSTEM_INSTRUCTION, weatherSummarySchema);
    
    result.structured_data.type = 'weather_summary';
    result.structured_data.data_sources = ['Open-Meteo Forecast', 'NDMA Sachet'];
    
    // Evaluate if any active alerts triggered to attach to response
    const triggeredRules = evaluateThresholds(weatherData);
    if (triggeredRules.length > 0 || ndmaAlerts.length > 0) {
      result.active_alerts_exist = true;
    } else {
      result.active_alerts_exist = false;
    }

    return result;
  } catch (error) {
    console.error('[Weather Agent] Error in runWeatherOnDemand:', error);
    return {
      message: "I am unable to reach the weather forecast service right now. Please check your local forecast. Generally, keep wheat crops irrigated if temperatures are rising.",
      structured_data: {
        type: 'weather_summary',
        forecast_days: 7,
        key_risk: "Unknown due to connection timeout",
        recommended_action: "Monitor skies and local announcements",
        data_sources: ['Static Fallback']
      },
      active_alerts_exist: false
    };
  }
}

/**
 * Checks weather thresholds and generates an alert banner if triggered.
 * @param {object} profile - Farmer profile
 * @returns {Promise<object|null>} - Weather alert object to be saved in DB or null if no alerts
 */
async function runWeatherThresholdCheck(profile) {
  try {
    const lat = profile.gps_lat || 25.3176;
    const lon = profile.gps_lon || 82.9739;
    const state = profile.state || 'Uttar Pradesh';
    const district = profile.district || 'Varanasi';

    console.log(`[Weather Agent] Checking thresholds for ${district}, ${state}`);
    const [weatherData, ndmaAlerts] = await Promise.all([
      fetchWeatherData(lat, lon).catch(() => null),
      fetchActiveAlerts(state, district).catch(() => [])
    ]);

    if (!weatherData) return null;

    // 1. Check local thresholds
    const triggeredRules = evaluateThresholds(weatherData);

    // 2. Determine if we should generate an alert
    const hasTriggeredRules = triggeredRules.length > 0;
    const hasNdmaAlerts = ndmaAlerts.length > 0;

    if (!hasTriggeredRules && !hasNdmaAlerts) {
      return null; // No weather threat
    }

    // Prepare prompt to generate alert warning
    const weatherSummary = {
      daily_max_temps: weatherData.daily.temperature_2m_max,
      daily_min_temps: weatherData.daily.temperature_2m_min,
      daily_precip_sums: weatherData.daily.precipitation_sum,
      daily_wind_speeds: weatherData.daily.windspeed_10m_max
    };

    const userPrompt = `
Farmer: ${profile.name}, Crop: ${profile.primary_crop || 'Wheat'} (Stage: vegetative growth)
Location: ${district}, ${state}

Weather Data (Next 3 Days):
${JSON.stringify(weatherSummary)}

Triggered Internal Thresholds:
${JSON.stringify(triggeredRules)}

Official NDMA Active Alerts:
${JSON.stringify(ndmaAlerts)}
`;

    const generatedAlert = await generateJson(userPrompt, WEATHER_ALERT_SYSTEM_INSTRUCTION, weatherAlertSchema);
    
    return {
      alert_type: generatedAlert.alert_type,
      severity: generatedAlert.severity,
      message: generatedAlert.message,
      valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // Valid for 24 hours
    };

  } catch (error) {
    console.error('[Weather Agent] Error in runWeatherThresholdCheck:', error);
    return null;
  }
}

module.exports = {
  runWeatherOnDemand,
  runWeatherThresholdCheck
};
