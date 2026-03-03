import { createSlackBot } from './bot/slackBot.js';
import { personalityAnalyzer } from './ai/personalityAnalyzer.js';
import { config } from './config/slack.js';
import db from './database/db.js';
import { dailyCheckin } from './scheduler/dailyCheckin.js';
import { checkinValidator } from './scheduler/checkinValidator.js';
import { codePushReminder } from './scheduler/codePushReminder.js';
import { eodSummary } from './scheduler/eodSummary.js';
import { hydrationReminder } from './scheduler/hydrationReminder.js';

async function main() {
  console.log('🚀 Starting Slack Personality Bot...\n');

  console.log('Configuration:');
  console.log(`  Target Channel: ${config.target.channelId}`);
  console.log(`  Your User ID: ${config.target.userId}`);
  console.log(`  AI Model: ${config.openai.model}`);
  console.log(`  Auto-send Threshold: ${config.bot.autoSendThreshold}%`);
  console.log(`  Response Delay: ${config.bot.responseDelay}s\n`);

  console.log('📊 Loading personality profile...');
  const profile = await personalityAnalyzer.getOrCreateProfile();
  
  if (profile) {
    console.log('✅ Personality profile loaded\n');
  } else {
    console.log('⚠️  No personality profile found. Run trainer first or it will be created as messages are collected.\n');
  }

  console.log('🔌 Connecting to Slack...');
  const app = createSlackBot();

  await app.start();
  console.log('✅ Bot is running!\n');
  console.log(`👀 Monitoring channel ${config.target.channelId} for messages...`);
  console.log(`💬 Auto-sending responses with >${config.bot.autoSendThreshold}% confidence`);
  console.log(`📨 Low-confidence responses will be sent to you for review\n`);

  // Initialize schedulers
  console.log('📅 Initializing daily check-in schedulers...');
  const client = app.client;
  dailyCheckin.initialize(client);
  checkinValidator.initialize(client);
  codePushRe.initialize(client);
  hydrationReminderminder.initialize(client);
  eodSummary.initialize(client);
  console.log('✅ Schedulers initialized\n');

  console.log('Press Ctrl+C to stop\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down bot...');
  
  // Stop schedulers
  dailyCheckin.stop();
  checkinValidator.stop();
  codePushReminder.stop();
  hydrationReminder.stop();
  console.log('✅ Schedulers stopped');
  
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database closed');
    }
    process.exit(0);
  });
});
