import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';
import { eodDetector } from './src/utils/eodDetector.js';
import { responseGenerator } from './src/ai/responseGenerator.js';
import { config } from './src/config/slack.js';

dotenv.config();

const client = new WebClient(config.slack.botToken);

async function sendFollowUps(hoursBack = 7) {
  console.log(`\n🔍 Processing EOD updates from the last ${hoursBack} hours...\n`);
  
  const now = Date.now() / 1000;
  const oldestTimestamp = now - (hoursBack * 3600);
  
  try {
    const result = await client.conversations.history({
      channel: config.target.channelId,
      oldest: oldestTimestamp.toString(),
      limit: 100,
    });

    const messages = result.messages || [];
    console.log(`Found ${messages.length} total messages\n`);
    
    const eodUpdates = messages.filter(msg => {
      if (msg.user === config.target.userId) return false;
      if (msg.bot_id || msg.subtype === 'bot_message') return false;
      if (!msg.text) return false;
      
      return eodDetector.isEndOfDayUpdate(msg.text);
    });

    console.log(`Found ${eodUpdates.length} EOD updates\n`);
    console.log('='.repeat(60));

    let sentCount = 0;

    for (const update of eodUpdates.reverse()) {
      const userInfo = await client.users.info({ user: update.user });
      const userName = userInfo.user.profile?.display_name || userInfo.user.name;
      
      console.log(`\n📊 EOD Update from: ${userName}`);
      console.log(`   Time: ${new Date(parseFloat(update.ts) * 1000).toLocaleString()}`);
      
      const components = eodDetector.extractUpdateComponents(update.text);
      const analysis = eodDetector.analyzeCompleteness(components);
      
      console.log(`   Completeness: ${analysis.completenessScore}%`);
      console.log(`   Issues: ${analysis.issues.join(', ') || 'None'}`);
      
      if (analysis.issues.length > 0) {
        console.log(`   🤖 Generating follow-up...`);
        
        try {
          const result = await responseGenerator.generateResponse(update, userInfo.user);
          
          console.log(`   Response: "${result.response}"`);
          console.log(`   Confidence: ${result.confidence.toFixed(1)}%`);
          
          if (result.confidence >= config.bot.autoSendThreshold) {
            await client.chat.postMessage({
              channel: config.target.channelId,
              text: result.response,
              thread_ts: update.thread_ts || update.ts,
            });
            
            console.log(`   ✅ Sent!`);
            sentCount++;
            
            await new Promise(resolve => setTimeout(resolve, 3000));
          } else {
            console.log(`   ⏭️  Skipped (low confidence)`);
          }
        } catch (error) {
          console.log(`   ❌ Error: ${error.message}`);
        }
      } else {
        console.log(`   ✅ Update is complete, no follow-up needed`);
      }
      
      console.log('='.repeat(60));
    }
    
    console.log(`\n✅ Processed ${eodUpdates.length} updates, sent ${sentCount} follow-ups\n`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

const hoursBack = process.argv[2] ? parseInt(process.argv[2]) : 7;
sendFollowUps(hoursBack).then(() => process.exit(0));
