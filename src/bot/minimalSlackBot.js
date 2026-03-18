import { App } from '@slack/bolt';
import { config } from './config/slack.js';
import { WebClient } from '@slack/web-api';

export function createMinimalSlackBot() {
  const app = new App({
    token: config.slack.botToken,
    appToken: config.slack.appToken,
    socketMode: true,
    signingSecret: config.slack.signingSecret,
  });

  // Simple message handler for EOD responses
  app.message(async ({ message, client }) => {
    console.log(`📨 Message received: "${message.text}" from user ${message.user} in channel ${message.channel}`);
    
    // Only process messages from target channel
    if (message.channel !== config.target.channelId) {
      return;
    }
    
    // Check if this looks like an EOD update
    const text = message.text.toLowerCase();
    const isEODUpdate = text.includes('purpose') && text.includes('process') && text.includes('payoff');
    
    if (isEODUpdate) {
      console.log(`✅ EOD update detected from ${message.user}`);
      
      try {
        // React with ✅ to acknowledge
        await client.reactions.add({
          channel: message.channel,
          timestamp: message.ts,
          name: 'white_check_mark',
        });
        
        // Send a quick acknowledgment
        await client.chat.postMessage({
          channel: message.channel,
          text: `✅ Thanks for the EOD update, <@${message.user}>! 🙏`,
          thread_ts: message.ts,
        });
        
      } catch (error) {
        console.error('Error responding to EOD update:', error);
      }
    }
  });

  return app;
}
