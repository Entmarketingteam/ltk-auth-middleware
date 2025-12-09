"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTokenRefreshJob = startTokenRefreshJob;
exports.stopTokenRefreshJob = stopTokenRefreshJob;
exports.refreshUserTokens = refreshUserTokens;
const node_cron_1 = __importDefault(require("node-cron"));
const tokenStorage_js_1 = require("./tokenStorage.js");
const puppeteerLogin_js_1 = require("./puppeteerLogin.js");
let refreshJob = null;
/**
 * Start the token refresh background job
 */
function startTokenRefreshJob() {
    if (refreshJob) {
        console.log('[Token Refresh] Job already running');
        return;
    }
    console.log('[Token Refresh] Starting background job (runs every 5 minutes)');
    // Run every 5 minutes
    refreshJob = node_cron_1.default.schedule('*/5 * * * *', async () => {
        await checkAndRefreshTokens();
    });
    // Also run immediately on startup
    checkAndRefreshTokens().catch(console.error);
}
/**
 * Stop the token refresh background job
 */
function stopTokenRefreshJob() {
    if (refreshJob) {
        refreshJob.stop();
        refreshJob = null;
        console.log('[Token Refresh] Background job stopped');
    }
}
/**
 * Check all connections and refresh/mark expired tokens
 */
async function checkAndRefreshTokens() {
    console.log('[Token Refresh] Checking for expiring tokens...');
    try {
        const userIds = await (0, tokenStorage_js_1.getConnectionsNeedingRefresh)();
        if (userIds.length === 0) {
            console.log('[Token Refresh] No tokens need refresh');
            return;
        }
        console.log(`[Token Refresh] Found ${userIds.length} connections needing attention`);
        for (const userId of userIds) {
            await handleExpiringToken(userId);
        }
    }
    catch (error) {
        console.error('[Token Refresh] Error checking tokens:', error);
    }
}
/**
 * Handle a single expiring token
 */
async function handleExpiringToken(userId) {
    console.log(`[Token Refresh] Processing user ${userId}`);
    try {
        const tokens = await (0, tokenStorage_js_1.getTokens)(userId);
        if (!tokens) {
            console.log(`[Token Refresh] No tokens found for user ${userId}`);
            return;
        }
        // Check if tokens are still valid
        const isValid = await (0, puppeteerLogin_js_1.validateTokens)(tokens.accessToken, tokens.idToken);
        if (isValid) {
            // Tokens are still working - update expiration estimate
            // LTK tokens typically last 1 hour, so extend by 1 hour
            const newExpiration = Math.floor(Date.now() / 1000) + 3600;
            await (0, tokenStorage_js_1.updateTokenExpiration)(userId, newExpiration);
            console.log(`[Token Refresh] Tokens still valid for user ${userId}, extended expiration`);
        }
        else {
            // Tokens are invalid - mark as error
            await (0, tokenStorage_js_1.markConnectionError)(userId, 'Token expired - please reconnect your LTK account');
            console.log(`[Token Refresh] Tokens expired for user ${userId}, marked as ERROR`);
            // TODO: Optionally trigger notification to user
            // await notifyUserTokenExpired(userId);
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        await (0, tokenStorage_js_1.markConnectionError)(userId, `Refresh failed: ${errorMessage}`);
        console.error(`[Token Refresh] Error processing user ${userId}:`, error);
    }
}
/**
 * Manually trigger refresh check for a specific user
 */
async function refreshUserTokens(userId) {
    try {
        const tokens = await (0, tokenStorage_js_1.getTokens)(userId);
        if (!tokens) {
            return {
                success: false,
                message: 'No tokens found - please connect your LTK account',
            };
        }
        const isValid = await (0, puppeteerLogin_js_1.validateTokens)(tokens.accessToken, tokens.idToken);
        if (isValid) {
            const newExpiration = Math.floor(Date.now() / 1000) + 3600;
            await (0, tokenStorage_js_1.updateTokenExpiration)(userId, newExpiration);
            return {
                success: true,
                message: 'Tokens are valid and expiration has been extended',
            };
        }
        else {
            await (0, tokenStorage_js_1.markConnectionError)(userId, 'Token expired');
            return {
                success: false,
                message: 'Tokens have expired - please reconnect your LTK account',
            };
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return {
            success: false,
            message: `Refresh failed: ${errorMessage}`,
        };
    }
}
//# sourceMappingURL=tokenRefresh.js.map