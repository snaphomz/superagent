# ClickUp Integration Setup Guide

## 📋 Overview

This guide will help you connect your ClickUp workspace to the Slack bot for task tracking and management.

## 🔐 OAuth Credentials

**App Name:** slack_techteam
**Client ID:** LCCIMF2N836O58HU8D95I8HXFWNLUXJ6
**Client Secret:** 77QSAXMR3S0OEO0KVIJ1WV2K567LGKRGY0DQABN10PHFN2Q7SXKCCX772C11CYBZ
**Redirect URI:** https://superagent-bot.fly.dev/auth/clickup/callback

## 🚀 Setup Steps

### Step 1: Add Environment Variables

Add these to your Fly.io secrets:

```bash
flyctl secrets set CLICKUP_CLIENT_ID=LCCIMF2N836O58HU8D95I8HXFWNLUXJ6
flyctl secrets set CLICKUP_CLIENT_SECRET=77QSAXMR3S0OEO0KVIJ1WV2K567LGKRGY0DQABN10PHFN2Q7SXKCCX772C11CYBZ
flyctl secrets set CLICKUP_REDIRECT_URI=https://superagent-bot.fly.dev/auth/clickup/callback
```

### Step 2: Authorize the App

Visit this URL to authorize the bot to access your ClickUp workspace:

```
https://app.clickup.com/api?client_id=LCCIMF2N836O58HU8D95I8HXFWNLUXJ6&redirect_uri=https://superagent-bot.fly.dev/auth/clickup/callback
```

**What happens:**
1. You'll be redirected to ClickUp
2. Select which workspace to connect
3. Click "Connect Workspace"
4. You'll be redirected back to the bot
5. Bot will exchange the code for an access token
6. You'll see a success message

### Step 3: Get Your Workspace and List IDs

After authorization, you can use these Slack commands:

- `!clickup workspaces` - List all your workspaces
- `!clickup spaces <workspace_id>` - List spaces in a workspace
- `!clickup lists <folder_id>` - List all lists in a folder

Once you have your IDs, add them to Fly.io:

```bash
flyctl secrets set CLICKUP_WORKSPACE_ID=your_workspace_id
flyctl secrets set CLICKUP_LIST_ID=your_list_id
```

## 📊 Available Features

### Task Monitoring
- Automatic notifications when task status changes
- Track task assignments
- Monitor due dates

### Slack Commands
- `!clickup tasks` - Show tasks in configured list
- `!clickup task <task_id>` - Get task details
- `!clickup workspaces` - List your workspaces

### Daily Summary Integration
- Completed tasks included in daily summary
- Task progress tracking
- Team member task completion stats

## 🔧 Configuration

Edit these in your `.env` or Fly.io secrets:

```bash
# Required
CLICKUP_CLIENT_ID=LCCIMF2N836O58HU8D95I8HXFWNLUXJ6
CLICKUP_CLIENT_SECRET=77QSAXMR3S0OEO0KVIJ1WV2K567LGKRGY0DQABN10PHFN2Q7SXKCCX772C11CYBZ
CLICKUP_REDIRECT_URI=https://superagent-bot.fly.dev/auth/clickup/callback

# Optional - Set after authorization
CLICKUP_WORKSPACE_ID=your_workspace_id
CLICKUP_LIST_ID=your_list_id
```

## 🎯 Next Steps

1. Deploy the bot with ClickUp integration
2. Authorize the app using the URL above
3. Get your workspace and list IDs
4. Configure monitoring and notifications
5. Test with Slack commands

## 📝 Notes

- Access tokens are stored in memory (will need re-auth after bot restart)
- For persistent storage, we can add database storage later
- OAuth flow is secure and follows ClickUp best practices
- The bot only has access to workspaces you explicitly authorize

## 🔗 Useful Links

- [ClickUp API Documentation](https://developer.clickup.com/)
- [OAuth Flow Guide](https://developer.clickup.com/docs/authentication)
- [Webhook Documentation](https://developer.clickup.com/docs/webhooks)
