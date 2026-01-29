# Deployment Checklist

Use this checklist when deploying the multi-platform creator analytics automation middleware.

## Prerequisites

- [ ] Supabase project created
- [ ] Railway account (or other hosting platform)
- [ ] Google Cloud project with Sheets API enabled (for automated extraction)
- [ ] Google Service Account created with JSON key

## Database Setup

- [ ] Run migration in Supabase SQL Editor:
  ```sql
  -- From: supabase/migrations/add_multi_platform_support.sql
  ```
- [ ] Verify `platform_connections` table exists
- [ ] Verify indexes are created
- [ ] Test Supabase connection with service key

## Environment Variables

### Required for Basic Operation

- [ ] `SUPABASE_URL` - Your Supabase project URL
- [ ] `SUPABASE_SERVICE_KEY` - Service role key (not anon key!)
- [ ] `ENCRYPTION_KEY` - Generate with: `openssl rand -hex 32`
- [ ] `NODE_ENV` - Set to `production`
- [ ] `FRONTEND_URL` - Your frontend URL for CORS

### Required for Google Sheets Integration

- [ ] `GOOGLE_SERVICE_ACCOUNT_EMAIL` - From service account JSON
- [ ] `GOOGLE_SERVICE_ACCOUNT_KEY` - Private key from service account JSON

### Optional

- [ ] `PORT` - Custom port (default: 3000)

## Railway Deployment

- [ ] Fork repository to your GitHub account
- [ ] Create new Railway project
- [ ] Connect to GitHub repository
- [ ] Add all environment variables
- [ ] Deploy and verify deployment succeeds
- [ ] Copy Railway URL (e.g., `https://xxx.up.railway.app`)
- [ ] Test health endpoint: `curl https://xxx.up.railway.app/health`

## Google Sheets Setup (if using automated extraction)

- [ ] Create Google Sheet for analytics data
- [ ] Copy Spreadsheet ID from URL
- [ ] Share sheet with service account email (Editor permission)
- [ ] Test write access with a manual extraction

## Testing

### Test LTK Integration (Existing)

- [ ] Connect LTK account: `POST /api/ltk/connect`
- [ ] Check status: `GET /api/ltk/status/:userId`
- [ ] Test proxy: `GET /api/ltk/earnings/:userId`

### Test Mavely Integration (New)

- [ ] Connect Mavely account: `POST /api/mavely/connect`
  ```bash
  curl -X POST https://your-url/api/mavely/connect \
    -H "Content-Type: application/json" \
    -d '{"userId":"test-user","email":"your@email.com","password":"password"}'
  ```
  
- [ ] Check connection status: `GET /api/mavely/status/:userId`
  ```bash
  curl https://your-url/api/mavely/status/test-user
  ```

- [ ] Extract data manually: `POST /api/mavely/extract/:userId`
  ```bash
  curl -X POST https://your-url/api/mavely/extract/test-user \
    -H "Content-Type: application/json" \
    -d '{"startDate":"2026-01-01","endDate":"2026-01-29"}'
  ```

- [ ] Export to Google Sheets: `POST /api/mavely/extract/:userId`
  ```bash
  curl -X POST https://your-url/api/mavely/extract/test-user \
    -H "Content-Type: application/json" \
    -d '{
      "startDate":"2026-01-01",
      "endDate":"2026-01-29",
      "exportToSheets":true,
      "spreadsheetId":"your-sheet-id",
      "sheetName":"Mavely Analytics"
    }'
  ```

- [ ] Verify data appears in Google Sheet

### Test Scheduled Extraction

- [ ] Enable scheduled extraction: `POST /api/scheduled/mavely/enable/:userId`
  ```bash
  curl -X POST https://your-url/api/scheduled/mavely/enable/test-user \
    -H "Content-Type: application/json" \
    -d '{
      "spreadsheetId":"your-sheet-id",
      "sheetName":"Mavely Analytics",
      "schedule":"0 2 * * *"
    }'
  ```

- [ ] Check platform_connections metadata for scheduled_job config
- [ ] Wait for scheduled run or manually trigger for testing
- [ ] Verify daily extraction is working (check logs)

## Frontend Integration

- [ ] Add `VITE_LTK_MIDDLEWARE_URL` to frontend `.env`
- [ ] Update API client to use new middleware URL
- [ ] Test connection flow from frontend
- [ ] Test data extraction from frontend
- [ ] Test scheduled job management from frontend

## Monitoring

- [ ] Set up Railway logging/monitoring
- [ ] Monitor cron job execution
- [ ] Set up alerts for failed extractions
- [ ] Monitor Google Sheets API quota usage
- [ ] Monitor Supabase database usage

## Security Review

- [ ] Verify ENCRYPTION_KEY is secure and backed up
- [ ] Verify Google Service Account key is not in git
- [ ] Verify CORS is configured correctly
- [ ] Verify frontend URL whitelist
- [ ] Review Supabase RLS policies
- [ ] Ensure no credentials in logs

## Documentation

- [ ] Update team documentation with new endpoints
- [ ] Document Google Sheets setup process
- [ ] Document scheduled extraction configuration
- [ ] Create runbook for common issues
- [ ] Document troubleshooting steps

## Post-Deployment

- [ ] Update DNS/URLs if needed
- [ ] Notify team of new features
- [ ] Schedule training/demo session
- [ ] Create monitoring dashboard
- [ ] Plan for future platform integrations (Amazon, ShopMY)

## Rollback Plan

If something goes wrong:

- [ ] Revert to previous Railway deployment
- [ ] Disable scheduled jobs in database
- [ ] Restore previous environment variables
- [ ] Check Supabase for any corrupted data
- [ ] Notify users of downtime

## Success Criteria

- ✅ All health checks pass
- ✅ Mavely login successful
- ✅ Data extraction working
- ✅ Google Sheets integration working
- ✅ Scheduled jobs running
- ✅ No errors in logs
- ✅ Frontend integration working
- ✅ Users can connect/disconnect accounts
- ✅ Daily data being collected automatically

---

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Railway URL:** _______________  
**Issues Encountered:** _______________
