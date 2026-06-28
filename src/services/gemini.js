const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: GEMINI_API_KEY is not set in environment variables.');
}

const ai = new GoogleGenAI({ apiKey });
const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/**
 * Generate standard text using Gemini.
 * @param {string|Array} contents - The user prompt or conversation history
 * @param {string} [systemInstruction] - Instructions for the model behavior
 * @returns {Promise<string>} - The text response
 */
async function generateText(contents, systemInstruction = '') {
  try {
    const config = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    const response = await ai.models.generateContent({
      model: defaultModel,
      contents,
      config
    });

    return response.text;
  } catch (error) {
    console.error('Error in gemini.generateText:', error);
    throw error;
  }
}

/**
 * Generate JSON output using Gemini.
 * @param {string|Array} contents - The user prompt or conversation history
 * @param {string} systemInstruction - Instructions for the model behavior
 * @param {object} [schema] - Optional JSON schema for the response structure
 * @returns {Promise<object>} - Parsed JSON object
 */
async function generateJson(contents, systemInstruction = '', schema = null) {
  try {
    const config = {
      responseMimeType: 'application/json',
    };
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }
    if (schema) {
      config.responseSchema = schema;
    }

    const response = await ai.models.generateContent({
      model: defaultModel,
      contents,
      config
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.error('Error in gemini.generateJson:', error);
    throw error;
  }
}

module.exports = {
  ai,
  generateText,
  generateJson
};
