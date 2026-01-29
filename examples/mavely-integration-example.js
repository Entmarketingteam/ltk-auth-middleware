/**
 * Example: Complete Mavely Integration Workflow
 * 
 * This example demonstrates how to:
 * 1. Connect a Mavely account
 * 2. Extract analytics data
 * 3. Export to Google Sheets
 * 4. Set up scheduled daily extraction
 */

const MIDDLEWARE_URL = 'https://your-middleware.railway.app';
const USER_ID = 'your-user-id';

// ============================================================
// 1. CONNECT MAVELY ACCOUNT
// ============================================================

async function connectMavelyAccount() {
  const response = await fetch(`${MIDDLEWARE_URL}/api/mavely/connect`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      userId: USER_ID,
      email: 'marketingteam@nickient.com',
      password: 'your-password', // IMPORTANT: Change the password after sharing!
    }),
  });

  const result = await response.json();
  console.log('Connect Result:', result);
  
  if (result.success) {
    console.log('✅ Mavely account connected successfully!');
    console.log('Token expires at:', result.expiresAt);
  } else {
    console.error('❌ Connection failed:', result.error);
  }
  
  return result;
}

// ============================================================
// 2. CHECK CONNECTION STATUS
// ============================================================

async function checkMavelyStatus() {
  const response = await fetch(`${MIDDLEWARE_URL}/api/mavely/status/${USER_ID}`);
  const result = await response.json();
  
  console.log('Status:', result);
  console.log('Connected:', result.connected);
  console.log('Expires At:', result.expiresAt);
  
  return result;
}

// ============================================================
// 3. EXTRACT DATA MANUALLY (One-time)
// ============================================================

async function extractMavelyData(startDate, endDate) {
  const response = await fetch(`${MIDDLEWARE_URL}/api/mavely/extract/${USER_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate: startDate || '2026-01-01',
      endDate: endDate || '2026-01-29',
      exportToSheets: false, // Set to true to export to Google Sheets
    }),
  });

  const result = await response.json();
  console.log('Extraction Result:', result);
  
  if (result.success) {
    console.log('✅ Data extracted successfully!');
    console.log('Data points:', result.data.length);
    console.log('Sample data:', result.data[0]);
  } else {
    console.error('❌ Extraction failed:', result.error);
  }
  
  return result;
}

// ============================================================
// 4. EXTRACT AND EXPORT TO GOOGLE SHEETS
// ============================================================

async function extractAndExportToSheets() {
  const SPREADSHEET_ID = '1abc123def456ghi789jkl'; // Your Google Sheet ID
  
  const response = await fetch(`${MIDDLEWARE_URL}/api/mavely/extract/${USER_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      startDate: '2026-01-01',
      endDate: '2026-01-29',
      exportToSheets: true,
      spreadsheetId: SPREADSHEET_ID,
      sheetName: 'Mavely Analytics',
    }),
  });

  const result = await response.json();
  console.log('Export Result:', result);
  
  if (result.success && result.sheets?.success) {
    console.log('✅ Data exported to Google Sheets!');
    console.log('Appended rows:', result.sheets.appendedRows);
  } else {
    console.error('❌ Export failed:', result.error || result.sheets?.error);
  }
  
  return result;
}

// ============================================================
// 5. ENABLE SCHEDULED DAILY EXTRACTION
// ============================================================

async function enableScheduledExtraction() {
  const SPREADSHEET_ID = '1abc123def456ghi789jkl'; // Your Google Sheet ID
  
  const response = await fetch(`${MIDDLEWARE_URL}/api/scheduled/mavely/enable/${USER_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      spreadsheetId: SPREADSHEET_ID,
      sheetName: 'Mavely Analytics',
      schedule: '0 2 * * *', // Daily at 2 AM UTC (optional, this is default)
    }),
  });

  const result = await response.json();
  console.log('Scheduled Extraction:', result);
  
  if (result.success) {
    console.log('✅ Scheduled extraction enabled!');
    console.log('Schedule:', result.schedule);
    console.log('Data will be automatically extracted daily and appended to Google Sheets');
  } else {
    console.error('❌ Failed to enable scheduled extraction:', result.error);
  }
  
  return result;
}

// ============================================================
// 6. DISABLE SCHEDULED EXTRACTION
// ============================================================

async function disableScheduledExtraction() {
  const response = await fetch(`${MIDDLEWARE_URL}/api/scheduled/mavely/disable/${USER_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const result = await response.json();
  console.log('Disable Result:', result);
  
  if (result.success) {
    console.log('✅ Scheduled extraction disabled');
  } else {
    console.error('❌ Failed to disable:', result.error);
  }
  
  return result;
}

// ============================================================
// 7. DISCONNECT MAVELY ACCOUNT
// ============================================================

async function disconnectMavely() {
  const response = await fetch(`${MIDDLEWARE_URL}/api/mavely/disconnect/${USER_ID}`, {
    method: 'DELETE',
  });

  const result = await response.json();
  console.log('Disconnect Result:', result);
  
  if (result.success) {
    console.log('✅ Mavely account disconnected');
  } else {
    console.error('❌ Failed to disconnect:', result.error);
  }
  
  return result;
}

// ============================================================
// COMPLETE WORKFLOW EXAMPLE
// ============================================================

async function completeWorkflow() {
  console.log('🚀 Starting Complete Mavely Integration Workflow...\n');
  
  // Step 1: Connect account
  console.log('Step 1: Connecting Mavely account...');
  await connectMavelyAccount();
  console.log('\n');
  
  // Step 2: Check status
  console.log('Step 2: Checking connection status...');
  await checkMavelyStatus();
  console.log('\n');
  
  // Step 3: Extract data manually (for testing)
  console.log('Step 3: Extracting data manually...');
  await extractMavelyData('2026-01-01', '2026-01-29');
  console.log('\n');
  
  // Step 4: Extract and export to Google Sheets
  console.log('Step 4: Exporting to Google Sheets...');
  await extractAndExportToSheets();
  console.log('\n');
  
  // Step 5: Enable scheduled daily extraction
  console.log('Step 5: Enabling scheduled daily extraction...');
  await enableScheduledExtraction();
  console.log('\n');
  
  console.log('✅ Complete workflow finished!');
  console.log('Your Mavely analytics will now be automatically extracted daily.');
}

// ============================================================
// RUN IT!
// ============================================================

// Uncomment to run the complete workflow
// completeWorkflow();

// Or run individual functions as needed:
// connectMavelyAccount();
// checkMavelyStatus();
// extractMavelyData('2026-01-01', '2026-01-29');
// extractAndExportToSheets();
// enableScheduledExtraction();
// disableScheduledExtraction();
// disconnectMavely();
