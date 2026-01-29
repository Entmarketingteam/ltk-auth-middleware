# API Reference

Complete API documentation for the Multi-Platform Creator Analytics Middleware.

Base URL: `https://your-middleware.railway.app`

---

## Health Check

### GET /health

Check if the server is running.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2026-01-29T17:00:00.000Z",
  "version": "2.0.0"
}
```

---

## LTK (RewardStyle) Endpoints

### POST /api/ltk/connect

Connect a creator's LTK account.

**Request Body:**
```json
{
  "userId": "string (required)",
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "LTK account connected successfully",
  "expiresAt": "2026-01-30T17:00:00.000Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Invalid credentials",
  "errorCode": "INVALID_CREDENTIALS"
}
```

### GET /api/ltk/status/:userId

Check LTK connection status.

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

### DELETE /api/ltk/disconnect/:userId

Disconnect LTK account.

**Response:**
```json
{
  "success": true,
  "message": "LTK account disconnected"
}
```

---

## Mavely Endpoints

### POST /api/mavely/connect

Connect a creator's Mavely account using credentials.

**Request Body:**
```json
{
  "userId": "string (required)",
  "email": "string (required)",
  "password": "string (required)"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Mavely account connected successfully",
  "expiresAt": "2026-01-30T17:00:00.000Z"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Login failed",
  "errorCode": "INVALID_CREDENTIALS"
}
```

**Error Codes:**
- `INVALID_CREDENTIALS` - Wrong email or password
- `TIMEOUT` - Login took too long
- `BLOCKED` - IP or account blocked
- `UNKNOWN` - Unexpected error

### GET /api/mavely/status/:userId

Check Mavely connection status for a user.

**URL Parameters:**
- `userId` - User ID (required)

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

**Status Values:**
- `CONNECTED` - Account connected and tokens valid
- `DISCONNECTED` - Account disconnected
- `ERROR` - Connection error, needs reconnection
- `NOT_FOUND` - No connection found

### DELETE /api/mavely/disconnect/:userId

Disconnect Mavely account and remove stored tokens.

**URL Parameters:**
- `userId` - User ID (required)

**Response:**
```json
{
  "success": true,
  "message": "Mavely account disconnected"
}
```

### POST /api/mavely/extract/:userId

Extract analytics data from Mavely for a date range.

**URL Parameters:**
- `userId` - User ID (required)

**Request Body:**
```json
{
  "startDate": "2026-01-01 (optional, default: today)",
  "endDate": "2026-01-29 (optional, default: today)",
  "exportToSheets": false,
  "spreadsheetId": "string (required if exportToSheets=true)",
  "sheetName": "string (optional, default: 'Mavely Analytics')"
}
```

**Response (Without Sheets):**
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
  "message": "Extracted 1 data points"
}
```

**Response (With Sheets):**
```json
{
  "success": true,
  "data": [...],
  "sheets": {
    "success": true,
    "appendedRows": 1
  },
  "message": "Extracted 1 data points and appended to Google Sheets"
}
```

**Data Fields:**
- `date` - Date of data (ISO format)
- `sales` - Total sales amount
- `commission` - Commission earned
- `clicks` - Number of clicks
- `conversionRate` - Conversion rate percentage
- `orders` - Number of orders
- Additional fields may vary based on platform

### POST /api/mavely/export-csv/:userId

Attempt to export CSV from Mavely (if platform supports it).

**URL Parameters:**
- `userId` - User ID (required)

**Request Body:**
```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-29"
}
```

**Response:**
```json
{
  "success": true,
  "csvData": "date,sales,commission,...\n2026-01-29,1250.50,125.05,..."
}
```

**Note:** This feature depends on platform availability and may not be fully implemented.

---

## Scheduled Jobs Endpoints

### POST /api/scheduled/:platform/enable/:userId

Enable scheduled daily extraction for a platform.

**URL Parameters:**
- `platform` - Platform name: `mavely`, `amazon`, or `shopmy`
- `userId` - User ID (required)

**Request Body:**
```json
{
  "spreadsheetId": "string (required)",
  "sheetName": "string (optional, default: '{Platform} Analytics')",
  "schedule": "string (optional, cron format, default: '0 2 * * *')"
}
```

**Cron Schedule Examples:**
- `"0 2 * * *"` - Daily at 2 AM UTC (default)
- `"0 8 * * *"` - Daily at 8 AM UTC
- `"0 */6 * * *"` - Every 6 hours
- `"0 0 * * 0"` - Weekly on Sunday at midnight
- `"0 12 * * 1-5"` - Weekdays at noon

**Response:**
```json
{
  "success": true,
  "message": "Scheduled extraction enabled for mavely",
  "schedule": "0 2 * * *"
}
```

### POST /api/scheduled/:platform/disable/:userId

Disable scheduled extraction for a platform.

**URL Parameters:**
- `platform` - Platform name: `mavely`, `amazon`, or `shopmy`
- `userId` - User ID (required)

**Response:**
```json
{
  "success": true,
  "message": "Scheduled extraction disabled for mavely"
}
```

---

## Error Responses

All endpoints follow a consistent error format:

```json
{
  "success": false,
  "error": "Human-readable error message"
}
```

### Common HTTP Status Codes

- `200` - Success
- `400` - Bad request (missing or invalid parameters)
- `401` - Authentication failed
- `404` - Resource not found
- `500` - Internal server error

### Platform-Specific Error Codes

**Login Errors:**
- `INVALID_CREDENTIALS` - Wrong email or password
- `TIMEOUT` - Login took too long (> 60 seconds)
- `BLOCKED` - Account or IP blocked by platform
- `UNKNOWN` - Unexpected error

**Connection Errors:**
- `NOT_FOUND` - No connection found for user
- `SESSION_EXPIRED` - Tokens expired, need to reconnect

**Data Extraction Errors:**
- `NO_CONNECTION` - Platform not connected
- `NO_DATA` - No data available for date range
- `RATE_LIMITED` - Too many requests

---

## Rate Limiting

Currently, there are no hard rate limits, but please be responsible:

- **Manual extractions**: Avoid running more than once per minute
- **Scheduled jobs**: Default to daily, minimum 1 hour intervals recommended
- **Login attempts**: Maximum 3 per minute per user

Excessive usage may result in blocking from the platform or middleware.

---

## Authentication & Security

### Token Storage
- All tokens are encrypted with AES-256-GCM before storage
- Credentials are never stored, only used once during login
- Each user's tokens are isolated and can only be accessed with their userId

### CORS
- Requests must come from whitelisted `FRONTEND_URL`
- Set in environment variables

### HTTPS
- All production deployments must use HTTPS
- Credentials transmitted over HTTP will be rejected

---

## Webhooks & Callbacks

*Coming soon*

Planned features:
- Webhook notifications when scheduled jobs complete
- Webhook notifications when tokens expire
- Callback URLs for async operations

---

## Data Retention

- **Tokens**: Stored until explicitly disconnected or expired
- **Analytics Data**: Not stored in middleware (only passed through to Google Sheets)
- **Logs**: Retained for 7 days on Railway
- **Scheduled Jobs**: Configuration stored in `platform_connections.metadata`

---

## Limits

### Google Sheets API
- 60 requests per minute per service account
- 500 requests per 100 seconds per service account
- Middleware includes automatic delays to stay within limits

### Puppeteer
- Maximum 5 concurrent browser sessions
- Maximum 60-second timeout per login
- Screenshots saved to `/tmp` for debugging

### Database
- Supabase free tier: 500MB storage, 2GB bandwidth
- Tokens are small (~2KB each)
- Metadata stored in JSONB column

---

## Support

For issues or questions:
1. Check server logs in Railway dashboard
2. Review the troubleshooting section in MAVELY-INTEGRATION.md
3. Create an issue in the GitHub repository
4. Contact the development team

---

**API Version:** 2.0.0  
**Last Updated:** January 29, 2026
