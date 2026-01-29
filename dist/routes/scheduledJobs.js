"use strict";
/**
 * Scheduled Jobs Management Routes
 *
 * Handles configuration of scheduled data extraction jobs
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const scheduledExtraction_js_1 = require("../services/scheduledExtraction.js");
const router = (0, express_1.Router)();
/**
 * POST /api/scheduled/:platform/enable/:userId
 *
 * Enable scheduled daily extraction for a platform
 */
router.post('/:platform/enable/:userId', async (req, res) => {
    const { platform, userId } = req.params;
    const { spreadsheetId, sheetName, schedule } = req.body;
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'userId is required',
        });
    }
    if (!spreadsheetId) {
        return res.status(400).json({
            success: false,
            error: 'spreadsheetId is required',
        });
    }
    const platformUpper = platform.toUpperCase();
    if (!['MAVELY', 'AMAZON', 'SHOPMY'].includes(platformUpper)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid platform. Must be MAVELY, AMAZON, or SHOPMY',
        });
    }
    try {
        await (0, scheduledExtraction_js_1.enableScheduledExtraction)(userId, platformUpper, spreadsheetId, sheetName, schedule);
        return res.json({
            success: true,
            message: `Scheduled extraction enabled for ${platform}`,
            schedule: schedule || '0 2 * * *', // 2 AM UTC daily
        });
    }
    catch (error) {
        console.error(`[Scheduled Jobs] Error enabling scheduled extraction:`, error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
/**
 * POST /api/scheduled/:platform/disable/:userId
 *
 * Disable scheduled daily extraction for a platform
 */
router.post('/:platform/disable/:userId', async (req, res) => {
    const { platform, userId } = req.params;
    if (!userId) {
        return res.status(400).json({
            success: false,
            error: 'userId is required',
        });
    }
    const platformUpper = platform.toUpperCase();
    if (!['MAVELY', 'AMAZON', 'SHOPMY'].includes(platformUpper)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid platform. Must be MAVELY, AMAZON, or SHOPMY',
        });
    }
    try {
        await (0, scheduledExtraction_js_1.disableScheduledExtraction)(userId, platformUpper);
        return res.json({
            success: true,
            message: `Scheduled extraction disabled for ${platform}`,
        });
    }
    catch (error) {
        console.error(`[Scheduled Jobs] Error disabling scheduled extraction:`, error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        });
    }
});
exports.default = router;
//# sourceMappingURL=scheduledJobs.js.map