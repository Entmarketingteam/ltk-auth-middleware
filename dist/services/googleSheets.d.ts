/**
 * Google Sheets Integration Service
 *
 * Handles appending extracted analytics data to Google Sheets.
 * Requires Google Service Account credentials.
 */
import { MavelyAnalyticsData } from './mavelyDataExtraction.js';
export interface GoogleSheetsConfig {
    spreadsheetId: string;
    sheetName?: string;
    credentials?: {
        client_email: string;
        private_key: string;
    };
}
/**
 * Append analytics data to Google Sheets
 */
export declare function appendToGoogleSheets(data: MavelyAnalyticsData[], config: GoogleSheetsConfig): Promise<{
    success: boolean;
    error?: string;
    appendedRows?: number;
}>;
/**
 * Create a new Google Sheet for analytics data
 */
export declare function createAnalyticsSheet(title: string, credentials?: GoogleSheetsConfig['credentials']): Promise<{
    success: boolean;
    spreadsheetId?: string;
    error?: string;
}>;
/**
 * Get existing data from a sheet
 */
export declare function getSheetData(config: GoogleSheetsConfig, range?: string): Promise<{
    success: boolean;
    data?: any[][];
    error?: string;
}>;
//# sourceMappingURL=googleSheets.d.ts.map