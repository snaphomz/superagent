import cron from 'node-cron';
import { config } from '../config/slack.js';
import { jibbleMonitor } from '../monitors/jibbleMonitor.js';
import { obiTeamMonitor } from '../monitors/obiTeamMonitor.js';
import { eodSummary } from './eodSummary.js';
import db from '../database/postgres.js';

let dailySummaryJob = null;
let slackClient = null;

// Recipients
const PHANI_KUMAR_ID = 'U09KQK8V7ST';
const ANTONY_ID = config.target.userId;

export const dailySummary = {
  initialize(client) {
    slackClient = client;
    this.scheduleDailySummary();
    console.log('📊 Daily summary scheduler initialized');
  },

  scheduleDailySummary() {
    // Check for EOD updates every 30 minutes starting at 6 PM
    dailySummaryJob = cron.schedule(
      '*/30 18-23 * * *',
      async () => {
        await this.checkAndSendSummary();
      },
      {
        scheduled: true,
        timezone: config.scheduler.timezone,
      }
    );
  },

  async checkAndSendSummary() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Check if all required members have submitted EOD updates
      const allUpdatesComplete = await this.verifyAllEODUpdates(today);
      
      if (allUpdatesComplete) {
        console.log('✅ All EOD updates complete - sending daily summary');
        await this.sendDailySummary();
        // Stop checking for today
        if (dailySummaryJob) {
          dailySummaryJob.stop();
          // Reschedule for tomorrow
          this.scheduleDailySummary();
        }
      } else {
        console.log('⏳ Waiting for all EOD updates to complete...');
      }
    } catch (error) {
      console.error('❌ Error checking EOD updates:', error);
    }
  },

  async verifyAllEODUpdates(date) {
    try {
      // Get all team members who should submit EOD updates
      const query = `
        SELECT user_id, display_name, real_name
        FROM team_members
        WHERE exempt_from_eod = 0
      `;
      
      const result = await db.query(query);
      const requiredMembers = result.rows;
      
      if (requiredMembers.length === 0) {
        console.log('⚠️ No team members require EOD updates');
        return true;
      }
      
      // Check who has submitted EOD updates today
      const eodQuery = `
        SELECT user_id
        FROM daily_checkins
        WHERE date = $1
          AND morning_response_text IS NOT NULL
          AND morning_response_text != ''
      `;
      
      const eodResult = await db.query(eodQuery, [date]);
      const submittedUserIds = eodResult.rows.map(r => r.user_id);
      
      // Find who hasn't submitted
      const missingUpdates = requiredMembers.filter(
        member => !submittedUserIds.includes(member.user_id)
      );
      
      if (missingUpdates.length > 0) {
        console.log(`⏳ Missing EOD updates from ${missingUpdates.length} members:`);
        missingUpdates.forEach(member => {
          const name = member.display_name || member.real_name || member.user_id;
          console.log(`   - ${name}`);
        });
        return false;
      }
      
      console.log(`✅ All ${requiredMembers.length} team members have submitted EOD updates`);
      return true;
    } catch (error) {
      console.error('Error verifying EOD updates:', error);
      // If there's an error, send summary anyway to avoid blocking
      return true;
    }
  },

  async sendDailySummary() {
    try {
      console.log('📊 Generating daily summary...');
      
      const today = new Date().toISOString().split('T')[0];
      
      // Generate all sections
      const jibbleReport = await this.generateJibbleSection(today);
      const obiReport = await this.generateOBISection(today);
      const eodReport = await this.generateEODSection(today);
      
      // Build Slack blocks with collapsible sections
      const blocks = this.buildSummaryBlocks(today, jibbleReport, obiReport, eodReport);
      
      // Send to Phani Kumar
      await slackClient.chat.postMessage({
        channel: PHANI_KUMAR_ID,
        text: `Daily Summary - ${today}`,
        blocks: blocks,
      });
      
      // Send to Antony
      await slackClient.chat.postMessage({
        channel: ANTONY_ID,
        text: `Daily Summary - ${today}`,
        blocks: blocks,
      });
      
      console.log('✅ Daily summary sent to Phani Kumar and Antony');
    } catch (error) {
      console.error('❌ Error sending daily summary:', error);
    }
  },

  async generateJibbleSection(date) {
    try {
      const summary = await jibbleMonitor.getWorkHoursSummary(date);
      
      const sections = [];
      
      for (const [userName, data] of Object.entries(summary)) {
        const clockInTime = data.first_clock_in 
          ? new Date(data.first_clock_in).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Kolkata'
            })
          : 'N/A';
        
        const clockOutTime = data.last_clock_out
          ? new Date(data.last_clock_out).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'Asia/Kolkata'
            })
          : 'Still working';
        
        const status = data.status === 'clocked_in' ? '🟢 Working' : '⚪ Clocked Out';
        
        sections.push({
          user: userName,
          clockIn: clockInTime,
          clockOut: clockOutTime,
          hours: data.total_work_hours,
          breaks: data.total_break_minutes,
          status: status
        });
      }
      
      return sections;
    } catch (error) {
      console.error('Error generating Jibble section:', error);
      return [];
    }
  },

  async generateOBISection(date) {
    try {
      // Get OBI channel messages for the day
      const query = `
        SELECT * FROM messages
        WHERE channel_id = 'C08UM4WCYAZ'
          AND DATE(timestamp::timestamp) = $1
        ORDER BY timestamp ASC
      `;
      
      const result = await db.query(query, [date]);
      const messages = result.rows;
      
      if (messages.length === 0) {
        return { summary: 'No OBI Team activity today', items: [] };
      }
      
      // Group messages by topic/thread
      const conversations = await this.groupOBIConversations(messages);
      
      return conversations;
    } catch (error) {
      console.error('Error generating OBI section:', error);
      return { summary: 'Error fetching OBI updates', items: [] };
    }
  },

  async groupOBIConversations(messages) {
    // Use AI to summarize and group OBI conversations
    const messageTexts = messages.map(m => m.text).join('\n');
    
    // For now, return basic grouping - can enhance with AI later
    return {
      summary: `${messages.length} messages in OBI Team channel`,
      items: [
        {
          title: 'External Deployment Updates',
          details: `${messages.length} deployment-related messages tracked`
        }
      ]
    };
  },

  async generateEODSection(date) {
    try {
      // Get all EOD updates for the day
      const query = `
        SELECT 
          user_id,
          morning_response_text,
          planning_details,
          task_details,
          reddit_details
        FROM daily_checkins
        WHERE date = $1
          AND morning_response_text IS NOT NULL
        ORDER BY morning_response_at ASC
      `;
      
      const result = await db.query(query, [date]);
      const eodUpdates = result.rows;
      
      if (eodUpdates.length === 0) {
        return { summary: 'No EOD updates today', items: [] };
      }
      
      // Get team member names
      const teamQuery = `
        SELECT user_id, display_name, real_name
        FROM team_members
        WHERE user_id = ANY($1)
      `;
      
      const userIds = eodUpdates.map(u => u.user_id);
      const teamResult = await db.query(teamQuery, [userIds]);
      const teamMembers = teamResult.rows;
      
      const items = eodUpdates.map(update => {
        const member = teamMembers.find(m => m.user_id === update.user_id);
        const name = member?.display_name || member?.real_name || update.user_id;
        
        return {
          user: name,
          userId: update.user_id,
          update: update.morning_response_text,
          planning: update.planning_details,
          tasks: update.task_details,
          reddit: update.reddit_details
        };
      });
      
      return {
        summary: `${eodUpdates.length} team members provided EOD updates`,
        items: items
      };
    } catch (error) {
      console.error('Error generating EOD section:', error);
      return { summary: 'Error fetching EOD updates', items: [] };
    }
  },

  buildSummaryBlocks(date, jibbleReport, obiReport, eodReport) {
    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `📊 Daily Summary - ${date}`,
          emoji: true
        }
      },
      {
        type: 'divider'
      }
    ];

    // Jibble Attendance Section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*⏰ Jibble Attendance Report*\n${jibbleReport.length} team members tracked`
      }
    });

    jibbleReport.forEach(member => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${member.user}*\n• Clock In: ${member.clockIn}\n• Clock Out: ${member.clockOut}\n• Hours: ${member.hours}h | Breaks: ${member.breaks}m\n• Status: ${member.status}`
        }
      });
    });

    blocks.push({ type: 'divider' });

    // OBI Team Channel Section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🚀 OBI Team Channel Summary*\n${obiReport.summary}`
      }
    });

    if (obiReport.items && obiReport.items.length > 0) {
      obiReport.items.forEach(item => {
        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${item.title}*\n${item.details}`
          }
        });
      });
    }

    blocks.push({ type: 'divider' });

    // EOD Updates Section
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📝 EOD Updates & Action Items*\n${eodReport.summary}`
      }
    });

    if (eodReport.items && eodReport.items.length > 0) {
      eodReport.items.forEach(item => {
        let updateText = `*<@${item.userId}>*\n`;
        
        if (item.update) {
          updateText += `• Update: ${item.update.substring(0, 200)}${item.update.length > 200 ? '...' : ''}\n`;
        }
        
        if (item.tasks) {
          updateText += `• Tasks: ${item.tasks}\n`;
        }
        
        if (item.planning) {
          updateText += `• Planning: ${item.planning}\n`;
        }

        blocks.push({
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: updateText
          }
        });
      });
    }

    blocks.push({ type: 'divider' });

    // Footer
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Generated at ${new Date().toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata' })} IST`
        }
      ]
    });

    return blocks;
  },

  stop() {
    if (dailySummaryJob) {
      dailySummaryJob.stop();
      console.log('🛑 Daily summary scheduler stopped');
    }
  },

  // For testing - send immediately
  async sendNow() {
    await this.sendDailySummary();
  }
};
