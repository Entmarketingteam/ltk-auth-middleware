/**
 * Rate Limiting Middleware
 * 
 * Protects authentication endpoints from brute force attacks
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for authentication endpoints (login/connect)
 * Allows 5 requests per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    error: 'Too many authentication attempts. Please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip successful requests (only count failed attempts)
  skipSuccessfulRequests: true,
});

/**
 * Rate limiter for data extraction endpoints
 * Allows 30 requests per 15 minutes per IP
 */
export const extractionRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per windowMs
  message: {
    success: false,
    error: 'Too many extraction requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for general API endpoints
 * Allows 100 requests per 15 minutes per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
