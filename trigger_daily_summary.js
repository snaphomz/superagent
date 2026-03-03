import pkg from '@slack/web-api';
const { WebClient } = pkg;
import dotenv from 'dotenv';
import { dailySummary } from './src/scheduler/dailySummary.js';

dotenv.config();

const client = new WebClient(process.env.SLACK_BOT_TOKEN);

async function triggerDailySummary() {
  try {
    console.log('🚀 Manually triggering daily summary...\n');
    
    // Initialize the daily summary with the Slack client
    dailySummary.initialize(client);
    
    // Send the daily summary
    await dailySummary.sendDailySummary();
    
    console.log('\n✅ Daily summary sent successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error sending daily summary:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

triggerDailySummary();
