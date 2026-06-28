/**
 * Input validation middleware for chat request.
 */
function validateChatRequest(req, res, next) {
  const { message, farmer_id } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({
      error: {
        code: 'EMPTY_MESSAGE',
        message: 'Message cannot be empty.'
      }
    });
  }

  if (message.length > 500) {
    return res.status(400).json({
      error: {
        code: 'MESSAGE_TOO_LONG',
        message: 'Message is too long. Limit is 500 characters.'
      }
    });
  }

  if (!farmer_id || typeof farmer_id !== 'string') {
    return res.status(400).json({
      error: {
        code: 'MISSING_FARMER_ID',
        message: 'Farmer ID is required.'
      }
    });
  }

  next();
}

/**
 * Input validation middleware for farmer profile updates.
 */
function validateProfileRequest(req, res, next) {
  const { name, phone, district, state } = req.body;

  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Name is required' });
  }

  if (!phone || phone.trim().length === 0) {
    return res.status(400).json({ error: 'Phone is required' });
  }

  if (!district || district.trim().length === 0) {
    return res.status(400).json({ error: 'District is required' });
  }

  if (!state || state.trim().length === 0) {
    return res.status(400).json({ error: 'State is required' });
  }

  next();
}

module.exports = {
  validateChatRequest,
  validateProfileRequest
};
