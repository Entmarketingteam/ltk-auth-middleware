/**
 * LTK Earnings Route
 *
 * Fetches earnings/analytics data from LTK using Puppeteer.
 * Uses browser-based fetch since LTK API domains don't resolve publicly.
 */

import { Router, Request, Response as ExpressResponse } from 'express';
import puppeteer from 'puppeteer';
import { getTokens, getConnectionStatus } from '../services/tokenStorage.js';

// Type alias for Express Response
type Response = ExpressResponse;

const router = Router();

// LTK API Base URL
const LTK_API_BASE = 'https://creator-api-gateway.shopltk.com';

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
 * Make API call using Puppeteer browser context (bypasses DNS issues)
 */
async function fetchWithPuppeteer(url: string, accessToken: string): Promise<any> {
  console.log('[Puppeteer Fetch] Starting browser for:', url);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  try {
    const page = await browser.newPage();

    // Set a reasonable timeout
    page.setDefaultTimeout(30000);

    // First navigate to LTK domain to establish context
    await page.goto('https://creator.shopltk.com', { waitUntil: 'domcontentloaded' });

    // Make the API call from within the browser context
    const result = await page.evaluate(async (apiUrl: string, token: string) => {
      try {
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          return {
            error: true,
            status: response.status,
            statusText: response.statusText,
            body: await response.text()
          };
        }

        return { error: false, data: await response.json() };
      } catch (e: any) {
        return { error: true, message: e.message };
      }
    }, url, accessToken);

    console.log('[Puppeteer Fetch] Result received, error:', result.error);
    return result;

  } finally {
    await browser.close();
  }
}

/**
 * GET /api/ltk/earnings/:userId
 * Fetch earnings data from LTK API using Puppeteer
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
    console.log('[LTK Earnings] Token prefix:', accessToken.substring(0, 50) + '...');

    // 3. First get creator info to get creator_id
    console.log('[LTK Earnings] Fetching creator info via Puppeteer...');
    const creatorUrl = `${LTK_API_BASE}/v1/creator/me`;

    const meResult = await fetchWithPuppeteer(creatorUrl, accessToken);

    if (meResult.error) {
      console.error('[LTK Earnings] Failed to get creator info:', meResult);

      if (meResult.status === 401) {
        return res.status(401).json({
          success: false,
          error: 'Token expired or invalid',
          needsReauth: true,
        });
      }

      throw new Error(`Failed to get creator info: ${meResult.message || meResult.status}`);
    }

    const creatorData = meResult.data;
    const creatorId = creatorData.id || creatorData.creator_id || creatorData.data?.id;

    console.log('[LTK Earnings] Creator ID:', creatorId);

    if (!creatorId) {
      console.error('[LTK Earnings] Creator data:', JSON.stringify(creatorData));
      throw new Error('Could not determine creator ID from response');
    }

    // 4. Fetch earnings data
    console.log('[LTK Earnings] Fetching earnings data...');
    const earningsUrl = `${LTK_API_BASE}/v1/analytics/earnings?creator_id=${creatorId}&start_date=${start}&end_date=${end}`;

    const earningsResult = await fetchWithPuppeteer(earningsUrl, accessToken);

    if (earningsResult.error) {
      console.error('[LTK Earnings] Failed to fetch earnings:', earningsResult);
      throw new Error(`Failed to fetch earnings: ${earningsResult.status || earningsResult.message}`);
    }

    const earningsData = earningsResult.data;
    console.log('[LTK Earnings] Raw earnings data keys:', Object.keys(earningsData));

    // 5. Transform earnings data
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

    // 6. Calculate summary
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
  const analyticsType = (type as string) || 'posts';

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

    // Get creator ID first
    const meResult = await fetchWithPuppeteer(`${LTK_API_BASE}/v1/creator/me`, accessToken);

    if (meResult.error) {
      throw new Error('Failed to get creator info');
    }

    const creatorData = meResult.data;
    const creatorId = creatorData.id || creatorData.creator_id || creatorData.data?.id;

    // Build endpoint URL based on type
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

    const result = await fetchWithPuppeteer(endpoint, accessToken);

    if (result.error) {
      throw new Error(`Failed to fetch ${analyticsType} analytics`);
    }

    res.json({
      success: true,
      type: analyticsType,
      data: result.data?.data || result.data,
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
