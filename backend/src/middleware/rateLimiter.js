import rateLimit from 'express-rate-limit';

/**
 * Authentication rate limiter to protect against credential stuffing & brute-force attacks.
 * Automatically bypassed during automated test suites (NODE_ENV=test).
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    error: 'TooManyRequests',
    message: 'Too many authentication attempts from this IP. Please try again after 15 minutes.',
  },
});

/**
 * SOS Incident rate limiter to protect against denial-of-service spam and alarm fatigue.
 * Automatically bypassed during automated test suites (NODE_ENV=test).
 */
export const sosLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // Limit each IP to 5 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    error: 'TooManyRequests',
    message: 'Too many SOS requests from this IP. Please wait before creating another incident.',
  },
});

/**
 * Booking message rate limiter to protect against rapid spamming or automated bot floods.
 * Automatically bypassed during automated test suites (NODE_ENV=test).
 */
export const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // Limit each IP to 60 messages per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    error: 'TooManyRequests',
    message: 'Too many messages sent from this IP. Please slow down and try again shortly.',
  },
});

