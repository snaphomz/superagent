import { WebClient } from '@slack/web-api';
import { config } from './config/slack.js';
import { messageStore } from './database/messageStore.js';
import { personalityAnalyzer } from './ai/personalityAnalyzer.js';
import db from './database/db.js';

const client = new WebClient(config.slack.botToken);

async function fetchChannelHistory() {
  console.log('📥 Fetching channel history...\n');
  
  let allMessages = [];
  let cursor = null;
  let pageCount = 0;

  try {
    do {
      const result = await client.conversations.history({
        channel: config.target.channelId,
        limit: 200,
        cursor: cursor,
      });

      const messages = result.messages || [];
      allMessages = allMessages.concat(messages);
      cursor = result.response_metadata?.next_cursor;
      pageCount++;

      console.log(`  Fetched page ${pageCount}: ${messages.length} messages`);

      if (cursor) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } while (cursor);

    console.log(`\n✅ Total messages fetched: ${allMessages.length}\n`);
    return allMessages;
  } catch (error) {
    console.error('Error fetching channel history:', error);
    throw error;
  }
}

async function saveMessages(messages) {
  console.log('💾 Saving messages to database...\n');
  
  let savedCount = 0;
  let userMessageCount = 0;
  const userIds = new Set();

  for (const message of messages) {
    if (message.type !== 'message' || message.subtype === 'channel_join') {
      continue;
    }

    const isUserMessage = message.user === config.target.userId;
    
    try {
      await messageStore.saveMessage({
        ts: message.ts,
        client_msg_id: message.client_msg_id,
        user: message.user,
        channel: config.target.channelId,
        text: message.text || '',
        thread_ts: message.thread_ts,
        is_user_message: isUserMessage,
      });

      savedCount++;
      if (isUserMessage) {
        userMessageCount++;
      }
      
      if (message.user) {
        userIds.add(message.user);
      }
    } catch (error) {
      console.error(`Error saving message ${message.ts}:`, error.message);
    }
  }

  console.log(`✅ Saved ${savedCount} messages`);
  console.log(`  Your messages: ${userMessageCount}`);
  console.log(`  Other messages: ${savedCount - userMessageCount}`);
  console.log(`  Unique users: ${userIds.size}\n`);

  return { savedCount, userMessageCount, userIds };
}

async function fetchAndSaveTeamMembers(userIds) {
  console.log('👥 Fetching team member information...\n');
  
  let fetchedCount = 0;

  for (const userId of userIds) {
    try {
      const userInfo = await client.users.info({ user: userId });
      
      await messageStore.saveTeamMember(userInfo.user);
      
      console.log(`  ✓ ${userInfo.user.profile?.display_name || userInfo.user.name}`);
      fetchedCount++;

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error fetching user ${userId}:`, error.message);
    }
  }

  console.log(`\n✅ Saved ${fetchedCount} team members\n`);
}

async function main() {
  console.log('🎓 Slack Personality Bot - Training Mode\n');
  console.log('='.repeat(50));
  console.log(`Target Channel: ${config.target.channelId}`);
  console.log(`Your User ID: ${config.target.userId}`);
  console.log('='.repeat(50));
  console.log('\n');

  try {
    const messages = await fetchChannelHistory();
    
    const { userIds } = await saveMessages(messages);
    
    await fetchAndSaveTeamMembers(userIds);
    
    console.log('🧠 Analyzing your communication style...\n');
    await personalityAnalyzer.analyzeAndSaveProfile();
    
    console.log('\n✅ Training complete!\n');
    console.log('You can now start the bot with: npm start\n');
  } catch (error) {
    console.error('\n❌ Training failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    if (db && typeof db.end === 'function') {
      db.end((err) => {
        if (err) {
          console.error('Error closing database:', err);
        }
        process.exit(0);
      });
    } else if (db && typeof db.close === 'function') {
      db.close((err) => {
        if (err) {
          console.error('Error closing database:', err);
        }
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  }
}

main();
