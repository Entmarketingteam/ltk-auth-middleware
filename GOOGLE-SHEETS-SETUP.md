# Google Sheets Setup Guide

This guide walks you through setting up Google Sheets integration for automated data extraction.

## Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Create Project"**
3. Name it something like "Creator Analytics Automation"
4. Click **"Create"**

## Step 2: Enable Google Sheets API

1. In your project, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google Sheets API"**
3. Click on it and click **"Enable"**

## Step 3: Create a Service Account

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"Service Account"**
3. Fill in the details:
   - **Service account name:** `creator-analytics-automation`
   - **Service account ID:** (auto-filled)
   - **Description:** `Service account for automated creator analytics data extraction`
4. Click **"Create and Continue"**
5. For **"Grant this service account access to project"**, select:
   - **Role:** `Editor` (or just `Viewer` if you only need read access)
6. Click **"Continue"** then **"Done"**

## Step 4: Create Service Account Key

1. In the **"Credentials"** page, find your newly created service account
2. Click on the service account email
3. Go to the **"Keys"** tab
4. Click **"Add Key"** → **"Create new key"**
5. Choose **"JSON"** format
6. Click **"Create"**
7. A JSON file will be downloaded - **keep this safe!**

The JSON file will look like this:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "creator-analytics-automation@your-project.iam.gserviceaccount.com",
  "client_id": "123456789...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

## Step 5: Add Environment Variables

Extract these two values from the JSON file:

1. **`client_email`** → Goes into `GOOGLE_SERVICE_ACCOUNT_EMAIL`
2. **`private_key`** → Goes into `GOOGLE_SERVICE_ACCOUNT_KEY`

### For Railway Deployment:

1. Go to your Railway project
2. Click on your service
3. Go to **"Variables"** tab
4. Add:
   ```
   GOOGLE_SERVICE_ACCOUNT_EMAIL=creator-analytics-automation@your-project.iam.gserviceaccount.com
   ```
5. Add (paste the entire key including the BEGIN/END markers):
   ```
   GOOGLE_SERVICE_ACCOUNT_KEY=-----BEGIN PRIVATE KEY-----
   MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7...
   ...
   -----END PRIVATE KEY-----
   ```

### For Local Development:

Create a `.env` file:
```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL=creator-analytics-automation@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQI...\n-----END PRIVATE KEY-----\n"
```

**Important:** The private key must have `\n` for newlines when stored as a single-line string.

## Step 6: Create a Google Sheet

1. Go to [Google Sheets](https://sheets.google.com/)
2. Create a new spreadsheet
3. Name it something like "Creator Analytics Dashboard"
4. Copy the **Spreadsheet ID** from the URL:
   ```
   https://docs.google.com/spreadsheets/d/1abc123def456ghi789jkl/edit
                                        ^^^^^^^^^^^^^^^^^^^^^^^^
                                        This is your Spreadsheet ID
   ```

## Step 7: Share Sheet with Service Account

**CRITICAL STEP:** You must share the Google Sheet with your service account email, or the API won't be able to write to it!

1. In your Google Sheet, click **"Share"**
2. Paste your service account email:
   ```
   creator-analytics-automation@your-project.iam.gserviceaccount.com
   ```
3. Set permission to **"Editor"**
4. **Uncheck** "Notify people" (it's a service account, not a real person)
5. Click **"Share"**

## Step 8: Test the Integration

Use the API to test:

```bash
# First, connect your Mavely account
curl -X POST https://your-middleware.railway.app/api/mavely/connect \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "email": "your-mavely-email@example.com",
    "password": "your-mavely-password"
  }'

# Then extract data to Google Sheets
curl -X POST https://your-middleware.railway.app/api/mavely/extract/user-123 \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-01-01",
    "endDate": "2026-01-29",
    "exportToSheets": true,
    "spreadsheetId": "1abc123def456ghi789jkl",
    "sheetName": "Mavely Analytics"
  }'
```

If everything is set up correctly, you should see new data in your Google Sheet!

## Step 9: Enable Scheduled Extraction (Optional)

To automatically extract data daily:

```bash
curl -X POST https://your-middleware.railway.app/api/scheduled/mavely/enable/user-123 \
  -H "Content-Type: application/json" \
  -d '{
    "spreadsheetId": "1abc123def456ghi789jkl",
    "sheetName": "Mavely Analytics",
    "schedule": "0 2 * * *"
  }'
```

Now your Mavely analytics will be automatically extracted and appended to Google Sheets every day at 2 AM UTC!

## Troubleshooting

### "Google service account credentials not configured"
- Make sure `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_KEY` are set in environment variables
- Check that the private key includes the `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` markers
- Make sure newlines are escaped as `\n` in the environment variable

### "The caller does not have permission"
- You forgot to share the Google Sheet with the service account email
- Go back to Step 7 and share it with the service account

### "Requested entity was not found"
- Check that the Spreadsheet ID is correct
- The spreadsheet ID is the long string in the URL, not the name of the sheet

### Data not appearing in sheet
- Check the server logs for errors
- Verify the sheet name matches exactly (case-sensitive)
- Make sure the Mavely connection is active: `GET /api/mavely/status/user-123`

## Security Best Practices

1. **Never commit the service account JSON file to git**
   - Add it to `.gitignore`
   - Store keys only in environment variables

2. **Use minimal permissions**
   - The service account only needs access to the specific spreadsheets you're using
   - Don't give it broader permissions than necessary

3. **Rotate keys periodically**
   - Delete old keys from Google Cloud Console
   - Create new keys and update environment variables

4. **Monitor usage**
   - Check Google Cloud Console for API usage
   - Set up alerts for unusual activity

## Next Steps

Once you have Google Sheets working:
1. Create additional sheets for different platforms (Amazon, ShopMY)
2. Set up scheduled extraction for consistent data collection
3. Build dashboards or reports using the collected data
4. Consider adding data validation or transformation logic
