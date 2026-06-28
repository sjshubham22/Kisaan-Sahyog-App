const { generateJson } = require('../services/gemini');

const ORCHESTRATOR_SYSTEM_INSTRUCTION = `You are the intent classifier and guardrail monitor for "Kisaan Sahyog", a digital assistant for Indian farmers.
Your job is to analyze the user's message and determine what agricultural domain it belongs to. You must also enforce strict safety and topic guardrails.

1. Top-Level Topic Guardrails:
- The query must be strictly related to agriculture, farming, crops, weather, soil, irrigation, fertilizers, pests, diseases, or market (mandi/MSP) prices.
- If the query is NOT related to agriculture (e.g., asking about politics, entertainment, sports, software development, general history, mathematics, or off-topic conversational fillers), you must classify it as "out_of_scope" and trigger the guardrail.
- If the query requests dangerous, harmful, or illegal substances or hazardous recipes, you must classify it as "out_of_scope".

2. Intent Classification Categories:
- "crop_advice": Sowing, planting, fertilizer schedules, crop varieties, yields, harvesting, irrigation frequency.
- "weather_query": Forecasts, rain, temperature, storm, weather risk.
- "market_price": Mandi rates, MSP, selling crops, market pricing.
- "pest_disease": Plant diseases, insect control, fungal or bacterial infections, spots on leaves.
- "combined": Questions containing multiple intents (e.g., "Will it rain this week, and is it a good time to sow wheat?").
- "out_of_scope": Queries that trigger safety rules or are completely unrelated to farming.

3. Output Format:
You must return a JSON object with the following fields:
- "intent": One of "crop_advice", "weather_query", "market_price", "pest_disease", "combined", "out_of_scope".
- "explanation": A brief, 1-sentence reasoning for this classification.
- "guardrail_triggered": A boolean (true if out_of_scope, false otherwise).
- "message": If guardrail_triggered is true, provide a polite refusal message in English: "I can only assist you with farming, crop advisory, and weather-related queries." If false, this field should be empty "".`;

const responseSchema = {
  type: 'OBJECT',
  properties: {
    intent: {
      type: 'STRING',
      enum: ['crop_advice', 'weather_query', 'market_price', 'pest_disease', 'combined', 'out_of_scope']
    },
    explanation: { type: 'STRING' },
    guardrail_triggered: { type: 'BOOLEAN' },
    message: { type: 'STRING' }
  },
  required: ['intent', 'explanation', 'guardrail_triggered', 'message']
};

/**
 * Orchestrates incoming chat message: validates intent and checks guardrails.
 * @param {string} userMessage - User query
 * @returns {Promise<object>} - Intent classification result
 */
async function classifyIntent(userMessage) {
  try {
    const userPrompt = `Analyze this user query: "${userMessage}"`;
    const classification = await generateJson(userPrompt, ORCHESTRATOR_SYSTEM_INSTRUCTION, responseSchema);
    console.log('[Orchestrator] Intent classification:', classification);
    return classification;
  } catch (error) {
    console.error('[Orchestrator] Error in classifyIntent:', error);
    // Safe fallback intent
    return {
      intent: 'crop_advice',
      explanation: 'Fallback due to system error classification',
      guardrail_triggered: false,
      message: ''
    };
  }
}

module.exports = {
  classifyIntent
};
