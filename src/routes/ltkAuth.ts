/**
 * LTK Authentication Routes
 * 
 * Handles creator connection flow:
 * - POST /connect - Log into LTK and store tokens
 * - GET /status/:userId - Check connection status
 * - POST /refresh/:userId - Manually refresh tokens
 * - DELETE /disconnect/:userId - Remove connection
 */

import { Router, Request, Response } from 'express';
import { loginToLTK } from '../services/puppeteerLogin.js';
import {
  storeTokens,
  getConnectionStatus,
  disconnectLTK,
  updatePublisherIds,
  getTokens
} from '../services/tokenStorage.js';
import { refreshUserTokens } from '../services/tokenRefresh.js';
import { authRateLimiter } from '../utils/rateLimiter.js';

const router = Router();

/**
 * POST /api/ltk/connect
 * 
 * Connect a creator's LTK account using their credentials.
 * Credentials are used once for login, then discarded.
 * Only encrypted tokens are stored.
 * Rate limited to 5 attempts per 15 minutes per IP.
 */
router.post('/connect', authRateLimiter, async (req: Request, res: Response) => {
  const { userId, email, password } = req.body;
  
  // Validate input
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'userId is required',
    });
  }
  
  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'email is required',
    });
  }
  
  if (!password || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'password is required',
    });
  }
  
  console.log(`[LTK Auth] Connection attempt for user ${userId} with email ${email}`);
  
  try {
    // Attempt login via Puppeteer
    const result = await loginToLTK(email, password);
    
    if (!result.success) {
      console.log(`[LTK Auth] Login failed for user ${userId}: ${result.error}`);
      return res.status(401).json({
        success: false,
        error: result.error || 'Login failed',
        errorCode: result.errorCode,
      });
    }
    
    // Store encrypted tokens
    await storeTokens(userId, {
      accessToken: result.accessToken!,
      idToken: result.idToken!,
      expiresAt: result.expiresAt!,
    });
    
    console.log(`[LTK Auth] Successfully connected user ${userId}`);
    
    return res.json({
      success: true,
      message: 'LTK account connected successfully',
      expiresAt: new Date(result.expiresAt! * 1000).toISOString(),
    });
    
  } catch (error) {
    console.error(`[LTK Auth] Error connecting user ${userId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during connection',
    });
  }
});

/**
 * GET /api/ltk/status/:userId
 * 
 * Check the connection status for a user.
 */
router.get('/status/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId is required',
    });
  }
  
  try {
    const status = await getConnectionStatus(userId);
    
    return res.json({
      success: true,
      ...status,
    });
    
  } catch (error) {
    console.error(`[LTK Auth] Error getting status for user ${userId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /api/ltk/refresh/:userId
 * 
 * Manually trigger a token refresh/validation check.
 */
router.post('/refresh/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  
  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId is required',
    });
  }
  
  try {
    const result = await refreshUserTokens(userId);
    
    return res.json(result);
    
  } catch (error) {
    console.error(`[LTK Auth] Error refreshing tokens for user ${userId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * DELETE /api/ltk/disconnect/:userId
 *
 * Disconnect LTK account (removes stored tokens).
 */
router.delete('/disconnect/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId is required',
    });
  }

  try {
    await disconnectLTK(userId);

    console.log(`[LTK Auth] Disconnected user ${userId}`);

    return res.json({
      success: true,
      message: 'LTK account disconnected',
    });

  } catch (error) {
    console.error(`[LTK Auth] Error disconnecting user ${userId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * PUT /api/ltk/publisher-ids/:userId
 *
 * Update publisher IDs for analytics (use comma-separated IDs for multiple accounts)
 * Example: "293045,987693288,987748582"
 */
router.put('/publisher-ids/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { publisherIds } = req.body;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId is required',
    });
  }

  if (!publisherIds || typeof publisherIds !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'publisherIds is required (comma-separated string)',
    });
  }

  try {
    await updatePublisherIds(userId, publisherIds);

    console.log(`[LTK Auth] Updated publisher IDs for user ${userId}: ${publisherIds}`);

    return res.json({
      success: true,
      message: 'Publisher IDs updated',
      publisherIds,
    });

  } catch (error: any) {
    console.error(`[LTK Auth] Error updating publisher IDs for user ${userId}:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * GET /api/ltk/publisher-ids/:userId
 *
 * Get current publisher IDs for a user
 */
router.get('/publisher-ids/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId is required',
    });
  }

  try {
    const tokens = await getTokens(userId);

    if (!tokens) {
      return res.status(404).json({
        success: false,
        error: 'No LTK connection found',
      });
    }

    return res.json({
      success: true,
      publisherId: tokens.publisherId,
      publisherIds: tokens.publisherIds,
    });

  } catch (error: any) {
    console.error(`[LTK Auth] Error getting publisher IDs for user ${userId}:`, error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

export default router;
