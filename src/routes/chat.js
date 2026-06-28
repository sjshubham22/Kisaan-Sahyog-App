const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimit');
const { validateChatRequest } = require('../middleware/validate');
const { getFarmerProfile } = require('../models/farmer');
const { getChatHistory, createChatSession, saveMessage } = require('../models/message');
const { classifyIntent } = require('../agents/orchestrator');
const { runCropAdvisoryAgent } = require('../agents/cropAdvisoryAgent');
const { runWeatherOnDemand } = require('../agents/weatherAlertAgent');
const { generateText } = require('../services/gemini');

// Apply rate limiting and authentication
router.use(authMiddleware);
router.use(rateLimiter);

/**
 * Helper to synthesize outputs from both agents in case of a combined query.
 */
async function synthesizeCombinedResponse(userQuery, cropResult, weatherResult) {
  const synthesisInstruction = `You are "Kisaan Sahyog", a senior agricultural advisor.
You are given the individual advisories from the Crop Advisory Agent and the Weather Agent.
Your job is to synthesize these two outputs into a single, cohesive, friendly response for the farmer.

Rules:
1. Respond ONLY in English.
2. Word limit: Under 200 words.
3. Flow: Connect the weather forecast to the crop advice naturally (e.g., "Since heavy rain is expected on Tuesday, you should delay sowing...").
4. Action: Conclude the message with exactly ONE clear, practical action the farmer should take this week.
5. No markdown headers, bold headers, or bullet points in the text.`;

  const prompt = `
Farmer's Question: "${userQuery}"

Crop advisory component:
${cropResult.message}

Weather forecast component:
${weatherResult.message}
`;

  try {
    const text = await generateText(prompt, synthesisInstruction);
    return text;
  } catch (error) {
    console.error('Error in combined synthesis, falling back to concatenated message:', error);
    return `${cropResult.message}\n\nWeather Update: ${weatherResult.message}`;
  }
}

/**
 * POST /api/chat
 * Main chatbot entry point. Classifies query intent and routes to correct agent(s).
 */
router.post('/', validateChatRequest, async (req, res) => {
  const startTime = Date.now();
  const { message, session_id } = req.body;
  const farmerId = req.farmer_id; // Added by auth middleware

  try {
    // 1. Get farmer profile
    const profile = getFarmerProfile(farmerId);
    if (!profile) {
      return res.status(404).json({ error: 'Farmer profile not found.' });
    }

    // 2. Resolve/initialize session
    const sessionId = session_id || 'session_' + Math.random().toString(36).substr(2, 9);
    
    // Check if session exists in memory database (it will auto-create if missing)
    createChatSession(sessionId, farmerId);

    // 3. Save farmer's message to database
    saveMessage({
      session_id: sessionId,
      farmer_id: farmerId,
      role: 'farmer',
      content: message,
      content_en: message
    });

    // 4. Classify intent and check guardrails
    const intentResult = await classifyIntent(message);

    let responseMessage = '';
    let structuredData = null;
    let agentsUsed = [];
    let quickReplies = ["Sowing advice", "Weather forecast", "Mandi prices"];

    // 5. Check guardrails
    if (intentResult.guardrail_triggered) {
      responseMessage = intentResult.message || "I can only assist you with farming, crop advisory, and weather-related queries.";
      structuredData = { type: 'guardrail_rejection' };
      agentsUsed = ['orchestrator'];
    } 
    // Pest and disease (future scope)
    else if (intentResult.intent === 'pest_disease') {
      responseMessage = "I notice you are asking about crop pests or disease diagnosis. The disease diagnostic module is currently under development. For safety, please consult your local Krishi Vigyan Kendra (KVK) or extension officer for certified chemical recommendations.";
      structuredData = { type: 'fallback_pest' };
      agentsUsed = ['orchestrator'];
      quickReplies = ["Wheat sowing schedule", "Check weather warning", "Mandi prices"];
    } 
    // Market Price query
    else if (intentResult.intent === 'market_price') {
      const cropResult = await runCropAdvisoryAgent(message, profile);
      responseMessage = cropResult.message;
      structuredData = {
        type: 'market_price_card',
        commodity: profile.primary_crop,
        msp_price: cropResult.structured_data.msp_price,
        yield_estimate: cropResult.structured_data.yield_estimate,
        variety: cropResult.structured_data.variety
      };
      agentsUsed = ['crop_advisory'];
      quickReplies = ["Sowing window", "Weather forecast", "Fertiliser schedule"];
    } 
    // Crop advisory query
    else if (intentResult.intent === 'crop_advice') {
      const cropResult = await runCropAdvisoryAgent(message, profile);
      responseMessage = cropResult.message;
      structuredData = cropResult.structured_data;
      agentsUsed = ['crop_advisory'];
      quickReplies = ["Check the weather", "Show MSP price", "Irrigation tips"];
    } 
    // Weather query
    else if (intentResult.intent === 'weather_query') {
      const weatherResult = await runWeatherOnDemand(message, profile);
      responseMessage = weatherResult.message;
      structuredData = weatherResult.structured_data;
      agentsUsed = ['weather'];
      quickReplies = ["Sowing advice", "Crop safety tips", "Mandi prices"];
    } 
    // Combined Query
    else if (intentResult.intent === 'combined') {
      console.log('[Chat Route] Running crop advisory and weather agents in parallel...');
      // Run both agents in parallel
      const [cropResult, weatherResult] = await Promise.all([
        runCropAdvisoryAgent(message, profile),
        runWeatherOnDemand(message, profile)
      ]);

      // Synthesize cohesive message
      responseMessage = await synthesizeCombinedResponse(message, cropResult, weatherResult);
      
      // Combine structured data
      structuredData = {
        type: 'combined_advisory',
        crop_variety: cropResult.structured_data.variety,
        sowing_window: cropResult.structured_data.sowing_window,
        fertiliser: cropResult.structured_data.fertiliser,
        msp_price: cropResult.structured_data.msp_price,
        weather_key_risk: weatherResult.structured_data.key_risk,
        weather_recommended_action: weatherResult.structured_data.recommended_action,
        data_sources: [...cropResult.structured_data.data_sources, ...weatherResult.structured_data.data_sources]
      };
      agentsUsed = ['crop_advisory', 'weather'];
      quickReplies = ["Show fertilizer schedule", "Check weather warning", "Mandi prices"];
    }

    const latencyMs = Date.now() - startTime;

    // 6. Save assistant's response to database
    saveMessage({
      session_id: sessionId,
      farmer_id: farmerId,
      role: 'assistant',
      content: responseMessage,
      content_en: responseMessage,
      structured: JSON.stringify(structuredData),
      agents_used: JSON.stringify(agentsUsed),
      latency_ms: latencyMs
    });

    // 7. Send API contract response
    res.json({
      session_id: sessionId,
      response_language: 'en',
      message: responseMessage,
      structured_data: structuredData,
      quick_replies: quickReplies,
      agents_used: agentsUsed,
      response_time_ms: latencyMs
    });

  } catch (error) {
    console.error('[Chat API Error]:', error);
    res.status(500).json({
      session_id: session_id || 'unknown',
      response_language: 'en',
      message: "Sorry, I encountered a temporary processing error. Please try again in a few minutes.",
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: error.message
      }
    });
  }
});

module.exports = router;
