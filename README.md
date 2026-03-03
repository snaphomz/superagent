# Super Agent

A Slack bot that learns your communication style and automatically responds to team messages in your voice.

## Features

- 🤖 **AI-Powered Responses**: Uses GPT-4o-mini to generate responses matching your style
- 📊 **Style Learning**: Analyzes your message history to understand your communication patterns
- ✅ **Auto-Send Mode**: Automatically sends high-confidence responses (>85%)
- 📨 **Manual Review**: Low-confidence responses sent to you for approval
- 💾 **Local Storage**: All data stored securely in SQLite database
- 👥 **Team Detection**: Automatically learns team member patterns

## Deployment

**Production:** Deployed on Fly.io with PostgreSQL database
- See `FLY_DEPLOYMENT.md` for complete deployment guide
- Free tier available, then $7/month
- Includes health checks and automatic restarts
- All schedulers run in IST (Asia/Kolkata) timezone

## Cost Estimate

Using GPT-4o-mini: **$5-15/month** for typical team usage (100-300 messages/day)
Fly.io hosting: **Free tier available**, then $7/month

## Prerequisites

- Node.js 18+ installed
- Slack workspace with admin access
- OpenAI API key

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click "Create New App" → "From scratch"
3. Name it "Personality Bot" and select your workspace

#### Configure OAuth & Permissions

Add these **Bot Token Scopes**:
- `channels:history` - Read channel messages
- `channels:read` - View channel info
- `chat:write` - Send messages
- `users:read` - Read user information
- `im:write` - Send DMs for manual review
- `im:history` - Read DM history

#### Enable Socket Mode

1. Go to "Socket Mode" in sidebar
2. Enable Socket Mode
3. Generate an App-Level Token with `connections:write` scope
4. Save the token (starts with `xapp-`)

#### Enable Event Subscriptions

1. Go to "Event Subscriptions"
2. Enable Events
3. Subscribe to these **bot events**:
   - `message.channels` - Listen to channel messages
   - `team_join` - Track new team members

#### Install App to Workspace

1. Go to "Install App"
2. Click "Install to Workspace"
3. Authorize the app
4. Copy the "Bot User OAuth Token" (starts with `xoxb-`)

### 3. Configure Environment

1. Copy `.env.example` to `.env` (already done)
2. Update `.env` with your Slack credentials:

```bash
# Get these from Slack App settings
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
SLACK_SIGNING_SECRET=your-signing-secret

# Already configured
TARGET_CHANNEL_ID=C09RPPPKCLB
YOUR_USER_ID=D08UHMS0DSS
OPENAI_API_KEY=sk-proj-...
```

### 4. Train the Bot

Fetch historical messages and analyze your communication style:

```bash
npm run train
```

This will:
- Fetch all messages from the target channel
- Save them to the database
- Identify your messages
- Analyze your communication patterns
- Generate a personality profile

### 5. Start the Bot

```bash
npm start
```

Or for development with auto-restart:

```bash
npm run dev
```

## How It Works

### Message Flow

1. **Message Received** → Bot monitors channel C09RPPPKCLB
2. **Relevance Check** → Determines if message needs a response
3. **Context Building** → Gathers recent conversation history
4. **Response Generation** → GPT-4o-mini generates response in your style
5. **Confidence Scoring** → Evaluates response quality (0-100%)
6. **Auto-Send or Review**:
   - **≥85% confidence** → Auto-sends after 3-second delay
   - **<85% confidence** → Sends to you for manual approval

### What Triggers Responses

The bot responds to:
- All messages in the target channel
- Questions (messages with `?`)
- Check-ins ("how are you", "checking in")
- Daily update requests
- Task delegation ("can you", "could you")
- Direct @mentions of you

### Personality Analysis

The bot learns from your messages:
- **Tone**: Formal vs casual, direct vs diplomatic
- **Vocabulary**: Frequently used words and phrases
- **Message Length**: Average character count
- **Emoji Usage**: Which emojis you use and how often
- **Greetings/Closings**: Your typical message starters and endings
- **Sentence Structure**: Question/exclamation ratios

## Configuration

Edit `.env` to customize:

```bash
# Bot Behavior
AUTO_SEND_THRESHOLD=85
RESPONSE_DELAY_SECONDS=3
MAX_CONTEXT_MESSAGES=20

# Scheduler Times (IST - Asia/Kolkata)
CHECKIN_TIMEZONE=Asia/Kolkata
MORNING_CHECKIN_TIME=09:00
CHECKIN_VALIDATION_TIME=10:00
CODE_PUSH_REMINDER_TIME=17:30

# Channels & Users
TARGET_CHANNEL_ID=C09RPPPKCLB
YOUR_USER_ID=U08UHMRV2ES
```

## Usage

### View Logs

The bot logs all activity to console:
- Messages received and saved
- Response generation attempts
- Confidence scores
- Auto-send vs manual review decisions

### Manual Review

When confidence is low, you'll receive a DM with:
- Original message
- Suggested response
- Confidence score
- Message type
- **Approve & Send** button
- **Reject** button

### Update Personality Profile

Re-analyze your style after collecting more messages:

```bash
npm run train
```

### Database Location

All data stored in: `./data/messages.db`

Tables:
- `messages` - All channel messages
- `team_members` - Team member info
- `personality_profile` - Your communication style
- `response_log` - All generated responses

## Project Structure

```
slack-personality-bot/
├── src/
│   ├── index.js                    # Main entry point
│   ├── trainer.js                  # Training script
│   ├── config/
│   │   └── slack.js                # Configuration
│   ├── bot/
│   │   ├── slackBot.js             # Slack app setup
│   │   └── messageHandler.js       # Message processing
│   ├── ai/
│   │   ├── personalityAnalyzer.js  # Style analysis
│   │   ├── responseGenerator.js    # Response generation
│   │   └── promptBuilder.js        # Prompt engineering
│   ├── database/
│   │   ├── db.js                   # Database connection
│   │   └── messageStore.js         # Data operations
│   └── utils/
│       ├── styleExtractor.js       # Pattern extraction
│       └── contextBuilder.js       # Context management
├── data/
│   └── messages.db                 # SQLite database
├── package.json
├── .env                            # Configuration (DO NOT COMMIT)
├── .env.example                    # Template
└── README.md
```

## Troubleshooting

### Bot not receiving messages

- Check Socket Mode is enabled in Slack app settings
- Verify `SLACK_APP_TOKEN` is correct
- Ensure bot is invited to the channel: `/invite @Personality Bot`

### No personality profile

- Run `npm run train` first
- Check that `YOUR_USER_ID` matches your actual Slack user ID
- Verify you have messages in the target channel

### OpenAI errors

- Verify `OPENAI_API_KEY` is valid
- Check you have API credits available
- Ensure you have access to GPT-4o-mini model

### Database errors

- Delete `data/messages.db` and run `npm run train` again
- Check file permissions on `data/` directory

## Safety Features

- ✅ All data stored locally
- ✅ Manual review for uncertain responses
- ✅ Audit log of all generated messages
- ✅ Easy pause/resume (Ctrl+C to stop)
- ✅ No data sent to third parties except OpenAI

## Future Enhancements

- Web dashboard for monitoring
- Fine-tuned model for better accuracy
- Multi-channel support
- Sentiment analysis
- Calendar integration
- Feedback learning

## License

MIT

## Support

For issues or questions, check the logs and database for debugging information.
