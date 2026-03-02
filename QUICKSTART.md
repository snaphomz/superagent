# 🚀 Quick Start - 3 Steps to Launch

## ⚡ Step 1: Configure Slack App (5 min)

### Create App
1. Visit: https://api.slack.com/apps
2. **Create New App** → **From scratch**
3. Name: `Personality Bot`, select your workspace

### Add Permissions
**OAuth & Permissions** → Bot Token Scopes:
```
channels:history
channels:read
chat:write
users:read
im:write
im:history
```

### Enable Socket Mode
1. **Socket Mode** → Enable
2. Generate token with `connections:write`
3. **Copy the xapp- token**

### Enable Events
**Event Subscriptions** → Enable → Bot Events:
```
message.channels
team_join
```

### Install & Get Tokens
1. **Install App** → Install to Workspace
2. **Copy Bot User OAuth Token** (xoxb-)
3. **Basic Information** → **Copy Signing Secret**

### Invite to Channel
In Slack, go to channel and type:
```
/invite @Personality Bot
```

## ⚡ Step 2: Add Tokens to .env

Edit `.env` file and replace these 3 lines:

```bash
SLACK_BOT_TOKEN=xoxb-YOUR-ACTUAL-TOKEN-HERE
SLACK_APP_TOKEN=xapp-YOUR-ACTUAL-TOKEN-HERE
SLACK_SIGNING_SECRET=YOUR-ACTUAL-SECRET-HERE
```

Everything else is already configured!

## ⚡ Step 3: Train & Run

### Train (one time)
```bash
npm run train
```

Wait for it to:
- ✅ Fetch all channel messages
- ✅ Analyze your communication style
- ✅ Generate personality profile

### Start Bot
```bash
npm start
```

## ✅ You're Live!

The bot is now:
- 👀 Monitoring channel C09RPPPKCLB
- 🤖 Generating responses in your style
- ✅ Auto-sending high-confidence responses (>85%)
- 📨 Sending low-confidence to you for review

## 🎯 Test It

1. Have someone send a message in the channel
2. Watch the console for bot activity
3. See if it auto-sends or asks for your review

## 📊 What It Learned

After training, you'll see:
- Average message length
- Tone percentages (formal/casual/direct/etc)
- Common phrases you use
- Emoji patterns
- Greeting/closing styles

## ⚙️ Adjust Settings

Edit `.env` to tune behavior:
```bash
AUTO_SEND_THRESHOLD=85    # Lower = more auto-sends
RESPONSE_DELAY_SECONDS=3  # Delay before sending
MAX_CONTEXT_MESSAGES=20   # Conversation history
```

## 🆘 Troubleshooting

**Not receiving messages?**
- Check bot is invited: `/invite @Personality Bot`
- Verify Socket Mode is enabled
- Check SLACK_APP_TOKEN is correct

**No personality profile?**
- Run `npm run train` first
- Verify YOUR_USER_ID=D08UHMS0DSS
- Check you have messages in channel

**Need help?**
See full docs in README.md

---

**That's it! You're ready to go! 🎉**
