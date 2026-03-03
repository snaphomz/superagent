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
  scheduler: {
    morningCheckinTime: process.env.MORNING_CHECKIN_TIME || '09:00',
    validationTime: process.env.CHECKIN_VALIDATION_TIME || '10:00',
    codePushTime: process.env.CODE_PUSH_REMINDER_TIME || '17:30',
    dailySummaryTime: process.env.DAILY_SUMMARY_TIME || '23:30',
    timezone: process.env.CHECKIN_TIMEZONE || 'Asia/Kolkata',
    maxPingAttempts: parseInt(process.env.MAX_PING_ATTEMPTS || '3'),
    pingInterval: parseInt(process.env.PING_INTERVAL_MINUTES || '30'),
    programManagerId: process.env.PROGRAM_MANAGER_USER_ID,
    freelancerIds: (process.env.FREELANCER_USER_IDS || '').split(',').filter(Boolean),
    excludedUserIds: (process.env.EXCLUDED_USER_IDS || '').split(',').filter(Boolean),
    ericUserId: process.env.ERIC_USER_ID,
    pavanUserId: process.env.PAVAN_USER_ID,
  },
  obiTeam: {
    userId: process.env.OBI_TEAM_USER_ID || 'U08UA1N1FD5',
    externalChannelId: process.env.EXTERNAL_CHANNEL_ID || 'C08UM4WCYAZ',
    lookbackHours: parseInt(process.env.OBI_LOOKBACK_HOURS || '4'),
    ericUserId: process.env.ERIC_USER_ID || 'U09034VD8QG',
    pavanUserId: process.env.PAVAN_USER_ID || 'U09QRQLTBPT',
  },
};
