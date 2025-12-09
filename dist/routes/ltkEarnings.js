"use strict";
/**
 * LTK Earnings Route
 *
 * Fetches earnings/analytics data from LTK using the rewardstyle API gateway.
 * Uses direct fetch since api-gateway.rewardstyle.com resolves publicly.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tokenStorage_js_1 = require("../services/tokenStorage.js");
const router = (0, express_1.Router)();
// LTK API Base URL - the actual working endpoint discovered from browser DevTools
const LTK_API_BASE = 'https://api-gateway.rewardstyle.com';
/**
 * Make API call to LTK/Rewardstyle API with proper headers
 */
async function fetchLTKApi(url, accessToken, idToken) {
    console.log('[LTK API] Fetching:', url);
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'x-id-token': idToken,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    });
    console.log('[LTK API] Response status:', response.status);
    if (!response.ok) {
        const text = await response.text();
        return {
            error: true,
            status: response.status,
            statusText: response.statusText,
            body: text
        };
    }
    const data = await response.json();
    return { error: false, data };
}
/**
 * GET /api/ltk/earnings/:userId
 * Fetch earnings data from LTK API
 */
router.get('/earnings/:userId', async (req, res) => {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;
    // Default to last 30 days
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    console.log(`[LTK Earnings] Fetching earnings for user ${userId} from ${start} to ${end}`);
    try {
        // 1. Check connection status
        const status = await (0, tokenStorage_js_1.getConnectionStatus)(userId);
        if (!status.connected) {
            return res.status(401).json({
                success: false,
                error: 'LTK not connected',
                status: status.status,
            });
        }
        // 2. Get stored tokens
        const tokens = await (0, tokenStorage_js_1.getTokens)(userId);
        if (!tokens) {
            return res.status(401).json({
                success: false,
                error: 'No valid tokens found',
            });
        }
        const { accessToken, idToken, publisherId } = tokens;
        console.log('[LTK Earnings] Token prefix:', accessToken.substring(0, 50) + '...');
        console.log('[LTK Earnings] Publisher ID:', publisherId);
        if (!idToken) {
            return res.status(401).json({
                success: false,
                error: 'ID token required for LTK API calls',
                needsReauth: true,
            });
        }
        if (!publisherId) {
            return res.status(400).json({
                success: false,
                error: 'Publisher ID not found. Please reconnect your LTK account.',
                needsReauth: true,
            });
        }
        // Format dates for API (ISO format with time)
        const startDateTime = `${start}T00:00:00Z`;
        const endDateTime = `${end}T23:59:59Z`;
        // 3. Fetch hero chart data (summary stats)
        console.log('[LTK Earnings] Fetching hero chart data...');
        const heroUrl = `${LTK_API_BASE}/analytics/hero_chart?start_date=${encodeURIComponent(startDateTime)}&end_date=${encodeURIComponent(endDateTime)}&publisher_ids=${publisherId}&interval=day&platform=rs,ltk&timezone=UTC`;
        const heroResult = await fetchLTKApi(heroUrl, accessToken, idToken);
        if (heroResult.error) {
            console.error('[LTK Earnings] Failed to fetch hero chart:', heroResult);
            if (heroResult.status === 401) {
                return res.status(401).json({
                    success: false,
                    error: 'Token expired or invalid',
                    needsReauth: true,
                });
            }
            throw new Error(`Failed to fetch earnings: ${heroResult.status} ${heroResult.statusText}`);
        }
        const heroData = heroResult.data;
        console.log('[LTK Earnings] Hero data:', JSON.stringify(heroData).substring(0, 200));
        // 4. Fetch top performers/links data for detailed breakdown
        console.log('[LTK Earnings] Fetching top performers...');
        const topPerformersUrl = `${LTK_API_BASE}/analytics/top_performers/links?start_date=${encodeURIComponent(startDateTime)}&end_date=${encodeURIComponent(endDateTime)}&publisher_ids=${publisherId}&platform=rs,ltk&timezone=UTC&limit=50`;
        const topPerformersResult = await fetchLTKApi(topPerformersUrl, accessToken, idToken);
        let earnings = [];
        if (!topPerformersResult.error && topPerformersResult.data) {
            const performersData = topPerformersResult.data.data || topPerformersResult.data || [];
            earnings = (Array.isArray(performersData) ? performersData : []).map((item) => ({
                date: item.date || item.created_at || start,
                product: item.product_name || item.link_name || item.title || 'Unknown Product',
                brand: item.brand_name || item.retailer || item.merchant || 'Unknown Brand',
                commission: String(item.commissions || item.commission || item.earnings || '0'),
                orderValue: String(item.order_value || item.gmv || item.revenue || '0'),
                status: item.status || 'COMPLETED',
                clicks: item.clicks || 0,
                orders: item.orders || item.conversions || 0,
            }));
        }
        // 5. Build summary from hero chart data
        const aggregatedData = heroData?.aggregated || heroData || {};
        const summary = {
            totalEarnings: aggregatedData.commissions?.toFixed(2) || '0.00',
            totalOrders: aggregatedData.orders || 0,
            totalClicks: aggregatedData.clicks || 0,
            itemsSold: aggregatedData.items_sold || 0,
            conversionRate: aggregatedData.conversion_rate?.toFixed(2) || '0.00',
            averageOrderValue: aggregatedData.average_order_value?.toFixed(2) || '0.00',
            itemCount: earnings.length,
        };
        console.log('[LTK Earnings] Returning', earnings.length, 'earnings items');
        res.json({
            success: true,
            earnings,
            summary,
            period: { start, end },
            publisherId,
            rawHeroData: heroData, // Include raw data for debugging
        });
    }
    catch (error) {
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
router.get('/analytics/:userId', async (req, res) => {
    const { userId } = req.params;
    const { startDate, endDate, type } = req.query;
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const analyticsType = type || 'hero_chart';
    console.log(`[LTK Analytics] Fetching ${analyticsType} analytics for user ${userId}`);
    try {
        // Get tokens
        const tokens = await (0, tokenStorage_js_1.getTokens)(userId);
        if (!tokens) {
            return res.status(401).json({
                success: false,
                error: 'LTK not connected',
            });
        }
        const { accessToken, idToken, publisherId } = tokens;
        if (!idToken) {
            return res.status(401).json({
                success: false,
                error: 'ID token required',
                needsReauth: true,
            });
        }
        if (!publisherId) {
            return res.status(400).json({
                success: false,
                error: 'Publisher ID not found. Please reconnect your LTK account.',
                needsReauth: true,
            });
        }
        // Format dates
        const startDateTime = `${start}T00:00:00Z`;
        const endDateTime = `${end}T23:59:59Z`;
        // Build endpoint URL based on type
        let endpoint;
        switch (analyticsType) {
            case 'top_performers':
            case 'links':
                endpoint = `${LTK_API_BASE}/analytics/top_performers/links?start_date=${encodeURIComponent(startDateTime)}&end_date=${encodeURIComponent(endDateTime)}&publisher_ids=${publisherId}&platform=rs,ltk&timezone=UTC&limit=50`;
                break;
            case 'performance_summary':
                endpoint = `${LTK_API_BASE}/analytics/performance_summary?start_date=${encodeURIComponent(startDateTime)}&end_date=${encodeURIComponent(endDateTime)}&publisher_ids=${publisherId}&platform=rs,ltk&timezone=UTC`;
                break;
            case 'contributors':
                endpoint = `${LTK_API_BASE}/analytics/contributors?start_date=${encodeURIComponent(startDateTime)}&end_date=${encodeURIComponent(endDateTime)}&publisher_ids=${publisherId}&platform=rs,ltk&timezone=UTC`;
                break;
            case 'hero_chart':
            default:
                endpoint = `${LTK_API_BASE}/analytics/hero_chart?start_date=${encodeURIComponent(startDateTime)}&end_date=${encodeURIComponent(endDateTime)}&publisher_ids=${publisherId}&interval=day&platform=rs,ltk&timezone=UTC`;
                break;
        }
        const result = await fetchLTKApi(endpoint, accessToken, idToken);
        if (result.error) {
            if (result.status === 401) {
                return res.status(401).json({
                    success: false,
                    error: 'Token expired',
                    needsReauth: true,
                });
            }
            throw new Error(`Failed to fetch ${analyticsType} analytics: ${result.status}`);
        }
        res.json({
            success: true,
            type: analyticsType,
            data: result.data?.data || result.data,
            period: { start, end },
            publisherId,
        });
    }
    catch (error) {
        console.error('[LTK Analytics] Error:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});
exports.default = router;
//# sourceMappingURL=ltkEarnings.js.map