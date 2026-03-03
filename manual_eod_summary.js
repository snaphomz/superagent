import pkg from '@slack/web-api';
const { WebClient } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const TARGET_CHANNEL = process.env.TARGET_CHANNEL_ID;
const ANTONY_ID = process.env.YOUR_USER_ID;
const PHANI_ID = 'U09KQK8V7ST';

async function generateManualEODSummary() {
  try {
    console.log('📊 Generating manual EOD summary from today\'s messages...\n');
    
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0)).getTime() / 1000;
    
    // Fetch today's messages from target channel
    const result = await client.conversations.history({
      channel: TARGET_CHANNEL,
      oldest: startOfDay.toString(),
      limit: 1000
    });
    
    console.log(`Found ${result.messages.length} messages from today\n`);
    
    // Filter for EOD-like updates (messages with substantial content)
    const eodUpdates = result.messages.filter(msg => 
      msg.text && 
      msg.text.length > 50 && 
      !msg.bot_id &&
      msg.user !== ANTONY_ID &&
      !msg.text.startsWith('!') // Exclude commands
    ).reverse(); // Chronological order
    
    console.log(`Found ${eodUpdates.length} potential EOD updates\n`);
    
    // Get user info for all users
    const userIds = [...new Set(eodUpdates.map(m => m.user))];
    const userInfo = {};
    
    for (const userId of userIds) {
      try {
        const info = await client.users.info({ user: userId });
        userInfo[userId] = info.user.real_name || info.user.name;
      } catch (error) {
        userInfo[userId] = userId;
      }
    }
    
    // Build summary blocks
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📊 Daily Summary - ${new Date().toISOString().split('T')[0]}`,
          emoji: true
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*⏰ Jibble Attendance Report*\n0 team members tracked`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🚀 OBI Team Channel Summary*\nNo OBI Team activity today`
        }
      },
      {
        type: 'divider'
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*📝 EOD Updates & Action Items*\n${eodUpdates.length} team members provided updates`
        }
      }
    ];
    
    // Add each EOD update
    for (const update of eodUpdates) {
      const userName = userInfo[update.user];
      const timestamp = new Date(parseFloat(update.ts) * 1000).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Kolkata'
      });
      
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${userName}* (${timestamp})\n${update.text.substring(0, 500)}${update.text.length > 500 ? '...' : ''}`
        }
      });
    }
    
    blocks.push({
      type: 'divider'
    });
    
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Generated at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })} IST`
        }
      ]
    });
    
    // Send to Phani
    console.log(`📤 Sending to Phani Kumar (${PHANI_ID})...`);
    await client.chat.postMessage({
      channel: PHANI_ID,
      text: `Daily Summary - ${new Date().toISOString().split('T')[0]}`,
      blocks: blocks
    });
    console.log('✅ Sent to Phani Kumar');
    
    // Send to Antony
    console.log(`📤 Sending to Antony (${ANTONY_ID})...`);
    await client.chat.postMessage({
      channel: ANTONY_ID,
      text: `Daily Summary - ${new Date().toISOString().split('T')[0]}`,
      blocks: blocks
    });
    console.log('✅ Sent to Antony');
    
    console.log('\n✅ Manual EOD summary sent successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

generateManualEODSummary();
