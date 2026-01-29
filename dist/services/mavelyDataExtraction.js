"use strict";
/**
 * Mavely Data Extraction Service
 *
 * Extracts analytics data from Mavely creator dashboard
 * using Puppeteer to navigate and scrape data.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractMavelyData = extractMavelyData;
exports.exportMavelyCSV = exportMavelyCSV;
const puppeteer_1 = __importDefault(require("puppeteer"));
const platformStorage_js_1 = require("./platformStorage.js");
const MAVELY_ANALYTICS_URL = 'https://creators.joinmavely.com/analytics';
const DEFAULT_TIMEOUT = 60000;
/**
 * Extract Mavely analytics data for a date range
 */
async function extractMavelyData(userId, startDate, endDate) {
    let browser = null;
    try {
        console.log(`[Mavely Extract] Starting data extraction for user ${userId}`);
        // Get stored tokens
        const tokens = await (0, platformStorage_js_1.getPlatformTokens)(userId, 'MAVELY');
        if (!tokens) {
            return {
                success: false,
                error: 'No Mavely connection found. Please connect your account first.',
            };
        }
        // Launch browser
        browser = await puppeteer_1.default.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080',
            ],
        });
        const page = await browser.newPage();
        // Set viewport and user agent
        await page.setViewport({ width: 1920, height: 1080 });
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        // Set cookies/auth from stored tokens
        await page.setCookie({
            name: 'auth-token',
            value: tokens.accessToken,
            domain: '.joinmavely.com',
            path: '/',
        });
        if (tokens.sessionCookie) {
            await page.setCookie({
                name: 'session',
                value: tokens.sessionCookie,
                domain: '.joinmavely.com',
                path: '/',
            });
        }
        console.log('[Mavely Extract] Navigating to analytics page...');
        // Navigate to analytics page
        await page.goto(MAVELY_ANALYTICS_URL, {
            waitUntil: 'networkidle2',
            timeout: DEFAULT_TIMEOUT,
        });
        await delay(2000);
        // Take screenshot for debugging
        await page.screenshot({ path: '/tmp/mavely-analytics-page.png' });
        console.log('[Mavely Extract] Screenshot saved to /tmp/mavely-analytics-page.png');
        // Check if we're actually on the analytics page (not redirected to login)
        const currentUrl = page.url();
        if (currentUrl.includes('/auth/login')) {
            return {
                success: false,
                error: 'Session expired. Please reconnect your Mavely account.',
            };
        }
        // Set date range if date picker exists
        if (startDate && endDate) {
            await setDateRange(page, startDate, endDate);
        }
        // Wait for data to load
        await delay(3000);
        // Extract analytics data
        const analyticsData = await extractAnalyticsFromPage(page);
        console.log(`[Mavely Extract] Successfully extracted ${analyticsData.length} data points`);
        return {
            success: true,
            data: analyticsData,
        };
    }
    catch (error) {
        console.error('[Mavely Extract] Error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error during data extraction',
        };
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
}
/**
 * Set date range in the Mavely date picker
 */
async function setDateRange(page, startDate, endDate) {
    try {
        console.log(`[Mavely Extract] Setting date range: ${startDate} to ${endDate}`);
        // Look for date picker input
        const datePickerSelectors = [
            'input[name="date"]',
            'input[id*="date" i]',
            'input.mantine-DateRangePicker-input',
            'input[autocomplete="off"][readonly]',
        ];
        for (const selector of datePickerSelectors) {
            const dateInput = await page.$(selector);
            if (dateInput) {
                console.log(`[Mavely Extract] Found date picker: ${selector}`);
                // Click to open date picker
                await dateInput.click();
                await delay(1000);
                // Try to interact with the date picker
                // This will vary based on the actual implementation
                // For now, we'll just log that we found it
                console.log('[Mavely Extract] Date picker opened, waiting for manual date selection support...');
                // Close date picker for now
                await page.keyboard.press('Escape');
                break;
            }
        }
    }
    catch (error) {
        console.log('[Mavely Extract] Could not set date range:', error);
    }
}
/**
 * Extract analytics data from the page
 */
async function extractAnalyticsFromPage(page) {
    try {
        // Extract data from the page
        const data = await page.evaluate(() => {
            const results = [];
            // Try to find quick stats
            const statsElements = document.querySelectorAll('[class*="stat" i], [class*="metric" i], [class*="card" i]');
            const today = new Date().toISOString().split('T')[0];
            const dataPoint = {
                date: today,
            };
            // Look for specific metrics
            statsElements.forEach(el => {
                const text = el.textContent?.trim() || '';
                const lowerText = text.toLowerCase();
                // Extract sales
                if (lowerText.includes('sales') || lowerText.includes('revenue')) {
                    const match = text.match(/\$?([\d,]+\.?\d*)/);
                    if (match) {
                        dataPoint.sales = parseFloat(match[1].replace(/,/g, ''));
                    }
                }
                // Extract commission
                if (lowerText.includes('commission')) {
                    const match = text.match(/\$?([\d,]+\.?\d*)/);
                    if (match) {
                        dataPoint.commission = parseFloat(match[1].replace(/,/g, ''));
                    }
                }
                // Extract clicks
                if (lowerText.includes('clicks')) {
                    const match = text.match(/([\d,]+)/);
                    if (match) {
                        dataPoint.clicks = parseInt(match[1].replace(/,/g, ''), 10);
                    }
                }
                // Extract conversion rate
                if (lowerText.includes('conversion')) {
                    const match = text.match(/([\d.]+)%/);
                    if (match) {
                        dataPoint.conversionRate = parseFloat(match[1]);
                    }
                }
                // Extract orders
                if (lowerText.includes('orders')) {
                    const match = text.match(/([\d,]+)/);
                    if (match) {
                        dataPoint.orders = parseInt(match[1].replace(/,/g, ''), 10);
                    }
                }
            });
            // Only add if we found at least one metric
            if (Object.keys(dataPoint).length > 1) {
                results.push(dataPoint);
            }
            // Try to extract table data if available
            const tables = document.querySelectorAll('table');
            tables.forEach(table => {
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 2) {
                        const rowData = {
                            date: cells[0].textContent?.trim() || today,
                        };
                        // Try to extract numeric values from cells
                        cells.forEach((cell, index) => {
                            if (index === 0)
                                return; // Skip date column
                            const text = cell.textContent?.trim() || '';
                            const match = text.match(/\$?([\d,]+\.?\d*)/);
                            if (match) {
                                const value = parseFloat(match[1].replace(/,/g, ''));
                                rowData[`metric${index}`] = value;
                            }
                        });
                        if (Object.keys(rowData).length > 1) {
                            results.push(rowData);
                        }
                    }
                });
            });
            return results;
        });
        return data;
    }
    catch (error) {
        console.error('[Mavely Extract] Error extracting data from page:', error);
        return [];
    }
}
/**
 * Helper function for delays
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
/**
 * Export Mavely data as CSV (if export button is available)
 */
async function exportMavelyCSV(userId, startDate, endDate) {
    let browser = null;
    try {
        const tokens = await (0, platformStorage_js_1.getPlatformTokens)(userId, 'MAVELY');
        if (!tokens) {
            return {
                success: false,
                error: 'No Mavely connection found',
            };
        }
        browser = await puppeteer_1.default.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
            ],
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        // Set auth cookies
        await page.setCookie({
            name: 'auth-token',
            value: tokens.accessToken,
            domain: '.joinmavely.com',
            path: '/',
        });
        await page.goto(MAVELY_ANALYTICS_URL, {
            waitUntil: 'networkidle2',
            timeout: DEFAULT_TIMEOUT,
        });
        await delay(2000);
        // Look for CSV export button
        const exportButtonSelectors = [
            'button:has-text("Export")',
            'button:has-text("Download")',
            'button:has-text("CSV")',
            '[aria-label*="export" i]',
            '[aria-label*="download" i]',
        ];
        let exportButton = null;
        for (const selector of exportButtonSelectors) {
            try {
                exportButton = await page.$(selector);
                if (exportButton) {
                    console.log(`[Mavely Export] Found export button: ${selector}`);
                    break;
                }
            }
            catch {
                // Continue
            }
        }
        if (!exportButton) {
            return {
                success: false,
                error: 'CSV export button not found on analytics page',
            };
        }
        // Click export button and wait for download
        // This would need to be implemented based on how Mavely handles exports
        return {
            success: false,
            error: 'CSV export functionality not fully implemented yet',
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
    finally {
        if (browser) {
            await browser.close();
        }
    }
}
//# sourceMappingURL=mavelyDataExtraction.js.map