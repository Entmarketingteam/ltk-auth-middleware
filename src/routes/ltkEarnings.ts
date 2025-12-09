/**
 * LTK Earnings Route
 *
 * Fetches earnings/analytics data from LTK API using stored tokens.
 * Uses the real LTK Creator API endpoints.
 */

import { Router, Request, Response as ExpressResponse } from 'express';
import fetch from 'node-fetch';
import https from 'https';
import dns from 'dns';
import { getTokens, getConnectionStatus } from '../services/tokenStorage.js';

// Type alias for Express Response
type Response = ExpressResponse;

const router = Router();

// LTK API Base URL - use the gateway endpoint that the tokens are scoped to
const LTK_API_BASE = 'https://creator-api-gateway.shopltk.com';

// Custom HTTPS agent with Google DNS lookup to fix Railway container DNS issues
const customLookup: any = (
  hostname: string,
  options: any,
  callback: any
) => {
  // Use Google's DNS resolver
  const resolver = new dns.Resolver();
  resolver.setServers(['8.8.8.8', '8.8.4.4']);

  resolver.resolve4(hostname, (err, addresses) => {
    if (err) {
      console.error('[DNS] Failed to resolve', hostname, 'with Google DNS:', err.message);
      // Fall back to system DNS
      dns.lookup(hostname, { family: 4 }, callback);
    } else if (addresses && addresses.length > 0) {
      console.log('[DNS] Resolved', hostname, 'to', addresses[0]);
      callback(null, addresses[0], 4);
    } else {
      callback(new Error(`No addresses found for ${hostname}`), '', 0);
    }
  });
};

const httpsAgent = new https.Agent({
  lookup: customLookup,
});

/**
 * Get browser-like headers for LTK API requests
 */
function getLTKHeaders(accessToken: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Origin': 'https://creator.shopltk.com',
    'Referer': 'https://creator.shopltk.com/',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
  };
}

interface LTKEarningsItem {
  date: string;
  product: string;
  brand: string;
  commission: string;
  orderValue: string;
  status: string;
  clicks?: number;
  orders?: number;
}

/**
 * GET /api/ltk/earnings/:userId
 * Fetch earnings data from LTK API
 */
router.get('/earnings/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { startDate, endDate } = req.query;

  // Default to last 30 days
  const end = (endDate as string) || new Date().toISOString().split('T')[0];
  const start = (startDate as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  console.log(`[LTK Earnings] Fetching earnings for user ${userId} from ${start} to ${end}`);

  try {
    // 1. Check connection status
    const status = await getConnectionStatus(userId);
    if (!status.connected) {
      return res.status(401).json({
        success: false,
        error: 'LTK not connected',
        status: status.status,
      });
    }

    // 2. Get stored tokens
    const tokens = await getTokens(userId);
    if (!tokens) {
      return res.status(401).json({
        success: false,
        error: 'No valid tokens found',
      });
    }

    const { accessToken } = tokens;

    // 3. First get creator info to get creator_id
    console.log('[LTK Earnings] Fetching creator info...');
    const headers = getLTKHeaders(accessToken);
    const creatorUrl = `${LTK_API_BASE}/v1/creator/me`;
    console.log('[LTK Earnings] Calling:', creatorUrl);
    console.log('[LTK Earnings] Token prefix:', accessToken.substring(0, 50) + '...');

    let meResponse;
    try {
      meResponse = await fetch(creatorUrl, {
        headers,
        agent: httpsAgent,
      });
    } catch (fetchError: any) {
      console.error('[LTK Earnings] Fetch error details:', {
        message: fetchError.message,
        cause: fetchError.cause,
        code: fetchError.code,
        errno: fetchError.errno,
        syscall: fetchError.syscall,
        hostname: fetchError.hostname,
        stack: fetchError.stack?.split('\n').slice(0, 3).join('\n'),
      });
      throw new Error(`Network error calling LTK API: ${fetchError.message} (${fetchError.cause?.message || fetchError.code || 'unknown'})`);
    }

    if (!meResponse.ok) {
      const errorText = await meResponse.text();
      console.error('[LTK Earnings] Failed to get creator info:', meResponse.status, errorText);

      if (meResponse.status === 401) {
        return res.status(401).json({
          success: false,
          error: 'Token expired or invalid',
          needsReauth: true,
        });
      }

      throw new Error(`Failed to get creator info: ${meResponse.status}`);
    }

    const creatorData = await meResponse.json() as any;
    const creatorId = creatorData.id || creatorData.creator_id || creatorData.data?.id;

    console.log('[LTK Earnings] Creator ID:', creatorId);

    if (!creatorId) {
      console.error('[LTK Earnings] Creator data:', JSON.stringify(creatorData));
      throw new Error('Could not determine creator ID from response');
    }

    // 4. Fetch earnings data
    console.log('[LTK Earnings] Fetching earnings data...');
    const earningsUrl = `${LTK_API_BASE}/v1/analytics/earnings?creator_id=${creatorId}&start_date=${start}&end_date=${end}`;

    const earningsResponse = await fetch(earningsUrl, {
      headers,
      agent: httpsAgent,
    });

    if (!earningsResponse.ok) {
      const errorText = await earningsResponse.text();
      console.error('[LTK Earnings] Failed to fetch earnings:', earningsResponse.status, errorText);
      throw new Error(`Failed to fetch earnings: ${earningsResponse.status}`);
    }

    const earningsData = await earningsResponse.json() as any;
    console.log('[LTK Earnings] Raw earnings data keys:', Object.keys(earningsData));

    // 5. Also try to get post analytics for more detail
    let postAnalytics: any[] = [];
    try {
      const postsUrl = `${LTK_API_BASE}/v1/analytics/posts?creator_id=${creatorId}&start_date=${start}&end_date=${end}`;
      const postsResponse = await fetch(postsUrl, {
        headers,
        agent: httpsAgent,
      });

      if (postsResponse.ok) {
        const postsData = await postsResponse.json() as any;
        postAnalytics = postsData.data || postsData.posts || postsData || [];
        console.log('[LTK Earnings] Got post analytics:', postAnalytics.length, 'items');
      }
    } catch (e) {
      console.log('[LTK Earnings] Could not fetch post analytics (non-fatal)');
    }

    // 6. Transform earnings data
    const rawEarnings = earningsData.data || earningsData.earnings || earningsData || [];

    const earnings: LTKEarningsItem[] = (Array.isArray(rawEarnings) ? rawEarnings : []).map((item: any) => ({
      date: item.date || item.sale_date || item.created_at || item.order_date || new Date().toISOString(),
      product: item.product_name || item.product || item.item_name || item.title || 'Unknown Product',
      brand: item.brand_name || item.brand || item.retailer || item.merchant || 'Unknown Brand',
      commission: String(item.commission || item.commission_amount || item.earnings || item.payout || '0'),
      orderValue: String(item.order_value || item.sale_amount || item.gmv || item.revenue || '0'),
      status: item.status || item.payment_status || 'PENDING',
      clicks: item.clicks || item.click_count || 0,
      orders: item.orders || item.order_count || item.conversions || 0,
    }));

    // 7. Calculate summary
    const summary = {
      totalEarnings: earnings.reduce((sum, e) => sum + parseFloat(e.commission || '0'), 0).toFixed(2),
      totalOrders: earnings.reduce((sum, e) => sum + (e.orders || 0), 0),
      totalClicks: earnings.reduce((sum, e) => sum + (e.clicks || 0), 0),
      itemCount: earnings.length,
    };

    console.log('[LTK Earnings] Returning', earnings.length, 'earnings items');

    res.json({
      success: true,
      earnings,
      summary,
      period: { start, end },
      creatorId,
      postAnalytics: postAnalytics.slice(0, 10), // Include some post data
    });

  } catch (error: any) {
    console.error('[LTK Earnings] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/ltk/analytics/:userId
 * Fetch detailed analytics (posts, brands, etc.)
 */
router.get('/analytics/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;
  const { startDate, endDate, type } = req.query;

  const end = (endDate as string) || new Date().toISOString().split('T')[0];
  const start = (startDate as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const analyticsType = (type as string) || 'posts'; // posts, brands, earnings

  console.log(`[LTK Analytics] Fetching ${analyticsType} analytics for user ${userId}`);

  try {
    // Get tokens
    const tokens = await getTokens(userId);
    if (!tokens) {
      return res.status(401).json({
        success: false,
        error: 'LTK not connected',
      });
    }

    const { accessToken } = tokens;
    const headers = getLTKHeaders(accessToken);

    // Get creator ID
    const meResponse = await fetch(`${LTK_API_BASE}/v1/creator/me`, {
      headers,
      agent: httpsAgent,
    });

    if (!meResponse.ok) {
      throw new Error('Failed to get creator info');
    }

    const creatorData = await meResponse.json() as any;
    const creatorId = creatorData.id || creatorData.creator_id || creatorData.data?.id;

    // Fetch requested analytics type
    let endpoint: string;
    switch (analyticsType) {
      case 'brands':
        endpoint = `${LTK_API_BASE}/v1/analytics/brands?creator_id=${creatorId}&start_date=${start}&end_date=${end}`;
        break;
      case 'earnings':
        endpoint = `${LTK_API_BASE}/v1/analytics/earnings?creator_id=${creatorId}&start_date=${start}&end_date=${end}`;
        break;
      case 'posts':
      default:
        endpoint = `${LTK_API_BASE}/v1/analytics/posts?creator_id=${creatorId}&start_date=${start}&end_date=${end}`;
        break;
    }

    const response = await fetch(endpoint, {
      headers,
      agent: httpsAgent,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${analyticsType} analytics`);
    }

    const data = await response.json() as any;

    res.json({
      success: true,
      type: analyticsType,
      data: data.data || data,
      period: { start, end },
      creatorId,
    });

  } catch (error: any) {
    console.error('[LTK Analytics] Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
