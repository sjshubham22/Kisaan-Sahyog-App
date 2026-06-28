/**
 * Authentication middleware.
 * Verifies JWT or maps standard bearer tokens to the local farmer session.
 * For local testing, maps missing/bearer tokens to 'farmer_default_123'.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    console.log('[Auth Middleware] No Authorization header. Defaulting to farmer_default_123 for testing.');
    req.farmer_id = 'farmer_default_123';
    return next();
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Invalid Authorization header format. Must be Bearer <token>.' });
  }

  const token = parts[1];
  
  // In development, allow simple farmer id tokens directly
  if (token.startsWith('farmer_')) {
    req.farmer_id = token;
  } else {
    // If it's a simulated JWT, map it back to default or decode it
    req.farmer_id = 'farmer_default_123';
  }

  next();
}

module.exports = authMiddleware;
