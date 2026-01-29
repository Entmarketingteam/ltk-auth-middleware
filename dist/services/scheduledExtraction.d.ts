/**
 * Scheduled Data Extraction Service
 *
 * Handles scheduled daily extraction of analytics data from all platforms
 * and appending to Google Sheets.
 */
/**
 * Start the scheduled data extraction job
 * Runs daily at 2 AM by default (configurable per user)
 */
export declare function startScheduledDataExtraction(): void;
/**
 * Enable scheduled extraction for a user
 */
export declare function enableScheduledExtraction(userId: string, platform: 'MAVELY' | 'AMAZON' | 'SHOPMY', spreadsheetId: string, sheetName?: string, schedule?: string): Promise<void>;
/**
 * Disable scheduled extraction for a user
 */
export declare function disableScheduledExtraction(userId: string, platform: 'MAVELY' | 'AMAZON' | 'SHOPMY'): Promise<void>;
//# sourceMappingURL=scheduledExtraction.d.ts.map