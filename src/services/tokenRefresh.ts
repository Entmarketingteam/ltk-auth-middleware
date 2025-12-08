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

import cron from 'node-cron';
import { 
  getConnectionsNeedingRefresh, 
  getTokens, 
  markConnectionError,
  updateTokenExpiration 
} from './tokenStorage.js';
import { validateTokens } from './puppeteerLogin.js';

let refreshJob: cron.ScheduledTask | null = null;

/**
 * Start the token refresh background job
 */
export function startTokenRefreshJob(): void {
  if (refreshJob) {
    console.log('[Token Refresh] Job already running');
    return;
  }
  
  console.log('[Token Refresh] Starting background job (runs every 5 minutes)');
  
  // Run every 5 minutes
  refreshJob = cron.schedule('*/5 * * * *', async () => {
    await checkAndRefreshTokens();
  });
  
  // Also run immediately on startup
  checkAndRefreshTokens().catch(console.error);
}

/**
 * Stop the token refresh background job
 */
export function stopTokenRefreshJob(): void {
  if (refreshJob) {
    refreshJob.stop();
    refreshJob = null;
    console.log('[Token Refresh] Background job stopped');
  }
}

/**
 * Check all connections and refresh/mark expired tokens
 */
async function checkAndRefreshTokens(): Promise<void> {
  console.log('[Token Refresh] Checking for expiring tokens...');
  
  try {
    const userIds = await getConnectionsNeedingRefresh();
    
    if (userIds.length === 0) {
      console.log('[Token Refresh] No tokens need refresh');
      return;
    }
    
    console.log(`[Token Refresh] Found ${userIds.length} connections needing attention`);
    
    for (const userId of userIds) {
      await handleExpiringToken(userId);
    }
    
  } catch (error) {
    console.error('[Token Refresh] Error checking tokens:', error);
  }
}

/**
 * Handle a single expiring token
 */
async function handleExpiringToken(userId: string): Promise<void> {
  console.log(`[Token Refresh] Processing user ${userId}`);
  
  try {
    const tokens = await getTokens(userId);
    
    if (!tokens) {
      console.log(`[Token Refresh] No tokens found for user ${userId}`);
      return;
    }
    
    // Check if tokens are still valid
    const isValid = await validateTokens(tokens.accessToken, tokens.idToken);
    
    if (isValid) {
      // Tokens are still working - update expiration estimate
      // LTK tokens typically last 1 hour, so extend by 1 hour
      const newExpiration = Math.floor(Date.now() / 1000) + 3600;
      await updateTokenExpiration(userId, newExpiration);
      console.log(`[Token Refresh] Tokens still valid for user ${userId}, extended expiration`);
    } else {
      // Tokens are invalid - mark as error
      await markConnectionError(userId, 'Token expired - please reconnect your LTK account');
      console.log(`[Token Refresh] Tokens expired for user ${userId}, marked as ERROR`);
      
      // TODO: Optionally trigger notification to user
      // await notifyUserTokenExpired(userId);
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await markConnectionError(userId, `Refresh failed: ${errorMessage}`);
    console.error(`[Token Refresh] Error processing user ${userId}:`, error);
  }
}

/**
 * Manually trigger refresh check for a specific user
 */
export async function refreshUserTokens(userId: string): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const tokens = await getTokens(userId);
    
    if (!tokens) {
      return {
        success: false,
        message: 'No tokens found - please connect your LTK account',
      };
    }
    
    const isValid = await validateTokens(tokens.accessToken, tokens.idToken);
    
    if (isValid) {
      const newExpiration = Math.floor(Date.now() / 1000) + 3600;
      await updateTokenExpiration(userId, newExpiration);
      return {
        success: true,
        message: 'Tokens are valid and expiration has been extended',
      };
    } else {
      await markConnectionError(userId, 'Token expired');
      return {
        success: false,
        message: 'Tokens have expired - please reconnect your LTK account',
      };
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      message: `Refresh failed: ${errorMessage}`,
    };
  }
}
