import pkg from '@slack/bolt';
const { App } = pkg;
import { config } from '../config/slack.js';
import { messageHandler } from './messageHandler.js';
import { obiTeamMonitor } from '../monitors/obiTeamMonitor.js';
import { jibbleMonitor } from '../monitors/jibbleMonitor.js';
import { strikeEvaluator } from '../scheduler/strikeEvaluator.js';
import { channelDigest } from '../ai/channelDigest.js';
import { todayIST } from '../utils/dateUtils.js';
import { feedbackCollector } from '../learning/feedbackCollector.js';
import { learningCommands } from '../learning/learningCommands.js';

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
        const today = todayIST();
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

    // Handle Jibble debug command — shows raw last 5 Jibble channel messages
    if (message.text && message.text.trim().toLowerCase() === '!jibble debug') {
      if (message.user !== ANTONY_USER_ID) return;
      try {
        const history = await client.conversations.history({
          channel: 'C09GDQ1RX7G',
          limit: 5,
        });
        const msgs = history.messages || [];
        let report = `🔍 *Last ${msgs.length} Jibble channel messages:*\n\n`;
        for (const m of msgs) {
          report += `• bot_id: \`${m.bot_id || 'none'}\`\n`;
          report += `  text: \`${(m.text || '').substring(0, 150)}\`\n`;
          if (m.blocks && m.blocks.length > 0) {
            const blockText = JSON.stringify(m.blocks).substring(0, 300);
            report += `  blocks: \`${blockText}\`\n`;
          }
          if (m.attachments && m.attachments.length > 0) {
            const attText = JSON.stringify(m.attachments[0]).substring(0, 300);
            report += `  attachments[0]: \`${attText}\`\n`;
          }
          report += `\n`;
        }
        await client.chat.postMessage({ channel: message.channel, text: report });
        return;
      } catch (error) {
        await client.chat.postMessage({ channel: message.channel, text: `❌ Error: ${error.message}` });
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

    // Handle !strikes command — Antony-only, DM response only
    if (message.text && message.text.trim().toLowerCase().startsWith('!strikes')) {
      if (message.user !== ANTONY_USER_ID) {
        // Silently ignore — no response to non-Antony
        return;
      }

      try {
        const parts = message.text.trim().split(/\s+/);
        const subCmd = parts[1]?.toLowerCase();

        // !strikes test — run evaluation immediately for today
        if (subCmd === 'test') {
          await client.chat.postMessage({
            channel: ANTONY_USER_ID,
            text: '⚡ Running strike evaluation now... check logs for details.',
          });
          strikeEvaluator.initialize(client);
          const today = todayIST();
          const allStrikes = await strikeEvaluator.evaluateDay(today);
          const todayStrikes = await strikeEvaluator.getTodayStrikes(today);
          const weeklyData = await strikeEvaluator.getWeeklyStrikeSummary();

          let report = `⚡ *Strike Evaluation Results — ${today}*\n\n`;
          if (todayStrikes.length === 0) {
            report += '✅ No strikes recorded today.\n';
          } else {
            const byUser = {};
            for (const row of todayStrikes) {
              if (!byUser[row.user_id]) byUser[row.user_id] = { name: row.display_name || row.real_name || row.user_id, strikes: [] };
              byUser[row.user_id].strikes.push(`${row.strike_type}: ${row.details || ''}`);
            }
            for (const { name, strikes } of Object.values(byUser)) {
              report += `• *${name}*: ${strikes.length} strike${strikes.length > 1 ? 's' : ''}\n`;
              strikes.forEach(s => { report += `  _${s}_\n`; });
            }
          }

          if (weeklyData.length > 0) {
            report += '\n*Weekly Totals:*\n';
            for (const row of weeklyData) {
              const name = row.display_name || row.real_name || row.user_id;
              const flag = row.escalated ? ' ⚠️ ESCALATED' : '';
              report += `• ${name}: ${row.total_strikes} strike${row.total_strikes !== 1 ? 's' : ''}${flag}\n`;
            }
          }

          await client.chat.postMessage({ channel: ANTONY_USER_ID, text: report });
          return;
        }

        // !strikes @user — history for specific user
        const mentionMatch = message.text.match(/<@([A-Z0-9]+)>/);
        if (mentionMatch) {
          const targetUserId = mentionMatch[1];
          const history = await strikeEvaluator.getUserStrikeHistory(targetUserId, 30);
          let report = `⚡ *Strike History for <@${targetUserId}> (last 30 days)*\n\n`;
          if (history.length === 0) {
            report += '✅ No strikes on record.';
          } else {
            for (const row of history) {
              report += `• ${row.strike_date}: *${row.strike_type}* — ${row.details || ''}\n`;
            }
          }
          await client.chat.postMessage({ channel: ANTONY_USER_ID, text: report });
          return;
        }

        // !strikes — weekly leaderboard
        strikeEvaluator.initialize(client);
        const weeklyData = await strikeEvaluator.getWeeklyStrikeSummary();
        let report = `⚡ *Weekly Strike Report*\n\n`;
        if (weeklyData.length === 0) {
          report += '✅ No strike data for this week yet.';
        } else {
          for (const row of weeklyData) {
            const name = row.display_name || row.real_name || row.user_id;
            const breakdown = row.strike_breakdown ? JSON.parse(row.strike_breakdown) : {};
            const bStr = Object.entries(breakdown).map(([t, c]) => `${t}: ${c}`).join(', ');
            const flag = row.escalated ? ' ⚠️ *ESCALATED*' : '';
            report += `• *${name}*: ${row.total_strikes} strike${row.total_strikes !== 1 ? 's' : ''}${flag}`;
          }
        }
        
        await client.chat.postMessage({ channel: ANTONY_USER_ID, text: report });
        return;
      } catch (error) {
        console.error('Error handling !strikes weekly command:', error);
        await client.chat.postMessage({
          channel: ANTONY_USER_ID,
          text: '❌ Error generating weekly strike report.',
        });
        return;
      }
    }

    // Handle learning commands
    if (message.text && message.text.trim().toLowerCase().startsWith('!learning')) {
      if (message.user !== ANTONY_USER_ID) {
        console.log(`⛔ Unauthorized learning command by ${message.user}`);
        return;
      }

      const parts = message.text.trim().split(/\s+/);
      const subCmd = parts[1]?.toLowerCase();

      try {
        if (subCmd === 'insights') {
          await learningCommands.handleLearningInsights(client, message.channel);
        } else if (subCmd === 'patterns') {
          const patternType = parts[2] || 'all';
          await learningCommands.handlePatternDetails(client, message.channel, patternType);
        } else if (subCmd === 'feedback') {
          const hours = parseInt(parts[2]) || 24;
          await learningCommands.handleRecentFeedback(client, message.channel, hours);
        } else {
          await client.chat.postMessage({
            channel: message.channel,
            text: `📚 *Learning Commands:*\n• \`!learning insights\` - View learning insights report\n• \`!learning patterns [type]\` - View pattern details\n• \`!learning feedback [hours]\` - View recent feedback\n\nPattern types: all, style_pattern, eod_template, question_template`,
          });
        }
      } catch (error) {
        console.error('Error handling learning command:', error);
        await client.chat.postMessage({
          channel: message.channel,
          text: '❌ Error processing learning command.',
        });
      }
      return;
    }

    // Handle !digest command — Antony-only, triggers today's channel digest
    if (message.text && message.text.trim().toLowerCase() === '!digest') {
      if (message.user !== ANTONY_USER_ID) {
        return;
      }

      try {
        const today = todayIST();
        await client.chat.postMessage({
          channel: ANTONY_USER_ID,
          text: '📰 Generating channel digests now...',
        });

        const targetDigest = await channelDigest.generateAndSaveDigest(config.target.channelId, today, client);
        const obiDigest = await channelDigest.generateAndSaveDigest('C08UM4WCYAZ', today, client);

        let report = `📰 *Channel Digest — ${today}*\n\n`;

        report += `*Target Channel (<#${config.target.channelId}>):*\n`;
        if (targetDigest) {
          report += `Summary: ${targetDigest.raw_summary || 'N/A'}\n`;
          if (targetDigest.topics?.length) report += `Topics: ${targetDigest.topics.join(', ')}\n`;
          if (targetDigest.open_questions?.length) report += `Open: ${targetDigest.open_questions.join('; ')}\n`;
        } else {
          report += '_No messages today_\n';
        }

        report += `\n*OBI Channel:*\n`;
        if (obiDigest) {
          report += `Summary: ${obiDigest.raw_summary || 'N/A'}\n`;
          if (obiDigest.topics?.length) report += `Topics: ${obiDigest.topics.join(', ')}\n`;
          if (obiDigest.open_questions?.length) report += `Open: ${obiDigest.open_questions.join('; ')}\n`;
        } else {
          report += '_No messages today_\n';
        }

        await client.chat.postMessage({ channel: ANTONY_USER_ID, text: report });
      } catch (error) {
        console.error('Error handling !digest command:', error);
        await client.chat.postMessage({
          channel: ANTONY_USER_ID,
          text: `❌ Error generating digest: ${error.message}`,
        });
      }
      return;
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

  // Track reactions to bot messages for learning
  app.event('reaction_added', async ({ event, client }) => {
    try {
      await feedbackCollector.trackReaction(event, client);
    } catch (error) {
      console.error('Error tracking reaction:', error);
    }
  });

  app.event('reaction_removed', async ({ event, client }) => {
    try {
      // Track negative feedback when reactions are removed
      event.reaction = event.reaction;
      event.item = event.item;
      // Treat as negative feedback
      if (event.reaction === 'thumbsup') {
        await feedbackCollector.trackReaction({
          ...event,
          reaction: 'thumbsdown',
          user: event.user
        }, client);
      }
    } catch (error) {
      console.error('Error tracking reaction removal:', error);
    }
  });

  return app;
}
