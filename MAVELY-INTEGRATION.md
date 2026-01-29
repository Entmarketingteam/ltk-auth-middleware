# Multi-Platform Creator Analytics Automation

This middleware now supports automated data extraction from multiple creator platforms:
- **LTK (RewardStyle)** - Existing functionality
- **Mavely** - NEW
- **Amazon Creator** - Coming soon
- **ShopMY** - Coming soon

## Features

### 🔐 Secure Authentication
- Plaid-style credential flow (never stores passwords)
- AES-256-GCM encrypted token storage
- Automated login via headless Chrome (Puppeteer)
- No 2FA support needed for Mavely

### 📊 Data Extraction
- Automated daily analytics extraction
- Scheduled extraction to Google Sheets
- Manual on-demand data extraction
- CSV export support (where available)

### 📅 Scheduled Jobs
- Daily automated data extraction (configurable schedule)
- Automatic append to Google Sheets
- Per-user, per-platform configuration
- Default: Daily at 2 AM UTC

## Mavely Integration

### Connect Mavely Account

```bash
POST /api/mavely/connect
```

**Request:**
```json
{
  "userId": "your-user-id",
  "email": "marketingteam@nickient.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Mavely account connected successfully",
  "expiresAt": "2026-01-30T17:00:00.000Z"
}
```

### Extract Analytics Data

```bash
POST /api/mavely/extract/:userId
```

**Request:**
```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-29",
  "exportToSheets": true,
  "spreadsheetId": "your-google-sheet-id",
  "sheetName": "Mavely Analytics"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-01-29",
      "sales": 1250.50,
      "commission": 125.05,
      "clicks": 450,
      "conversionRate": 2.8,
      "orders": 15
    }
  ],
  "sheets": {
    "success": true,
    "appendedRows": 1
  },
  "message": "Extracted 1 data points and appended to Google Sheets"
}
```

### Check Connection Status

```bash
GET /api/mavely/status/:userId
```

**Response:**
```json
{
  "success": true,
  "connected": true,
  "status": "CONNECTED",
  "expiresAt": "2026-01-30T17:00:00.000Z",
  "lastRefresh": "2026-01-29T17:00:00.000Z"
}
```

### Disconnect Mavely Account

```bash
DELETE /api/mavely/disconnect/:userId
```

## Scheduled Data Extraction

### Enable Scheduled Extraction

Set up daily automated extraction to Google Sheets:

```bash
POST /api/scheduled/mavely/enable/:userId
```

**Request:**
```json
{
  "spreadsheetId": "your-google-sheet-id",
  "sheetName": "Mavely Analytics",
  "schedule": "0 2 * * *"
}
```

The `schedule` field uses cron syntax:
- `"0 2 * * *"` = Daily at 2 AM UTC (default)
- `"0 8 * * *"` = Daily at 8 AM UTC
- `"0 */6 * * *"` = Every 6 hours
- `"0 0 * * 0"` = Weekly on Sunday at midnight

**Response:**
```json
{
  "success": true,
  "message": "Scheduled extraction enabled for mavely",
  "schedule": "0 2 * * *"
}
```

### Disable Scheduled Extraction

```bash
POST /api/scheduled/mavely/disable/:userId
```

## Google Sheets Integration

### Prerequisites

1. Create a Google Service Account
2. Enable Google Sheets API
3. Download service account JSON credentials
4. Share your Google Sheet with the service account email

### Environment Variables

Add these to your `.env` or Railway environment:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

### Sheet Format

The service automatically creates sheets with headers based on extracted data:

| date       | sales   | commission | clicks | conversionRate | orders |
|------------|---------|------------|--------|----------------|--------|
| 2026-01-29 | 1250.50 | 125.05     | 450    | 2.8            | 15     |
| 2026-01-28 | 980.25  | 98.03      | 380    | 2.6            | 12     |

## Database Schema Updates

The existing `platform_connections` table now supports multiple platforms:

```sql
-- Platform can now be: 'LTK', 'MAVELY', 'AMAZON', 'SHOPMY'
-- Metadata can include scheduled_job configuration:
{
  "scheduled_job": {
    "enabled": true,
    "spreadsheet_id": "abc123...",
    "sheet_name": "Mavely Analytics",
    "schedule": "0 2 * * *",
    "created_at": "2026-01-29T17:00:00.000Z"
  }
}
```

## Security Considerations

### Credential Handling
- ✅ Credentials used once for login, then immediately discarded
- ✅ Only encrypted tokens stored in database
- ✅ All data transmission over HTTPS
- ✅ AES-256-GCM encryption for tokens

### Google Sheets Access
- ✅ Service account has minimal required permissions
- ✅ Spreadsheet access must be explicitly granted
- ✅ Private key stored in environment variables only

### Rate Limiting
- The system includes delays between scheduled jobs to avoid rate limiting
- Manual extractions are not rate-limited but should be used responsibly

## Troubleshooting

### "Could not find email input field"
The Mavely login page structure may have changed. Check `/tmp/mavely-login-page.png` for debugging.

### "Session expired"
Mavely tokens may have expired. Reconnect the account:
```bash
POST /api/mavely/connect
```

### "Google service account credentials not configured"
Ensure `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_KEY` are set in environment variables.

### No data extracted
- Verify the account is connected: `GET /api/mavely/status/:userId`
- Check if there's actual data for the date range
- Look at server logs for detailed error messages

## Examples

### Complete Workflow

1. **Connect Mavely account:**
```bash
curl -X POST https://your-middleware.railway.app/api/mavely/connect \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "email": "creator@example.com",
    "password": "secure-password"
  }'
```

2. **Extract data manually:**
```bash
curl -X POST https://your-middleware.railway.app/api/mavely/extract/user-123 \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-01-01",
    "endDate": "2026-01-29",
    "exportToSheets": true,
    "spreadsheetId": "1abc...",
    "sheetName": "Mavely Analytics"
  }'
```

3. **Enable scheduled extraction:**
```bash
curl -X POST https://your-middleware.railway.app/api/scheduled/mavely/enable/user-123 \
  -H "Content-Type: application/json" \
  -d '{
    "spreadsheetId": "1abc...",
    "sheetName": "Mavely Analytics",
    "schedule": "0 2 * * *"
  }'
```

Now your Mavely analytics will be automatically extracted daily and appended to Google Sheets!

## Coming Soon

### Amazon Creator
- Automated login to Amazon Associates
- Sales and commission tracking
- Product performance analytics

### ShopMY
- Creator dashboard integration
- Link performance tracking
- Revenue analytics

## API Reference Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mavely/connect` | POST | Connect Mavely account |
| `/api/mavely/status/:userId` | GET | Check connection status |
| `/api/mavely/disconnect/:userId` | DELETE | Disconnect account |
| `/api/mavely/extract/:userId` | POST | Extract analytics data |
| `/api/mavely/export-csv/:userId` | POST | Export CSV (if available) |
| `/api/scheduled/:platform/enable/:userId` | POST | Enable scheduled extraction |
| `/api/scheduled/:platform/disable/:userId` | POST | Disable scheduled extraction |

## Support

For issues or questions, please check the server logs or create an issue in the repository.
