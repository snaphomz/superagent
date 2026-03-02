import dotenv from 'dotenv';

dotenv.config();

export const config = {
  slack: {
    botToken: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  },
  target: {
    channelId: process.env.TARGET_CHANNEL_ID,
    userId: process.env.YOUR_USER_ID,
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
  },
  bot: {
    autoSendThreshold: parseInt(process.env.AUTO_SEND_THRESHOLD || '85'),
    responseDelay: parseInt(process.env.RESPONSE_DELAY_SECONDS || '3'),
    maxContextMessages: parseInt(process.env.MAX_CONTEXT_MESSAGES || '20'),
  },
  database: {
    path: process.env.DB_PATH || './data/messages.db',
  },
};
