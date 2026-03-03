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

    // Handle ClickUp commands
    if (message.text && message.text.trim().toLowerCase().startsWith('!clickup')) {
      // Check if user is Antony
      if (message.user !== ANTONY_USER_ID) {
        console.log(`⛔ Unauthorized command attempt by ${message.user}`);
        return;
      }

      const { clickupClient } = await import('../integrations/clickupClient.js');
      const { clickupMonitor } = await import('../monitors/clickupMonitor.js');
      const parts = message.text.trim().split(' ');
      const command = parts[1]?.toLowerCase();

      try {
        if (!clickupClient.getAccessToken()) {
          await client.chat.postMessage({
            channel: message.channel,
            text: '❌ ClickUp not authorized yet. Please visit the authorization URL first.',
          });
          return;
        }

        if (command === 'workspaces') {
          const workspaces = await clickupClient.getAuthorizedWorkspaces();
          const workspaceList = workspaces.map(w => `• ${w.name} (ID: ${w.id})`).join('\n');
          
          await client.chat.postMessage({
            channel: message.channel,
            text: `📋 *Your ClickUp Workspaces:*\n\n${workspaceList}\n\nUse \`!clickup spaces <workspace_id>\` to see spaces in a workspace.`,
          });
          return;
        }

        if (command === 'spaces' && parts[2]) {
          const workspaceId = parts[2];
          const spaces = await clickupClient.getSpaces(workspaceId);
          const spaceList = spaces.map(s => `• ${s.name} (ID: ${s.id})`).join('\n');
          
          await client.chat.postMessage({
            channel: message.channel,
            text: `📋 *Spaces in Workspace:*\n\n${spaceList}`,
          });
          return;
        }

        if (command === 'setlist' && parts[2]) {
          const listId = parts[2];
          clickupMonitor.setListId(listId);
          
          await client.chat.postMessage({
            channel: message.channel,
            text: `✅ ClickUp list configured: ${listId}\n\nThe bot will now monitor tasks in this list and post updates to this channel.`,
          });
          return;
        }

        if (command === 'tasks') {
          const listId = clickupMonitor.getListId();
          if (!listId) {
            await client.chat.postMessage({
              channel: message.channel,
              text: '❌ No list configured. Use `!clickup setlist <list_id>` first.',
            });
            return;
          }

          const tasksByAssignee = await clickupMonitor.getTasksByAssignee(listId);
          let response = '📋 *Current Tasks by Assignee:*\n\n';
          
          for (const [assignee, tasks] of Object.entries(tasksByAssignee)) {
            response += `*${assignee}:*\n`;
            tasks.forEach(task => {
              response += `  • ${task.status} - ${task.name}${task.dueDate ? ` (Due: ${task.dueDate})` : ''}\n`;
            });
            response += '\n';
          }

          await client.chat.postMessage({
            channel: message.channel,
            text: response,
          });
          return;
        }

        // Show help if command not recognized
        await client.chat.postMessage({
          channel: message.channel,
          text: `📋 *ClickUp Commands:*\n\n• \`!clickup workspaces\` - List your workspaces\n• \`!clickup spaces <workspace_id>\` - List spaces in a workspace\n• \`!clickup setlist <list_id>\` - Configure which list to monitor\n• \`!clickup tasks\` - Show current tasks by assignee`,
        });
        return;
      } catch (error) {
        console.error('Error handling ClickUp command:', error);
        await client.chat.postMessage({
          channel: message.channel,
          text: `❌ Error: ${error.message}`,
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
