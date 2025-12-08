/**
 * LTK API Proxy Routes
 * 
 * Proxies requests to the LTK API using stored tokens.
 * This is your existing ltkProxy.ts logic, but now tokens come from database.
 */

import { Router, Request, Response } from 'express';
import { getTokens } from '../services/tokenStorage.js';

const router = Router();

const LTK_API_BASE = 'https://api-gateway.rewardstyle.com';

/**
 * Middleware to get tokens from database
 */
async function getAuthHeaders(userId: string): Promise<Record<string, string> | null> {
  const tokens = await getTokens(userId);
  
  if (!tokens) {
    return null;
  }
  
  return {
    'Authorization': `Bearer ${tokens.accessToken}`,
    'x-id-token': tokens.idToken,
    'Origin': 'https://creator.shopltk.com',
    'Referer': 'https://creator.shopltk.com/',
    'Content-Type': 'application/json',
  };
}

/**
 * Generic proxy handler
 */
async function proxyToLTK(
  userId: string,
  endpoint: string,
  method: string = 'GET',
  body?: unknown
): Promise<{ status: number; data: unknown }> {
  const headers = await getAuthHeaders(userId);
  
  if (!headers) {
    return {
      status: 401,
      data: { error: 'Not connected to LTK. Please connect your account first.' },
    };
  }
  
  const url = `${LTK_API_BASE}${endpoint}`;
  console.log(`[LTK Proxy] ${method} ${url}`);
  
  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  
  const data = await response.json().catch(() => ({}));
  
  return {
    status: response.status,
    data,
  };
}

// User ID extraction middleware
// In production, this would come from your auth session
function getUserId(req: Request): string | null {
  // Check header first (API clients)
  const headerUserId = req.headers['x-user-id'];
  if (typeof headerUserId === 'string') {
    return headerUserId;
  }
  
  // Check query param (simple testing)
  const queryUserId = req.query.userId;
  if (typeof queryUserId === 'string') {
    return queryUserId;
  }
  
  return null;
}

/**
 * GET /api/ltk/analytics/contributors
 */
router.get('/analytics/contributors', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const result = await proxyToLTK(userId, '/api/creator-analytics/v1/contributors');
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/analytics/hero-chart
 */
router.get('/analytics/hero-chart', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const endpoint = `/api/creator-analytics/v1/hero_chart${queryString ? `?${queryString}` : ''}`;
  
  const result = await proxyToLTK(userId, endpoint);
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/analytics/performance-summary
 */
router.get('/analytics/performance-summary', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const endpoint = `/api/creator-analytics/v1/performance_summary${queryString ? `?${queryString}` : ''}`;
  
  const result = await proxyToLTK(userId, endpoint);
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/analytics/performance-stats
 */
router.get('/analytics/performance-stats', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const endpoint = `/api/creator-analytics/v1/performance_stats${queryString ? `?${queryString}` : ''}`;
  
  const result = await proxyToLTK(userId, endpoint);
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/analytics/top-performers
 */
router.get('/analytics/top-performers', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const endpoint = `/api/creator-analytics/v1/top_performers${queryString ? `?${queryString}` : ''}`;
  
  const result = await proxyToLTK(userId, endpoint);
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/analytics/items-sold
 */
router.get('/analytics/items-sold', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const endpoint = `/api/creator-analytics/v1/items_sold${queryString ? `?${queryString}` : ''}`;
  
  const result = await proxyToLTK(userId, endpoint);
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/analytics/commissions-summary
 */
router.get('/analytics/commissions-summary', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const result = await proxyToLTK(userId, '/api/creator-analytics/v1/commissions_summary');
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/user-info
 */
router.get('/user-info', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const result = await proxyToLTK(userId, '/api/co-api/v1/get_user_info');
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/user/:publisherId
 */
router.get('/user/:publisherId', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const { publisherId } = req.params;
  const result = await proxyToLTK(userId, `/api/creator-account-service/v1/users/${publisherId}`);
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/account/:accountId
 */
router.get('/account/:accountId', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const { accountId } = req.params;
  const result = await proxyToLTK(userId, `/publishers/v1/accounts/${accountId}`);
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/amazon-identities
 */
router.get('/amazon-identities', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const result = await proxyToLTK(userId, '/integrations/v1/amazon/identities');
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/search-trends
 */
router.get('/search-trends', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const result = await proxyToLTK(userId, '/api/ltk/v2/ltk_search_trends/');
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/favorites
 */
router.get('/favorites', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const endpoint = `/api/pub/v1/favorites/${queryString ? `?${queryString}` : ''}`;
  
  const result = await proxyToLTK(userId, endpoint);
  return res.status(result.status).json(result.data);
});

/**
 * GET /api/ltk/folders
 */
router.get('/folders', async (req: Request, res: Response) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  
  const queryString = new URLSearchParams(req.query as Record<string, string>).toString();
  const endpoint = `/api/pub/v1/folders/${queryString ? `?${queryString}` : ''}`;
  
  const result = await proxyToLTK(userId, endpoint);
  return res.status(result.status).json(result.data);
});

export default router;
