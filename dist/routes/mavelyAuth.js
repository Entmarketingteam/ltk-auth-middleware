"use strict";
/**
 * Mavely Authentication Routes
 *
 * Handles Mavely creator connection flow:
 * - POST /connect - Log into Mavely and store tokens
 * - GET /status/:userId - Check connection status
 * - DELETE /disconnect/:userId - Remove connection
 * - GET /extract/:userId - Extract analytics data
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mavelyLogin_js_1 = require("../services/mavelyLogin.js");
const platformStorage_js_1 = require("../services/platformStorage.js");
const mavelyDataExtraction_js_1 = require("../services/mavelyDataExtraction.js");
const googleSheets_js_1 = require("../services/googleSheets.js");
const rateLimiter_js_1 = require("../utils/rateLimiter.js");
const router = (0, express_1.Router)();
/**
 * POST /api/mavely/connect
 *
 * Connect a creator's Mavely account using their credentials.
 * Rate limited to 5 attempts per 15 minutes per IP.
 */
router.post('/connect', rateLimiter_js_1.authRateLimiter, async (req, res) => {
    const { userId, email, password } = req.body;
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
    console.log(`[Mavely Auth] Connection attempt for user ${userId} with email ${email}`);
    try {
        // Attempt login via Puppeteer
        const result = await (0, mavelyLogin_js_1.loginToMavely)(email, password);
        if (!result.success) {
            console.log(`[Mavely Auth] Login failed for user ${userId}: ${result.error}`);
            return res.status(401).json({
                success: false,
                error: result.error || 'Login failed',
                errorCode: result.errorCode,
            });
        }
        // Store encrypted tokens
        await (0, platformStorage_js_1.storePlatformTokens)(userId, 'MAVELY', {
            accessToken: result.accessToken,
            sessionCookie: result.sessionCookie,
            expiresAt: result.expiresAt,
        });
        console.log(`[Mavely Auth] Successfully connected user ${userId}`);
        return res.json({
            success: true,
            message: 'Mavely account connected successfully',
            expiresAt: new Date(result.expiresAt * 1000).toISOString(),
        });
    }
    catch (error) {
        console.error(`[Mavely Auth] Error connecting user ${userId}:`, error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error during connection',
        });
    }
});
/**
 * GET /api/mavely/status/:userId
 *
 * Check the connection status for a user.
 */
router.get('/status/:userId', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'userId is required',
        });
    }
    try {
        const status = await (0, platformStorage_js_1.getPlatformConnectionStatus)(userId, 'MAVELY');
        return res.json({
            success: true,
            ...status,
        });
    }
    catch (error) {
        console.error(`[Mavely Auth] Error getting status for user ${userId}:`, error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});
/**
 * DELETE /api/mavely/disconnect/:userId
 *
 * Disconnect Mavely account (removes stored tokens).
 */
router.delete('/disconnect/:userId', async (req, res) => {
    const { userId } = req.params;
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'userId is required',
        });
    }
    try {
        await (0, platformStorage_js_1.disconnectPlatform)(userId, 'MAVELY');
        console.log(`[Mavely Auth] Disconnected user ${userId}`);
        return res.json({
            success: true,
            message: 'Mavely account disconnected',
        });
    }
    catch (error) {
        console.error(`[Mavely Auth] Error disconnecting user ${userId}:`, error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});
/**
 * POST /api/mavely/extract/:userId
 *
 * Extract analytics data from Mavely for a date range
 * Rate limited to 30 requests per 15 minutes per IP.
 */
router.post('/extract/:userId', rateLimiter_js_1.extractionRateLimiter, async (req, res) => {
    const { userId } = req.params;
    const { startDate, endDate, exportToSheets, spreadsheetId, sheetName } = req.body;
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'userId is required',
        });
    }
    try {
        console.log(`[Mavely Extract] Extracting data for user ${userId}`);
        const result = await (0, mavelyDataExtraction_js_1.extractMavelyData)(userId, startDate || new Date().toISOString().split('T')[0], endDate || new Date().toISOString().split('T')[0]);
        if (!result.success || !result.data) {
            return res.status(400).json({
                success: false,
                error: result.error || 'Failed to extract data',
            });
        }
        // Optionally export to Google Sheets
        if (exportToSheets && spreadsheetId && result.data.length > 0) {
            const sheetsResult = await (0, googleSheets_js_1.appendToGoogleSheets)(result.data, {
                spreadsheetId,
                sheetName: sheetName || 'Mavely Analytics',
            });
            return res.json({
                success: true,
                data: result.data,
                sheets: sheetsResult,
                message: `Extracted ${result.data.length} data points${sheetsResult.success ? ' and appended to Google Sheets' : ''}`,
            });
        }
        return res.json({
            success: true,
            data: result.data,
            message: `Extracted ${result.data.length} data points`,
        });
    }
    catch (error) {
        console.error(`[Mavely Extract] Error extracting data for user ${userId}:`, error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});
/**
 * POST /api/mavely/export-csv/:userId
 *
 * Attempt to export CSV from Mavely (if available)
 * Rate limited to 30 requests per 15 minutes per IP.
 */
router.post('/export-csv/:userId', rateLimiter_js_1.extractionRateLimiter, async (req, res) => {
    const { userId } = req.params;
    const { startDate, endDate } = req.body;
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'userId is required',
        });
    }
    try {
        const result = await (0, mavelyDataExtraction_js_1.exportMavelyCSV)(userId, startDate, endDate);
        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: result.error,
            });
        }
        return res.json({
            success: true,
            csvData: result.csvData,
        });
    }
    catch (error) {
        console.error(`[Mavely Export] Error exporting CSV for user ${userId}:`, error);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=mavelyAuth.js.map