# Getting Started with Your New Multi-Platform Analytics System

This guide explains how to handle the additions and work with the codebase in Cursor (or any IDE).

## 📋 Table of Contents

1. [Understanding What Was Added](#understanding-what-was-added)
2. [Setting Up in Cursor IDE](#setting-up-in-cursor-ide)
3. [Local Development Setup](#local-development-setup)
4. [Deploying to Production](#deploying-to-production)
5. [Working with the Code](#working-with-the-code)
6. [Testing Your Changes](#testing-your-changes)
7. [Common Tasks](#common-tasks)

---

## Understanding What Was Added

### New Features

Your repository now has **complete Mavely integration** with:
- ✅ Automated login and data extraction
- ✅ Google Sheets export capability
- ✅ Scheduled daily jobs
- ✅ Rate-limited secure endpoints

### File Structure

```
ltk-auth-middleware/
├── src/
│   ├── index.ts                          # Main server (updated)
│   ├── routes/
│   │   ├── ltkAuth.ts                    # LTK routes (rate limited)
│   │   ├── ltkEarnings.ts                # LTK earnings
│   │   ├── ltkProxy.ts                   # LTK proxy
│   │   ├── mavelyAuth.ts                 # NEW: Mavely routes
│   │   └── scheduledJobs.ts              # NEW: Job management
│   ├── services/
│   │   ├── puppeteerLogin.ts             # LTK login
│   │   ├── mavelyLogin.ts                # NEW: Mavely login
│   │   ├── mavelyDataExtraction.ts       # NEW: Mavely scraping
│   │   ├── platformStorage.ts            # NEW: Generic storage
│   │   ├── googleSheets.ts               # NEW: Sheets API
│   │   ├── scheduledExtraction.ts        # NEW: Cron jobs
│   │   ├── tokenStorage.ts               # LTK storage
│   │   └── tokenRefresh.ts               # Token refresh
│   └── utils/
│       ├── encryption.ts                 # AES-256-GCM
│       └── rateLimiter.ts                # NEW: Rate limiting
├── examples/
│   └── mavely-integration-example.js     # NEW: Usage examples
├── supabase/
│   └── migrations/
│       └── add_multi_platform_support.sql # NEW: DB migration
├── MAVELY-INTEGRATION.md                 # NEW: Mavely guide
├── GOOGLE-SHEETS-SETUP.md                # NEW: Sheets setup
├── DEPLOYMENT-CHECKLIST.md               # NEW: Deploy guide
├── API-REFERENCE.md                      # NEW: API docs
├── IMPLEMENTATION-SUMMARY.md             # NEW: Quick start
└── .env.example                          # NEW: Env template
```

---

## Setting Up in Cursor IDE

### Yes, You Can Work in Cursor! 

Cursor is perfect for this project. Here's how to set it up:

### 1. Open the Project in Cursor

```bash
# Navigate to your project
cd /path/to/ltk-auth-middleware

# Open in Cursor
cursor .
```

Or simply:
- Open Cursor
- File → Open Folder
- Select `ltk-auth-middleware`

### 2. Install Cursor Extensions (Recommended)

These will help you work with the codebase:

**Essential:**
- **TypeScript Language Features** (built-in) - TypeScript support
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **GitLens** - Git supercharged

**Helpful:**
- **Thunder Client** or **REST Client** - Test API endpoints
- **MongoDB for VS Code** - If using MongoDB
- **Supabase** - Supabase integration

### 3. Configure Cursor Settings

Create `.vscode/settings.json` (Cursor uses VS Code settings):

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true
  }
}
```

### 4. Cursor AI Features You Can Use

Cursor has amazing AI features perfect for this project:

**Cmd+K (Mac) / Ctrl+K (Windows):**
- Generate new code
- Refactor existing code
- Write tests
- Add comments/documentation

**Cmd+L (Mac) / Ctrl+L (Windows):**
- Chat with AI about the codebase
- Ask questions like:
  - "How does the Mavely login work?"
  - "Explain the scheduled extraction service"
  - "How do I add a new platform?"

**Examples:**
```
// Select code, press Cmd+K, type:
"Add TypeScript types for this function"
"Add error handling for network failures"
"Write a unit test for this service"
```

---

## Local Development Setup

### 1. Install Dependencies

```bash
cd /home/runner/work/ltk-auth-middleware/ltk-auth-middleware
npm install
```

### 2. Set Up Environment Variables

Copy the example file:
```bash
cp .env.example .env
```

Edit `.env` with your actual values:
```bash
# Supabase
SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_KEY=your-service-key-here

# Encryption
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Google Sheets (optional for local dev)
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# App
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

### 3. Run the Database Migration

In Supabase SQL Editor:
```sql
-- Copy from: supabase/migrations/add_multi_platform_support.sql
-- And run it
```

### 4. Start Development Server

```bash
npm run dev
```

This will start the server with hot-reload at `http://localhost:3000`

### 5. Test the API

```bash
# Health check
curl http://localhost:3000/health

# Expected response:
# {"status":"healthy","timestamp":"...","version":"2.0.0"}
```

---

## Deploying to Production

### Option 1: Deploy to Railway (Recommended)

**Already set up for Railway!** Just:

1. **Push your changes:**
   ```bash
   git push origin copilot/automate-data-extraction
   ```

2. **Merge the PR on GitHub**

3. **Railway will auto-deploy** (if connected to your repo)

4. **Add environment variables** in Railway dashboard:
   - Go to your Railway project
   - Variables tab
   - Add all variables from `.env.example`

5. **Run the migration** in Supabase

### Option 2: Manual Deployment

Follow the complete checklist: `DEPLOYMENT-CHECKLIST.md`

---

## Working with the Code

### Understanding the Architecture

```
Request Flow:
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ POST /api/mavely/connect
       ▼
┌─────────────────────┐
│  Express Routes     │ (mavelyAuth.ts)
│  + Rate Limiting    │
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Mavely Login       │ (mavelyLogin.ts)
│  Service            │ → Puppeteer → Mavely Website
└──────┬──────────────┘
       │
       ▼
┌─────────────────────┐
│  Platform Storage   │ (platformStorage.ts)
│  + Encryption       │ → Supabase
└─────────────────────┘
```

### Common Code Patterns

#### 1. Adding a New Endpoint

```typescript
// In src/routes/mavelyAuth.ts
router.post('/new-endpoint/:userId', rateLimiter, async (req, res) => {
  const { userId } = req.params;
  const { param1, param2 } = req.body;
  
  try {
    // Your logic here
    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

#### 2. Adding a New Platform (e.g., Amazon)

```typescript
// 1. Create src/services/amazonLogin.ts
export async function loginToAmazon(email: string, password: string) {
  // Similar to mavelyLogin.ts
}

// 2. Create src/services/amazonDataExtraction.ts
export async function extractAmazonData(userId: string) {
  // Similar to mavelyDataExtraction.ts
}

// 3. Create src/routes/amazonAuth.ts
// Copy pattern from mavelyAuth.ts

// 4. Update src/index.ts
import amazonAuthRoutes from './routes/amazonAuth.js';
app.use('/api/amazon', amazonAuthRoutes);

// 5. Update scheduledExtraction.ts
case 'AMAZON':
  const amazonResult = await extractAmazonData(userId, dateStr, dateStr);
  break;
```

### Using TypeScript in Cursor

**Auto-completion works great!**
- Start typing and Cursor will suggest based on types
- Hover over functions to see signatures
- Cmd+Click to jump to definitions

**Type checking:**
```bash
npm run typecheck
```

**Building:**
```bash
npm run build
```

---

## Testing Your Changes

### Manual Testing

#### 1. Test Mavely Connection

```bash
# In Cursor, open terminal (Ctrl+`)
curl -X POST http://localhost:3000/api/mavely/connect \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "email": "your-mavely-email@example.com",
    "password": "your-password"
  }'
```

#### 2. Test Data Extraction

```bash
curl -X POST http://localhost:3000/api/mavely/extract/test-user-123 \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-01-01",
    "endDate": "2026-01-29",
    "exportToSheets": false
  }'
```

#### 3. Use Thunder Client in Cursor

1. Install Thunder Client extension
2. Create a new request
3. Set URL: `http://localhost:3000/api/mavely/connect`
4. Set method: POST
5. Add JSON body
6. Click Send

### Using the Example Code

Open `examples/mavely-integration-example.js` in Cursor:

```bash
# Update the MIDDLEWARE_URL to your local server
const MIDDLEWARE_URL = 'http://localhost:3000';

# Run individual functions
node examples/mavely-integration-example.js
```

---

## Common Tasks

### Task 1: Test a New Feature Locally

```bash
# 1. Make your changes in Cursor
# 2. Save files (auto-formats with Prettier)
# 3. Terminal in Cursor:
npm run dev

# 4. Test with curl or Thunder Client
# 5. Check logs in terminal
```

### Task 2: Add a New Platform

```bash
# 1. Copy mavelyLogin.ts → amazonLogin.ts
# 2. Update URLs and selectors for Amazon
# 3. Copy mavelyAuth.ts → amazonAuth.ts
# 4. Update platform references
# 5. Add routes in src/index.ts
# 6. Test locally
# 7. Commit and push
```

### Task 3: Debug an Issue

**In Cursor:**
1. Set breakpoints (click left of line numbers)
2. Run → Start Debugging (F5)
3. Configure `launch.json` if needed:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "skipFiles": ["<node_internals>/**"]
    }
  ]
}
```

### Task 4: View Logs

```bash
# In Cursor terminal:
npm run dev

# Or for production logs:
# Railway dashboard → Your service → Logs
```

### Task 5: Update Documentation

```bash
# In Cursor:
# 1. Open relevant .md file
# 2. Edit with Markdown preview (Cmd+Shift+V)
# 3. Save and commit
```

---

## Quick Reference

### Important Files to Know

| File | Purpose | When to Edit |
|------|---------|--------------|
| `src/index.ts` | Main server | Add new routes |
| `src/routes/mavelyAuth.ts` | Mavely endpoints | Add Mavely features |
| `src/services/mavelyLogin.ts` | Mavely login | Fix login issues |
| `src/services/platformStorage.ts` | Token storage | Change storage logic |
| `src/services/scheduledExtraction.ts` | Cron jobs | Modify schedule |
| `.env` | Local config | Never commit! |
| `.env.example` | Config template | Document new vars |

### Useful Commands

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run build           # Compile TypeScript
npm run typecheck       # Check types without building
npm run start           # Start production server

# Git
git status              # Check changes
git add .               # Stage all changes
git commit -m "..."     # Commit changes
git push                # Push to remote

# Database
# Run in Supabase SQL Editor, not terminal
```

### Cursor Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl + P | Quick file open |
| Cmd/Ctrl + Shift + P | Command palette |
| Cmd/Ctrl + K | AI inline edit |
| Cmd/Ctrl + L | AI chat |
| Cmd/Ctrl + ` | Toggle terminal |
| Cmd/Ctrl + B | Toggle sidebar |
| F5 | Start debugging |
| Cmd/Ctrl + Shift + F | Search in files |

---

## Next Steps

### Immediate Actions

1. **✅ Open project in Cursor**
   ```bash
   cursor /path/to/ltk-auth-middleware
   ```

2. **✅ Install dependencies**
   ```bash
   npm install
   ```

3. **✅ Set up `.env` file**
   ```bash
   cp .env.example .env
   # Edit with your values
   ```

4. **✅ Start dev server**
   ```bash
   npm run dev
   ```

5. **✅ Test the API**
   ```bash
   curl http://localhost:3000/health
   ```

### For Production Deployment

1. **📋 Follow the deployment checklist**
   - See: `DEPLOYMENT-CHECKLIST.md`

2. **📋 Set up Google Sheets**
   - See: `GOOGLE-SHEETS-SETUP.md`

3. **📋 Deploy to Railway**
   - Push changes
   - Add environment variables
   - Monitor logs

---

## Getting Help

### Within Cursor

**Ask Cursor AI (Cmd+L):**
- "How does the Mavely login service work?"
- "What does the platformStorage service do?"
- "How can I add Amazon integration?"
- "Explain the scheduled extraction flow"

### Documentation

- `MAVELY-INTEGRATION.md` - Mavely features
- `API-REFERENCE.md` - Complete API docs
- `GOOGLE-SHEETS-SETUP.md` - Sheets setup
- `DEPLOYMENT-CHECKLIST.md` - Deploy guide
- `IMPLEMENTATION-SUMMARY.md` - Quick overview

### Common Issues

**Issue: "Cannot find module"**
```bash
# Solution:
npm install
```

**Issue: "Port already in use"**
```bash
# Solution: Change PORT in .env
PORT=3001
```

**Issue: "TypeScript errors"**
```bash
# Solution:
npm run typecheck
# Fix errors shown
```

---

## Summary

**Yes, you can absolutely work in Cursor!** 

Here's your workflow:

1. **Open in Cursor** → Works perfectly
2. **Edit code** → TypeScript auto-complete, AI assistance
3. **Test locally** → `npm run dev` in terminal
4. **Use AI** → Cmd+K for edits, Cmd+L for questions
5. **Debug** → Set breakpoints, F5 to debug
6. **Commit** → Git integration built-in
7. **Deploy** → Push to trigger Railway deployment

**You're all set to develop!** 🚀

The codebase is production-ready and waiting for you to:
- Test locally with your Mavely account
- Deploy to Railway
- Set up scheduled extraction
- Add more platforms (Amazon, ShopMY)

**Happy coding in Cursor!** ✨
