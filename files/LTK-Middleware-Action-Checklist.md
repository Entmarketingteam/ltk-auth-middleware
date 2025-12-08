# LTK Middleware — Action Checklist

## What You Have
- ✅ Complete middleware code (in zip file from previous session)
- ✅ 20+ LTK API endpoints reverse-engineered
- ✅ CreatorMetrics frontend with manual token input working
- ✅ Supabase database with platform_connections table

## What You Need to Do (6 Steps)

### Step 1: Run Supabase Migration (2 min)
Go to Supabase → SQL Editor → Run this:

```sql
ALTER TABLE platform_connections 
ADD COLUMN IF NOT EXISTS encrypted_access_token TEXT,
ADD COLUMN IF NOT EXISTS encrypted_id_token TEXT,
ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refresh_error TEXT;
```

### Step 2: Generate Encryption Key (1 min)
Run in terminal:
```bash
openssl rand -hex 32
```
Save the 64-character output — you'll need it for Railway.

### Step 3: Create GitHub Repo (5 min)
```bash
# Unzip the middleware code I gave you
# Then:
cd ltk-auth-middleware
git init
git add .
git commit -m "LTK auth middleware"
gh repo create Entmarketingteam/ltk-auth-middleware --public --push
```

### Step 4: Deploy to Railway (10 min)
1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select `ltk-auth-middleware`
4. Add these environment variables:

| Variable | Value |
|----------|-------|
| `SUPABASE_URL` | Your Supabase URL |
| `SUPABASE_SERVICE_KEY` | Service role key (Settings → API) |
| `ENCRYPTION_KEY` | The 64-char key from Step 2 |
| `FRONTEND_URL` | `https://your-frontend.vercel.app` |
| `NODE_ENV` | `production` |

5. Copy your Railway URL (like `https://ltk-auth-xxx.up.railway.app`)

### Step 5: Update Frontend (5 min)
Add to CreatorMetrics `.env`:
```
VITE_LTK_MIDDLEWARE_URL=https://your-railway-url.up.railway.app
```

Copy `LTKConnectModal.tsx` from the middleware examples folder into your frontend.

### Step 6: Test (5 min)
```bash
# Test health endpoint
curl https://your-railway-url.up.railway.app/health

# Test connect (use real LTK credentials)
curl -X POST https://your-railway-url.up.railway.app/api/ltk/connect \
  -H "Content-Type: application/json" \
  -d '{"userId":"test-user-id","email":"your@email.com","password":"your-password"}'
```

---

## Critical Technical Details

### LTK Authentication (Must Know)
- LTK uses **Auth0** for login
- **Two tokens required** for every API call:
  - `auth._token.auth0` → goes in `Authorization: Bearer` header
  - `auth._id_token.auth0` → goes in `x-id-token` header
- Tokens expire in ~1 hour
- **No refresh endpoint exists** — users must reconnect when expired

### API Call Pattern
```
Authorization: Bearer {access_token}
x-id-token: {id_token}
Origin: https://creator.shopltk.com
```

### Security Model
- Credentials: Used once by Puppeteer, then **immediately discarded**
- Tokens: Encrypted with AES-256-GCM before storing in Supabase
- Transport: HTTPS only

---

## Options/Alternatives

### Deployment Platform Options
| Platform | Pros | Cons |
|----------|------|------|
| **Railway** (recommended) | Easy, Puppeteer works, $5 free | Paid after free tier |
| Render | 750 hrs/mo free | Slower cold starts |
| Fly.io | Good free tier | More complex setup |
| ~~Vercel~~ | N/A | **Cannot run Puppeteer** |

### If Puppeteer Gets Blocked by LTK
Options:
1. Add random delays between actions
2. Use residential proxies
3. Rotate user agents
4. Fall back to manual token input (current system)

### Token Refresh Options
Since LTK has no refresh endpoint:
1. **Current approach**: Validate tokens, mark ERROR when expired, user reconnects
2. **Alternative**: Store encrypted credentials, auto re-login (higher security risk)

---

## File Locations

| What | Where |
|------|-------|
| Complete middleware code | `ltk-auth-middleware.zip` (from previous session) |
| PRD document | This file + detailed version |
| Frontend component | `examples/LTKConnectModal.tsx` in the zip |
| Migration SQL | `supabase/migrations/add_encrypted_tokens.sql` in the zip |

---

## Quick Reference: Middleware Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/api/ltk/connect` | POST | Connect LTK (email, password, userId) |
| `/api/ltk/status/:userId` | GET | Check connection status |
| `/api/ltk/disconnect/:userId` | DELETE | Remove connection |
| `/api/ltk/analytics/*` | GET | Proxy to LTK API |

---

## Troubleshooting Quick Fixes

| Problem | Fix |
|---------|-----|
| "Could not find email input" | LTK changed login page, update selectors |
| "Tokens not found in cookies" | Check cookie names haven't changed |
| CORS errors | Verify FRONTEND_URL env var matches exactly |
| 401/403 from LTK API | Both tokens required, check headers |

---

## Total Time Estimate: ~30 minutes

If you get stuck, the detailed PRD has full explanations of every component.
