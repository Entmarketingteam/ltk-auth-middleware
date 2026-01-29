/**
 * Mavely Authentication Routes
 *
 * Handles Mavely creator connection flow:
 * - POST /connect - Log into Mavely and store tokens
 * - GET /status/:userId - Check connection status
 * - DELETE /disconnect/:userId - Remove connection
 * - GET /extract/:userId - Extract analytics data
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=mavelyAuth.d.ts.map