/**
 * Token Refresh Service
 *
 * Background job that checks for expiring tokens and attempts to refresh them.
 * Runs every 5 minutes via node-cron.
 *
 * Note: LTK doesn't have a public refresh token endpoint, so when tokens expire,
 * we need to notify the user to re-authenticate. This service primarily:
 * 1. Monitors token expiration
 * 2. Marks connections as ERROR when tokens expire
 * 3. Could potentially re-login with stored credentials (security trade-off)
 */
/**
 * Start the token refresh background job
 */
export declare function startTokenRefreshJob(): void;
/**
 * Stop the token refresh background job
 */
export declare function stopTokenRefreshJob(): void;
/**
 * Manually trigger refresh check for a specific user
 */
export declare function refreshUserTokens(userId: string): Promise<{
    success: boolean;
    message: string;
}>;
//# sourceMappingURL=tokenRefresh.d.ts.map