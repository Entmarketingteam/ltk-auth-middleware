/**
 * Google Sheets Integration Service
 * 
 * Handles appending extracted analytics data to Google Sheets.
 * Requires Google Service Account credentials.
 */

import { google } from 'googleapis';
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
 * Get Google Sheets API client
 */
async function getSheetsClient(config: GoogleSheetsConfig) {
  // Use service account credentials from env or config
  const credentials = config.credentials || {
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '',
    private_key: (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '').replace(/\\n/g, '\n'),
  };

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Google service account credentials not configured');
  }

  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Append analytics data to Google Sheets
 */
export async function appendToGoogleSheets(
  data: MavelyAnalyticsData[],
  config: GoogleSheetsConfig
): Promise<{ success: boolean; error?: string; appendedRows?: number }> {
  try {
    if (!data || data.length === 0) {
      return {
        success: false,
        error: 'No data to append',
      };
    }

    const sheets = await getSheetsClient(config);
    const sheetName = config.sheetName || 'Analytics Data';

    // Prepare data for sheets
    // First, get all unique keys from the data
    const allKeys = new Set<string>();
    data.forEach(row => {
      Object.keys(row).forEach(key => allKeys.add(key));
    });
    const headers = Array.from(allKeys).sort();

    // Check if sheet exists and has headers
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: config.spreadsheetId,
    });

    const sheet = spreadsheet.data.sheets?.find(
      s => s.properties?.title === sheetName
    );

    if (!sheet) {
      // Create sheet if it doesn't exist
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });

      // Add headers
      await sheets.spreadsheets.values.append({
        spreadsheetId: config.spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });
    } else {
      // Check if headers exist
      const headerRange = `${sheetName}!A1:${String.fromCharCode(65 + headers.length - 1)}1`;
      const existingHeaders = await sheets.spreadsheets.values.get({
        spreadsheetId: config.spreadsheetId,
        range: headerRange,
      });

      if (!existingHeaders.data.values || existingHeaders.data.values.length === 0) {
        // Add headers
        await sheets.spreadsheets.values.append({
          spreadsheetId: config.spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [headers],
          },
        });
      }
    }

    // Convert data to rows
    const rows = data.map(item => {
      return headers.map(key => {
        const value = item[key];
        if (value === undefined || value === null) return '';
        if (typeof value === 'number') return value;
        return String(value);
      });
    });

    // Append data
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: config.spreadsheetId,
      range: `${sheetName}!A:A`,
      valueInputOption: 'RAW',
      requestBody: {
        values: rows,
      },
    });

    console.log(`[Google Sheets] Appended ${rows.length} rows to ${sheetName}`);

    return {
      success: true,
      appendedRows: rows.length,
    };
  } catch (error) {
    console.error('[Google Sheets] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Create a new Google Sheet for analytics data
 */
export async function createAnalyticsSheet(
  title: string,
  credentials?: GoogleSheetsConfig['credentials']
): Promise<{ success: boolean; spreadsheetId?: string; error?: string }> {
  try {
    const config: GoogleSheetsConfig = {
      spreadsheetId: '', // Not needed for creation
      credentials,
    };

    const sheets = await getSheetsClient(config);

    const response = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title,
        },
        sheets: [
          {
            properties: {
              title: 'Mavely Analytics',
            },
          },
          {
            properties: {
              title: 'Amazon Analytics',
            },
          },
          {
            properties: {
              title: 'ShopMY Analytics',
            },
          },
        ],
      },
    });

    console.log(`[Google Sheets] Created new spreadsheet: ${response.data.spreadsheetId}`);

    return {
      success: true,
      spreadsheetId: response.data.spreadsheetId || undefined,
    };
  } catch (error) {
    console.error('[Google Sheets] Error creating sheet:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get existing data from a sheet
 */
export async function getSheetData(
  config: GoogleSheetsConfig,
  range?: string
): Promise<{ success: boolean; data?: any[][]; error?: string }> {
  try {
    const sheets = await getSheetsClient(config);
    const sheetName = config.sheetName || 'Analytics Data';
    const dataRange = range || `${sheetName}!A:Z`;

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: config.spreadsheetId,
      range: dataRange,
    });

    return {
      success: true,
      data: response.data.values || [],
    };
  } catch (error) {
    console.error('[Google Sheets] Error getting data:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
