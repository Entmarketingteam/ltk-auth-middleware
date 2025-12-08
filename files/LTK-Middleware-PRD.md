# LTK Auth Middleware — Technical Requirements Document

**Project:** Plaid-Style Authentication Middleware for LTK  
**Owner:** Emily / ENT Agency  
**Date:** December 7, 2025  
**Status:** Implementation Ready  

---

## Executive Summary

Build a middleware service that allows creators to connect their LTK (RewardStyle) accounts to CreatorMetrics by entering credentials once. The middleware automates login via headless browser, extracts authentication tokens, encrypts and stores them, then uses them for ongoing API access. Credentials are never stored — only encrypted tokens.

---

## Table of Contents

1. [Background & Discovery](#1-background--discovery)
2. [Architecture Overview](#2-architecture-overview)
3. [What Already Exists](#3-what-already-exists)
4. [What Was Built (Ready to Deploy)](#4-what-was-built-ready-to-deploy)
5. [Deployment Instructions](#5-deployment-instructions)
6. [Frontend Integration](#6-frontend-integration)
7. [LTK Technical Details (Critical)](#7-ltk-technical-details-critical)
8. [Security Considerations](#8-security-considerations)
9. [Future Enhancements](#9-future-enhancements)
10. [Troubleshooting Guide](#10-troubleshooting-guide)

---

## 1. Background & Discovery

### The Problem

LTK has NO public API or OAuth flow. Creators must:
1. Log into `creator.shopltk.com` manually
2. Open browser DevTools
3. Copy authentication cookies
4. Paste into your app

This is unacceptable for a production app with 10-14 creators.

### The Discovery

Through reverse-engineering, we found:

1. **LTK uses Auth0** for authentication
2. **Two tokens are required** for API calls (not one!)
3. **Tokens are stored in cookies**, not localStorage
4. **20+ undocumented API endpoints** were mapped
5. **No refresh token endpoint exists** publicly

### Cookie Names (Critical)

```
auth._token.auth0      → Access Token (Bearer token, ~1 hour expiry)
auth._id_token.auth0   → ID Token (user identity, ~28 hours expiry)
```

### API Authentication Pattern

```http
GET https://api-gateway.rewardstyle.com/api/creator-analytics/v1/contributors
Authorization: Bearer {access_token}
x-id-token: {id_token}
Origin: https://creator.shopltk.com
Referer: https://creator.shopltk.com/
```

**Both headers are required.** Missing either causes 401/403 errors.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE SYSTEM                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐         ┌──────────────────────────────────────┐  │
│  │   FRONTEND       │         │   LTK AUTH MIDDLEWARE (Railway)      │  │
│  │   (Vercel)       │         │                                      │  │
│  │                  │         │  ┌────────────────────────────────┐  │  │
│  │  CreatorMetrics  │  HTTPS  │  │  POST /api/ltk/connect         │  │  │
│  │  React + Vite    │ ──────► │  │                                │  │  │
│  │                  │         │  │  1. Receive credentials        │  │  │
│  │  ┌────────────┐  │         │  │  2. Launch Puppeteer           │  │  │
│  │  │ Connect    │  │         │  │  3. Navigate to LTK login      │  │  │
│  │  │ LTK Modal  │  │         │  │  4. Enter email/password       │  │  │
│  │  └────────────┘  │         │  │  5. Wait for redirect          │  │  │
│  │                  │         │  │  6. Extract auth cookies       │  │  │
│  └──────────────────┘         │  │  7. Encrypt tokens (AES-256)   │  │  │
│                               │  │  8. Store in Supabase          │  │  │
│                               │  │  9. DISCARD credentials        │  │  │
│                               │  │  10. Return success            │  │  │
│                               │  └────────────────────────────────┘  │  │
│                               │                                      │  │
│                               │  ┌────────────────────────────────┐  │  │
│                               │  │  GET /api/ltk/* (Proxy)        │  │  │
│                               │  │                                │  │  │
│  ┌──────────────────┐         │  │  1. Get userId from request    │  │  │
│  │   SUPABASE       │ ◄────── │  │  2. Fetch encrypted tokens     │  │  │
│  │                  │         │  │  3. Decrypt tokens             │  │  │
│  │  platform_       │         │  │  4. Call LTK API               │  │  │
│  │  connections     │         │  │  5. Return data                │  │  │
│  │  (encrypted)     │         │  └────────────────────────────────┘  │  │
│  └──────────────────┘         │                                      │  │
│                               │  ┌────────────────────────────────┐  │  │
│                               │  │  Background Job (cron)         │  │  │
│  ┌──────────────────┐         │  │                                │  │  │
│  │   LTK API        │ ◄────── │  │  Every 5 min: Check expiring   │  │  │
│  │   (RewardStyle)  │         │  │  tokens, validate, mark errors │  │  │
│  └──────────────────┘         │  └────────────────────────────────┘  │  │
│                               └──────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. What Already Exists

### In CreatorMetrics Repo (GitHub)

**Repository:** `https://github.com/Entmarketingteam/CreatorMetrics`

| File | Purpose | Status |
|------|---------|--------|
| `server/routes/ltkProxy.ts` | 20+ LTK API endpoints mapped | ✅ Complete |
| `src/lib/ltkAuth.ts` | JWT decoder, token management | ✅ Complete |
| `src/lib/ltkApiClient.ts` | Frontend API client | ✅ Complete |
| `src/contexts/LTKAuthContext.tsx` | React auth state | ✅ Complete |
| `src/pages/JWTDecoder.tsx` | Manual token input UI | ✅ Complete |
| `src/lib/contentMatcher.ts` | IG→LTK attribution | ✅ Complete |
| `supabase/migrations/*.sql` | Database schema | ✅ Complete |

### Supabase Tables

```sql
-- Existing table (needs columns added)
platform_connections:
  - id (uuid)
  - user_id (uuid, FK to profiles)
  - platform ('LTK' | 'AMAZON' | 'WALMART' | 'SHOPSTYLE')
  - status ('CONNECTED' | 'DISCONNECTED' | 'ERROR')
  - connected_at (timestamp)
  - last_synced_at (timestamp)
  - metadata (jsonb)
  - created_at (timestamp)
  - updated_at (timestamp)
```

### LTK API Endpoints (Reverse-Engineered)

**Base URL:** `https://api-gateway.rewardstyle.com`

| Category | Endpoint | Description |
|----------|----------|-------------|
| Analytics | `/api/creator-analytics/v1/contributors` | Get contributor list |
| Analytics | `/api/creator-analytics/v1/hero_chart` | Dashboard chart data |
| Analytics | `/api/creator-analytics/v1/performance_summary` | Performance overview |
| Analytics | `/api/creator-analytics/v1/performance_stats` | Detailed stats |
| Analytics | `/api/creator-analytics/v1/top_performers` | Top performing content |
| Analytics | `/api/creator-analytics/v1/items_sold` | Items sold list |
| Analytics | `/api/creator-analytics/v1/commissions_summary` | Commission totals |
| User | `/api/creator-account-service/v1/users/:publisherId` | User details |
| Account | `/publishers/v1/accounts/:accountId` | Account info |
| Account | `/api/creator-account-service/v1/accounts/:accountId/users` | Account users |
| User | `/api/co-api/v1/get_user_info` | Current user info |
| Profile | `/api/pub/v2/profiles/?rs_account_id=:accountId` | Public profile |
| Integration | `/integrations/v1/amazon/identities` | Amazon Associates link |
| Trends | `/api/ltk/v2/ltk_search_trends/` | Search trends |
| Top | `/analytics/top_performers/advertisers` | Top advertisers |
| Top | `/analytics/top_performers/links` | Top links |
| Top | `/analytics/top_performers/ltks` | Top LTKs |
| Content | `/api/pub/v1/favorites/` | Saved favorites |
| Content | `/api/pub/v1/folders/` | Folders |
| Products | `/api/co-api/v1/get_products_info` | Product info |
| Reviews | `/api/pub/v1/product_reviews/` | Product reviews |

---

## 4. What Was Built (Ready to Deploy)

A complete middleware project was created and is available as a zip file.

### Project Structure

```
ltk-auth-middleware/
├── src/
│   ├── index.ts                    # Express server entry point
│   ├── routes/
│   │   ├── ltkAuth.ts              # POST /connect, GET /status, DELETE /disconnect
│   │   └── ltkProxy.ts             # GET /api/ltk/* proxy endpoints
│   ├── services/
│   │   ├── puppeteerLogin.ts       # Headless browser login automation
│   │   ├── tokenStorage.ts         # Encrypted Supabase CRUD
│   │   └── tokenRefresh.ts         # Background token validation job
│   └── utils/
│       └── encryption.ts           # AES-256-GCM encrypt/decrypt
├── examples/
│   └── LTKConnectModal.tsx         # React component for frontend
├── supabase/
│   └── migrations/
│       └── add_encrypted_tokens.sql
├── package.json
├── tsconfig.json
├── railway.toml
├── .env.example
└── .gitignore
```

### Key Files Explained

#### `src/services/puppeteerLogin.ts`
- Launches headless Chrome via Puppeteer
- Navigates to `creator.shopltk.com`
- Finds and fills Auth0 login form
- Waits for successful redirect
- Extracts `auth._token.auth0` and `auth._id_token.auth0` cookies
- Returns tokens or error

#### `src/utils/encryption.ts`
- AES-256-GCM encryption (military-grade)
- Unique IV per encryption
- Stores as `iv.authTag.ciphertext` string

#### `src/services/tokenStorage.ts`
- `storeTokens(userId, tokens)` — encrypt and save
- `getTokens(userId)` — decrypt and return
- `getConnectionStatus(userId)` — check if connected
- `disconnectLTK(userId)` — remove tokens
- `getConnectionsNeedingRefresh()` — find expiring tokens

#### `src/services/tokenRefresh.ts`
- Runs every 5 minutes via node-cron
- Checks for tokens expiring within 10 minutes
- Validates by making test API call
- Marks as ERROR if invalid (user must reconnect)

---

## 5. Deployment Instructions

### Step 1: Run Supabase Migration

```sql
-- Run in Supabase SQL Editor
ALTER TABLE platform_connections 
ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT,
ADD COLUMN IF NOT EXISTS encrypted_id_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refresh_error TEXT;

CREATE INDEX IF NOT EXISTS idx_platform_connections_ltk_refresh 
ON platform_connections (platform, status, token_expires_at)
WHERE platform = 'LTK' AND status = 'CONNECTED';
```

### Step 2: Generate Encryption Key

```bash
openssl rand -hex 32
# Output: 64 hex characters (32 bytes)
# Example: a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

**Save this key securely.** You cannot recover encrypted tokens without it.

### Step 3: Create GitHub Repository

```bash
# Clone or create new repo
git clone https://github.com/Entmarketingteam/ltk-auth-middleware.git
# OR
mkdir ltk-auth-middleware && cd ltk-auth-middleware
git init

# Add files from the zip
# Commit and push
git add .
git commit -m "Initial LTK auth middleware"
git push -u origin main
```

### Step 4: Deploy to Railway

1. Go to [railway.app](https://railway.app)
2. Click **New Project**
3. Select **Deploy from GitHub repo**
4. Choose `ltk-auth-middleware`
5. Wait for initial deploy (will fail without env vars)

### Step 5: Configure Environment Variables

In Railway dashboard → Your project → **Variables**:

| Variable | Value | Notes |
|----------|-------|-------|
| `SUPABASE_URL` | `https://xxx.supabase.co` | From Supabase dashboard |
| `SUPABASE_SERVICE_KEY` | `eyJ...` | Service role key (not anon!) |
| `ENCRYPTION_KEY` | `a1b2c3d4...` | 64 hex chars from Step 2 |
| `FRONTEND_URL` | `https://creatormetrics.vercel.app` | Your frontend URL |
| `NODE_ENV` | `production` | Required |
| `PORT` | `3000` | Optional (Railway sets automatically) |

### Step 6: Get Your Railway URL

After successful deploy, Railway provides a URL:
```
https://ltk-auth-middleware-production-xxxx.up.railway.app
```

### Step 7: Test the Deployment

```bash
# Health check
curl https://your-railway-url.up.railway.app/health

# Expected response:
# {"status":"healthy","timestamp":"...","version":"1.0.0"}
```

---

## 6. Frontend Integration

### Option A: Use the Provided Modal Component

Copy `examples/LTKConnectModal.tsx` to your CreatorMetrics frontend.

Add environment variable:
```bash
# .env
VITE_LTK_MIDDLEWARE_URL=https://your-railway-url.up.railway.app
```

Usage:
```tsx
import { LTKConnectModal } from './components/LTKConnectModal';
import { useAuth } from './contexts/AuthContext';

function PlatformsPage() {
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Connect LTK
      </button>
      
      <LTKConnectModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => {
          // Refresh data, show success message, etc.
        }}
        userId={user.id}
      />
    </>
  );
}
```

### Option B: Direct API Integration

```typescript
// Connect LTK account
const response = await fetch(`${MIDDLEWARE_URL}/api/ltk/connect`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'supabase-user-id',
    email: 'creator@example.com',
    password: 'their-ltk-password',
  }),
});

// Check status
const status = await fetch(`${MIDDLEWARE_URL}/api/ltk/status/${userId}`);

// Use LTK API (proxy)
const analytics = await fetch(
  `${MIDDLEWARE_URL}/api/ltk/analytics/performance-summary?start_date=2024-01-01`,
  { headers: { 'x-user-id': userId } }
);

// Disconnect
await fetch(`${MIDDLEWARE_URL}/api/ltk/disconnect/${userId}`, {
  method: 'DELETE',
});
```

### Update Existing ltkApiClient.ts

Replace direct LTK calls with middleware proxy:

```typescript
// Before (direct to LTK, requires manual token paste)
const PROXY_BASE = `${BACKEND_URL}/api/ltk`;

// After (uses middleware with stored tokens)
const MIDDLEWARE_URL = import.meta.env.VITE_LTK_MIDDLEWARE_URL;
const PROXY_BASE = `${MIDDLEWARE_URL}/api/ltk`;

// Remove token headers - middleware handles auth
// Just pass userId header
headers: {
  'Content-Type': 'application/json',
  'x-user-id': userId,  // Middleware looks up tokens by userId
}
```

---

## 7. LTK Technical Details (Critical)

### Authentication Flow

```
User visits creator.shopltk.com
        ↓
Redirected to Auth0 login
        ↓
Enters email + password
        ↓
Auth0 issues JWT tokens
        ↓
LTK stores in cookies:
  - auth._token.auth0 (access token)
  - auth._id_token.auth0 (id token)
        ↓
All API calls require BOTH tokens
```

### Token Structure

**Access Token (auth._token.auth0):**
- Format: `Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ii...`
- Expiry: ~1 hour
- Used in: `Authorization` header

**ID Token (auth._id_token.auth0):**
- Format: `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Ii...`
- Expiry: ~28 hours
- Used in: `x-id-token` header
- Contains: User ID, email, account info

### API Request Pattern

```typescript
const response = await fetch('https://api-gateway.rewardstyle.com/api/...', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,  // REQUIRED
    'x-id-token': idToken,                     // REQUIRED
    'Origin': 'https://creator.shopltk.com',   // REQUIRED
    'Referer': 'https://creator.shopltk.com/', // REQUIRED
    'Content-Type': 'application/json',
  },
});
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Missing Authorization header | Add `Bearer {access_token}` |
| 403 Key not authorised | Missing x-id-token | Add ID token header |
| 401 Token expired | Access token >1 hour old | Get fresh tokens |
| CORS error | Wrong Origin header | Set to `creator.shopltk.com` |

### Token Refresh Reality

**There is NO public refresh endpoint.** When tokens expire:
1. Validate by making test API call
2. If valid, extend internal expiry estimate
3. If invalid, mark connection as ERROR
4. User must re-authenticate (re-enter credentials)

Alternative (not implemented): Store encrypted credentials and re-login automatically. Security trade-off.

---

## 8. Security Considerations

### What's Protected

| Data | Protection | Notes |
|------|------------|-------|
| Credentials in transit | HTTPS/TLS | Never sent over HTTP |
| Credentials at rest | **NOT STORED** | Used once, discarded |
| Access tokens | AES-256-GCM | Encrypted in database |
| ID tokens | AES-256-GCM | Encrypted in database |
| Encryption key | Environment variable | Never in code/git |

### Encryption Details

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key size:** 256 bits (32 bytes)
- **IV:** Random 128 bits per encryption
- **Auth tag:** 128 bits (tamper detection)
- **Storage format:** `{iv}.{authTag}.{ciphertext}` (all base64)

### CORS Configuration

```typescript
cors({
  origin: process.env.FRONTEND_URL,  // Only your frontend
  methods: ['GET', 'POST', 'DELETE'],
  credentials: true,
})
```

### Railway Security

- HTTPS enforced automatically
- No public access to env vars
- Logs don't contain secrets (if coded correctly)

---

## 9. Future Enhancements

### Priority 1: Amazon Associates Integration

Same pattern as LTK:
1. Puppeteer login to `affiliate-program.amazon.com`
2. Extract session cookies
3. Proxy API calls

### Priority 2: Multi-Creator Dashboard

- Admin view showing all connected creators
- Aggregate analytics across creators
- Bulk operations

### Priority 3: Webhook Notifications

When token expires:
- Send email to creator
- Slack notification to admin
- In-app notification

### Priority 4: Credential Re-auth (Optional)

Trade-off: Store encrypted credentials to enable automatic re-login when tokens expire. More convenient, but higher security risk.

---

## 10. Troubleshooting Guide

### Puppeteer Fails to Find Login Form

**Symptoms:** `Could not find email input field`

**Causes:**
1. LTK changed their login page HTML
2. Auth0 uses different form structure

**Solutions:**
1. Check `/tmp/ltk-login-debug.png` screenshot
2. Update selectors in `puppeteerLogin.ts`
3. Test with `headless: false` to see browser

### Tokens Not Found in Cookies

**Symptoms:** `Login succeeded but tokens not found`

**Causes:**
1. Cookie names changed
2. Login redirected to unexpected URL

**Solutions:**
1. Log all cookies: `console.log(cookies.map(c => c.name))`
2. Check for alternative cookie names
3. Verify final URL is `creator.shopltk.com`

### CORS Errors

**Symptoms:** `Access-Control-Allow-Origin` errors

**Solutions:**
1. Verify `FRONTEND_URL` env var is correct
2. Include protocol: `https://` not just domain
3. No trailing slash

### Decryption Fails

**Symptoms:** `Invalid encrypted token format`

**Causes:**
1. `ENCRYPTION_KEY` changed
2. Corrupted data in database

**Solutions:**
1. Verify same key is used everywhere
2. Re-connect affected accounts

### Railway Deploy Fails

**Symptoms:** Build or start errors

**Solutions:**
1. Check Railway logs
2. Verify all env vars are set
3. Ensure `package.json` has correct scripts
4. Check Node version (needs 18+)

---

## Appendix A: Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | ✅ | Service role key (bypasses RLS) |
| `ENCRYPTION_KEY` | ✅ | 64 hex chars for AES-256 |
| `FRONTEND_URL` | ✅ | CORS allowed origin |
| `NODE_ENV` | ✅ | `production` or `development` |
| `PORT` | ❌ | Server port (default: 3000) |

---

## Appendix B: API Reference

### POST /api/ltk/connect

Connect a creator's LTK account.

**Request:**
```json
{
  "userId": "uuid",
  "email": "creator@example.com",
  "password": "their-password"
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "LTK account connected successfully",
  "expiresAt": "2025-12-07T15:30:00.000Z"
}
```

**Response (error):**
```json
{
  "success": false,
  "error": "Invalid credentials",
  "errorCode": "INVALID_CREDENTIALS"
}
```

### GET /api/ltk/status/:userId

Check connection status.

**Response:**
```json
{
  "success": true,
  "connected": true,
  "status": "CONNECTED",
  "expiresAt": "2025-12-07T15:30:00.000Z",
  "lastRefresh": "2025-12-07T14:30:00.000Z"
}
```

### DELETE /api/ltk/disconnect/:userId

Remove LTK connection.

**Response:**
```json
{
  "success": true,
  "message": "LTK account disconnected"
}
```

### GET /api/ltk/analytics/*

Proxy requests to LTK API. Requires `x-user-id` header.

---

## Appendix C: Database Schema

```sql
-- Full platform_connections table after migration
CREATE TABLE platform_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('LTK', 'AMAZON', 'WALMART', 'SHOPSTYLE')),
  status TEXT NOT NULL DEFAULT 'DISCONNECTED' CHECK (status IN ('CONNECTED', 'DISCONNECTED', 'ERROR')),
  connected_at TIMESTAMPTZ,
  last_synced_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  
  -- New columns for encrypted tokens
  encrypted_access_token TEXT,
  encrypted_id_token TEXT,
  token_expires_at TIMESTAMPTZ,
  last_refresh_at TIMESTAMPTZ,
  refresh_error TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, platform)
);
```

---

## Appendix D: Files to Download

1. **ltk-auth-middleware.zip** — Complete middleware project
2. **LTKConnectModal.tsx** — React component for frontend
3. **add_encrypted_tokens.sql** — Supabase migration

---

## Document History

| Date | Author | Changes |
|------|--------|---------|
| 2025-12-07 | Claude | Initial PRD created |

---

*End of Document*
