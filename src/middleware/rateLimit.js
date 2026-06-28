const rateLimitStore = {};

/**
 * Basic in-memory rate limiting middleware.
 * Limits users to 20 requests per hour (60 minutes) per IP/Farmer.
 */
function rateLimiter(req, res, next) {
  const key = req.body.farmer_id || req.ip;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 20;

  if (!rateLimitStore[key]) {
    rateLimitStore[key] = [];
  }

  // Filter out timestamps older than the window
  rateLimitStore[key] = rateLimitStore[key].filter(timestamp => now - timestamp < windowMs);

  if (rateLimitStore[key].length >= maxRequests) {
    console.warn(`[Rate Limiter] Rate limit exceeded for key: ${key}`);
    return res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many queries. Please try again later. (Limit: 20 requests per hour)'
      }
    });
  }

  // Record the request timestamp
  rateLimitStore[key].push(now);
  next();
}

module.exports = rateLimiter;
