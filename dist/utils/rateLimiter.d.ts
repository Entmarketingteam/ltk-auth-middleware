/**
 * Rate Limiting Middleware
 *
 * Protects authentication endpoints from brute force attacks
 */
/**
 * Rate limiter for authentication endpoints (login/connect)
 * Allows 5 requests per 15 minutes per IP
 */
export declare const authRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Rate limiter for data extraction endpoints
 * Allows 30 requests per 15 minutes per IP
 */
export declare const extractionRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Rate limiter for general API endpoints
 * Allows 100 requests per 15 minutes per IP
 */
export declare const apiRateLimiter: import("express-rate-limit").RateLimitRequestHandler;
//# sourceMappingURL=rateLimiter.d.ts.map