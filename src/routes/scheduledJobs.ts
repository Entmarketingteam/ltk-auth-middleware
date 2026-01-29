/**
 * Scheduled Jobs Management Routes
 * 
 * Handles configuration of scheduled data extraction jobs
 */

import { Router, Request, Response } from 'express';
import {
  enableScheduledExtraction,
  disableScheduledExtraction,
} from '../services/scheduledExtraction.js';

const router = Router();

/**
 * POST /api/scheduled/:platform/enable/:userId
 * 
 * Enable scheduled daily extraction for a platform
 */
router.post('/:platform/enable/:userId', async (req: Request, res: Response) => {
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

  const platformUpper = platform.toUpperCase() as 'MAVELY' | 'AMAZON' | 'SHOPMY';
  if (!['MAVELY', 'AMAZON', 'SHOPMY'].includes(platformUpper)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid platform. Must be MAVELY, AMAZON, or SHOPMY',
    });
  }

  try {
    await enableScheduledExtraction(
      userId,
      platformUpper,
      spreadsheetId,
      sheetName,
      schedule
    );

    return res.json({
      success: true,
      message: `Scheduled extraction enabled for ${platform}`,
      schedule: schedule || '0 2 * * *', // 2 AM UTC daily
    });
  } catch (error) {
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
router.post('/:platform/disable/:userId', async (req: Request, res: Response) => {
  const { platform, userId } = req.params;

  if (!userId) {
    return res.status(400).json({
      success: false,
      error: 'userId is required',
    });
  }

  const platformUpper = platform.toUpperCase() as 'MAVELY' | 'AMAZON' | 'SHOPMY';
  if (!['MAVELY', 'AMAZON', 'SHOPMY'].includes(platformUpper)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid platform. Must be MAVELY, AMAZON, or SHOPMY',
    });
  }

  try {
    await disableScheduledExtraction(userId, platformUpper);

    return res.json({
      success: true,
      message: `Scheduled extraction disabled for ${platform}`,
    });
  } catch (error) {
    console.error(`[Scheduled Jobs] Error disabling scheduled extraction:`, error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
});

export default router;
