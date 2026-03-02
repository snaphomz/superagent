# Fly.io Deployment Guide - 100% Free

Fly.io has a generous free tier perfect for your Slack bot.

## Free Tier Includes:
- ✅ 3 shared-cpu VMs (160GB/month)
- ✅ 3GB persistent storage
- ✅ 160GB outbound data
- ✅ No credit card required initially
- ✅ Perfect for long-running bots

## Quick Setup (10 minutes)

### Step 1: Install Fly CLI

**macOS:**
```bash
brew install flyctl
```

**Or using curl:**
```bash
curl -L https://fly.io/install.sh | sh
```

### Step 2: Sign Up & Login

```bash
flyctl auth signup
# Or if you have an account:
flyctl auth login
```

### Step 3: Create fly.toml Configuration

Already created for you in the project!

### Step 4: Launch App

```bash
cd /Users/aa/CascadeProjects/windsurf-project

# Launch (will create app and deploy)
flyctl launch --no-deploy

# When prompted:
# - App name: superagent (or choose your own)
# - Region: Choose closest to you
# - PostgreSQL: NO (we're using Render's database)
# - Redis: NO
```

### Step 5: Set Environment Variables

```bash
# Set all secrets
flyctl secrets set \
  DATABASE_URL="postgresql://slackbot:MhH4JTYtzQU5bedSSPM0XogC6c0PsNdI@dpg-d6itv01drdic73enbi7g-a.oregon-postgres.render.com/slackbot_yzem" \
  SLACK_BOT_TOKEN="<your-token>" \
  SLACK_APP_TOKEN="<your-token>" \
  SLACK_SIGNING_SECRET="<your-secret>" \
  OPENAI_API_KEY="<your-key>" \
  TARGET_CHANNEL_ID="C09RPPPKCLB" \
  YOUR_USER_ID="U08UHMRV2ES" \
  NODE_ENV="production" \
  AUTO_SEND_THRESHOLD="85" \
  RESPONSE_DELAY_SECONDS="3" \
  MAX_CONTEXT_MESSAGES="20"
```

### Step 6: Deploy

```bash
flyctl deploy
```

### Step 7: Check Logs

```bash
flyctl logs
```

You should see:
```
✅ Personality profile loaded
✅ Bot is running!
👀 Monitoring channel C09RPPPKCLB for messages...
```

## Useful Commands

```bash
# View logs (live)
flyctl logs

# Check app status
flyctl status

# SSH into app (if needed)
flyctl ssh console

# Scale down to save resources (if needed)
flyctl scale count 1

# Restart app
flyctl apps restart superagent
```

## Cost Monitoring

```bash
# Check usage
flyctl dashboard
```

Your bot should stay well within the free tier limits.

## Troubleshooting

### App not starting?
```bash
flyctl logs
```

### Need to update environment variables?
```bash
flyctl secrets set KEY="value"
```

### Want to redeploy?
```bash
git push  # Push changes to GitHub
flyctl deploy  # Deploy to Fly.io
```

## Benefits of Fly.io

- ✅ Truly free (no time limit like Render's 90 days)
- ✅ No credit card required initially
- ✅ Better for long-running processes
- ✅ Easy CLI deployment
- ✅ Can use your existing Render PostgreSQL database

---

Ready to deploy? Just run:
```bash
brew install flyctl
flyctl auth signup
cd /Users/aa/CascadeProjects/windsurf-project
flyctl launch --no-deploy
# Then set secrets and deploy!
```
