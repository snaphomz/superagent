import { createSlackBot } from './bot/slackBot.js';
import { personalityAnalyzer } from './ai/personalityAnalyzer.js';
import { config } from './config/slack.js';
import db from './database/db.js';
import { dailyCheckin } from './scheduler/dailyCheckin.js';
import { checkinValidator } from './scheduler/checkinValidator.js';
import { codePushReminder } from './scheduler/codePushReminder.js';
import { eodSummary } from './scheduler/eodSummary.js';
import { hydrationReminder } from './scheduler/hydrationReminder.js';
import { dailySummary } from './scheduler/dailySummary.js';
import http from 'http';

let healthCheckServer;

async function main() {
  console.log('🚀 Starting Slack Personality Bot...\n');

  // Create and start HTTP health check server FIRST for Fly.io
  const PORT = process.env.PORT || 8080;
  
  healthCheckServer = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ 
        status: 'healthy', 
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }));
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  // Start health check server and wait for it to be ready
  await new Promise((resolve) => {
    healthCheckServer.listen(PORT, '0.0.0.0', () => {
      console.log(`✅ Health check server listening on 0.0.0.0:${PORT}`);
      console.log(`   This keeps Fly.io machines alive 24/7\n`);
      resolve();
    });
  });

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
  console.log('📅 Initializing schedulers...');
  const client = app.client;
  dailyCheckin.initialize(client);
  checkinValidator.initialize(client);
  codePushReminder.initialize(client);
  eodSummary.initialize(client);
  hydrationReminder.initialize(client);
  dailySummary.initialize(client);
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
  dailySummary.stop();
  console.log('✅ Schedulers stopped');
  
  // Close health check server
  if (healthCheckServer) {
    healthCheckServer.close(() => {
      console.log('✅ Health check server stopped');
    });
  }
  
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database closed');
    }
    process.exit(0);
  });
});
