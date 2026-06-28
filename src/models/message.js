const db = require('../db');

/**
 * Get chat history for a session.
 * @param {string} sessionId 
 * @returns {Array<object>}
 */
function getChatHistory(sessionId) {
  return db.messages.getBySession(sessionId);
}

/**
 * Initialize a new chat session.
 * @param {string} sessionId 
 * @param {string} farmerId 
 * @returns {object} - The session object
 */
function createChatSession(sessionId, farmerId) {
  return db.sessions.create(sessionId, farmerId);
}

/**
 * Save a message (either from farmer or assistant).
 * @param {object} message 
 * @returns {object} - The saved message
 */
function saveMessage(message) {
  return db.messages.save(message);
}

module.exports = {
  getChatHistory,
  createChatSession,
  saveMessage
};
