/**
 * LTK Authentication Routes
 *
 * Handles creator connection flow:
 * - POST /connect - Log into LTK and store tokens
 * - GET /status/:userId - Check connection status
 * - POST /refresh/:userId - Manually refresh tokens
 * - DELETE /disconnect/:userId - Remove connection
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=ltkAuth.d.ts.map