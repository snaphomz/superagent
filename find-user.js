import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';

dotenv.config();

const client = new WebClient(process.env.SLACK_BOT_TOKEN);
const channelId = process.env.TARGET_CHANNEL_ID;

console.log('\n🔍 Finding users in channel...\n');

try {
  const result = await client.conversations.history({
    channel: channelId,
    limit: 100,
  });

  const userMessages = {};
  
  result.messages.forEach(msg => {
    if (msg.user && msg.text) {
      if (!userMessages[msg.user]) {
        userMessages[msg.user] = {
          count: 0,
          samples: [],
        };
      }
      userMessages[msg.user].count++;
      if (userMessages[msg.user].samples.length < 2) {
        userMessages[msg.user].samples.push(msg.text.substring(0, 60));
      }
    }
  });

  console.log('Users found in channel (with message counts):\n');
  
  for (const [userId, data] of Object.entries(userMessages).sort((a, b) => b[1].count - a[1].count)) {
    try {
      const userInfo = await client.users.info({ user: userId });
      const displayName = userInfo.user.profile?.display_name || userInfo.user.name || userInfo.user.real_name;
      
      console.log(`User ID: ${userId}`);
      console.log(`  Name: ${displayName}`);
      console.log(`  Real Name: ${userInfo.user.real_name || 'N/A'}`);
      console.log(`  Messages: ${data.count}`);
      console.log(`  Sample: "${data.samples[0]}..."`);
      console.log('');
    } catch (err) {
      console.log(`User ID: ${userId} (${data.count} messages) - Could not fetch user info`);
    }
  }
  
  console.log(`\nCurrent YOUR_USER_ID in .env: ${process.env.YOUR_USER_ID}`);
  console.log('\nIf your user ID is different, update YOUR_USER_ID in .env and run npm run train again.\n');
  
} catch (error) {
  console.error('Error:', error.message);
}
