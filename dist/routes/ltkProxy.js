"use strict";
/**
 * LTK API Proxy Routes
 *
 * Proxies requests to the LTK API using stored tokens.
 * This is your existing ltkProxy.ts logic, but now tokens come from database.
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tokenStorage_js_1 = require("../services/tokenStorage.js");
const router = (0, express_1.Router)();
const LTK_API_BASE = 'https://api-gateway.rewardstyle.com';
/**
 * Middleware to get tokens from database
 */
async function getAuthHeaders(userId) {
    const tokens = await (0, tokenStorage_js_1.getTokens)(userId);
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
async function proxyToLTK(userId, endpoint, method = 'GET', body) {
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
function getUserId(req) {
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
router.get('/analytics/contributors', async (req, res) => {
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
router.get('/analytics/hero-chart', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    const queryString = new URLSearchParams(req.query).toString();
    const endpoint = `/api/creator-analytics/v1/hero_chart${queryString ? `?${queryString}` : ''}`;
    const result = await proxyToLTK(userId, endpoint);
    return res.status(result.status).json(result.data);
});
/**
 * GET /api/ltk/analytics/performance-summary
 */
router.get('/analytics/performance-summary', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    const queryString = new URLSearchParams(req.query).toString();
    const endpoint = `/api/creator-analytics/v1/performance_summary${queryString ? `?${queryString}` : ''}`;
    const result = await proxyToLTK(userId, endpoint);
    return res.status(result.status).json(result.data);
});
/**
 * GET /api/ltk/analytics/performance-stats
 */
router.get('/analytics/performance-stats', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    const queryString = new URLSearchParams(req.query).toString();
    const endpoint = `/api/creator-analytics/v1/performance_stats${queryString ? `?${queryString}` : ''}`;
    const result = await proxyToLTK(userId, endpoint);
    return res.status(result.status).json(result.data);
});
/**
 * GET /api/ltk/analytics/top-performers
 */
router.get('/analytics/top-performers', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    const queryString = new URLSearchParams(req.query).toString();
    const endpoint = `/api/creator-analytics/v1/top_performers${queryString ? `?${queryString}` : ''}`;
    const result = await proxyToLTK(userId, endpoint);
    return res.status(result.status).json(result.data);
});
/**
 * GET /api/ltk/analytics/items-sold
 */
router.get('/analytics/items-sold', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    const queryString = new URLSearchParams(req.query).toString();
    const endpoint = `/api/creator-analytics/v1/items_sold${queryString ? `?${queryString}` : ''}`;
    const result = await proxyToLTK(userId, endpoint);
    return res.status(result.status).json(result.data);
});
/**
 * GET /api/ltk/analytics/commissions-summary
 */
router.get('/analytics/commissions-summary', async (req, res) => {
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
router.get('/user-info', async (req, res) => {
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
router.get('/user/:publisherId', async (req, res) => {
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
router.get('/account/:accountId', async (req, res) => {
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
router.get('/amazon-identities', async (req, res) => {
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
router.get('/search-trends', async (req, res) => {
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
router.get('/favorites', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    const queryString = new URLSearchParams(req.query).toString();
    const endpoint = `/api/pub/v1/favorites/${queryString ? `?${queryString}` : ''}`;
    const result = await proxyToLTK(userId, endpoint);
    return res.status(result.status).json(result.data);
});
/**
 * GET /api/ltk/folders
 */
router.get('/folders', async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
        return res.status(400).json({ error: 'userId is required' });
    }
    const queryString = new URLSearchParams(req.query).toString();
    const endpoint = `/api/pub/v1/folders/${queryString ? `?${queryString}` : ''}`;
    const result = await proxyToLTK(userId, endpoint);
    return res.status(result.status).json(result.data);
});
exports.default = router;
//# sourceMappingURL=ltkProxy.js.map