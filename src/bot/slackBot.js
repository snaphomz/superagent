import pkg from '@slack/bolt';
const { App } = pkg;
import { config } from '../config/slack.js';
import { messageHandler } from './messageHandler.js';
import { obiTeamMonitor } from '../monitors/obiTeamMonitor.js';
import { jibbleMonitor } from '../monitors/jibbleMonitor.js';

export function createSlackBot() {
  const app = new App({
    token: config.slack.botToken,
    appToken: config.slack.appToken,
    socketMode: true,
    signingSecret: config.slack.signingSecret,
  });

  app.message(async ({ message, client }) => {
    // Only allow Antony to use bot commands
    const ANTONY_USER_ID = config.target.userId;
    
    // Handle Jibble summary command
    if (message.text && message.text.trim().toLowerCase() === '!jibble summary') {
      // Check if user is Antony
      if (message.user !== ANTONY_USER_ID) {
        console.log(`⛔ Unauthorized command attempt by ${message.user}`);
        return;
      }
      
      try {
        const today = new Date().toISOString().split('T')[0];
        const summary = await jibbleMonitor.generateDailySummary(today);
        
        await client.chat.postMessage({
          channel: message.channel,
          text: summary,
        });
        return;
      } catch (error) {
        console.error('Error generating Jibble summary:', error);
        await client.chat.postMessage({
          channel: message.channel,
          text: '❌ Error generating Jibble attendance summary. Please try again.',
        });
        return;
      }
    }

    // Handle daily summary test command
    if (message.text && message.text.trim().toLowerCase() === '!daily summary') {
      // Check if user is Antony
      if (message.user !== ANTONY_USER_ID) {
        console.log(`⛔ Unauthorized command attempt by ${message.user}`);
        return;
      }
      
      try {
        console.log('🧪 Manual daily summary trigger detected');
        const { dailySummary } = await import('../scheduler/dailySummary.js');
        dailySummary.initialize(client);
        await dailySummary.sendDailySummary();
        
        await client.chat.postMessage({
          channel: message.channel,
          text: '✅ Daily summary sent! Check your DMs.',
        });
        return;
      } catch (error) {
        console.error('Error generating daily summary:', error);
        await client.chat.postMessage({
          channel: message.channel,
          text: '❌ Error generating daily summary. Please try again.',
        });
        return;
      }
    }

    // Handle Jibble status check command
    if (message.text && message.text.trim().toLowerCase() === '!jibble status') {
      // Check if user is Antony
      if (message.user !== ANTONY_USER_ID) {
        console.log(`⛔ Unauthorized command attempt by ${message.user}`);
        return;
      }
      
      try {
        const db = (await import('../database/postgres.js')).default;
        const result = await db.query('SELECT COUNT(*) as count, MIN(date) as first_date, MAX(date) as last_date FROM jibble_attendance');
        const count = result.rows[0].count;
        const firstDate = result.rows[0].first_date;
        const lastDate = result.rows[0].last_date;
        
        await client.chat.postMessage({
          channel: message.channel,
          text: `📊 Jibble Database Status:\n• Total records: ${count}\n• First record: ${firstDate || 'None'}\n• Last record: ${lastDate || 'None'}`,
        });
        return;
      } catch (error) {
        console.error('Error checking Jibble status:', error);
        await client.chat.postMessage({
          channel: message.channel,
          text: '❌ Error checking Jibble status.',
        });
        return;
      }
    }

    await messageHandler.handleMessage(message, client);
  });

  app.action('approve_response', async ({ body, ack, client }) => {
    await ack();
    await messageHandler.handleApproval(body, client);
  });

  app.action('reject_response', async ({ body, ack, client }) => {
    await ack();
    await messageHandler.handleApproval(body, client);
  });

  app.event('team_join', async ({ event, client }) => {
    try {
      const userInfo = await client.users.info({ user: event.user.id });
      await messageHandler.updateTeamMember(userInfo.user);
    } catch (error) {
      console.error('Error handling team_join:', error);
    }
  });

  return app;
}
