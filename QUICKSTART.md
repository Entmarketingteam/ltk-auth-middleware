# ⚡ Quick Start Guide

Get up and running in 5 minutes!

## For Your Question: "How do I handle the additions?"

### Answer: You have 2 options:

**Option 1: Just Deploy (Easiest)**
- All code is ready to go
- Just deploy to Railway and configure environment variables
- See: `DEPLOYMENT-CHECKLIST.md`

**Option 2: Develop Locally First (Recommended)**
- Test features on your machine before deploying
- See steps below 👇

---

## For Your Question: "Can I work in Cursor now?"

### Answer: YES! ✅

Cursor works perfectly with this codebase. See: `CURSOR-SETUP-GUIDE.md`

---

## 🚀 Super Quick Local Setup

### 1️⃣ Open in Cursor

```bash
cd /path/to/ltk-auth-middleware
cursor .
```

### 2️⃣ Install Dependencies

```bash
npm install
```

### 3️⃣ Set Up Environment

```bash
# Copy template
cp .env.example .env

# Edit .env with your values
# At minimum, you need:
# - SUPABASE_URL
# - SUPABASE_SERVICE_KEY
# - ENCRYPTION_KEY (generate: openssl rand -hex 32)
```

### 4️⃣ Start Development Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### 5️⃣ Test It

```bash
# In another terminal
curl http://localhost:3000/health

# You should see:
# {"status":"healthy","timestamp":"...","version":"2.0.0"}
```

**✅ You're ready to code!**

---

## 🎯 What Can You Do Now?

### Test Mavely Integration Locally

```bash
curl -X POST http://localhost:3000/api/mavely/connect \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user",
    "email": "your-mavely-email@example.com",
    "password": "your-password"
  }'
```

### Edit Code in Cursor

1. **Open any file** (try `src/routes/mavelyAuth.ts`)
2. **Make changes** (TypeScript auto-complete works!)
3. **Save** (server auto-restarts with your changes)
4. **Test** (use curl or Thunder Client extension)

### Use Cursor AI Features

**Cmd+K** (Mac) or **Ctrl+K** (Windows):
- Select code
- Press Cmd+K
- Type what you want (e.g., "add error handling")
- AI generates the code

**Cmd+L** (Mac) or **Ctrl+L** (Windows):
- Open AI chat
- Ask questions about the code
- Get explanations and suggestions

---

## 📚 Documentation Map

Lost? Here's where to find what you need:

| I want to... | Read this file |
|-------------|----------------|
| Use Cursor IDE | `CURSOR-SETUP-GUIDE.md` |
| Deploy to production | `DEPLOYMENT-CHECKLIST.md` |
| Set up Google Sheets | `GOOGLE-SHEETS-SETUP.md` |
| Use Mavely features | `MAVELY-INTEGRATION.md` |
| See API endpoints | `API-REFERENCE.md` |
| Quick overview | `IMPLEMENTATION-SUMMARY.md` |
| Understand changes | `README.md` |

---

## 🔧 Common Commands

```bash
# Development
npm run dev         # Start with hot-reload
npm run build       # Compile TypeScript
npm run typecheck   # Check for errors
npm start          # Start production server

# Git
git status         # See what changed
git add .          # Stage changes
git commit -m "msg" # Commit
git push           # Push to GitHub
```

---

## ❓ Quick FAQ

**Q: Do I need to deploy to test?**
A: No! Run locally with `npm run dev`

**Q: Can I use VS Code instead of Cursor?**
A: Yes! All the .vscode configs work in VS Code too

**Q: Where do I put my API keys?**
A: In `.env` file (never commit this!)

**Q: How do I add a new platform like Amazon?**
A: Copy the Mavely pattern, see `CURSOR-SETUP-GUIDE.md` → "Adding a New Platform"

**Q: Is Google Sheets required?**
A: No! Only if you want automated daily exports

**Q: How do I test without real credentials?**
A: You'll need real credentials for now. Consider creating test accounts.

---

## 🆘 Something Not Working?

### Server won't start?
```bash
# Check if port is in use
lsof -i :3000

# Change port in .env
PORT=3001
```

### TypeScript errors?
```bash
npm run typecheck
# Fix errors shown
```

### Module not found?
```bash
npm install
```

### Still stuck?
- Check server logs in terminal
- Read relevant documentation file
- Use Cursor AI (Cmd+L) to ask questions

---

## ✨ You're All Set!

**Next Steps:**
1. ✅ Open in Cursor
2. ✅ Run `npm install`
3. ✅ Create `.env` file
4. ✅ Run `npm run dev`
5. ✅ Start coding!

**Happy developing!** 🚀

---

*For detailed guides, see the other .md files in this directory*
