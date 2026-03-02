# Quick Setup Guide

## Step 1: Configure Slack App

You need to create a Slack app and get the required tokens. Follow these steps:

### Create the App

1. Go to https://api.slack.com/apps
2. Click **"Create New App"** → **"From scratch"**
3. Name: `Personality Bot`
4. Select your workspace

### Configure Permissions

**OAuth & Permissions** → Add Bot Token Scopes:
- `channels:history`
- `channels:read`
- `chat:write`
- `users:read`
- `im:write`
- `im:history`

### Enable Socket Mode

1. **Socket Mode** (in sidebar) → Enable
2. Generate App-Level Token with `connections:write` scope
3. Copy token (starts with `xapp-`) → Save for `.env`

### Enable Events

**Event Subscriptions** → Enable → Subscribe to bot events:
- `message.channels`
- `team_join`

### Install to Workspace

1. **Install App** → **Install to Workspace**
2. Authorize
3. Copy **Bot User OAuth Token** (starts with `xoxb-`)
4. Copy **Signing Secret** from **Basic Information**

### Invite Bot to Channel

In Slack channel C09RPPPKCLB, type:
```
/invite @Personality Bot
```

## Step 2: Update .env File

Open `.env` and add your Slack credentials:

```bash
SLACK_BOT_TOKEN=xoxb-YOUR-TOKEN-HERE
SLACK_APP_TOKEN=xapp-YOUR-TOKEN-HERE
SLACK_SIGNING_SECRET=YOUR-SECRET-HERE
```

The other values are already configured:
- `TARGET_CHANNEL_ID=C09RPPPKCLB`
- `YOUR_USER_ID=D08UHMS0DSS`
- `OPENAI_API_KEY=sk-proj-...` (already set)

## Step 3: Train the Bot

Run the trainer to fetch historical messages and analyze your style:

```bash
npm run train
```

This will:
- ✅ Fetch all messages from channel C09RPPPKCLB
- ✅ Save your messages to database
- ✅ Analyze your communication patterns
- ✅ Generate personality profile

## Step 4: Start the Bot

```bash
npm start
```

The bot will:
- 🤖 Monitor channel C09RPPPKCLB
- 💬 Generate responses in your style
- ✅ Auto-send high-confidence responses (>85%)
- 📨 Send low-confidence responses to you for review

## Verification Checklist

Before running, verify:
- [ ] Slack app created and installed
- [ ] Bot invited to channel C09RPPPKCLB
- [ ] All tokens added to `.env`
- [ ] Dependencies installed (`npm install`)
- [ ] Trainer completed successfully
- [ ] Bot started without errors

## Troubleshooting

**Bot not receiving messages?**
- Ensure Socket Mode is enabled
- Verify bot is invited to channel: `/invite @Personality Bot`
- Check `SLACK_APP_TOKEN` is correct

**No personality profile?**
- Run `npm run train` first
- Verify `YOUR_USER_ID=D08UHMS0DSS` is correct
- Check you have messages in the channel

**OpenAI errors?**
- Verify API key is valid
- Check you have credits available
- Ensure GPT-4o-mini access

## Next Steps

Once running:
1. Send a test message in the channel
2. Watch console for bot activity
3. Check if response is auto-sent or sent for review
4. Adjust `AUTO_SEND_THRESHOLD` in `.env` if needed

## Support

Check console logs for detailed debugging information.
