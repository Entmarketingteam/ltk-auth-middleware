# Multi-Platform Creator Analytics Middleware

A Plaid-style authentication middleware that allows creators to securely connect their accounts from multiple platforms without browser extensions. Now supports automated data extraction and Google Sheets integration.

## Supported Platforms

- ✅ **LTK (RewardStyle)** - Full support
- ✅ **Mavely** - NEW! Full support with scheduled extraction
- 🚧 **Amazon Creator** - Coming soon
- 🚧 **ShopMY** - Coming soon

## Key Features

### 🔐 Secure Authentication
- Plaid-style credential flow (passwords never stored)
- AES-256-GCM encrypted token storage
- Automated headless browser login
- HTTPS-only transmission

### 📊 Automated Data Extraction
- **NEW:** Daily scheduled extraction to Google Sheets
- Manual on-demand data extraction
- CSV export support (where available)
- Customizable date ranges

### 📅 Scheduled Jobs
- Configurable cron schedules (default: daily at 2 AM UTC)
- Automatic append to Google Sheets
- Per-user, per-platform configuration
- Background processing

## Quick Start

See [MAVELY-INTEGRATION.md](./MAVELY-INTEGRATION.md) for detailed Mavely setup and usage.

## How It Works

```
Creator clicks "Connect LTK"
        ↓
Modal with email/password form (your app)
        ↓
Credentials sent to YOUR server over HTTPS
        ↓
Puppeteer opens headless Chrome
        ↓
Logs into creator.shopltk.com
        ↓
Extracts auth cookies (access_token, id_token)
        ↓
Encrypts & stores tokens in Supabase
        ↓
Credentials discarded (NEVER stored)
        ↓
Creator sees "Connected ✓"
```

## Security Model

- **Credentials are NEVER stored** — only used once for login, then discarded
- **Tokens encrypted with AES-256-GCM** before database storage
- **HTTPS only** — all credential transmission encrypted in transit
- **Token auto-refresh** — background job keeps tokens fresh
- **Creator consent required** — explicit opt-in for each connection

## Deployment

### Railway (Recommended)

1. Fork this repo to your GitHub
2. Go to [railway.app](https://railway.app)
3. New Project → Deploy from GitHub repo
4. Add environment variables (see below)
5. Deploy!

### Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...  # Service role key, not anon key!

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key  # Generate with: openssl rand -hex 32

# Google Sheets (for automated data extraction)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n

# App
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-app.vercel.app  # For CORS
```

### Generate Encryption Key

```bash
openssl rand -hex 32
# Output: a1b2c3d4e5f6...  (64 hex chars = 32 bytes)
```

## API Endpoints

### POST /api/ltk/connect
Connect a creator's LTK account

```json
{
  "userId": "supabase-user-id",
  "email": "creator@example.com",
  "password": "their-ltk-password"
}
```

### GET /api/ltk/status/:userId
Check connection status

### POST /api/ltk/refresh/:userId
Manually trigger token refresh

### DELETE /api/ltk/disconnect/:userId
Remove LTK connection

### GET /api/ltk/proxy/*
Proxy requests to LTK API (uses stored tokens)

## Database Schema

Add this migration to your Supabase:

```sql
-- Run this in Supabase SQL Editor
ALTER TABLE platform_connections 
ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT,
ADD COLUMN IF NOT EXISTS encrypted_id_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refresh_error TEXT,
ADD COLUMN IF NOT EXISTS encryption_iv TEXT;
```

## Local Development

```bash
npm install
npm run dev
```

## Architecture

```
src/
├── index.ts              # Express server entry
├── routes/
│   ├── ltkAuth.ts       # Connect/disconnect endpoints
│   └── ltkProxy.ts      # API proxy (from your existing code)
├── services/
│   ├── puppeteerLogin.ts # Headless browser login
│   ├── tokenStorage.ts   # Encrypted Supabase storage
│   └── tokenRefresh.ts   # Auto-refresh background job
└── utils/
    └── encryption.ts     # AES-256-GCM helpers
```

## Credits

Built for [ENT Agency](https://github.com/Entmarketingteam) by Emily.
