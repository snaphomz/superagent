# Render Deployment Fix

## Two Issues to Fix

### Issue 1: Training Locally
The **Internal Database URL** only works within Render's network. For local training, you need the **External Database URL**.

**Get External URL:**
1. Go to Render Dashboard → Your PostgreSQL database
2. Click **"Info"** tab
3. Copy the **"External Database URL"** (has full hostname like `.oregon-postgres.render.com`)

**Update your local `.env`:**
```bash
DATABASE_URL=<paste External Database URL here>
```

**Then run training:**
```bash
npm run train
```

---

### Issue 2: Render Service Type
Your bot is deployed as a **Web Service**, but Render expects Web Services to open an HTTP port. Your bot uses WebSocket (Socket Mode) and doesn't need HTTP.

**Solution: Change to Background Worker**

Render has a service type specifically for this: **Background Worker**

## How to Fix on Render

### Option 1: Recreate as Background Worker (Recommended)

1. **Delete current web service:**
   - Dashboard → `superagent` → Settings → Delete Service

2. **Create Background Worker:**
   - Click **"New +"** → **"Background Worker"**
   - Connect to GitHub: `snaphomz/superagent`
   - Configure:
     - **Name:** `superagent`
     - **Region:** Oregon (same as database)
     - **Branch:** `main`
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
     - **Plan:** Free

3. **Add Environment Variables:**
   ```
   DATABASE_URL=<Internal Database URL>
   SLACK_BOT_TOKEN=<your token>
   SLACK_APP_TOKEN=<your token>
   SLACK_SIGNING_SECRET=<your secret>
   TARGET_CHANNEL_ID=C09RPPPKCLB
   YOUR_USER_ID=U08UHMRV2ES
   OPENAI_API_KEY=<your key>
   NODE_ENV=production
   AUTO_SEND_THRESHOLD=85
   RESPONSE_DELAY_SECONDS=3
   MAX_CONTEXT_MESSAGES=20
   ```

4. **Deploy**

### Option 2: Add Health Check Port (Alternative)

If you want to keep it as Web Service, we can add a simple HTTP server just for health checks.

Let me know which option you prefer!

---

## Quick Steps Summary

**Right now:**
1. Get **External Database URL** from Render
2. Update your local `.env` with External URL
3. Run `npm run train` locally
4. Delete Web Service, create Background Worker
5. Bot will run 24/7 without port timeout issues

**Which do you want to do first?**
- Get External URL and train?
- Or fix Render service type?
