/**
 * Mavely Data Extraction Service
 *
 * Extracts analytics data from Mavely creator dashboard
 * using Puppeteer to navigate and scrape data.
 */
export interface MavelyAnalyticsData {
    date: string;
    sales?: number;
    commission?: number;
    clicks?: number;
    conversionRate?: number;
    revenue?: number;
    orders?: number;
    [key: string]: string | number | undefined;
}
export interface MavelyDataExtractionResult {
    success: boolean;
    data?: MavelyAnalyticsData[];
    error?: string;
}
/**
 * Extract Mavely analytics data for a date range
 */
export declare function extractMavelyData(userId: string, startDate: string, endDate: string): Promise<MavelyDataExtractionResult>;
/**
 * Export Mavely data as CSV (if export button is available)
 */
export declare function exportMavelyCSV(userId: string, startDate: string, endDate: string): Promise<{
    success: boolean;
    csvData?: string;
    error?: string;
}>;
//# sourceMappingURL=mavelyDataExtraction.d.ts.map