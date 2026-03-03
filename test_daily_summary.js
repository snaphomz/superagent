import { createSlackBot } from './src/bot/slackBot.js';
import { dailySummary } from './src/scheduler/dailySummary.js';
import { config } from './src/config/slack.js';
import db from './src/database/db.js';

async function testDailySummary() {
  try {
    console.log('🧪 Testing Daily Summary Generation...\n');
    
    // Initialize Slack bot
    console.log('🔌 Connecting to Slack...');
    const app = createSlackBot();
    await app.start();
    console.log('✅ Connected to Slack\n');
    
    // Initialize daily summary with client
    const client = app.client;
    dailySummary.initialize(client);
    
    console.log('📊 Generating and sending daily summary to Antony...\n');
    
    // Send summary immediately
    await dailySummary.sendDailySummary();
    
    console.log('\n✅ Daily summary sent successfully!');
    console.log('📬 Check your Slack DMs for the summary\n');
    
    // Close connections
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error testing daily summary:', error);
    process.exit(1);
  }
}

testDailySummary();
