import cron from 'node-cron';
import { config } from '../config/slack.js';
import { jibbleMonitor } from '../monitors/jibbleMonitor.js';
import { obiTeamMonitor } from '../monitors/obiTeamMonitor.js';
import { eodSummary } from './eodSummary.js';
import { strikeEvaluator } from './strikeEvaluator.js';
import { channelDigest } from '../ai/channelDigest.js';
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
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      
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
      
      const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const istHour = nowIST.getHours();

      // Always use IST-based date strings to avoid UTC offset issues
      const todayIST = nowIST.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // YYYY-MM-DD

      // If running before 6 AM IST, Jibble data is from yesterday (previous workday)
      const yesterdayIST = new Date(nowIST.getTime() - 24 * 60 * 60 * 1000)
        .toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const jibbleDate = istHour < 6 ? yesterdayIST : todayIST;

      const today = todayIST;
      console.log(`📅 Date: ${today} (Jibble date: ${jibbleDate}, IST hour: ${istHour})`);

      // Generate channel digests for both target + OBI channels
      console.log('📰 Generating channel digests...');
      try {
        await channelDigest.generateAndSaveDigest(config.target.channelId, today, slackClient);
        await channelDigest.generateAndSaveDigest('C08UM4WCYAZ', today, slackClient);
        console.log('✅ Channel digests saved');
      } catch (digestErr) {
        console.error('⚠️ Channel digest generation failed (non-fatal):', digestErr.message);
      }

      // Read today's strike data (evaluation runs on its own cron at 9:30 PM IST)
      console.log('⚡ Fetching strike data...');
      let strikeData = [];
      let weeklyStrikeData = [];
      try {
        strikeData = await strikeEvaluator.getTodayStrikes(jibbleDate);
        weeklyStrikeData = await strikeEvaluator.getWeeklyStrikeSummary();
        console.log(`✅ Strike data fetched: ${strikeData.length} strikes today`);
      } catch (strikeErr) {
        console.error('⚠️ Strike data fetch failed (non-fatal):', strikeErr.message);
      }
      
      // Generate all sections
      console.log('⏰ Generating Jibble section...');
      const jibbleReport = await this.generateJibbleSection(jibbleDate);
      console.log(`   Found ${jibbleReport.length} Jibble attendance records`);
      
      console.log('🚀 Generating OBI section...');
      const obiReport = await this.generateOBISection(today);
      console.log(`   OBI summary: ${obiReport.summary}`);
      
      console.log('📝 Generating EOD section...');
      const eodReport = await this.generateEODSection(today);
      console.log(`   EOD summary: ${eodReport.summary}`);
      
      // Build base Slack blocks — use jibbleDate as the report date (may be yesterday)
      const reportDate = jibbleDate;
      console.log('🔨 Building Slack blocks...');
      const baseBlocks = this.buildSummaryBlocks(reportDate, jibbleReport, obiReport, eodReport);

      // Build strike blocks (manager-only section)
      const strikeBlocks = this.buildStrikeBlocks(reportDate, strikeData, weeklyStrikeData);
      const managerBlocks = [...baseBlocks, ...strikeBlocks];

      console.log(`   Created ${baseBlocks.length} base blocks + ${strikeBlocks.length} strike blocks`);
      
      // Send to Phani Kumar (with strike section)
      console.log(`📤 Sending summary to Phani Kumar (${PHANI_KUMAR_ID})...`);
      try {
        await slackClient.chat.postMessage({
          channel: PHANI_KUMAR_ID,
          text: `Daily Summary - ${reportDate}`,
          blocks: managerBlocks,
        });
        console.log('✅ Sent to Phani Kumar');
      } catch (error) {
        console.error('❌ Error sending to Phani Kumar:', error.message);
      }
      
      // Send to Antony (with strike section)
      console.log(`📤 Sending summary to Antony (${ANTONY_ID})...`);
      try {
        await slackClient.chat.postMessage({
          channel: ANTONY_ID,
          text: `Daily Summary - ${reportDate}`,
          blocks: managerBlocks,
        });
        console.log('✅ Sent to Antony');
      } catch (error) {
        console.error('❌ Error sending to Antony:', error.message);
      }
      
      console.log('✅ Daily summary sending complete');
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
      // timestamp column is Slack epoch TEXT (e.g. "1741234567.123456"), use to_timestamp()
      const query = `
        SELECT * FROM messages
        WHERE channel_id = 'C08UM4WCYAZ'
          AND DATE(to_timestamp(timestamp::double precision) AT TIME ZONE 'Asia/Kolkata') = $1::date
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
    try {
      // Compile messages for AI analysis
      const messageTexts = messages.map((m, i) => 
        `[${i + 1}] ${m.text}`
      ).join('\n');
      
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const prompt = `You are analyzing messages from the OBI Team external deployment channel. Summarize the key activities, identify any issues or blockers, and highlight important updates.

Messages:
${messageTexts}

Provide:
1. **Summary**: Brief overview of OBI Team activity
2. **Key Updates**: Important deployment updates or changes
3. **Issues**: Any problems, blockers, or concerns mentioned
4. **Action Items**: Things that need follow-up

Format as JSON:
{
  "summary": "brief overview",
  "keyUpdates": ["update 1", "update 2", ...],
  "issues": ["issue 1", "issue 2", ...],
  "actionItems": ["action 1", "action 2", ...]
}`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are analyzing external team communications for a project manager.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 800
      });
      
      const rawObi = response.choices[0].message.content.trim()
        .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const analysis = JSON.parse(rawObi);
      
      const items = [];
      if (analysis.keyUpdates && analysis.keyUpdates.length > 0) {
        items.push({
          title: '📢 Key Updates',
          details: analysis.keyUpdates.join('\n• ')
        });
      }
      if (analysis.issues && analysis.issues.length > 0) {
        items.push({
          title: '⚠️ Issues & Blockers',
          details: analysis.issues.join('\n• ')
        });
      }
      if (analysis.actionItems && analysis.actionItems.length > 0) {
        items.push({
          title: '✅ Action Items',
          details: analysis.actionItems.join('\n• ')
        });
      }
      
      return {
        summary: analysis.summary || `${messages.length} messages in OBI Team channel`,
        items: items
      };
      
    } catch (error) {
      console.error('Error analyzing OBI conversations:', error);
      return {
        summary: `${messages.length} messages in OBI Team channel`,
        items: [
          {
            title: 'External Deployment Updates',
            details: `${messages.length} deployment-related messages tracked`
          }
        ]
      };
    }
  },

  async generateEODSection(date) {
    try {
      // Query actual EOD messages from the messages table for the target channel
      // EOD updates are messages containing Purpose/Process/Payoff or "Update:" patterns
      // timestamp is Slack epoch TEXT, convert with to_timestamp()
      const query = `
        SELECT DISTINCT ON (user_id)
          user_id,
          text,
          timestamp
        FROM messages
        WHERE channel_id = $2
          AND DATE(to_timestamp(timestamp::double precision) AT TIME ZONE 'Asia/Kolkata') = $1::date
          AND thread_ts IS NULL
          AND (
            text ILIKE '%purpose%'
            OR text ILIKE '%process%'
            OR text ILIKE '%payoff%'
            OR text ILIKE '%update:%'
            OR text ILIKE '%today%tasks%'
            OR text ILIKE '%eod%'
          )
          AND LENGTH(text) > 50
        ORDER BY user_id, timestamp DESC
      `;

      const result = await db.query(query, [date, config.target.channelId]);
      const eodMessages = result.rows;

      if (eodMessages.length === 0) {
        return { summary: 'No EOD updates today', items: [], redFlags: [], analysis: 'No updates to analyze' };
      }

      // Get team member names
      const teamQuery = `
        SELECT user_id, display_name, real_name
        FROM team_members
        WHERE user_id = ANY($1)
      `;

      const userIds = eodMessages.map(u => u.user_id);
      const teamResult = await db.query(teamQuery, [userIds]);
      const teamMembers = teamResult.rows;

      const { eodDetector } = await import('../utils/eodDetector.js');

      const items = eodMessages.map(msg => {
        const member = teamMembers.find(m => m.user_id === msg.user_id);
        const name = member?.display_name || member?.real_name || msg.user_id;
        const eodData = eodDetector.extractUpdateComponents(msg.text);

        return {
          user: name,
          userId: msg.user_id,
          update: msg.text,
          purpose: eodData?.purpose || null,
          process: eodData?.process || null,
          payoff: eodData?.payoff || null,
        };
      });
      
      // Use AI to analyze EOD updates for red flags and insights
      const analysis = await this.analyzeEODUpdates(items);
      
      return {
        summary: `${items.length} team members provided EOD updates`,
        items: items,
        redFlags: analysis.redFlags,
        insights: analysis.insights,
        analysis: analysis.summary
      };
    } catch (error) {
      console.error('Error generating EOD section:', error);
      return { summary: 'Error fetching EOD updates', items: [], redFlags: [], analysis: 'Error analyzing updates' };
    }
  },

  async analyzeEODUpdates(updates) {
    try {
      // Compile all updates into a single text for AI analysis
      const updatesText = updates.map(u => 
        `${u.user}: ${u.update || ''}`
      ).join('\n\n');
      
      const { OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const prompt = `You are analyzing end-of-day updates from a software development team. Your job is to identify red flags, potential delays, blockers, and ambiguities.

Team Updates:
${updatesText}

Analyze these updates and provide:
1. **Red Flags**: Any blockers, delays, unclear requirements, or concerning patterns
2. **Insights**: Key observations about team progress and coordination
3. **Summary**: A brief executive summary highlighting what needs attention

Format your response as JSON:
{
  "redFlags": ["flag 1", "flag 2", ...],
  "insights": ["insight 1", "insight 2", ...],
  "summary": "brief executive summary"
}

Focus on:
- Blockers or dependencies mentioned
- Vague or ambiguous language ("might", "trying to", "not sure")
- Delays or timeline concerns
- Missing information or incomplete updates
- Coordination issues between team members
- Repeated problems or patterns`;

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a technical project manager analyzing team updates for risks and insights.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      });
      
      // Strip markdown code fences if present before parsing
      const raw = response.choices[0].message.content.trim()
        .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      const analysis = JSON.parse(raw);
      return analysis;
      
    } catch (error) {
      console.error('Error analyzing EOD updates with AI:', error);
      return {
        redFlags: [],
        insights: ['Unable to generate AI analysis'],
        summary: 'AI analysis unavailable'
      };
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

    // EOD Updates Section with AI Analysis
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📝 EOD Updates & Analysis*\n${eodReport.summary}`
      }
    });

    // Add AI Analysis Summary
    if (eodReport.analysis) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🔍 Executive Summary*\n${eodReport.analysis}`
        }
      });
    }

    // Add Red Flags if any
    if (eodReport.redFlags && eodReport.redFlags.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*🚨 Red Flags & Concerns*\n${eodReport.redFlags.map(flag => `• ${flag}`).join('\n')}`
        }
      });
    }

    // Add Insights
    if (eodReport.insights && eodReport.insights.length > 0) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*💡 Key Insights*\n${eodReport.insights.map(insight => `• ${insight}`).join('\n')}`
        }
      });
    }

    blocks.push({ type: 'divider' });

    // Individual EOD Updates — structured summary only, no raw text
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📝 EOD Updates & Action Items*\n${eodReport.summary}`
      }
    });

    if (eodReport.items && eodReport.items.length > 0) {
      eodReport.items.forEach(item => {
        const lines = [`*<@${item.userId}>*`];
        if (item.purpose) lines.push(`• *Purpose:* ${item.purpose.substring(0, 120)}${item.purpose.length > 120 ? '...' : ''}`);
        if (item.process) lines.push(`• *Process:* ${item.process.substring(0, 120)}${item.process.length > 120 ? '...' : ''}`);
        if (item.payoff) lines.push(`• *Payoff:* ${item.payoff.substring(0, 120)}${item.payoff.length > 120 ? '...' : ''}`);
        // Fallback if no structured fields parsed
        if (!item.purpose && !item.process && !item.payoff && item.update) {
          lines.push(`• ${item.update.substring(0, 150)}${item.update.length > 150 ? '...' : ''}`);
        }
        blocks.push({
          type: 'section',
          text: { type: 'mrkdwn', text: lines.join('\n') }
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

  buildStrikeBlocks(date, todayStrikes, weeklyData) {
    const blocks = [];

    blocks.push({ type: 'divider' });
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*⚡ Strike Report — ${date}*\n_Confidential: visible only to Antony and Phani_`
      }
    });

    // Today's strikes grouped by user
    if (todayStrikes.length === 0) {
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: '✅ No strikes today' }
      });
    } else {
      const byUser = {};
      for (const row of todayStrikes) {
        const key = row.user_id;
        if (!byUser[key]) {
          byUser[key] = {
            name: row.display_name || row.real_name || row.user_id,
            userId: row.user_id,
            strikes: []
          };
        }
        byUser[key].strikes.push(`${this._strikeLabel(row.strike_type)}: ${row.details || ''}`);
      }

      let todayText = '*Today\'s Strikes:*\n';
      for (const { name, userId, strikes } of Object.values(byUser)) {
        todayText += `• *${name}* (<@${userId}>) — ${strikes.length} strike${strikes.length > 1 ? 's' : ''}\n`;
        strikes.forEach(s => { todayText += `  _${s}_\n`; });
      }

      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: todayText }
      });
    }

    // Weekly totals
    if (weeklyData && weeklyData.length > 0) {
      let weeklyText = '*Weekly Totals (this week):*\n';
      for (const row of weeklyData) {
        const name = row.display_name || row.real_name || row.user_id;
        const breakdown = row.strike_breakdown ? JSON.parse(row.strike_breakdown) : {};
        const breakdownStr = Object.entries(breakdown)
          .map(([type, count]) => `${this._strikeLabel(type)}: ${count}`)
          .join(', ');
        const flag = row.escalated ? ' ⚠️ *ESCALATED*' : '';
        weeklyText += `• *${name}*: ${row.total_strikes} strike${row.total_strikes !== 1 ? 's' : ''}${flag}`;
        if (breakdownStr) weeklyText += ` _(${breakdownStr})_`;
        weeklyText += '\n';
      }

      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: weeklyText }
      });
    }

    return blocks;
  },

  _strikeLabel(type) {
    const labels = {
      no_eod: 'No EOD',
      low_quality: 'Low quality EOD',
      short_hours: 'Short hours (<8h)',
      overdue_tasks: 'Overdue ClickUp tasks',
      no_checkin: 'No morning check-in',
    };
    return labels[type] || type;
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
