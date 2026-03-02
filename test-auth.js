import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';

dotenv.config();

console.log('\n🔍 Slack Authentication Diagnostics\n');
console.log('='.repeat(50));

const botToken = process.env.SLACK_BOT_TOKEN;
const appToken = process.env.SLACK_APP_TOKEN;
const signingSecret = process.env.SLACK_SIGNING_SECRET;

console.log('\n📋 Configuration Check:');
console.log(`  SLACK_BOT_TOKEN: ${botToken ? (botToken.substring(0, 9) + '...' + botToken.substring(botToken.length - 4)) : '❌ NOT SET'}`);
console.log(`  SLACK_APP_TOKEN: ${appToken ? (appToken.substring(0, 9) + '...' + appToken.substring(appToken.length - 4)) : '❌ NOT SET'}`);
console.log(`  SLACK_SIGNING_SECRET: ${signingSecret ? '✅ SET' : '❌ NOT SET'}`);

console.log('\n🔑 Token Format Check:');
if (botToken) {
  if (botToken.startsWith('xoxb-')) {
    console.log('  ✅ Bot token starts with xoxb-');
  } else {
    console.log('  ❌ Bot token should start with xoxb- but starts with:', botToken.substring(0, 5));
  }
  
  if (botToken.includes(' ')) {
    console.log('  ❌ Bot token contains spaces - remove them!');
  } else {
    console.log('  ✅ No spaces in bot token');
  }
} else {
  console.log('  ❌ Bot token is not set in .env file');
}

if (appToken) {
  if (appToken.startsWith('xapp-')) {
    console.log('  ✅ App token starts with xapp-');
  } else {
    console.log('  ❌ App token should start with xapp- but starts with:', appToken.substring(0, 5));
  }
} else {
  console.log('  ❌ App token is not set in .env file');
}

console.log('\n🧪 Testing Bot Token Authentication...');

if (!botToken) {
  console.log('❌ Cannot test - SLACK_BOT_TOKEN not set\n');
  process.exit(1);
}

const client = new WebClient(botToken);

try {
  const authTest = await client.auth.test();
  console.log('✅ Authentication successful!\n');
  console.log('Bot Info:');
  console.log(`  Bot User ID: ${authTest.user_id}`);
  console.log(`  Bot Name: ${authTest.user}`);
  console.log(`  Team: ${authTest.team}`);
  console.log(`  Team ID: ${authTest.team_id}`);
  
  console.log('\n🧪 Testing Channel Access...');
  const channelId = process.env.TARGET_CHANNEL_ID;
  
  if (channelId) {
    try {
      const channelInfo = await client.conversations.info({ channel: channelId });
      console.log(`✅ Can access channel: #${channelInfo.channel.name}`);
      
      if (!channelInfo.channel.is_member) {
        console.log('\n⚠️  WARNING: Bot is not a member of this channel!');
        console.log(`   Run this in Slack: /invite @${authTest.user} in channel #${channelInfo.channel.name}`);
      } else {
        console.log('✅ Bot is a member of the channel');
      }
    } catch (channelError) {
      console.log(`❌ Cannot access channel ${channelId}`);
      console.log(`   Error: ${channelError.message}`);
      console.log(`   Make sure to invite the bot: /invite @${authTest.user}`);
    }
  }
  
  console.log('\n✅ All checks passed! You can now run: npm run train\n');
  
} catch (error) {
  console.log('❌ Authentication failed!\n');
  console.log('Error:', error.message);
  console.log('\nPossible fixes:');
  console.log('1. Go to https://api.slack.com/apps');
  console.log('2. Select your app');
  console.log('3. Go to "OAuth & Permissions"');
  console.log('4. Copy the "Bot User OAuth Token" (starts with xoxb-)');
  console.log('5. Update SLACK_BOT_TOKEN in .env file');
  console.log('6. Make sure the app is installed to your workspace\n');
  process.exit(1);
}
