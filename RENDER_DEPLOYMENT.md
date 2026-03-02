# Render Deployment Guide - Free Tier

## Quick Start (15 minutes)

### Step 1: Create Render Account (2 minutes)
1. Go to https://render.com
2. Sign up with GitHub (recommended) or email
3. Verify your email
4. **No credit card required!**

### Step 2: Create PostgreSQL Database (3 minutes)
1. Click **"New +"** → **"PostgreSQL"**
2. Configure:
   - **Name:** `slackbot-db`
   - **Database:** `slackbot`
   - **User:** `slackbot`
   - **Region:** Choose closest to you
   - **Plan:** **Free** (90 days free)
3. Click **"Create Database"**
4. Wait 1-2 minutes for provisioning
5. Copy the **"Internal Database URL"** (starts with `postgresql://`)

### Step 3: Push Code to GitHub (5 minutes)

If not already on GitHub:

```bash
cd /Users/aa/CascadeProjects/windsurf-project

# Initialize git if needed
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit - Slack personality bot"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/slack-personality-bot.git
git branch -M main
git push -u origin main
```

### Step 4: Deploy Web Service (5 minutes)

1. In Render dashboard, click **"New +"** → **"Web Service"**
2. Click **"Connect GitHub"** and authorize
3. Select your repository: `slack-personality-bot`
4. Configure:
   - **Name:** `slack-personality-bot`
   - **Region:** Same as database
   - **Branch:** `main`
   - **Root Directory:** (leave empty)
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** **Free**

5. Click **"Advanced"** and add environment variables:

```
DATABASE_URL=<paste Internal Database URL from Step 2>
SLACK_BOT_TOKEN=<from your .env>
SLACK_APP_TOKEN=<from your .env>
SLACK_SIGNING_SECRET=<from your .env>
TARGET_CHANNEL_ID=C09RPPPKCLB
YOUR_USER_ID=U08UHMRV2ES
OPENAI_API_KEY=<from your .env>
NODE_ENV=production
AUTO_SEND_THRESHOLD=85
RESPONSE_DELAY_SECONDS=3
MAX_CONTEXT_MESSAGES=20
```

6. Click **"Create Web Service"**
7. Wait 3-5 minutes for deployment

### Step 5: Run Training Script (2 minutes)

**Option A: From Render Shell**
1. Go to your service page
2. Click **"Shell"** tab (top right)
3. Run: `npm run train`
4. Wait for training to complete

**Option B: From Local (Recommended)**
1. Add to your local `.env`:
   ```
   DATABASE_URL=<paste Internal Database URL>
   ```
2. Run locally: `npm run train`
3. Data goes directly to cloud database

### Step 6: Verify Deployment (2 minutes)

1. Go to **"Logs"** tab in Render
2. Look for:
   ```
   ✅ Bot is running!
   👀 Monitoring channel C09RPPPKCLB for messages...
   ```
3. Test in Slack - post an EOD update
4. Bot should respond with @mention

## Troubleshooting

### Bot not starting?
- Check **Logs** tab for errors
- Verify all environment variables are set
- Ensure DATABASE_URL is correct

### Database connection error?
- Use **Internal Database URL** (not External)
- Check database is in same region as web service
- Verify PostgreSQL is running (green status)

### Bot not responding?
- Check Slack tokens are correct
- Verify bot is invited to channel
- Check OpenAI API key is valid
- Look at Logs for error messages

### Training script fails?
- Run locally with cloud DATABASE_URL
- Check you have messages in the channel
- Verify YOUR_USER_ID is correct

## Monitoring

### View Logs
- Render Dashboard → Your Service → **Logs** tab
- Real-time logs of bot activity
- Filter by severity

### Check Database
- Render Dashboard → Your Database → **Info** tab
- See connection count, size, etc.
- Can connect with any PostgreSQL client

### Monitor Costs
- Render Dashboard → **Usage** tab
- Free tier: 750 hours/month (24/7 for 31 days)
- Database: Free for 90 days

## After 90 Days

Your free database expires. Options:

### Option 1: Upgrade to Paid ($7/month)
1. Go to database settings
2. Upgrade to Starter plan
3. Continue using same database

### Option 2: Migrate to Fly.io Free
1. Export data from Render
2. Set up Fly.io (free forever)
3. Import data
4. Update bot to use new DATABASE_URL

### Option 3: Migrate to Another Platform
1. Export personality profile
2. Deploy to Railway/other platform
3. Re-run training script

## Useful Commands

### View Logs
```bash
# Install Render CLI (optional)
npm install -g render-cli

# View logs
render logs slack-personality-bot
```

### Connect to Database
```bash
# Using psql
psql <DATABASE_URL>

# List tables
\dt

# View messages
SELECT COUNT(*) FROM messages;
```

### Redeploy
- Push to GitHub main branch
- Render auto-deploys
- Or click **"Manual Deploy"** in dashboard

## Environment Variables Reference

| Variable | Value | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Auto-filled | PostgreSQL connection string |
| `SLACK_BOT_TOKEN` | xoxb-... | From Slack app settings |
| `SLACK_APP_TOKEN` | xapp-... | From Slack app settings |
| `SLACK_SIGNING_SECRET` | ... | From Slack app settings |
| `TARGET_CHANNEL_ID` | C09RPPPKCLB | Channel to monitor |
| `YOUR_USER_ID` | U08UHMRV2ES | Your Slack user ID |
| `OPENAI_API_KEY` | sk-proj-... | OpenAI API key |
| `NODE_ENV` | production | Environment mode |
| `AUTO_SEND_THRESHOLD` | 85 | Confidence threshold |
| `RESPONSE_DELAY_SECONDS` | 3 | Delay before sending |
| `MAX_CONTEXT_MESSAGES` | 20 | Context window size |

## Support

- Render Docs: https://render.com/docs
- Render Community: https://community.render.com
- Check Logs first for errors
- Test locally with cloud DATABASE_URL

## Success Checklist

- [ ] Render account created
- [ ] PostgreSQL database created
- [ ] Code pushed to GitHub
- [ ] Web service deployed
- [ ] All environment variables set
- [ ] Training script completed
- [ ] Bot responding in Slack
- [ ] Logs show no errors
- [ ] @mentions working
- [ ] EOD engagement working

**Congratulations! Your bot is now running 24/7 for free!** 🎉
